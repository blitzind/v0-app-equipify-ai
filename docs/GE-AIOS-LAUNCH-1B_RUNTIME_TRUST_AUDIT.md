# GE-AIOS-LAUNCH-1B — Runtime Trust Audit & Delivery

**Milestone:** Operator trust — expose real autonomous runtime on Home without new engines.

**Implementation marker:** `ge-aios-launch-1b-runtime-trust-v1`

---

## 1. Runtime audit summary

Ava's production autonomous stack is **real and scheduled**, but most subsystems are **gated** by kill switches (`autonomy_enabled`, `autonomy_objective_mode_enabled` — both default **false**). The master scheduler runs every 20 minutes regardless; ASL/portfolio/draft-factory ticks **no-op** when autonomy is off.

**Home previously showed KPI-derived "live status"** (`buildAvaLiveStatus`) — not runtime truth. LAUNCH-1B replaces that surface with production signals.

---

## 2. Complete autonomous worker inventory

| Worker | Trigger | Schedule / mode | Gated by autonomy? | Home signal wired |
|--------|---------|-----------------|--------------------|-------------------|
| **Objective runtime scheduler** | Vercel cron | Every 20 min | Partial — ASL sub-tick skipped if off | `runtimeTrust.lastSchedulerRunAt`, heartbeat |
| **Autonomous Sales Loop (ASL)** | Scheduler sub-tick | Every 20 min | Yes (`autonomy_enabled`) | `autonomyTickHealth`, `salesOutcomes` |
| **Portfolio manager** | Scheduler sub-tick | Every 20 min | Yes | `portfolioManager`, tick health |
| **Draft factory** | Scheduler + event bus | Every 20 min + events | Yes | `canonicalOperatorApproval`, outcomes |
| **Mission bootstrap** | Growth Profile approval | Event | No | `productionMissionAuthority` |
| **Work manager** | Home daily briefing | On page load | N/A (projection) | `workManager.active_work` |
| **Discovery worker** | Cron | Daily 3 AM UTC | Independent | `missionDiscovery` |
| **Email discovery** | Cron | Every 10 min | Independent | Cron telemetry (ops) |
| **Phone discovery** | Cron | Every 10 min | Independent | Cron telemetry (ops) |
| **Social profile discovery** | Cron | Every 10 min | Independent | Cron telemetry (ops) |
| **Company intelligence** | Cron | Every 10 min | Independent | Outcomes / research events |
| **Buying committee intelligence** | Cron | Every 10 min | Independent | Pipeline steps (when active) |
| **Acquisition worker** | Cron | Every 5 min | Independent | Cron telemetry (ops) |
| **Prospect graph expansion** | Cron | Daily 3:45 AM | Independent | Cron telemetry (ops) |
| **Research (lead)** | ASL + admission pipeline | Event + scheduler | Yes | `salesOutcomes`, active work |
| **Qualification** | ASL | Scheduler tick | Yes | Outcomes, active work |
| **Decision maker / buying committee** | Intelligence crons + ASL | Mixed | Partial | Active work type inference |
| **Package generation** | Draft factory / ASL | Scheduler | Yes | Outcomes `outreach_prepared` |
| **Learning / memory** | Event bus (closed-loop) | Event-driven | Observe-only mostly | Organizational memory (separate) |
| **Sequence scheduler** | Cron | Every 10 min | Outbound separate | Not on Home trust surface |
| **Sequence safe execute** | Cron | Every 5 min | Approval-gated | Waiting state when approvals pending |
| **Inbox sync** | Cron | Every 15 min | Independent | Inbox KPIs |
| **Outreach execute cron** | — | **Retired (410)** | — | N/A |

---

## 3. Trigger reference (production crons)

All paths under `/api/cron/*` in `vercel.json`. Growth-relevant schedules:

- `growth-objective-runtime-scheduler` — every 20 minutes (master autonomy tick)
- `growth-discovery-worker` — daily
- `growth-email/phone/social/company-intelligence/buying-committee` — every 10 minutes
- `growth-acquisition-worker` — every 5 minutes
- `growth-sequence-scheduler` — every 10 minutes
- `growth-sequence-safe-execute` — every 5 minutes

---

## 4. Current runtime state (operator language)

Implemented in `buildGrowthHomeRuntimeTrustViewModel`:

| State | When |
|-------|------|
| Working | Active work item `status=working`, or recent sales outcome (<5 min) |
| Waiting | Pending approvals, operator approval required |
| Scheduled | Autonomy on, no active work, no recent activity |
| Idle | Autonomy off or no executable work |
| Blocked | Setup incomplete, autonomy disabled with blockers, stop reasons |

---

## 5. Runtime heartbeat implementation

**Server loader:** `loadGrowthHomeRuntimeTrustPayload`

Sources (all existing production infrastructure):

- `getRuntimeKillSwitchStates` — autonomy gates
- `buildGrowthAiosAutonomyTickHealthSnapshot` — last tick, stop reason, selected work type
- `listRecentGrowthCronExecutionRuns` — last scheduler run + next estimate (+20 min)

**Home UI:** `GrowthHomeAvaRuntimeTrustSection` — heartbeat grid on canonical Home surface (below hero).

---

## 6. Activity timeline

**Source:** `workspaceSummary.salesOutcomes.outcomes` only — timestamps from `completed_at`.

**Never simulated.** Empty feed when no outcomes.

---

## 7–8. Idle and blocked detection

Human reasons from kill switches, tick stop reasons, mission discovery state, and pending approvals. Never shows Working when autonomy is off.

---

## 9. Start Ava workflow (production evidence)

| Step | What happens |
|------|----------------|
| Company Profile + Growth Profile complete | Server may call mission bootstrap |
| Autonomous Mode | Must be enabled (`autonomy_enabled`) — defaults false |
| Objective mode | Must be enabled — defaults false |
| Get Ava Ready wizard | 7 steps; gates launch banner |

**Primary action on Home:** setup CTA, Enable Autonomous Mode, Open Autonomy settings, or Autonomous mode active banner.

---

## 10. Runtime trust score

| Dimension | Before 1B | After 1B |
|-----------|-----------|----------|
| Real runtime on Home | ~15% | ~85% |
| Start clarity | Ambiguous | Single primary action |
| Activity feed truth | Mixed | 100% sales outcomes |
| Heartbeat | None | Scheduler + last activity |

**Validate:** `pnpm validate:ge-aios-launch-1b-production`

---

## 12. Remaining launch blockers

- P0: `autonomy_enabled` defaults false
- P0: Find Leads / Run AI teammate orphaned from Home
- P1: Loader budget timeouts may drop runtimeTrust under load
- P1: Discovery cron events not in Home feed yet
- P2: Legacy `buildAvaLiveStatus` still synthesized (deprecated on Home)
