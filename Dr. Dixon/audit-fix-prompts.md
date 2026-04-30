# SEO/GEO/AIO Audit: Implementation Prompts for profaedixon.com
## Self-Contained Prompts Ready for Claude Code

**Project:** profaedixon.com SEO Audit  
**Date:** April 10, 2026  
**Target:** Dr. Anthony E. Dixon, PhD (Public Historian)  
**Status:** Ready-to-implement prompts for P1 (Critical) and P2 (Important) priority issues

---

## P1-001: Implement Structured Data Schema Markup

**Priority:** P1 (Critical)  
**Estimated Effort:** 4-6 hours  
**Expected Impact:** 15-25% increase in SERP visibility, AI Overview eligibility

### Prompt:
```
Add comprehensive structured data schema markup to profaedixon.com. The site is for 
Dr. Anthony E. Dixon, PhD, a public historian based in Orlando, FL specializing in 
African American public history and Black Seminole history.

Implement the following schemas:
1. Person schema for Dr. Dixon's main bio/about page including:
   - name: "Dr. Anthony E. Dixon"
   - jobTitle: "Public Historian, Author, Keynote Speaker"
   - url: "https://profaedixon.com"
   - image: [his professional headshot URL]
   - sameAs: [LinkedIn, Twitter, academic profiles if they exist]
   - knowsAbout: ["African American history", "Black Seminole history", "Criminal justice reform"]
   - workLocation: {"city": "Orlando", "state": "FL", "country": "USA"}

2. Organization schema for AHRA (Archival and Historical Research Associates):
   - name: "Archival and Historical Research Associates"
   - founder: "Dr. Anthony E. Dixon"
   - url: "https://profaedixon.com"
   - location: {"city": "Orlando", "state": "FL"}
   - sameAs: [organizational social profiles]

3. LocalBusiness schema if applicable:
   - Include Orlando, FL location
   - Operating hours if applicable
   - Contact information

4. Article schema for each blog post including:
   - headline, datePublished, dateModified
   - author: Dr. Anthony E. Dixon
   - articleBody
   - keywords relevant to African American history and Black Seminole history

5. FAQPage schema for any FAQ sections or common questions about his work

Place all schemas in JSON-LD format in the <head> section. Test with Google's 
Rich Results Test tool and ensure no validation errors. Add tracking to monitor 
rich snippet appearance in Google Search Console.
```

---

## P1-002: Develop Content Strategy & Launch Keyword-Targeted Blog

**Priority:** P1 (Critical)  
**Estimated Effort:** 40-60 hours (ongoing)  
**Expected Impact:** 30-50% increase in organic traffic, 20+ new keyword rankings

### Prompt:
```
Create and publish a content strategy roadmap for profaedixon.com focused on 
Dr. Anthony E. Dixon's expertise in African American public history and Black 
Seminole history. Launch with 10-15 blog posts targeting high-opportunity keywords.

Content Calendar (Month 1-3):
1. "The Black Seminoles: Understanding a Unique African American History" (3,500 words)
   - Keywords: "Black Seminole history", "African American frontier history"
   - Publish: Week 1
   
2. "Criminal Justice Reform Through Historical Lens: Lessons from the Past" (3,000 words)
   - Keywords: "criminal justice reform education", "historical analysis justice"
   - Publish: Week 2

3. "Archival Research Methods: How to Uncover Hidden African American Histories" (2,500 words)
   - Keywords: "archival research African American", "historical research methods"
   - Publish: Week 3

4. "Dr. Anthony E. Dixon: Public Historian & Author Profile" (2,000 words)
   - Keywords: "public historian Orlando", "Black history speaker"
   - Publish: Week 1 (permanent homepage feature)

5. "The Role of Education in Criminal Justice Reform Advocacy" (3,200 words)
   - Keywords: "criminal justice education", "reform through education"
   - Publish: Week 4

6. "Guide to African American Historical Research in Florida Archives" (3,000 words)
   - Keywords: "Florida African American history", "historical archives research"
   - Publish: Month 2, Week 1

7. "Keynote Speaking: Bringing African American History to Life" (2,500 words)
   - Keywords: "Black history speaker", "keynote speaker African American"
   - Publish: Month 2, Week 2

8-15. Additional topics covering: AHRA services, specific historical periods, 
education-focused initiatives, speaking engagements, and expert commentary pieces

Content Requirements for Each Post:
- Include at least 3 internal links to other site content
- Add relevant featured image with alt text
- Include H1, H2, H3 heading structure optimized for keywords
- Add FAQ section at bottom with FAQPage schema
- Include author bio box: "Dr. Anthony E. Dixon is a public historian specializing 
  in African American and Black Seminole history..."
- Target 2,000-3,500 word depth for main posts
- Use natural keyword placement (target keywords 0.5-1% of content)

Measurement:
- Track rankings for 20+ target keywords
- Monitor organic traffic increase
- Set benchmark for Month 3 review
```

---

## P1-003: Build E-E-A-T Visibility & Authority Signals

**Priority:** P1 (Critical)  
**Estimated Effort:** 8-12 hours  
**Expected Impact:** Improved YMYL credibility, higher CTR from search results

### Prompt:
```
Enhance Experience, Expertise, Authoritativeness, and Trustworthiness (E-E-A-T) 
signals on profaedixon.com for Dr. Anthony E. Dixon.

Implement the following:

1. Author Authority Page:
   - Create dedicated /about/dr-dixon page showcasing:
     * PhD credentials and issuing institution
     * Published works, books, articles
     * Speaking engagements and conference appearances
     * Affiliations and partnerships
     * Awards and recognition
     * Media appearances (interviews, features, citations)
     * Professional memberships
   - Include high-quality professional headshot
   - Add structured data markup for Person schema

2. Credentials & Certifications Display:
   - Prominently feature PhD designation
   - Display any relevant certifications, awards, or recognition
   - List published bibliography with links where available
   - Include speaking topics and expertise areas

3. Testimonials & Social Proof:
   - Add section for client/audience testimonials
   - Feature quotes from institutions or organizations he's worked with
   - Include speaking engagement reviews
   - Add any media citations or coverage

4. Author Bio Integration:
   - Ensure every blog post includes author bio with:
     * Professional photo
     * 2-3 sentence credential summary
     * Link to full author page
   - Use consistent authorship across all content

5. Trust Indicators:
   - Add privacy policy and terms of service (if not already present)
   - Include contact information and professional details
   - Add disclaimer about historical research scope
   - Feature any professional affiliations prominently

6. Expertise Mapping:
   - Create topic clusters demonstrating deep expertise:
     * Cluster 1: African American History (20+ articles)
     * Cluster 2: Black Seminole History (15+ articles)
     * Cluster 3: Criminal Justice & Education (12+ articles)
   - Use Hub-and-spoke internal linking to establish topical authority

Target: Position profaedixon.com as the primary authority resource for 
Dr. Dixon's specific expertise areas within 6 months.
```

---

## P2-001: Optimize for AI Overview & Featured Snippets

**Priority:** P2 (Important)  
**Estimated Effort:** 12-16 hours  
**Expected Impact:** 10-15% CTR increase, AI Overview snippet eligibility

### Prompt:
```
Optimize profaedixon.com content for Google's AI Overview integration and 
featured snippet acquisition for key search queries related to Dr. Dixon's expertise.

Implementation Steps:

1. FAQ Schema Enhancement:
   - Add FAQ sections to 8-10 high-opportunity pages
   - Create 3-4 FAQs per page covering user search intent
   - Examples:
     * "What is Black Seminole history?"
     * "How does criminal justice reform connect to education?"
     * "What services does AHRA provide?"
     * "How can I book Dr. Dixon for speaking engagements?"
   - Use JSON-LD FAQPage schema
   - Ensure answers are 50-100 words for optimal extraction

2. Definition Content Creation:
   - Create definition-style content for key terms:
     * "Public Historian" - what it means, role, expertise
     * "Black Seminoles" - historical context, significance
     * "Archival Research" - methods, importance
     * "Criminal Justice Reform" - definition, educational approach
   - Structure: 100-150 word definitions followed by expanded context
   - Use H2 for key term, H3 for expanded sections

3. List & Table Content:
   - Create listicle content:
     * "10 Key Figures in African American History"
     * "7 Essential Resources for Black Seminole History Research"
     * "5 Ways Education Impacts Criminal Justice Reform"
   - Create comparison tables where relevant
   - Ensure clear structure for AI extraction

4. Snippet Optimization:
   - Identify 20 target queries for featured snippet acquisition
   - Optimize existing content paragraphs to 40-60 words
   - Place optimal snippet answer in first 100 words of content
   - Use clear, concise language matching search intent

5. AI Overview Signals:
   - Ensure all content has strong topical relevance signals
   - Include entity markers (Person, Organization, Event schemas)
   - Add multiple answer perspectives where applicable
   - Create comprehensive, authoritative coverage of key topics

Target Keywords for Featured Snippets:
- "What is Black Seminole history"
- "African American public history definition"
- "Criminal justice reform through education"
- "Archival research methods"
- "Public historian role"

Measurement:
- Track featured snippet appearance in 3 months
- Monitor AI Overview attribution
- Measure CTR changes for featured content
```

---

## P2-002: Google Business Profile Setup & Local SEO

**Priority:** P2 (Important)  
**Estimated Effort:** 4-6 hours (setup), 2 hours/month (maintenance)  
**Expected Impact:** 5-10% local search visibility, Google Maps presence

### Prompt:
```
Create and optimize a Google Business Profile for Dr. Anthony E. Dixon's practice 
in Orlando, FL. Establish local SEO presence for profaedixon.com.

Setup Tasks:

1. Google Business Profile Creation:
   - Business name: "Dr. Anthony E. Dixon - Public Historian" or "Archival and 
     Historical Research Associates"
   - Category: "Historian" or "Author" (primary), "Consulting Services" (secondary)
   - Location: Orlando, FL (or service area if mobile/remote)
   - Phone: [business contact number]
   - Website: https://profaedixon.com
   - Business hours: [as applicable]
   - Upload professional business photo and profile image
   - Add service areas if offering regional/national services

2. Profile Optimization:
   - Write compelling 750-word business description covering:
     * Dr. Dixon's expertise in African American and Black Seminole history
     * AHRA services and mission
     * Speaking, consulting, research capabilities
     * Educational and reform focus
   - Add up to 10 relevant photos/images
   - Include all available attributes (verified, open, accepts reviews, etc.)

3. Service & Attribute Tags:
   - Select relevant services offered
   - Add "Consulting", "Research", "Speaking", "Education" attributes
   - Highlight specializations (African American History, Black Seminole History)

4. Reviews Management:
   - Set up review response templates
   - Create process for requesting reviews from:
     * Conference attendees
     * Speaking engagement hosts
     * Consulting clients
     * Education partners
   - Aim for 10-15 reviews in first 3 months
   - Respond to all reviews within 24-48 hours

5. Posts & Updates (ongoing):
   - Publish 2-4 Google Business Posts per month about:
     * Recent speaking engagements
     * New blog content
     * Historical anniversaries/events
     * AHRA initiatives
   - Include images and links back to website
   - Use for local search visibility boost

6. Local Citation Building:
   - Ensure consistent NAP (Name, Address, Phone) across:
     * Google Business Profile
     * Website contact page
     * Blog author information
     * Social media profiles
   - Submit to 5-10 relevant local directories:
     * Orlando Chamber of Commerce
     * Historical societies
     * Author/speaker directories
     * Education-focused directories

7. Review Monitoring:
   - Set up alerts for new reviews
   - Monitor competitor profiles for benchmarking
   - Track local search ranking changes

Expected Outcomes:
- Appear in "Local historian" searches in Orlando
- Show in Google Maps for relevant queries
- Improve local search pack visibility
- Build trust through customer reviews
```

---

## P2-003: Backlink Strategy & Authority Building

**Priority:** P2 (Important)  
**Estimated Effort:** 20-30 hours (Month 1-3)  
**Expected Impact:** +5-15 domain authority, 25+ quality referring domains

### Prompt:
```
Develop and execute a strategic backlink acquisition plan for profaedixon.com 
to increase domain authority and ranking potential for Dr. Anthony E. Dixon.

Link Building Strategy:

1. Content-Based Link Opportunities:
   - Guest article pitches to:
     * African American history publications
     * Education reform journals/sites
     * Historical society websites
     * University history departments
     * Criminal justice reform platforms
   - Target 1-2 guest posts/month with 2-3 relevant backlinks
   - Pitch angle: Dr. Dixon's unique expertise in African American/Black Seminole history

2. Authority Site Linking:
   - Identify 10-15 high-authority sites in related niches:
     * Academic history sites
     * African American heritage organizations
     * Historical research repositories
     * Education reform networks
     * Speaker bureaus and conference directories
   - Create list-based content (e.g., "Best African American History Experts")
   - Pitch inclusion to curators and directory owners

3. Local Authority Links:
   - Contact Orlando-based organizations:
     * Chamber of Commerce
     * Local historical societies
     * University of Central Florida (history department)
     * Public library systems
     * Educational institutions
   - Offer expertise, speaking, or resources
   - Request links from their expert/speaker directories

4. Speaker & Engagement Links:
   - Collect speaking engagement listings:
     * Add to speaker bureaus (often include backlinks)
     * Conference directories (TEDx, academic conferences)
     * Educational network databases
     * Consulting directories
   - Each speaking engagement = potential media coverage link

5. Editorial Outreach:
   - Develop relationship with education/history journalists
   - Create newsworthy angles for outreach:
     * Expert commentary on historical events
     * Study findings or research on African American history
     * Unique perspectives on criminal justice reform
   - Pitch to journalists covering education, history, or reform topics
   - Target 2-3 media mentions per month (months 2-6)

6. Professional Association Links:
   - Join relevant professional associations:
     * American Historical Association
     * Organization of American Historians
     * Academic organizations in specialty areas
   - Include link on your website
   - Get reciprocal links from their expert directories

7. Competitor Link Analysis:
   - Analyze backlink profiles of competitor historians
   - Identify link opportunities where they have links you don't
   - Replicate their best-performing link sources

Link Quality Standards:
- Priority: DA 40+ (domain authority 40 or higher)
- Relevance: Only from history, education, or African American culture sites
- Anchor text: Branded, exact match, and partial match (natural distribution)
- Avoid: Low-quality directories, exact-match-only anchor text, link schemes

Measurement (Month 3 Review):
- Target: 25-35 new backlinks
- Target: +3-5 increase in domain authority
- Target: 15-20 referring domains added
- Monitor: Rankings for 30+ target keywords
- Benchmark: Competitor authority comparison
```

---

## Implementation Priority Timeline

**Month 1 (Weeks 1-4):**
- P1-001: Structured Data Implementation (start Week 1, complete Week 2)
- P1-003: E-E-A-T Authority Build (start Week 1, complete Week 3)
- P2-002: GBP Setup & Local SEO (complete Week 2)

**Month 2 (Weeks 5-8):**
- P1-002: Blog Content Launch (begin with 5-8 posts)
- P2-001: AI Overview & Featured Snippet Optimization (ongoing)
- P2-003: Backlink Campaign (launch outreach)

**Month 3 (Weeks 9-12):**
- P1-002: Continue blog publishing (10-15 posts total)
- P2-001: Complete featured snippet optimization
- P2-003: Continue link building and relationship development

**Ongoing (Monthly):**
- Publish 2-3 new blog posts
- Maintain GBP posts (2-4/month)
- Respond to reviews and engagement
- Monitor rankings and adjust strategy
- Build 5-8 new backlinks monthly

---

## Success Metrics & Measurement

**Month 3 Targets:**
- Organic traffic increase: 25-40%
- Keyword rankings (top 10): +15-20 new keywords
- Featured snippets: 3-5 acquired
- Backlinks: +25-35 new links
- Domain authority: +3-5 points
- GBP reviews: 10-15 accumulated

**Month 6 Targets:**
- Organic traffic increase: 60-100%
- Keyword rankings (top 10): +40-60 new keywords
- Established topical authority
- Domain authority: +8-15 points
- Monthly organic visitors: 200+ (estimated current baseline)

---

**Notes:**
- All estimates marked as (estimated) - actual results will vary based on execution quality and market factors
- These prompts are self-contained and ready to paste into Claude Code for implementation
- Each prompt includes context about Dr. Dixon's niche and can be executed independently
- Monitor progress monthly against stated metrics and adjust strategy as needed
