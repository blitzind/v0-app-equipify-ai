# GE-AI-UX-3B — AI Teammate Server-Side Identity Persistence

**Phase:** GE-AI-UX-3B  
**Scope:** Server persistence for AI teammate identity — no autonomy, runtime, outbound, or event bus changes.  
**Certification:** `pnpm test:ge-ai-ux-3b-ai-teammate-server-identity`  
**Migration:** `supabase/migrations/20270829120000_growth_organization_ai_teammate_identity_3b.sql` (not applied to production in this phase)

---

## Persistence audit

| Pattern | Table / File | Scope | Reuse strategy |
| ------- | ------------ | ----- | -------------- |
| Organization autonomy | `growth.organization_autonomy_settings` | Organization | Reference only — separate domain |
| Operator workspace prefs | `growth.operator_workspace_preferences` | User | **Extended** — `ai_teammate_onboarding_completed` column |
| Organization AI teammate | `growth.organization_ai_teammate_identity` | Organization | **New** — shared teammate name |
| Workspace settings API access | `requireGrowthWorkspaceSettingsAccess` | User + org context | **Reused** for auth |
| UX-3A localStorage | `equipify:ai-os:teammate-identity/v1` | Client | **Optimistic cache / offline fallback** |

No duplicate preference system — follows Phase 8B Growth workspace settings patterns.

---

## Canonical identity model

```typescript
type AiTeammateIdentity = {
  organizationId: string | null
  name: string
  role: "Your AI Revenue Operator"
  source: "default" | "organization"
  onboardingCompleted: boolean
  updatedByUserId?: string | null
  updatedAt?: string | null
}
```

- **Name:** organization-scoped (shared across operators in the Growth org)
- **Onboarding:** user-scoped via `operator_workspace_preferences.ai_teammate_onboarding_completed`
- **Role:** read-only in API responses — never stored as editable
- **User override:** deferred — org name only in 3B

---

## API

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/growth/workspace/settings/ai-teammate` | Load effective identity |
| PATCH | `/api/growth/workspace/settings/ai-teammate` | Update `{ name?, onboardingCompleted? }` |

Validation: 2–32 characters; letters, numbers, spaces, hyphen, apostrophe; invalid → fallback to Ava on read, 400 on write.

---

## Client behavior

1. Provider reads **localStorage** for instant hydration
2. Fetches **server identity** on mount
3. Server wins when available; localStorage updated as cache
4. On save/onboarding complete → PATCH server + update cache
5. On server failure → local/default Ava with error surfaced in Settings

---

## Files

| Layer | Path |
| ----- | ---- |
| Migration | `supabase/migrations/20270829120000_growth_organization_ai_teammate_identity_3b.sql` |
| Types | `lib/growth/settings/growth-ai-teammate-identity-types.ts` |
| Repository | `lib/growth/settings/growth-ai-teammate-identity-repository.ts` |
| Service | `lib/growth/settings/growth-ai-teammate-identity-service.ts` |
| Client | `lib/growth/settings/growth-ai-teammate-identity-client.ts` |
| API | `app/api/growth/workspace/settings/ai-teammate/route.ts` |
| Provider | `components/growth/ai-teammate/ai-teammate-identity-provider.tsx` |
| Settings | `components/growth/settings/growth-ai-teammate-settings-panel.tsx` |

---

*GE-AI-UX-3B — complete locally (not committed, migration not applied to production).*
