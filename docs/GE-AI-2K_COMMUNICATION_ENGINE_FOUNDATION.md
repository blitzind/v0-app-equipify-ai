# GE-AI-2K — Communication Engine Foundation

**Phase:** GE-AI-2K  
**Status:** Complete locally (not committed)  
**QA marker:** `growth-ge-ai-2k-communication-engine-v1`

## Objective

Introduce a read-only **Communication Engine** that produces structured `GrowthCommunicationPlan` artifacts for channel strategy. The engine plans and ranks channels — it does **not** send, schedule, mutate Core, or bypass Growth Autonomy or approval gates.

## Architectural position

```
Meta-Recommender / Priority Binding / lead data / autonomy policy
        ↓
Communication Engine (read-only planning)
        ↓
Consumers: Outreach Preparation · Bounded Outbound read model · Human Approval Center · AI Operations
        ↓
Existing transports (unchanged): sequence jobs · SMS · voice · SENDR · LinkedIn manual tasks
```

## Communication / channel audit matrix

| Existing System | Current Communication Role | Channel(s) | Current Decision Logic | Reuse Strategy |
| --- | --- | --- | --- | --- |
| Email sequence runtime | Executes approved sequence jobs | email | Step order, approval gate, sender readiness | Transport only — plan recommends email steps |
| SMS sequence runtime | Executes approved SMS jobs | sms | Same gate matrix as email | Transport only — plan recommends SMS steps |
| Voice Drop runtime | Executes certified voice drops | voice_drop | Certification + autonomy + scope channel | Plan blocks until certified; transport unchanged |
| AI Voice runtime | Outbound AI voice sessions | ai_voice | Explicit approval + pending session queue | Plan blocks unless `aiVoiceExplicitlyAllowed` |
| LinkedIn manual tasks | Cadence task creation | linkedin_manual | Always manual operator execution | Plan emits `create_linkedin_task` only |
| SENDR / personalized video | Draft preview + queue on approval | video, sendr | Human approval + SENDR readiness | Plan recommends step; no send |
| Outreach Preparation Agent | Draft packages per lead | email, sms, linkedin, sendr | Previously hardcoded `email` | Consumes plan for `recommendedChannel` |
| Meeting Preparation Agent | Brief after outreach | n/a | Waits on outreach completion | Unchanged — downstream of outreach |
| Automation runtime (GE-V1.5) | Prepared action inbox | mixed | Rule + human approval inbox | Unchanged — separate approval surface |
| Sequence builders | Define cadence templates | mixed | Operator-authored step order | Plan informs strategy; builders unchanged |
| Channel capability flags | Autonomy + scope allowed channels | all | Growth Autonomy kill switches | Input to Communication Engine policy layer |
| Sender readiness / deliverability | Gate before send | email, sms | Readiness checks in outbound gates | Input context; no duplicate checks in transport |
| Suppression / opt-out | Hard block | all | Suppression lists + opt-out flags | Engine → `do_not_contact` when blocked |
| Reply intelligence | Stop / pivot signals | email, sms | Stop conditions on scopes + conversation events | Engine `wait` / goal shift on positive intent |
| Engagement scoring | Prioritization hints | email, sms, video | Meta-recommender + pilot confidence | Weight in deterministic ranking formula |
| Human execution queues | Operator task backlog | manual | Queue status | Route hints only |
| Growth Autonomy channel gates | Policy enforcement | outbound channels | Kill switches + capabilities | Engine excludes blocked channels |
| Bounded outbound gate engine (2I) | 14-gate execution envelope | email, sms, voice, video, linkedin | Scope + consumption + stop conditions | Consumes plan summary; `resolveBoundedOutboundActionFromPlan` respects gates |

## Communication plan model

Canonical type: `GrowthCommunicationPlan` in `lib/growth/aios/communication/growth-communication-engine-types.ts`.

Key fields:

- `subject`, `goal`, `recommendedStrategy`
- `steps[]` — channel, actionType, timing, approval flags, requiredChecks, fallbackIfBlocked
- `fallbackStrategy[]`, `stopConditions`, `policy`, `evidence[]`, `confidence`, `routeHints[]`

## Ranking logic

Deterministic formula (client-safe engine):

```
channelScore = engagementWeight × 0.30 + readinessWeight × 0.25 + policyWeight × 0.25 + signalWeight × 0.20
```

Tie-break: channel name ascending.

Strategy resolution:

- Suppression/opt-out → `do_not_contact`
- Emergency stop / negative intent → `human_review`
- Positive intent / meeting booked → `wait`
- Top channel → `email_first` | `sms_first` | `call_first` | `video_first`
- Email+SMS within 5 points → `multi_touch`

## Fallback / escalation model

- Each step may define `fallbackIfBlocked` → next step number
- `fallbackStrategy` records blocked / no_reply / low_engagement paths
- Final step escalates to `request_human_review`
- Bounded outbound uses `resolveBoundedOutboundActionFromPlan` — never bypasses gate engine

## Channel policy rules

| Rule | Behavior |
| --- | --- |
| Suppression / opt-out | All channels blocked → `do_not_contact` |
| AI Voice | Blocked unless `aiVoiceExplicitlyAllowed` |
| Voice drop | Blocked unless `voiceDropCertified` |
| Scope channels | Channels outside scope `allowedChannels` blocked |
| Autonomy outbound off | Outbound-eligible channels blocked |
| Sender readiness | Email/SMS blocked when readiness false |
| Quiet hours | Step 1 timing → `delay` 8h |
| LinkedIn | Always `create_linkedin_task` — manual only |

## Integrations

| Consumer | Integration |
| --- | --- |
| AI Operations Command Center | `communicationEngine` read model + UI section |
| GET API | `/api/platform/growth/ai-os/communication-plan` |
| Bounded Autonomous Outbound | `communicationPlanSummary` on each scope row |
| Outreach Preparation | `requestGrowthCommunicationPlan` → `recommendedChannel` |
| Human Approval Center | Plan context evidence on outbound scope items |
| Event bus (2B) | `growth.communication.plan_generated` (non-mutating) |

## Files changed

| Path | Role |
| --- | --- |
| `lib/growth/aios/communication/growth-communication-engine-types.ts` | Canonical types |
| `lib/growth/aios/communication/growth-communication-engine-engine.ts` | Deterministic planner |
| `lib/growth/aios/communication/growth-communication-engine-service.ts` | Server read service + event publish |
| `lib/growth/aios/outbound/growth-autonomous-outbound-scope-types.ts` | Scope row plan summary |
| `lib/growth/aios/outbound/growth-autonomous-outbound-scope-engine.ts` | Plan resolution per scope |
| `lib/growth/aios/ai-os-command-center-types.ts` | Read model field |
| `lib/growth/aios/ai-os-command-center-service.ts` | Build + publish |
| `lib/growth/aios/approvals/growth-human-approval-center-engine.ts` | Plan evidence |
| `lib/growth/aios/approvals/growth-human-approval-center-service.ts` | Forward bounded outbound to collector |
| `lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts` | Plan-driven channel |
| `lib/growth/aios/ai-event-registry.ts` | Event type registration |
| `app/api/platform/growth/ai-os/communication-plan/route.ts` | GET-only API |
| `components/growth/ai-os/command-center/growth-ai-os-communication-engine-section.tsx` | Operations UI |
| `components/growth/ai-os/operations/growth-ai-os-operations-dashboard.tsx` | Section wiring |
| `components/growth/ai-os/command-center/growth-ai-os-command-center-panel.tsx` | Prop pass-through |
| `scripts/test-ge-ai-2k-communication-engine.ts` | Certification |
| `package.json` | `test:ge-ai-2k-communication-engine` script |

## Tests run

```bash
pnpm test:ge-ai-2k-communication-engine
```

Includes nested regressions: 2I, 2I-PROD-1/2/3, 2B, 2H, 2E, 2F.

## Known limitations

- Context loading uses bounded outbound scopes + outreach pilot lead IDs — not full CRM engagement history yet
- No persistent plan storage — plans are synthesized per read model request
- Quiet hours delay uses fixed 8h placeholder when active (scope timezone evaluated for outbound rows)
- Video/SENDR ranking uses engagement/meta signals only — no render pipeline integration
- Revenue Director orchestration loop not wired — planning layer only

## Revenue Director Foundation

**Partially unblocked.** GE-AI-2K provides the unified channel planning layer Revenue Director needs for strategy synthesis. Remaining blockers for full Revenue Director Foundation:

- Persistent plan history + cross-objective orchestration
- Live engagement/suppression/reply feeds into context loader
- Execution Agent binding to plan steps (still transport-separated)

The Communication Engine is the required **planning substrate**; Revenue Director can consume `GrowthCommunicationPlan` read models next without duplicating channel logic.
