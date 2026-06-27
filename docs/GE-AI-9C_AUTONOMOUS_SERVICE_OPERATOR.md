# GE-AI-9C — Autonomous Service Operator

**Phase:** GE-AI-9C  
**Scope:** Presentation and orchestration only — Ava owns Service Operations through Service Missions coordinated by Revenue Director. No backend, runtime, API, transport, scheduler, or migration changes.  
**Certification:** `pnpm test:ge-ai-9c-autonomous-service-operator`

---

## Philosophy (locked)

Winning a customer is only the beginning. Ava should help ensure every customer receives excellent service. Service becomes a **portfolio of Service Missions**. Revenue creates customers; Marketing creates demand; Customer Success grows relationships; **Service delivers the experience**. Revenue Director continues coordinating all mission types.

---

## Service mission lifecycle (existing stages, orchestrated)

Scheduled → Preparation → Assigned → In Progress → Awaiting Customer → Completed → Follow-up → Review Requested → Closed

No duplicate workflow logic — orchestration only.

---

## UX audit

| Area | Before (UX-9B) | After (UX-9C) |
|------|----------------|---------------|
| Service framing | Embedded in activity metrics | **My Service Missions** (max 3) |
| Schedule health | Daily briefing only | **Service Health** — human language only |
| Technicians | Not surfaced on Home | **Technician Awareness** from scheduling read models |
| Post-service | Inbox counts | **Customer Follow-ups** — presentation only |
| Operations | None on Home | **Operational Insights** with evidence |
| Impact | CS contribution only | **Service Contribution** — work orders, utilization, satisfaction |

**QA marker:** `growth-ge-ai-ux-9c-autonomous-service-operator-v1`

---

## Home layout (service sections)

After Customer Success sections:

1. **My Service Missions**  
2. **Service Health**  
3. **Technician Awareness**  
4. **Customer Follow-ups**  
5. **Operational Insights**  
6. **Service Contribution**  

---

## Data sources (read models only)

| Signal | Source |
|--------|--------|
| Service missions | Calls today, meetings today, call-ready leads, approval queue (blocked/running jobs), inbox |
| Service health | Activity calendar, call-ready queue, relationship alerts, blocked jobs |
| Technician awareness | Calls logged, call-ready capacity, pending drafts, blocked jobs |
| Follow-ups | Replies needing attention, positive interest, completed touchpoints |
| Operational insights | Completion trends, conversation/relationship alerts, blocked jobs |
| Contribution | Calls, meetings, engagement score, revenue briefing |
| Revenue Director path | Optional snapshot → `operationsDashboard.activeWork[0]` |

---

## Operator voice

- "I'm actively managing N service missions."
- "Today's schedule is healthy."
- "One technician may need assistance."
- "N customers are ready for follow-up."

---

## Forbidden actions (UI + synthesizer)

- Reassign technician  
- Dispatch now  
- Transport send / scheduler activation  
- New work order creation from Home  

---

## Certification checklist

```bash
pnpm test:ge-ai-9c-autonomous-service-operator   # this phase
pnpm test:ge-ai-9b-autonomous-customer-success-operator
pnpm test:ge-ai-9a-autonomous-marketing-operator
pnpm test:ge-ai-8a-autonomous-revenue-operator
```

---

## Future compatibility

Service Missions use the same mission architecture as Revenue, Marketing, Customer Success, Finance, and Operations — expandable without redesign.
