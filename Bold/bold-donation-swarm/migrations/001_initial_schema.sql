-- ============================================================
-- BOLD Ministries Donation Funnel — Initial Schema
-- Supabase (PostgreSQL) Migration
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- DONORS — core donor records
-- ============================================================
create table public.donors (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  first_name text,
  last_name text,
  phone text,
  segment text check (segment in ('church_community', 'local_resident', 'referral', 'cold_traffic')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  first_donation_at timestamptz,
  total_donated numeric(10,2) default 0,
  donation_count integer default 0,
  is_recurring boolean default false,
  klaviyo_synced boolean default false,
  ghl_synced boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- DONATIONS — individual gift records
-- ============================================================
create table public.donations (
  id uuid primary key default uuid_generate_v4(),
  donor_id uuid not null references public.donors(id) on delete cascade,
  stripe_payment_intent_id text unique,
  stripe_customer_id text,
  amount numeric(10,2) not null,
  gift_tier integer check (gift_tier in (25, 50, 100, 250, 500, 1000)),
  is_recurring boolean default false,
  recurring_interval text check (recurring_interval in ('monthly', 'quarterly', 'annual')),
  status text default 'completed' check (status in ('pending', 'completed', 'failed', 'refunded')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz default now()
);

-- ============================================================
-- VISITORS — anonymous page visitors (A2 traffic qualifier)
-- ============================================================
create table public.visitors (
  id uuid primary key default uuid_generate_v4(),
  session_id text unique not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  segment text check (segment in ('church_community', 'local_resident', 'referral', 'cold_traffic')),
  landing_page text,
  referrer text,
  device_type text check (device_type in ('mobile', 'desktop', 'tablet')),
  started_form boolean default false,
  completed_donation boolean default false,
  abandoned_at timestamptz,
  donor_id uuid references public.donors(id),
  created_at timestamptz default now()
);

-- ============================================================
-- EVENTS — funnel event tracking (A9 analytics)
-- ============================================================
create table public.events (
  id uuid primary key default uuid_generate_v4(),
  visitor_id uuid references public.visitors(id),
  donor_id uuid references public.donors(id),
  event_type text not null,
  event_data jsonb default '{}',
  page text,
  created_at timestamptz default now()
);

-- Index for common event queries
create index idx_events_type on public.events(event_type);
create index idx_events_created on public.events(created_at);

-- ============================================================
-- COMPLAINTS — donor complaints (QC2 monitoring)
-- ============================================================
create table public.complaints (
  id uuid primary key default uuid_generate_v4(),
  donor_id uuid references public.donors(id),
  email text,
  complaint_type text,
  description text,
  status text default 'open' check (status in ('open', 'resolved', 'escalated')),
  created_at timestamptz default now()
);

-- ============================================================
-- CAMPAIGN_PROGRESS — tracks $1M goal (progress bar data)
-- ============================================================
create table public.campaign_progress (
  id uuid primary key default uuid_generate_v4(),
  total_raised numeric(12,2) not null default 342000,
  goal numeric(12,2) not null default 1000000,
  donor_count integer default 0,
  last_calculated_at timestamptz default now()
);

-- Seed initial campaign state
insert into public.campaign_progress (total_raised, goal, donor_count)
values (342000, 1000000, 0);

-- ============================================================
-- AB_VARIANTS — A/B test tracking (A9 analytics)
-- ============================================================
create table public.ab_variants (
  id uuid primary key default uuid_generate_v4(),
  test_name text not null,
  variant text not null check (variant in ('A', 'B')),
  impressions integer default 0,
  conversions integer default 0,
  total_revenue numeric(10,2) default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.donors enable row level security;
alter table public.donations enable row level security;
alter table public.visitors enable row level security;
alter table public.events enable row level security;
alter table public.complaints enable row level security;
alter table public.campaign_progress enable row level security;
alter table public.ab_variants enable row level security;

-- Anon can read campaign progress (public progress bar)
create policy "Public can read campaign progress"
  on public.campaign_progress for select
  using (true);

-- Anon can insert visitors and events (client-side tracking)
create policy "Anon can insert visitors"
  on public.visitors for insert
  with check (true);

create policy "Anon can insert events"
  on public.events for insert
  with check (true);

-- Service role has full access (server-side operations)
create policy "Service role full access donors"
  on public.donors for all
  using (auth.role() = 'service_role');

create policy "Service role full access donations"
  on public.donations for all
  using (auth.role() = 'service_role');

create policy "Service role full access visitors"
  on public.visitors for all
  using (auth.role() = 'service_role');

create policy "Service role full access events"
  on public.events for all
  using (auth.role() = 'service_role');

create policy "Service role full access complaints"
  on public.complaints for all
  using (auth.role() = 'service_role');

create policy "Service role full access campaign_progress"
  on public.campaign_progress for all
  using (auth.role() = 'service_role');

create policy "Service role full access ab_variants"
  on public.ab_variants for all
  using (auth.role() = 'service_role');

-- ============================================================
-- FUNCTIONS — auto-update donors on new donation
-- ============================================================

create or replace function public.update_donor_on_donation()
returns trigger as $$
begin
  update public.donors set
    total_donated = total_donated + NEW.amount,
    donation_count = donation_count + 1,
    first_donation_at = coalesce(first_donation_at, now()),
    is_recurring = is_recurring or NEW.is_recurring,
    updated_at = now()
  where id = NEW.donor_id;

  -- Update campaign progress
  update public.campaign_progress set
    total_raised = total_raised + NEW.amount,
    donor_count = (select count(distinct donor_id) from public.donations where status = 'completed'),
    last_calculated_at = now();

  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_donation_completed
  after insert on public.donations
  for each row
  when (NEW.status = 'completed')
  execute function public.update_donor_on_donation();
