import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildRevenueIntelligenceCopilot } from "@/lib/growth/revenue-intelligence/revenue-copilot-service"
import { computeBuyingMomentum } from "@/lib/growth/revenue-intelligence/buying-momentum-engine"
import { detectOpportunitySignalsFromReplyV2 } from "@/lib/growth/revenue-intelligence/opportunity-signal-engine"
import { classifyReplyIntentV2 } from "@/lib/growth/reply-intelligence/reply-intent-classifier-v2"
import { extractBuyingSignals } from "@/lib/growth/reply-intelligence/buying-signal-extractor"
import { detectReplyObjections } from "@/lib/growth/reply-intelligence/objection-detection"
import { buildBuyingCommitteeMap } from "@/lib/growth/revenue-intelligence/buying-committee-map"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const leadId = z.string().uuid().parse(new URL(request.url).searchParams.get("leadId"))

  try {
    const { data: leadRow } = await access.admin.schema("growth").from("leads").select("company_name").eq("id", leadId).maybeSingle()
    const { data: replyRow } = await access.admin
      .schema("growth")
      .from("outbound_replies")
      .select("body_preview, thread_reply_count, response_latency_ms, recommended_operator_action")
      .eq("lead_id", leadId)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const bodyPreview = (replyRow as { body_preview?: string | null } | null)?.body_preview ?? null
    const classified = classifyReplyIntentV2(bodyPreview)
    const buyingSignals = extractBuyingSignals(bodyPreview)
    const objections = detectReplyObjections(bodyPreview)
    const signals = detectOpportunitySignalsFromReplyV2({
      bodyPreview,
      classification: classified,
      buyingSignals,
      threadReplyCount: Number((replyRow as { thread_reply_count?: number } | null)?.thread_reply_count ?? 1),
      responseLatencyMs: (replyRow as { response_latency_ms?: number | null } | null)?.response_latency_ms ?? null,
    })

    const committee = buildBuyingCommitteeMap({
      leadId,
      companyLabel: (leadRow as { company_name?: string } | null)?.company_name ?? "Account",
      bodyPreview,
      signals,
    })

    const momentum = computeBuyingMomentum({
      threadReplyCount: Number((replyRow as { thread_reply_count?: number } | null)?.thread_reply_count ?? 1),
      responseLatencyMs: (replyRow as { response_latency_ms?: number | null } | null)?.response_latency_ms ?? null,
      buyingSignalCount: buyingSignals.length,
      objectionCount: objections.length,
      resolvedObjectionCount: 0,
      outboundMessageCount: 1,
      stakeholderCount: committee.stakeholderCount,
    })

    const assist = buildRevenueIntelligenceCopilot({
      companyLabel: (leadRow as { company_name?: string } | null)?.company_name ?? "Account",
      momentum,
      signals,
      objectionCategories: objections.map((o) => o.category),
      committeeCompleteness: committee.completenessScore,
      missingStakeholders: committee.missingStakeholderSuggestions,
      recommendedOperatorAction: (replyRow as { recommended_operator_action?: string } | null)?.recommended_operator_action,
    })

    return NextResponse.json({ ok: true, assist })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not build revenue copilot assist." }, { status: 500 })
  }
}
