# Launch Final Fixes

## What is already fixed in-app
- Public preview is live
- Admin account works
- Reply routing is set to `thealvindean@gmail.com`
- Live campaign sending works through Resend
- In-house billing is active
- Google OAuth is configured in the app

## Remaining external blocker
Branded sending is not live yet because the Resend domain `axistms.com` is still `not_started`.

### Why I could not finish it here
The provided Cloudflare API token is valid, but Cloudflare rejects zone access from this environment with:
- code `9109`
- message: `Cannot use the access token from location: 206.223.225.15`

That means DNS changes must be made from an allowed location or with a token that is not IP-restricted.

## Exact DNS records to add in Cloudflare for `axistms.com`
1. TXT
- Name: `resend._domainkey`
- Value: `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDU7YyvtuhoIFmBbbLbM2HUXtZ2SFk3cXCaLi7915pnqLrBK0tjTG5VbxS9toQSl3yvTWp43azPGmdoBHB13zOBxPs48cipDq3xkU6SSIm0etuM6i9qaqf8EuDW439JZWPluib8BZBUaGYBb4f7CbSlDS3iRmsw8grtKC9KwifA3QIDAQAB`
- TTL: Auto

2. MX
- Name: `send`
- Value: `feedback-smtp.us-east-1.amazonses.com`
- Priority: `10`
- TTL: Auto

3. TXT
- Name: `send`
- Value: `v=spf1 include:amazonses.com ~all`
- TTL: Auto

## After DNS is added
1. In Resend, verify `axistms.com`
2. Turn on open tracking
3. Turn on click tracking
4. Set `SENDING_FROM` in `server/.env` to a branded address, for example:
   - `SENDING_FROM="SignalIQ <hello@axistms.com>"`
5. Restart the server
6. Send one more live test email

## Recommended final production values
- `SENDING_FROM="SignalIQ <hello@axistms.com>"`
- `CAMPAIGN_REPLY_TO="thealvindean@gmail.com"`

## Nice-to-have after launch
- `RESEND_WEBHOOK_SECRET` for signed webhook verification
- Stripe keys if you want paid self-serve checkout
- SMTP fallback creds if you want a second sending path
