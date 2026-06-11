/** Deterministic outreach message blocks (Growth Engine slice 6.15B). */

import type { OutreachIndustryKey } from "@/lib/growth/outreach/personalization/personalization-types"

export type MessageBlockTemplate = {
  id: string
  label: string
  variants: string[]
}

export type OutreachMessageBlockLibrary = {
  opening: MessageBlockTemplate[]
  pain: MessageBlockTemplate[]
  industry: MessageBlockTemplate[]
  proof: MessageBlockTemplate[]
  cta: MessageBlockTemplate[]
}

const OPENINGS: MessageBlockTemplate[] = [
  {
    id: "opening_direct",
    label: "Direct",
    variants: [
      "{{contactName}}, quick note for {{companyName}}.",
      "Hi {{contactName}} — reaching out about {{companyName}}.",
      "{{contactName}}, sharing a short idea for {{companyName}}.",
    ],
  },
  {
    id: "opening_context",
    label: "Context-led",
    variants: [
      "{{contactName}}, teams like {{companyName}} often tighten dispatch and service visibility as volume grows.",
      "Hi {{contactName}} — {{companyName}} looks like a fit for a tighter field-ops workflow.",
      "{{contactName}}, I had a specific ops note for {{companyName}} based on your service profile.",
    ],
  },
  {
    id: "opening_follow_up",
    label: "Follow-up",
    variants: [
      "{{contactName}}, following up with one focused note for {{companyName}}.",
      "Hi {{contactName}} — circling back with a clearer next step for {{companyName}}.",
    ],
  },
  {
    id: "opening_pain_first",
    label: "Pain-first",
    variants: [
      "{{contactName}}, dispatch friction and missed visibility often show up before teams add headcount — had a focused note for {{companyName}}.",
      "Hi {{contactName}} — when service queues get opaque, response time slips first at {{companyName}}.",
      "{{contactName}}, capacity pressure usually surfaces in dispatch before anywhere else — quick note for {{companyName}}.",
    ],
  },
  {
    id: "opening_benchmark",
    label: "Benchmark-first",
    variants: [
      "{{contactName}}, operators similar to {{companyName}} often benchmark dispatch handoffs before scaling volume.",
      "Hi {{contactName}} — teams at your scale usually compare workflow benchmarks before the next hiring push.",
      "{{contactName}}, worth a quick benchmark on how {{companyName}} coordinates field service today?",
    ],
  },
  {
    id: "opening_operational_issue",
    label: "Operational issue",
    variants: [
      "{{contactName}}, manual coordination between scheduling and dispatch still creates gaps for teams like {{companyName}}.",
      "Hi {{contactName}} — operational handoffs are where most service teams lose visibility first.",
      "{{contactName}}, one operational pattern stood out for {{companyName}} around service coordination.",
    ],
  },
  {
    id: "opening_staffing",
    label: "Staffing",
    variants: [
      "{{contactName}}, hiring signals at {{companyName}} often mean workflow strain is already visible in dispatch.",
      "Hi {{contactName}} — growing field teams usually expose scheduling gaps before capacity catches up.",
      "{{contactName}}, staffing growth at {{companyName}} often pairs with dispatch coordination pressure.",
    ],
  },
  {
    id: "opening_compliance",
    label: "Compliance",
    variants: [
      "{{contactName}}, biomedical operators like {{companyName}} balance uptime with documentation-heavy service workflows.",
      "Hi {{contactName}} — compliance-ready service teams still need cleaner dispatch visibility at {{companyName}}.",
      "{{contactName}}, clinical equipment uptime and audit-ready workflows often compete at organizations like {{companyName}}.",
    ],
  },
  {
    id: "opening_workflow",
    label: "Workflow",
    variants: [
      "{{contactName}}, one workflow question for {{companyName}} around how open jobs get tracked.",
      "Hi {{contactName}} — service workflow clarity is usually the first fix operators want at {{companyName}}.",
      "{{contactName}}, had a specific workflow observation for {{companyName}}'s field ops.",
    ],
  },
  {
    id: "opening_peer_comparison",
    label: "Peer comparison",
    variants: [
      "{{contactName}}, peers in your segment often tighten dispatch before the next growth phase — thought of {{companyName}}.",
      "Hi {{contactName}} — similar operators are comparing dispatch workflows; had a note for {{companyName}}.",
      "{{contactName}}, operators comparable to {{companyName}} are reworking service handoffs this quarter.",
    ],
  },
  {
    id: "opening_observation",
    label: "Observation",
    variants: [
      "{{contactName}}, noticed {{companyName}} runs multi-site service — had one operational observation.",
      "Hi {{contactName}} — {{companyName}} looks like an operator where dispatch visibility would matter quickly.",
      "{{contactName}}, one observation about how {{companyName}} coordinates field work.",
    ],
  },
  {
    id: "opening_trigger_event",
    label: "Trigger event",
    variants: [
      "{{contactName}}, recent growth at {{companyName}} often triggers a dispatch workflow review.",
      "Hi {{contactName}} — expansion phases usually surface service coordination gaps at {{companyName}}.",
      "{{contactName}}, timing at {{companyName}} may make a short workflow review worthwhile.",
    ],
  },
  {
    id: "opening_industry_specific",
    label: "Industry-specific",
    variants: [
      "{{contactName}}, equipment-intensive operators in your space often standardize dispatch before scaling technicians.",
      "Hi {{contactName}} — field service leaders in your industry usually prioritize job visibility first.",
      "{{contactName}}, had an industry-specific ops note for {{companyName}}.",
    ],
  },
]

const PAIN_BLOCKS: MessageBlockTemplate[] = [
  {
    id: "dispatch_manual",
    label: "Dispatch pain",
    variants: [
      "Manual dispatch and last-minute schedule changes can slow first-time fix rates.",
      "When dispatch stays manual, technicians lose time between calls and updates get missed.",
    ],
  },
  {
    id: "service_visibility",
    label: "Service visibility",
    variants: [
      "Service visibility gaps make it harder to see open work, response times, and owner accountability.",
      "Without a clear service queue, teams spend time chasing status instead of closing jobs.",
    ],
  },
  {
    id: "scheduling_gaps",
    label: "Scheduling gaps",
    variants: [
      "Online scheduling gaps often push more calls to the office and create avoidable back-and-forth.",
      "When booking stays phone-only, dispatch absorbs work that should be automated.",
    ],
  },
  {
    id: "capacity_strain",
    label: "Capacity strain",
    variants: [
      "Growing call volume exposes where manual handoffs create backlog before the team scales.",
      "Capacity pressure usually shows up first in dispatch, follow-up, and job closeout.",
    ],
  },
]

const INDUSTRY_BLOCKS: Record<OutreachIndustryKey, MessageBlockTemplate[]> = {
  hvac: [
    {
      id: "hvac_ops",
      label: "HVAC ops",
      variants: [
        "HVAC teams we work with usually want cleaner dispatch, job visibility, and fewer missed callbacks.",
        "For HVAC operators, the win is fewer dispatch bottlenecks and clearer technician handoffs.",
      ],
    },
  ],
  medical_equipment: [
    {
      id: "medical_ops",
      label: "Medical equipment ops",
      variants: [
        "Medical equipment service teams need tighter service visibility and predictable response workflows.",
        "For medical equipment operators, workflow clarity matters as much as technician coverage.",
      ],
    },
  ],
  field_service: [
    {
      id: "field_ops",
      label: "Field service ops",
      variants: [
        "Field service teams usually need one place to track jobs, dispatch, and customer follow-up.",
        "For field operations, the friction is often manual coordination across dispatch and service.",
      ],
    },
  ],
  general: [
    {
      id: "general_ops",
      label: "General ops",
      variants: [
        "Most service operators want fewer manual handoffs between scheduling, dispatch, and follow-up.",
        "The pattern we see is manual coordination creating delays before the team can scale cleanly.",
      ],
    },
  ],
}

const PROOF_BLOCKS: MessageBlockTemplate[] = [
  {
    id: "capacity_proof",
    label: "Capacity proof",
    variants: [
      "Equipify helps teams reduce dispatch friction and keep more jobs moving without adding admin overhead.",
      "Teams use Equipify to tighten dispatch handoffs and keep service work visible as volume grows.",
    ],
  },
  {
    id: "workflow_proof",
    label: "Workflow proof",
    variants: [
      "Equipify gives operators one workflow for scheduling, dispatch, and service follow-up.",
      "Operators use Equipify to replace manual status checks with a clearer service workflow.",
    ],
  },
  {
    id: "field_ops_proof",
    label: "Field ops proof",
    variants: [
      "Equipify helps field teams coordinate jobs, technician updates, and customer follow-up in one place.",
      "Field teams use Equipify to keep dispatch, job status, and follow-up aligned.",
    ],
  },
]

const CTA_BLOCKS: MessageBlockTemplate[] = [
  {
    id: "question_dispatch",
    label: "Question — dispatch",
    variants: [
      "Is dispatch still mostly manual on your team?",
      "How are you handling dispatch handoffs today?",
      "Still coordinating technicians by phone or spreadsheet?",
    ],
  },
  {
    id: "question_scheduling",
    label: "Question — scheduling",
    variants: [
      "How are you handling online scheduling today?",
      "Is booking still mostly phone-based on your team?",
      "Do customers book service online or call in?",
    ],
  },
  {
    id: "question_workflow",
    label: "Question — workflow",
    variants: [
      "Do you have one place to track open service jobs?",
      "Is service visibility a bottleneck right now?",
      "Worth comparing notes on your dispatch workflow?",
    ],
  },
  {
    id: "question_clarification",
    label: "Question — clarification",
    variants: [
      "Did I capture your concern correctly?",
      "Want me to clarify the one point you flagged?",
      "Should I send a shorter answer on the concern you raised?",
    ],
  },
  {
    id: "customer_next_step",
    label: "Customer — next step",
    variants: [
      "What would be most useful as a next step on your side?",
      "Should we pick up from the last workflow discussion?",
      "Want me to send the next piece we outlined?",
    ],
  },
  {
    id: "soft_resource",
    label: "Soft — resource",
    variants: [
      "Happy to send a one-pager if that is easier than a call.",
      "I can share a short overview if useful — no meeting required.",
      "Want a brief workflow summary instead of a live walkthrough?",
    ],
  },
  {
    id: "soft_walkthrough",
    label: "Soft — walkthrough",
    variants: [
      "Happy to share a quick walkthrough if useful.",
      "I can send a short walkthrough if that helps.",
      "Open to a quick walkthrough of the workflow?",
    ],
  },
  {
    id: "follow_up_reply",
    label: "Follow-up — reply",
    variants: [
      "Still worth picking this up?",
      "Should I keep this on your radar?",
      "Worth revisiting when timing is better?",
    ],
  },
  {
    id: "follow_up_continue",
    label: "Follow-up — continue",
    variants: [
      "Should I send a quick summary of the workflow fit?",
      "Want me to follow up with a shorter note next week?",
      "Happy to circle back with one focused question.",
    ],
  },
  {
    id: "memory_commitment",
    label: "Memory — commitment",
    variants: [
      "Still good to follow through on what we outlined?",
      "Want me to pick up the thread we left open?",
      "Should I send what we discussed before your next review?",
    ],
  },
  {
    id: "direct_reply",
    label: "Direct — reply",
    variants: [
      "Reply with what works best and I will adjust.",
      "Send a quick note back if you want the short version.",
      "What is the best way to keep this moving on your side?",
    ],
  },
  {
    id: "direct_time",
    label: "Direct — time",
    variants: [
      "What day works for a 15-minute fit check?",
      "Send a couple times that work and I will adapt.",
      "What does your calendar look like for a brief review?",
    ],
  },
  {
    id: "fifteen_minute",
    label: "15-minute CTA",
    variants: [
      "Open to a 15-minute walkthrough next week?",
      "Worth a quick 15-minute fit check?",
      "Would a short 15-minute review be useful?",
    ],
  },
  {
    id: "operations_review",
    label: "Operations CTA",
    variants: [
      "Open to a brief operations review?",
      "Would a short ops workflow review be helpful?",
      "Worth a quick look at your dispatch workflow?",
    ],
  },
  {
    id: "quick_walkthrough",
    label: "Walkthrough CTA",
    variants: [
      "Happy to share a quick walkthrough if useful.",
      "I can send a short walkthrough if that helps.",
      "Open to a quick walkthrough of the workflow?",
    ],
  },
  {
    id: "cta_workflow_review",
    label: "Workflow review",
    variants: [
      "Open to a brief workflow review next week?",
      "Would a short workflow review be useful for your team?",
      "Worth a 15-minute workflow review to compare approaches?",
    ],
  },
  {
    id: "cta_benchmark_review",
    label: "Benchmark review",
    variants: [
      "Happy to share how similar operators benchmark dispatch — worth a quick review?",
      "Open to a brief benchmark review against peer workflows?",
      "Would a short benchmark comparison be helpful?",
    ],
  },
  {
    id: "cta_ops_audit",
    label: "Operations audit",
    variants: [
      "Worth a light ops audit of how jobs flow from intake to closeout?",
      "Open to a quick operational audit of your dispatch handoffs?",
      "Would a brief ops audit help clarify next steps?",
    ],
  },
  {
    id: "cta_ops_assessment",
    label: "Operations assessment",
    variants: [
      "Open to a short operations assessment of your service queue?",
      "Would a focused ops assessment be useful this quarter?",
      "Happy to run a quick assessment of dispatch friction if helpful.",
    ],
  },
  {
    id: "cta_quick_call",
    label: "Quick call",
    variants: [
      "Open to a 10-minute call to compare notes?",
      "Would a quick call this week help clarify fit?",
      "Happy to schedule a brief call if timing works.",
    ],
  },
  {
    id: "cta_process_review",
    label: "Process review",
    variants: [
      "Worth a short process review on how work gets assigned today?",
      "Open to a focused process review of your field service flow?",
      "Would a brief process review help identify quick wins?",
    ],
  },
  {
    id: "cta_operational_gap_review",
    label: "Operational gap review",
    variants: [
      "Open to reviewing where operational gaps show up in dispatch?",
      "Would a quick gap review on service handoffs be useful?",
      "Happy to outline common gaps operators fix first — worth a review?",
    ],
  },
  {
    id: "cta_service_review",
    label: "Service review",
    variants: [
      "Worth a short service workflow review for your team?",
      "Open to a brief review of how service jobs are tracked today?",
      "Would a focused service review help prioritize next steps?",
    ],
  },
  {
    id: "cta_diagnostic_offer",
    label: "Diagnostic offer",
    variants: [
      "I can share a short diagnostic on dispatch friction — interested?",
      "Happy to send a quick diagnostic checklist if that helps.",
      "Open to a lightweight diagnostic on your service workflow?",
    ],
  },
  {
    id: "cta_peer_comparison_review",
    label: "Peer comparison review",
    variants: [
      "Worth comparing how peer operators handle similar dispatch volume?",
      "Open to a peer comparison review of field service workflows?",
      "Would a brief peer benchmark be useful for your planning?",
    ],
  },
  {
    id: "cta_workflow_diagnostic",
    label: "Workflow diagnostic",
    variants: [
      "Open to a workflow diagnostic to spot manual handoffs?",
      "Would a short workflow diagnostic help clarify priorities?",
      "Happy to walk through a diagnostic on service coordination.",
    ],
  },
]

export const OUTREACH_MESSAGE_BLOCK_LIBRARY: OutreachMessageBlockLibrary = {
  opening: OPENINGS,
  pain: PAIN_BLOCKS,
  industry: [],
  proof: PROOF_BLOCKS,
  cta: CTA_BLOCKS,
}

export function industryBlocksFor(industry: OutreachIndustryKey): MessageBlockTemplate[] {
  return INDUSTRY_BLOCKS[industry]
}

export function interpolateBlockText(
  template: string,
  tokens: { companyName: string; contactName: string | null },
): string {
  const contact = tokens.contactName?.trim() || "there"
  return template.replaceAll("{{companyName}}", tokens.companyName).replaceAll("{{contactName}}", contact)
}
