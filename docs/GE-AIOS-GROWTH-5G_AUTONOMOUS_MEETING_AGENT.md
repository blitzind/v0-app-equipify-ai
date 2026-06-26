# GE-AIOS-GROWTH-5G — Autonomous Meeting Agent

## Phase

**GE-AIOS-GROWTH-5G** completes the first end-to-end autonomous internal revenue workflow:

Research → Qualification → Planning → Execution → Outreach Preparation → **Meeting Preparation**

The Meeting Agent prepares everything a human sales rep needs to conduct a meeting. It does **not** book meetings, modify calendars, send invites, create opportunities, or mutate Equipify Core.

## Pilot configuration

| Setting | Value |
|---------|-------|
| Agent | `meeting_agent` |
| Scheduler mode | `controlled_agent_wake` |
| Allowed workflow | `meeting_preparation` |
| Disabled agents | _(none — prior chain agents remain enabled)_ |
| Budget | 20/hr · 200/day · 3 retries/lead/day · 30 min cooldown |

## Wake conditions

Meeting Agent wakes **only** when:

1. Planning completed (`executionPlan` present on workflow snapshot)
2. Execution completed (successful internal `research_company` run)
3. Outreach preparation completed (approval package with `pendingHumanApproval`)
4. Required contact data exists (contact name, email, phone, or decision makers)
5. Meeting confidence ≥ 0.45
6. Policy allows meeting preparation (`meetingAutonomyEnabled`)

Additional wake triggers: `stale_meeting_package`, `manual_meeting_preparation_request`.

## Responsibilities (preparation only)

- Meeting brief
- Account summary
- Decision-maker summary
- Objections
- Talking points
- Discovery questions
- ROI discussion
- Recommended agenda
- Follow-up recommendations

## Forbidden

- Create or book meetings
- Calendar API calls or writes
- Send invitations, email, SMS, LinkedIn
- Mutate Core
- Create Work Orders or Opportunities
- Execute outreach or invoke providers outside the existing preparation pipeline

## Events

- `agent.wake`
- `growth.meeting.prepared`

## Policy

- `meetingAutonomyEnabled` on Consolidation-1E policy read model
- `evaluateMeetingPilotAutonomyPolicyGate()` — sole runtime gate
- Requires `task_creation` capability + `autonomyGenerationEnabled` kill switch
- Growth Autonomy is the sole control surface (no Command Center toggles)

## UI surfaces

### AI Operations

Compact `meetingAgentStatus`: enabled, blocked, budget, wake reason, preparation status, confidence, last run.

### Mission Planning Review

Per-lead `autonomousMeetingPilotContext`: eligibility, confidence, blocked reasons, preparation summary, Revenue Operator recommendation.

## Revenue Operator

Supervises only — no autonomous approval or execution authority.

## Certification

```bash
pnpm test:ge-aios-growth-5g-autonomous-meeting-agent
```

Chains 5F → 5E → 5A → 4A–4F → 3C regression.
