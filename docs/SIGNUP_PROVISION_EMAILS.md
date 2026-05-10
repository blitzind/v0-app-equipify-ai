# Signup / provisioning emails (Phase 54.4)

Transactional emails sent **after** `POST /api/onboarding/provision` completes successfully (profile, org, seed path as today). They are **best-effort**: missing Resend config or provider errors **do not** fail provisioning.

## Behavior

| Email | Recipient | When |
|-------|-----------|------|
| Welcome | Signup user’s auth email | Self-serve workspace: `organizations.created_by` is the current user (skips invite/join paths). |
| Internal notify | `EMAIL_SIGNUP_INTERNAL_NOTIFY` or `mike@equipify.ai` | Same eligibility as welcome. |

## Idempotency

Per user + workspace, stored in Supabase Auth **`user_metadata`** (no DB migration):

- `signup_welcome_email_org_id` — UUID of the org the welcome was sent for  
- `signup_admin_notify_org_id` — UUID of the org the internal notify was sent for  

Provisioning retries for the **same** org do not resend. If welcome succeeds but internal notify fails, a retry sends **only** the missing one.

## Required / optional environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `RESEND_API_KEY` | To send in that environment | Resend API (server only). |
| `EMAIL_FROM_ADDRESS` | To send in that environment | From header (verified domain in Resend). |
| `EMAIL_REPLY_TO` | Optional | Reply-To on customer welcome (and other `sendEmail` uses). |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Dashboard link resolution via `getPublicAppOrigin()` (see [EMAIL_INFRASTRUCTURE.md](./EMAIL_INFRASTRUCTURE.md)). |
| `EMAIL_SIGNUP_INTERNAL_NOTIFY` | Optional | Internal recipient for new signup alerts (default: `mike@equipify.ai`). |

If `RESEND_API_KEY` or `EMAIL_FROM_ADDRESS` is unset, `sendEmail` returns a config error; provisioning still returns `ok: true` and logs `signup-provision-email` lines.

## Code

- `lib/email/config.ts` — env + `getPublicAppOrigin()` / internal notify recipient.
- `lib/email/resend.ts` — shared Resend client (`sendEmail`).
- `lib/email/signup-provision-emails.ts` — welcome + internal templates and idempotency.
- `app/api/onboarding/provision/route.ts` — invokes emails after successful provision.

## Non-goals

- Supabase Auth confirmation / magic-link templates (still managed in Supabase Dashboard).
- Invite-accept welcome (separate product decision).
- Marketing drips.

## Related

- [EMAIL_INFRASTRUCTURE.md](./EMAIL_INFRASTRUCTURE.md) — Resend setup, logging, and env vars for all transactional email.
