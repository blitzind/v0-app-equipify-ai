# Gmail integration — Phase 55.5 (readiness & boundaries)

This document describes **current state**, **product boundaries** vs Resend, and **future implementation shape** for a Gmail / Google Workspace mailbox connection. It does not ship OAuth or API code in this phase unless noted elsewhere.

---

## 1. Current state (audit)

| Area | Status |
|------|--------|
| **Gmail API / Google OAuth (mailbox)** | **Not implemented.** No `GOOGLE_CLIENT_ID`, Gmail routes, or token storage for Gmail in the app. |
| **Marketing Integrations catalog** (`/integrations`) | Gmail appears as **Coming Soon** with a waitlist modal only — **no OAuth, no API calls**. |
| **Settings → Integrations** (`/settings/integrations`) | **No Gmail row** before Phase 55.5; other cards used misleading **client-only Connect toggles** (now corrected to “Coming soon” or real links). |
| **`organization_integrations` / OAuth tokens** | Used for **QuickBooks Online** only (`organization_integration_oauth_tokens`, signed state via `INTEGRATION_OAUTH_STATE_SECRET`). Pattern is **not** reused for Gmail yet. |
| **Google login** (`signInWithOAuth({ provider: "google" })` on `/login`) | **Supabase Auth** — user sign-in only. **Not** Gmail send or inbox access. |
| **Google (Gemini) for AI** | **API key**-based AI provider — unrelated to Gmail mailbox. |
| **Transactional email** | **Resend** via centralized `sendEmail()` — see `docs/EMAIL_OUTBOUND_AUDIT.md`. |

**Placeholders:** Integrations catalog entries (Gmail, Microsoft 365, etc.) are product/marketing placeholders until each ships.

**Broken (fixed in 55.5):** Gmail catalog copy implied Equipify would “send quotes, invoices, and notifications” through Gmail — conflicting with Resend. Settings Integrations **Connect** buttons toggled fake local state.

---

## 2. Product role: Gmail vs Resend

| Concern | Provider | Notes |
|---------|----------|--------|
| Signup welcome, invites, password reset (via Supabase) | Supabase / platform | Not Gmail. |
| Invoices, quotes, work-order emails, certificates, team invites, AI Ops digest, customer staff messages, etc. | **Resend** (`sendEmail()`) | **System transactional path — do not replace with Gmail** without an explicit product change. |
| **Future** “send as me” from a connected `@company.com` Gmail, thread logging, optional inbox visibility | **Gmail (future)** | User/org mailbox integration — **additive**, not a second transactional pipeline for the rows above unless deliberately scoped later. |

**Rule:** Gmail is for **connected mailbox workflows** (identity, threading, optional sync), **not** for signup, invoice, quote, invite, or other **system-critical** transactional sends in this architecture unless leadership revisits that decision.

---

## 3. OAuth readiness (when implemented)

Reuse the **same security ideas** as QuickBooks:

- **Redirect URI:** Single registered callback URL (e.g. `/api/integrations/google-mail/callback`) — exact match in Google Cloud Console.
- **State:** Signed, org-scoped payload (HMAC), short TTL — mirror `lib/integrations/oauth-state.ts` pattern with a **Gmail-specific** payload type (do not overload QuickBooks state).
- **Tokens:** **Server-only** storage (e.g. encrypted or vault-backed columns or existing oauth token table with `integration_type = gmail`) — **never** return access or refresh tokens to the client or log them.
- **Refresh:** Background refresh on 401 from Gmail API; disconnect clears stored tokens.
- **Scopes:** Minimal (e.g. `gmail.send` only for send-from-mailbox; expand deliberately if inbox read is added).
- **Disconnect:** Revoke refresh token with Google where supported, then delete rows server-side.

**If OAuth is not built:** No env vars are required; keep UI as **Coming soon** and this doc as the spec.

---

## 4. Sending behavior (future)

- Must require a **connected** Gmail integration for the org or user (TBD: org-level vs user-level).
- **Do not** route existing Resend transactional routes through Gmail in Phase 55.x unless spec’d separately.
- Log **safe metadata** only (e.g. `source`, `organizationId`, message id stub, outcome) — not bodies or tokens.
- Optionally write `communication_events` with a distinct `event_type` / metadata flag for “sent via connected Gmail” for audit.

---

## 5. Sync behavior (future stages)

Not implemented. Suggested staged roadmap:

1. **Connect account** (OAuth, token storage).
2. **Send-from-Gmail** (user-initiated, scoped).
3. **Log sent messages** (IDs / thread ids, no full body in DB unless product requires it).
4. **Optional inbound / thread sync** (heavy; privacy and storage policy required).
5. **Customer/contact matching** (heuristics on participants — later).

Broad **full inbox sync** is out of scope until architecture, retention, and compliance are defined.

---

## 6. Environment variables (when implementing Gmail OAuth)

Do **not** commit secrets. Example names only:

| Variable | Purpose |
|----------|---------|
| `GOOGLE_OAUTH_CLIENT_ID` | Google Cloud OAuth 2.0 Web client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Server-only secret |
| `GOOGLE_GMAIL_REDIRECT_URI` | Registered redirect (must match console), e.g. `https://app.example.com/api/integrations/google-mail/callback` |
| `GOOGLE_GMAIL_SCOPES` | Space-separated scopes (optional if hard-coded) |

Reuse **`INTEGRATION_OAUTH_STATE_SECRET`** (or equivalent) for signed OAuth `state`, consistent with QuickBooks.

---

## 7. Manual checks (Phase 55.5)

- [ ] `/integrations` — Gmail shows **Coming soon**; description does not claim transactional invoice/quote delivery via Gmail.
- [ ] `/settings/integrations` — No fake Connect for unsupported rows; Gmail row (if present) matches doc.
- [ ] Resend flows unchanged — send test invoice or use dev email status route.
- [ ] No OAuth tokens in browser storage or client-side logs for Gmail (N/A until built).

---

## Related

- [EMAIL_OUTBOUND_AUDIT.md](./EMAIL_OUTBOUND_AUDIT.md) — Resend paths and transactional inventory.
- [EMAIL_INFRASTRUCTURE.md](./EMAIL_INFRASTRUCTURE.md) — env and Resend checklist.
