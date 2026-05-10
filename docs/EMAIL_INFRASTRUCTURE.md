# Outbound email infrastructure (Phase 55.1)

Equipify uses **one** outbound path: [Resend](https://resend.com) via `sendEmail()` in `lib/email/resend.ts`. There is no parallel SMTP client or second mailer.

## Architecture

| Piece | Role |
|-------|------|
| `lib/email/config.ts` | **Single config surface:** env reads, `isOutboundEmailConfigured()`, `getOutboundEmailHealth()`, `getPublicAppOrigin()`, signup notify recipient. **No secrets logged or returned.** |
| `lib/email/resend.ts` | Resend SDK singleton, `sendEmail()`, structured send logging, shared `from` / default `replyTo`. |
| `lib/email/templates.ts` | HTML/text bodies (unchanged). |
| `lib/email/signup-provision-emails.ts` | Signup welcome + internal notify (calls `sendEmail`). |

**All** Resend-backed transactional sends go through `sendEmail`. The authoritative per-route list, categories, and manual matrix live in [EMAIL_OUTBOUND_AUDIT.md](./EMAIL_OUTBOUND_AUDIT.md).

### From / reply-to

- **From:** always `EMAIL_FROM_ADDRESS` (must be a Resend-verified sender).
- **Reply-To:** per-message `replyTo` on `SendEmailInput` if set; otherwise `EMAIL_REPLY_TO` when set; otherwise omitted.
- No route bypasses this; optional `replyTo` only augments the default.

### Observability

Each send emits one JSON log line:

`source: "outbound-email"`, `provider: "resend"`, `category`, `organizationId` (if provided), `recipientCount`, `ok`, `code` (on failure), `providerMessageId` (on success), `hasReplyTo`, and a **truncated** error string — **not** full bodies, attachments, tokens, or API keys.

Categories include e.g. `invoice_customer`, `team_invite`, `signup_welcome`, `ai_ops_digest`, `work_order_summary` (see call sites).

### Failure behavior

- Misconfigured env → `sendEmail` returns `{ ok: false, code: "config" }` and logs; callers map to 503 where appropriate.
- Resend API errors → `code: "provider"`, logged; callers typically return 502.
- **Onboarding provision** still returns success if email fails (Phase 54.4).
- Duplicate send storms are **not** introduced by logging; idempotency for signup remains on Auth `user_metadata` (see [SIGNUP_PROVISION_EMAILS.md](./SIGNUP_PROVISION_EMAILS.md)).

## Required environment variables

| Variable | Required to send | Notes |
|----------|------------------|--------|
| `RESEND_API_KEY` | Yes | Server only. |
| `EMAIL_FROM_ADDRESS` | Yes | e.g. `Equipify <billing@yourdomain.com>` — domain verified in Resend. |
| `EMAIL_REPLY_TO` | No | Recommended for customer replies. |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Public app URL for links (welcome, invite, digest). |
| `NEXT_PUBLIC_APP_URL` | Fallback | Used if `NEXT_PUBLIC_SITE_URL` unset. |
| `APP_URL` | Fallback | Server-only origin if public vars unset. |
| `EMAIL_SIGNUP_INTERNAL_NOTIFY` | No | Internal new-workspace alerts (default `mike@equipify.ai`). |

## Resend production checklist

1. Create API key; store as `RESEND_API_KEY` in the deployment environment (never commit).
2. Add and verify sending **domain** (SPF/DKIM per Resend docs).
3. Set `EMAIL_FROM_ADDRESS` to an address on that domain.
4. Set `EMAIL_REPLY_TO` to a monitored inbox if you want replies.
5. Set `NEXT_PUBLIC_SITE_URL` to the canonical production URL (no trailing slash required; code normalizes).
6. Send a test from staging: invoice email, invite, signup provision (with test user).

## Local development

- Without `RESEND_API_KEY` / `EMAIL_FROM_ADDRESS`, sends fail gracefully (`code: "config"`); flows like provisioning still complete where designed.
- **Dev-only** health check: `GET /api/dev/email-delivery-status` returns `{ configured, hasResendApiKey, hasFromAddress, hasReplyToDefault }` — **404 in production.**

## Future providers

Config exposes `provider: "resend"` in health metadata so a later swap can branch in `sendEmail` without scattering `process.env` reads. Do not add a second competing client without replacing this path.

## Related

- [EMAIL_OUTBOUND_AUDIT.md](./EMAIL_OUTBOUND_AUDIT.md) — **Phase 55.2** full send-path inventory, link rules, manual test matrix.
- [SIGNUP_PROVISION_EMAILS.md](./SIGNUP_PROVISION_EMAILS.md) — signup-specific idempotency and copy.
