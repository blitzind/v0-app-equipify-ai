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
