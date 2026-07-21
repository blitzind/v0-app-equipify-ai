# GE-AIOS-LAUNCH-1C — Ava Activation & First-Day Experience

**Marker:** `ge-aios-launch-1c-ava-activation-v1`

---

## 1. Activation lifecycle

```
Create Workspace
  → Meet Ava (AI teammate onboarding)
  → Approve Growth Profile
  → Create acquisition mission + bind lead source (DataMoon)
  → Connect mailbox + approval guardrails
  → [Optional] Calendar/booking
  → Activate Ava (ONE operator action)
  → Autonomous discovery → research → qualification → package → operator review
```

**Where Ava becomes autonomous:** On **Activate Ava** — sets `autonomy_enabled` + `autonomy_objective_mode_enabled` and records `autonomous_activated_at`.

Before 1C: operators had to find Autonomy settings and toggle two kill switches separately.

---

## 2. Required operator actions (after 1C)

| Phase | Actions |
|-------|---------|
| Onboarding (unchanged) | Meet Ava, Growth Profile, mission, lead source, mailbox, guardrails |
| **Activation (NEW — one click)** | **Activate Ava** on Home |
| Ongoing | Review packages when waiting; optional calendar |

---

## 3. One-time activation (architecture preserved)

**Can consolidate?** Yes — without new schedulers.

`POST /api/growth/workspace/ava/activate` calls existing:
- `setRuntimeKillSwitch(autonomy_enabled)`
- `setRuntimeKillSwitch(autonomy_objective_mode_enabled)`
- `setOrganizationAiTeammateAutonomousActivation()`

Validates Get Ava Ready gates via `evaluateGrowthAvaActivationReadiness()`.

---

## 4. Activation experience

`GrowthHomeAvaActivationSection` — dedicated screen when setup complete but not activated:
- "Ava is ready" copy
- Capability promises (discover, research, packages, background work, no send without approval)
- Single **[ Activate Ava ]** button

---

## 5. Employee mode (post-activation)

Home transitions permanently:
- Hides: Get Ava Ready wizard, setup CTAs, first-week guide, launch banner
- Shows: Employee runtime trust with active-since, employment stats, current assignment, accomplishments feed
- Language: "I'm working for you" not "configure autonomy"

---

## 6. Lifetime statistics

From existing production read models (`buildGrowthAvaEmploymentStats`):
- Active since / days active
- Companies researched (sales outcomes)
- Opportunities prepared
- Approvals completed / companies rejected (organizational effectiveness baseline)
- Autonomous minutes today (runtime budget)
- Discovery cycles today (mission discovery proxy)

Stored: `growth.organization_ai_teammate_identity.autonomous_activated_at`

---

## 7. Operator confusion removed

| Before | After |
|--------|-------|
| Enable Autonomous Mode → settings | Activate Ava → one button |
| Objective mode separate toggle | Included in activation |
| Run AI teammate (Find Leads) | Not required for autonomous path |
| Get Ava Ready post-complete CTA to Find Leads | Activation screen replaces |

Find Leads / Run AI teammate remain for manual ops but are **not** on the primary Home activation path.

---

## 8. Production validation

```bash
pnpm test:ge-aios-launch-1c-activation
pnpm validate:ge-aios-launch-1c-production
```

---

## 9. Remaining launch blockers

- Migration `20270721190000_growth_ava_autonomous_activation_1c.sql` must be applied in production
- Equipify org already has autonomy on — backfills `activated_at` from profile approval until explicit activation recorded
- Discovery cron events still not in activity feed (1B gap)
- `GrowthAutonomyStatusBanner` in everythingElse still engineering-facing (P2)

---

## Files

| File | Purpose |
|------|---------|
| `lib/growth/ava-activation/*` | Activation service, readiness, employment stats |
| `app/api/growth/workspace/ava/activate/route.ts` | Activate API |
| `components/.../growth-home-ava-activation-section.tsx` | Activation UI |
| `supabase/migrations/20270721190000_growth_ava_autonomous_activation_1c.sql` | Activation timestamp |
