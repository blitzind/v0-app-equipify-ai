/** Static Aiden operator guide — edit here to update in-app coaching copy. */

export const AIDEN_OPERATOR_GUIDE_QA_MARKER = "aiden-operator-guide-v1" as const

export type AidenGuideLink = {
  label: string
  href: string
}

export type AidenGuideStep = {
  order: number
  title: string
  detail: string
  links?: AidenGuideLink[]
}

export type AidenChecklistItem = {
  id: string
  title: string
  where: string
  expectedStatus: string
  doNot: string
  links?: AidenGuideLink[]
}

export type AidenStatusEntry = {
  status: string
  meaning: string
  operatorAction: string
}

export type AidenBlockerEntry = {
  code: string
  meaning: string
  severity: "low" | "medium" | "high" | "critical"
  operatorAction: string
  engineeringNeeded: boolean
}

export type AidenReplyTypeEntry = {
  type: string
  where: string
  action: string
  opportunityHint?: string
}

export type AidenMetricEntry = {
  metric: string
  meaning: string
  healthySignal: string
}

export type AidenCoachTip = {
  id: string
  message: string
  when: string
}

export const AIDEN_COACH_TIPS: AidenCoachTip[] = [
  {
    id: "pending-approvals",
    message: "You have jobs pending approval. Review each draft before approving.",
    when: "When pending_approval count is greater than zero.",
  },
  {
    id: "mailbox-expired",
    message: "Mailbox is expired. Reconnect it before approving more sends.",
    when: "When mailbox status is expired or send_allowed is false.",
  },
  {
    id: "wave-gating",
    message: "Do not send Wave 2 until Wave 1 has at least one clean delivery.",
    when: "When expanding a pilot in controlled waves.",
  },
  {
    id: "dual-approval",
    message: "Approving a job is not enough — the AI draft must also be approved before transport runs.",
    when: "Before triggering safe execute.",
  },
  {
    id: "no-auto-send",
    message: "Nothing sends automatically. You approve every job; transport only runs on approved jobs.",
    when: "Always.",
  },
]

export const AIDEN_DAILY_ROUTINE: AidenGuideStep[] = [
  {
    order: 1,
    title: "Check mailbox health",
    detail: "Confirm outbound mailbox is connected and token is valid. Expired mailboxes block every send.",
    links: [
      { label: "Mailboxes", href: "/admin/growth/infrastructure/mailboxes" },
      { label: "Provider setup", href: "/admin/growth/providers/setup" },
    ],
  },
  {
    order: 2,
    title: "Check pending approvals",
    detail: "Open Sequence Execution and count jobs in pending_approval. These are waiting for your review.",
    links: [{ label: "Sequence execution", href: "/admin/growth/sequences/execution" }],
  },
  {
    order: 3,
    title: "Review drafts",
    detail: "Read subject, body, and personalization for each job. Reject anything that looks generic or wrong.",
    links: [{ label: "Outreach approval", href: "/admin/growth/outreach/approval" }],
  },
  {
    order: 4,
    title: "Approve jobs",
    detail: "Approve only jobs you would send yourself. Each approval is logged with your user.",
    links: [{ label: "Safe execution queue", href: "/admin/growth/sequences/execution" }],
  },
  {
    order: 5,
    title: "Send controlled batches",
    detail: "Approved jobs are picked up by safe execute (cron). Send in small waves — do not approve everything at once on day one.",
    links: [{ label: "Sequence execution", href: "/admin/growth/sequences/execution" }],
  },
  {
    order: 6,
    title: "Watch inbox",
    detail: "After sends go out, monitor the unified inbox for replies and bounces.",
    links: [
      { label: "Unified inbox", href: "/admin/growth/inbox" },
      { label: "Inbox diagnostics", href: "/admin/growth/inbox/diagnostics" },
    ],
  },
  {
    order: 7,
    title: "Respond to replies",
    detail: "Use reply drafts and workflow center. Classify intent before sending a follow-up.",
    links: [
      { label: "Replies", href: "/admin/growth/replies" },
      { label: "Reply workflow", href: "/admin/growth/replies/workflow" },
      { label: "Reply drafts", href: "/admin/growth/copilot/reply-drafts" },
    ],
  },
  {
    order: 8,
    title: "Book meetings",
    detail: "When a lead shows meeting intent, use booking intelligence and log the meeting on the lead timeline.",
    links: [
      { label: "Meetings", href: "/admin/growth/meetings" },
      { label: "Booking intelligence", href: "/admin/growth/booking-intelligence" },
    ],
  },
  {
    order: 9,
    title: "Approve opportunities",
    detail: "Promote qualified conversations to opportunities only after human review.",
    links: [
      { label: "Opportunities", href: "/admin/growth/opportunities" },
      { label: "Opportunity pipeline", href: "/admin/growth/opportunities/pipeline" },
    ],
  },
  {
    order: 10,
    title: "Review revenue attribution",
    detail: "Check attribution touches and revenue dashboard at end of day.",
    links: [
      { label: "Revenue", href: "/admin/growth/revenue" },
      { label: "Revenue attribution", href: "/admin/growth/revenue-attribution" },
    ],
  },
]

export const AIDEN_APOLLO_PILOT_CHECKLIST: AidenChecklistItem[] = [
  {
    id: "certified-cohort",
    title: "Certified cohort",
    where: "Apollo Pilot Operations panel → cohort readiness",
    expectedStatus: "All companies materialized; personalization and enrollment gates pass.",
    doNot: "Do not activate a cohort with trim errors, FK errors, or missing email assets.",
    links: [{ label: "Sequence execution", href: "/admin/growth/sequences/execution" }],
  },
  {
    id: "drafts-approved",
    title: "Drafts approved",
    where: "Apollo sequence execution queue → draft review",
    expectedStatus: "execution_ready on each company draft.",
    doNot: "Do not skip draft quality review — placeholder content blocks at send time.",
  },
  {
    id: "cohort-active",
    title: "Cohort active",
    where: "Apollo Pilot Operations → Activate cohort",
    expectedStatus: "Cohort status active, processing_allowed true.",
    doNot: "Do not activate before all drafts are approved.",
  },
  {
    id: "jobs-pending",
    title: "Jobs pending approval",
    where: "Safe Execution dashboard → pending_approval column",
    expectedStatus: "Jobs exist in pending_approval after materialization.",
    doNot: "Do not assume jobs auto-send — they wait for your approval.",
  },
  {
    id: "jobs-approved",
    title: "Jobs approved",
    where: "Safe Execution → approve each job + AI generation",
    expectedStatus: "Job status approved; generation also approved.",
    doNot: "Do not approve jobs you have not read.",
  },
  {
    id: "safe-execute",
    title: "Safe execute",
    where: "Production cron picks up approved jobs (operator triggers via platform)",
    expectedStatus: "Jobs move approved → running → sent (or blocked with reason).",
    doNot: "Do not bypass safe execute or send from local scripts.",
  },
  {
    id: "monitor-replies",
    title: "Monitor replies",
    where: "Unified inbox + reply workflow",
    expectedStatus: "Replies appear on lead timeline; attribution touches recorded on send.",
    doNot: "Do not send the next wave until prior wave delivery is confirmed clean.",
  },
]

export const AIDEN_STATUS_DICTIONARY: AidenStatusEntry[] = [
  {
    status: "pending_draft_approval",
    meaning: "Sequence draft exists but an operator has not approved the content yet.",
    operatorAction: "Review draft in Apollo queue; approve or reject.",
  },
  {
    status: "execution_ready",
    meaning: "Draft passed review and is ready for job materialization / enrollment.",
    operatorAction: "Proceed to job approval when cohort is active.",
  },
  {
    status: "pending_approval",
    meaning: "Execution job exists and waits for human send approval.",
    operatorAction: "Open job, review content, approve if correct.",
  },
  {
    status: "approved",
    meaning: "You approved the job; safe execute may pick it up.",
    operatorAction: "Wait for transport or check if mailbox / generation blockers exist.",
  },
  {
    status: "running",
    meaning: "Job is locked and transport is in progress.",
    operatorAction: "Wait 1–2 minutes. If stuck >30 min, check recovery — do not double-approve.",
  },
  {
    status: "sent",
    meaning: "Email delivered via provider; provider message ID recorded.",
    operatorAction: "Verify timeline + attribution; monitor inbox for replies.",
  },
  {
    status: "blocked",
    meaning: "Send stopped by a guard (mailbox, suppression, generation, etc.).",
    operatorAction: "Read last_error; fix root cause; re-approve when clear.",
  },
  {
    status: "failed",
    meaning: "Transport attempted but failed (provider or payload error).",
    operatorAction: "Read error, fix issue, re-approve for retry.",
  },
  {
    status: "draft cohort",
    meaning: "Pilot cohort created but not activated — no processing.",
    operatorAction: "Complete certification, approve drafts, then activate.",
  },
  {
    status: "active cohort",
    meaning: "Cohort processing enabled; jobs can be approved and sent.",
    operatorAction: "Run controlled approval waves; monitor dashboard.",
  },
  {
    status: "paused cohort",
    meaning: "Processing halted; new sends should not proceed.",
    operatorAction: "Investigate before resuming; do not approve jobs while paused.",
  },
]

export const AIDEN_BLOCKER_PLAYBOOK: AidenBlockerEntry[] = [
  {
    code: "Mailbox connection unhealthy / expired",
    meaning: "OAuth access token for outbound mailbox expired or revoked.",
    severity: "critical",
    operatorAction: "Go to Provider setup → Google → Reconnect (refresh or OAuth). Validate mailbox until status is connected.",
    engineeringNeeded: false,
  },
  {
    code: "generation_not_approved",
    meaning: "AI copilot draft for this step is not approved.",
    severity: "high",
    operatorAction: "Approve the AI generation for the enrollment step, then re-approve the job.",
    engineeringNeeded: false,
  },
  {
    code: "draft not send ready",
    meaning: "Content failed send-readiness checks (placeholder, missing template, etc.).",
    severity: "high",
    operatorAction: "Re-run materialization or fix draft content; do not force approve.",
    engineeringNeeded: false,
  },
  {
    code: "job stuck running",
    meaning: "Job lock not released after failed transport attempt.",
    severity: "medium",
    operatorAction: "Wait for recovery cron (~30 min) or use official restore path. Check mailbox before retry.",
    engineeringNeeded: false,
  },
  {
    code: "no verified email",
    meaning: "Lead has no verified contact email for outbound.",
    severity: "high",
    operatorAction: "Enrich contact or fix primary email in lead record before approving send.",
    engineeringNeeded: false,
  },
  {
    code: "eligible_pool_below_target",
    meaning: "Certification requires more greenfield companies than currently qualify.",
    severity: "medium",
    operatorAction: "Add/enroll more qualified companies or accept smaller pilot — not a send blocker for existing jobs.",
    engineeringNeeded: false,
  },
  {
    code: "sms missing phone",
    meaning: "SMS channel selected but no phone on contact.",
    severity: "low",
    operatorAction: "For email-only templates, this is expected — SMS is not required. Ignore if channels are email-only.",
    engineeringNeeded: false,
  },
]

export const AIDEN_DAILY_SALES_WORKFLOW = {
  morning: [
    "Check replies in unified inbox",
    "Review meetings booked overnight",
    "Scan blocked jobs and mailbox health",
    "Approve only safe, reviewed sends for the day",
  ],
  midday: [
    "Review new replies and classify intent",
    "Follow up on positive interest within SLA",
    "Update lead status on active conversations",
  ],
  endOfDay: [
    "Check pilot / command dashboard metrics",
    "Log lessons (what blocked, what replied)",
    "Prepare next approval batch — do not auto-queue",
  ],
} as const

export const AIDEN_REPLY_HANDLING: AidenReplyTypeEntry[] = [
  {
    type: "positive interest",
    where: "Unified inbox → thread → Action Center",
    action: "Use reply draft; propose next step or meeting. Update lead to engaged.",
    opportunityHint: "Create opportunity when budget and timeline are clear.",
  },
  {
    type: "objection",
    where: "Replies workflow → classify as objection",
    action: "Acknowledge concern; use playbook objection handler; do not argue.",
  },
  {
    type: "not interested",
    where: "Inbox → mark disposition",
    action: "Respect opt-out tone; pause sequence; do not re-pitch immediately.",
  },
  {
    type: "out of office",
    where: "Inbox thread",
    action: "Snooze follow-up until return date; no immediate reply needed.",
  },
  {
    type: "unsubscribe",
    where: "Compliance / suppression",
    action: "Confirm suppression applied; never send again to this address.",
  },
  {
    type: "wrong person",
    where: "Lead record + inbox",
    action: "Ask for correct contact; update lead or create new contact.",
  },
  {
    type: "meeting request",
    where: "Meetings + booking intelligence",
    action: "Send calendar link or propose times; log meeting on timeline.",
    opportunityHint: "Strong signal — create or advance opportunity.",
  },
]

export const AIDEN_METRICS_GUIDE: AidenMetricEntry[] = [
  {
    metric: "emails sent",
    meaning: "Count of successful sequence sends in pilot/cohort dashboard.",
    healthySignal: "Increases only after you approve jobs; should match approved sent jobs.",
  },
  {
    metric: "replies",
    meaning: "Inbound replies ingested and linked to leads.",
    healthySignal: "Grows after live sends; verify in inbox if dashboard is zero.",
  },
  {
    metric: "meetings",
    meaning: "Meetings logged or booked via booking flow.",
    healthySignal: "Tracks meeting intent replies converted to calendar events.",
  },
  {
    metric: "opportunities",
    meaning: "Human-approved pipeline opportunities.",
    healthySignal: "Manual promotion — should not spike without operator action.",
  },
  {
    metric: "revenue",
    meaning: "Attributed revenue from growth touches.",
    healthySignal: "Long-cycle metric; verify attribution touches exist first.",
  },
  {
    metric: "attribution touches",
    meaning: "Links between sends/replies and campaign enrollment.",
    healthySignal: "One touch per sent job with delivery attempt ID.",
  },
  {
    metric: "fatal blockers",
    meaning: "Hard stops preventing launch or send (mailbox, missing email, etc.).",
    healthySignal: "Zero before any send wave.",
  },
  {
    metric: "warnings",
    meaning: "Non-fatal issues (SMS missing phone on email-only, pool below target).",
    healthySignal: "Review but may not block email-only pilot.",
  },
  {
    metric: "certified",
    meaning: "Cohort passed materialization and readiness certification.",
    healthySignal: "All companies ready before activation.",
  },
  {
    metric: "ready for launch",
    meaning: "Combined gate: certified + drafts + infrastructure healthy.",
    healthySignal: "True only when mailbox, drafts, and cohort status align.",
  },
]

export const AIDEN_GUIDE_SECTIONS = [
  { id: "today", title: "What do I do today?" },
  { id: "pilot-checklist", title: "Apollo Pilot Launch Checklist" },
  { id: "status-dictionary", title: "Status Dictionary" },
  { id: "blocker-playbook", title: "Blocker Playbook" },
  { id: "daily-sales", title: "Daily Sales Workflow" },
  { id: "reply-handling", title: "Reply Handling Guide" },
  { id: "metrics", title: "Metrics Guide" },
] as const
