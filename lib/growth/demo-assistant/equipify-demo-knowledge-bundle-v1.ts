/** GE-v1-4 — Static Equipify knowledge bundle (versioned, no RAG). */

import {
  GE_V1_4_KNOWLEDGE_BUNDLE_VERSION,
  type GeV14ProspectContext,
} from "@/lib/growth/demo-assistant/ge-v1-4-types"

export type EquipifyDemoKnowledgeTopic = {
  topicId: string
  title: string
  keywords: string[]
  answerTemplate: string
  relatedIntents: Array<"pricing" | "integration" | "implementation" | "feature" | "demo" | "general">
}

export const EQUIPIFY_DEMO_KNOWLEDGE_BUNDLE_V1: {
  version: typeof GE_V1_4_KNOWLEDGE_BUNDLE_VERSION
  updatedAt: string
  topics: EquipifyDemoKnowledgeTopic[]
  fallbackAnswer: string
  safetyRules: string[]
} = {
  version: GE_V1_4_KNOWLEDGE_BUNDLE_VERSION,
  updatedAt: "2026-06-22",
  safetyRules: [
    "Never quote specific pricing — direct prospects to a live demo for tailored pricing.",
    "Never promise unsupported integrations or features.",
    "Never create meetings outside the existing booking flow.",
    "Recommend booking a demo when intent is high; never force booking.",
  ],
  fallbackAnswer:
    "Equipify helps field service teams run work orders, scheduling, quotes, invoices, and customer communication in one place. I'd be happy to walk through how it fits {{company}} — the best next step is a short live demo where we can answer specifics for your team.",
  topics: [
    {
      topicId: "what-equipify-does",
      title: "What Equipify does",
      keywords: ["what is equipify", "what does equipify", "equipify do", "about equipify", "platform"],
      relatedIntents: ["general", "feature"],
      answerTemplate:
        "Equipify is an operations platform for field service businesses. Teams use it to manage work orders, dispatch technicians, send quotes, invoice customers, collect payments, and keep customers updated — often from mobile apps in the field.{{personalized_suffix}}",
    },
    {
      topicId: "who-equipify-serves",
      title: "Who Equipify serves",
      keywords: ["who is it for", "industries", "field service", "hvac", "plumbing", "equipment rental", "maintenance"],
      relatedIntents: ["general"],
      answerTemplate:
        "Equipify is built for field service and equipment operations — HVAC, plumbing, electrical, equipment rental, maintenance, and similar teams that dispatch people to job sites.{{industry_suffix}}",
    },
    {
      topicId: "work-orders",
      title: "Work orders",
      keywords: ["work order", "work orders", "dispatch", "job ticket", "service ticket"],
      relatedIntents: ["feature"],
      answerTemplate:
        "Work orders in Equipify track the full job lifecycle — assignment, status, notes, photos, parts, and completion — so office and field stay aligned. Technicians can update jobs from mobile while dispatch sees live status.",
    },
    {
      topicId: "scheduling",
      title: "Scheduling",
      keywords: ["schedule", "scheduling", "calendar", "dispatch board", "route", "appointment"],
      relatedIntents: ["feature"],
      answerTemplate:
        "Scheduling helps you assign technicians, avoid double-booking, and see capacity at a glance. Many teams pair scheduling with work orders so every appointment ties back to billing and customer history.",
    },
    {
      topicId: "quotes",
      title: "Quotes",
      keywords: ["quote", "quotes", "estimate", "proposal", "pricing estimate"],
      relatedIntents: ["feature", "pricing"],
      answerTemplate:
        "Quotes let your team build professional estimates, send them to customers, and convert approved quotes into work orders or invoices without re-entering data.",
    },
    {
      topicId: "invoices",
      title: "Invoices",
      keywords: ["invoice", "invoices", "billing", "accounts receivable"],
      relatedIntents: ["feature"],
      answerTemplate:
        "Invoicing connects completed work to billing — line items, taxes, payment status, and customer records stay linked to the original job.",
    },
    {
      topicId: "payments",
      title: "Payments",
      keywords: ["payment", "payments", "pay online", "credit card", "collect payment"],
      relatedIntents: ["feature"],
      answerTemplate:
        "Equipify supports collecting payments as part of the customer workflow — so teams can get paid faster after jobs are complete, with payment status visible alongside invoices.",
    },
    {
      topicId: "customer-communication",
      title: "Customer communication",
      keywords: ["customer communication", "notifications", "sms", "email customer", "updates", "portal"],
      relatedIntents: ["feature"],
      answerTemplate:
        "Customer communication keeps homeowners and commercial clients informed — appointment reminders, on-the-way updates, and job completion notices — without manual follow-up from the office.",
    },
    {
      topicId: "mobile-apps",
      title: "Mobile applications",
      keywords: ["mobile", "app", "technician app", "field app", "ios", "android"],
      relatedIntents: ["feature"],
      answerTemplate:
        "Mobile apps give technicians access to assigned jobs, notes, photos, and status updates in the field, while the office sees changes in real time.",
    },
    {
      topicId: "quickbooks-integration",
      title: "QuickBooks integration",
      keywords: ["quickbooks", "quick books", "qbo", "accounting sync", "integrate with quickbooks"],
      relatedIntents: ["integration", "demo"],
      answerTemplate:
        "Yes — Equipify integrates with QuickBooks so financial data can sync with your accounting workflow. Exact setup depends on your edition and chart of accounts; a demo is the fastest way to confirm the right sync for {{company}}.",
    },
    {
      topicId: "pricing-guidance",
      title: "Pricing guidance",
      keywords: ["price", "pricing", "cost", "how much", "subscription", "per user", "license"],
      relatedIntents: ["pricing", "demo"],
      answerTemplate:
        "Pricing depends on team size, modules, and rollout scope — I can't quote exact numbers here. The best path is a short demo where we learn about {{company}} and share a tailored recommendation.",
    },
    {
      topicId: "implementation",
      title: "Implementation",
      keywords: ["implement", "implementation", "onboard", "onboarding", "setup", "migration", "go live", "timeline"],
      relatedIntents: ["implementation", "demo"],
      answerTemplate:
        "Implementation typically includes data setup, workflow configuration, and team training. Timelines vary by complexity — a demo helps us outline a realistic rollout plan for {{company}}.",
    },
    {
      topicId: "demo-process",
      title: "Demo process",
      keywords: ["demo", "book demo", "walkthrough", "see a demo", "schedule", "meeting"],
      relatedIntents: ["demo"],
      answerTemplate:
        "A demo is a live walkthrough tailored to your operations — usually 20–30 minutes. You can book directly{{booking_suffix}} and we'll cover workflows that matter most to {{company}}.",
    },
  ],
}

export function applyKnowledgePersonalization(
  template: string,
  context: GeV14ProspectContext,
): string {
  const company = context.company?.trim() || "your team"
  const industry = context.industry?.trim()
  const bookingUrl = context.bookingUrl?.trim()

  let text = template
    .replace(/\{\{company\}\}/g, company)
    .replace(/\{\{prospect_name\}\}/g, context.prospectName?.trim() || "there")

  if (text.includes("{{personalized_suffix}}")) {
    const suffix = context.prospectName
      ? ` For ${context.prospectName}${context.company ? ` at ${context.company}` : ""}, we can focus on the workflows you care about most.`
      : ""
    text = text.replace("{{personalized_suffix}}", suffix)
  }

  if (text.includes("{{industry_suffix}}")) {
    const suffix = industry
      ? ` Your industry (${industry}) is a common fit when teams need tighter dispatch-to-cash workflows.`
      : ""
    text = text.replace("{{industry_suffix}}", suffix)
  }

  if (text.includes("{{booking_suffix}}")) {
    const suffix = bookingUrl ? ` at ${bookingUrl}` : ""
    text = text.replace("{{booking_suffix}}", suffix)
  }

  return text.trim()
}

export function scoreKnowledgeTopicMatch(
  question: string,
  topic: EquipifyDemoKnowledgeTopic,
): number {
  const normalized = question.toLowerCase()
  let score = 0
  for (const keyword of topic.keywords) {
    if (normalized.includes(keyword.toLowerCase())) {
      score += keyword.split(" ").length >= 2 ? 3 : 1
    }
  }
  return score
}

export function resolveBestKnowledgeTopic(question: string): EquipifyDemoKnowledgeTopic | null {
  let best: EquipifyDemoKnowledgeTopic | null = null
  let bestScore = 0
  for (const topic of EQUIPIFY_DEMO_KNOWLEDGE_BUNDLE_V1.topics) {
    const score = scoreKnowledgeTopicMatch(question, topic)
    if (score > bestScore) {
      bestScore = score
      best = topic
    }
  }
  return bestScore > 0 ? best : null
}

export function resolveBundleAnswer(
  question: string,
  context: GeV14ProspectContext,
): { answer: string; topicId: string | null } {
  const topic = resolveBestKnowledgeTopic(question)
  if (topic) {
    return {
      topicId: topic.topicId,
      answer: applyKnowledgePersonalization(topic.answerTemplate, context),
    }
  }
  return {
    topicId: null,
    answer: applyKnowledgePersonalization(EQUIPIFY_DEMO_KNOWLEDGE_BUNDLE_V1.fallbackAnswer, context),
  }
}
