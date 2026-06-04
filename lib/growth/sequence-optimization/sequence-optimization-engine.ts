import {
  GROWTH_SEQUENCE_OPTIMIZATION_SAFETY_NOTES,
  GROWTH_SEQUENCE_OPTIMIZATION_V2_QA_MARKER,
  type GrowthSequenceOptimizationEvidence,
  type GrowthSequenceOptimizationRecommendation,
  type GrowthSequenceOptimizationRecommendationsPayload,
  type GrowthSequenceOptimizationRollups,
  type SequenceOptimizationEngineInput,
} from "@/lib/growth/sequence-optimization/sequence-optimization-types"
const MIN_STEP_TOUCHES = 10
const MIN_STEP_TOUCHES_PAUSE = 18

function confidenceScore(input: {
  wins?: number
  touchCount?: number
  leadCount?: number
  replyRatePct?: number | null
  bonus?: number
}): number {
  const raw =
    40 +
    (input.wins ?? 0) * 16 +
    Math.min(input.touchCount ?? 0, 40) * 0.5 +
    Math.min(input.leadCount ?? 0, 15) * 2 +
    (input.replyRatePct != null ? input.replyRatePct * 0.35 : 0) +
    (input.bonus ?? 0)
  return Math.max(0, Math.min(98, Math.round(raw)))
}

function evidence(label: string, value: string, metric?: string): GrowthSequenceOptimizationEvidence {
  return { label, value, metric }
}

function recId(type: string, sequenceId: string, stepId?: string | null): string {
  return `${type}:${sequenceId}:${stepId ?? "all"}`.slice(0, 120)
}

function pushRec(
  list: GrowthSequenceOptimizationRecommendation[],
  seen: Set<string>,
  rec: GrowthSequenceOptimizationRecommendation,
): void {
  if (seen.has(rec.id)) return
  seen.add(rec.id)
  list.push(rec)
}

function sequenceLabel(input: SequenceOptimizationEngineInput, sequenceId: string): string {
  return input.sequenceLabels.get(sequenceId) ?? `Sequence ${sequenceId.slice(0, 8)}`
}

function stepLabel(input: SequenceOptimizationEngineInput, stepId: string): string {
  return input.stepLabels.get(stepId) ?? `Step ${stepId.slice(0, 8)}`
}

function matchesFilter(input: SequenceOptimizationEngineInput, sequenceId: string | null): boolean {
  if (!input.filterSequenceId) return true
  return sequenceId === input.filterSequenceId
}

function resolveSequenceForStep(
  input: SequenceOptimizationEngineInput,
  stepKey: string,
): { sequenceId: string | null; stepId: string | null } {
  if (stepKey === "no_step") return { sequenceId: null, stepId: null }
  const meta = input.stepMeta.find((row) => row.stepId === stepKey)
  return { sequenceId: meta?.sequenceId ?? null, stepId: stepKey }
}

function stepUnderperformerRecs(
  input: SequenceOptimizationEngineInput,
  seen: Set<string>,
  out: GrowthSequenceOptimizationRecommendation[],
): void {
  for (const row of input.bySequenceStep) {
    if (row.key === "no_step" || row.touchCount < MIN_STEP_TOUCHES || row.wins > 0) continue
    const { sequenceId, stepId } = resolveSequenceForStep(input, row.key)
    if (!sequenceId || !stepId || !matchesFilter(input, sequenceId)) continue

    const meta = input.stepMeta.find((s) => s.stepId === stepId)
    const seqName = sequenceLabel(input, sequenceId)
    const stName = stepLabel(input, stepId)

    const pause = row.touchCount >= MIN_STEP_TOUCHES_PAUSE
    const type = pause ? "pause_underperforming_step" : "remove_step"
    pushRec(out, seen, {
      id: recId(type, sequenceId, stepId),
      recommendationType: type,
      title: pause ? `Pause step: ${stName}` : `Review removing step: ${stName}`,
      explanation: `${stName} in ${seqName} recorded ${row.touchCount} touches with zero attributed wins in range.`,
      evidence: [
        evidence("Touches", String(row.touchCount), "touches"),
        evidence("Leads", String(row.leadCount), "leads"),
        evidence("Channel", meta?.channel ?? "unknown"),
        evidence("Delay (days)", `${meta?.delayDaysMin ?? 0}–${meta?.delayDaysMax ?? 0}`),
      ],
      confidence: confidenceScore({ touchCount: row.touchCount, leadCount: row.leadCount }),
      sequenceId,
      sequenceLabel: seqName,
      sequenceStepId: stepId,
      sequenceStepLabel: stName,
      expectedImpact: pause
        ? "Reduce fatigue and protect sender reputation while operators redesign the step."
        : "Shorten sequence path for enrolled leads after human approval.",
      recommendedEdit: pause
        ? "Operator: pause or skip this step in the pattern editor — do not auto-pause enrollments."
        : "Operator: evaluate removing or replacing this step after reviewing copy and timing.",
      safetyNotes: GROWTH_SEQUENCE_OPTIMIZATION_SAFETY_NOTES,
      category: pause ? "underperformer" : "step_structure",
    })
  }
}

function stepWinnerRecs(
  input: SequenceOptimizationEngineInput,
  seen: Set<string>,
  out: GrowthSequenceOptimizationRecommendation[],
): void {
  for (const row of input.bySequenceStep) {
    if (row.key === "no_step" || row.wins < 1 || row.attributedRevenue <= 0) continue
    const { sequenceId, stepId } = resolveSequenceForStep(input, row.key)
    if (!sequenceId || !stepId || !matchesFilter(input, sequenceId)) continue

    pushRec(out, seen, {
      id: recId("double_down_on_winning_angle", sequenceId, stepId),
      recommendationType: "double_down_on_winning_angle",
      title: `Winning step: ${stepLabel(input, stepId)}`,
      explanation: `${stepLabel(input, stepId)} contributed to attributed revenue in ${sequenceLabel(input, sequenceId)}.`,
      evidence: [
        evidence("Attributed revenue", `$${Math.round(row.attributedRevenue).toLocaleString()}`, "revenue"),
        evidence("Wins", String(row.wins), "wins"),
        evidence("Touches", String(row.touchCount), "touches"),
      ],
      confidence: confidenceScore({ wins: row.wins, touchCount: row.touchCount, bonus: 10 }),
      sequenceId,
      sequenceLabel: sequenceLabel(input, sequenceId),
      sequenceStepId: stepId,
      sequenceStepLabel: stepLabel(input, stepId),
      expectedImpact: "Higher win rate when similar messaging is reused on comparable leads.",
      recommendedEdit:
        "Reuse messaging themes from this step in human-approved templates — no automatic step duplication.",
      safetyNotes: GROWTH_SEQUENCE_OPTIMIZATION_SAFETY_NOTES,
      category: "winning_angle",
    })
  }
}

function sequenceScaleRecs(
  input: SequenceOptimizationEngineInput,
  seen: Set<string>,
  out: GrowthSequenceOptimizationRecommendation[],
): void {
  for (const row of input.bySequence) {
    if (row.key === "no_sequence" || row.wins < 1 || !matchesFilter(input, row.key)) continue
    pushRec(out, seen, {
      id: recId("double_down_on_winning_angle", row.key),
      recommendationType: "double_down_on_winning_angle",
      title: `Scale pattern: ${row.label}`,
      explanation: `${row.label} shows attributed wins — consider enrolling more ICP-fit leads after operator review.`,
      evidence: [
        evidence("Wins", String(row.wins), "wins"),
        evidence("Revenue", `$${Math.round(row.attributedRevenue).toLocaleString()}`, "revenue"),
        evidence("Touches", String(row.touchCount), "touches"),
      ],
      confidence: confidenceScore({ wins: row.wins, touchCount: row.touchCount, bonus: 8 }),
      sequenceId: row.key,
      sequenceLabel: row.label,
      sequenceStepId: null,
      sequenceStepLabel: null,
      expectedImpact: "Incremental pipeline when volume is added with deliverability headroom.",
      recommendedEdit: "Review enrollment criteria and sender capacity — manual enrollment only.",
      safetyNotes: GROWTH_SEQUENCE_OPTIMIZATION_SAFETY_NOTES,
      category: "winning_angle",
    })
  }
}

function copyImprovementRecs(
  input: SequenceOptimizationEngineInput,
  seen: Set<string>,
  out: GrowthSequenceOptimizationRecommendation[],
): void {
  const lowSubjects = [...input.subjectSignals]
    .filter((row) => row.sends >= 5 && (row.replyRatePct ?? 100) < 3)
    .slice(0, 2)
  for (const row of lowSubjects) {
    const topSeq = input.bySequence.find((s) => s.wins >= 1) ?? input.bySequence[0]
    const sequenceId = topSeq && topSeq.key !== "no_sequence" ? topSeq.key : null
    if (sequenceId && !matchesFilter(input, sequenceId)) continue
    pushRec(out, seen, {
      id: recId("improve_subject", sequenceId ?? "global", row.key),
      recommendationType: "improve_subject",
      title: `Improve subject line (${row.label})`,
      explanation: `Subject category "${row.key}" shows ${row.replyRatePct ?? 0}% reply rate across ${row.sends} tracked sends.`,
      evidence: [
        evidence("Sends", String(row.sends)),
        evidence("Reply rate", `${row.replyRatePct ?? 0}%`),
      ],
      confidence: confidenceScore({ touchCount: row.sends, replyRatePct: row.replyRatePct ?? 0 }),
      sequenceId,
      sequenceLabel: sequenceId ? sequenceLabel(input, sequenceId) : "All sequences",
      sequenceStepId: null,
      sequenceStepLabel: null,
      expectedImpact: "Moderate lift in reply rate when subject lines are human-reviewed.",
      recommendedEdit: "Test research-backed or memory-aware subject variants in approved copy — no auto-send.",
      safetyNotes: GROWTH_SEQUENCE_OPTIMIZATION_SAFETY_NOTES,
      category: "copy_improvement",
    })
  }

  const genericOpener = input.openerSignals.find(
    (row) => row.key === "generic" && row.sends >= 5 && (row.replyRatePct ?? 100) < 4,
  )
  if (genericOpener) {
    pushRec(out, seen, {
      id: recId("improve_opener", "global", genericOpener.key),
      recommendationType: "improve_opener",
      title: "Improve opener — generic strategy underperforming",
      explanation: `Generic openers reply at ${genericOpener.replyRatePct ?? 0}% vs research/memory-backed alternatives.`,
      evidence: [
        evidence("Generic sends", String(genericOpener.sends)),
        evidence("Reply rate", `${genericOpener.replyRatePct ?? 0}%`),
      ],
      confidence: 62,
      sequenceId: null,
      sequenceLabel: "All sequences",
      sequenceStepId: null,
      sequenceStepLabel: null,
      expectedImpact: "Higher positive reply rate with evidence-backed openers.",
      recommendedEdit: "Shift first-touch openers to research-backed or memory-backed patterns after human approval.",
      safetyNotes: GROWTH_SEQUENCE_OPTIMIZATION_SAFETY_NOTES,
      category: "copy_improvement",
    })
  }

  const weakCta = input.ctaSignals.find((row) => row.sends >= 8 && row.wins === 0)
  if (weakCta) {
    pushRec(out, seen, {
      id: recId("improve_cta", "global", weakCta.key),
      recommendationType: "improve_cta",
      title: `Improve CTA (${weakCta.label})`,
      explanation: `${weakCta.sends} sends with CTA category "${weakCta.key}" produced no positive outcomes in window.`,
      evidence: [
        evidence("Sends", String(weakCta.sends)),
        evidence("Positive outcomes", "0"),
      ],
      confidence: 58,
      sequenceId: null,
      sequenceLabel: "All sequences",
      sequenceStepId: null,
      sequenceStepLabel: null,
      expectedImpact: "Better meeting conversion when CTA matches buyer stage.",
      recommendedEdit: "Human-review CTA copy (calendar link, soft ask, or value recap) before next enrollment wave.",
      safetyNotes: GROWTH_SEQUENCE_OPTIMIZATION_SAFETY_NOTES,
      category: "copy_improvement",
    })
  }

  for (const pain of input.painPoints.slice(0, 3)) {
    if (pain.winCount < 1) continue
    const seq = input.bySequence.find((s) => s.wins >= 1)
    const sequenceId = seq?.key !== "no_sequence" ? seq?.key ?? null : null
    if (sequenceId && !matchesFilter(input, sequenceId)) continue
    pushRec(out, seen, {
      id: recId("double_down_on_winning_angle", sequenceId ?? "global", pain.key),
      recommendationType: "double_down_on_winning_angle",
      title: `Winning angle: ${pain.label}`,
      explanation: `Pain theme "${pain.label}" appears on ${pain.winCount} closed-won path(s).`,
      evidence: [
        evidence("Wins", String(pain.winCount)),
        evidence("Leads", String(pain.leadCount)),
      ],
      confidence: confidenceScore({ wins: pain.winCount, leadCount: pain.leadCount, bonus: 12 }),
      sequenceId,
      sequenceLabel: sequenceId ? sequenceLabel(input, sequenceId) : "All sequences",
      sequenceStepId: null,
      sequenceStepLabel: null,
      expectedImpact: "Stronger resonance when pain theme is consistent across steps.",
      recommendedEdit: "Emphasize this pain in step 1–2 copy after operator review — no template auto-update.",
      safetyNotes: GROWTH_SEQUENCE_OPTIMIZATION_SAFETY_NOTES,
      category: "winning_angle",
    })
  }
}

function timingRecs(
  input: SequenceOptimizationEngineInput,
  seen: Set<string>,
  out: GrowthSequenceOptimizationRecommendation[],
): void {
  for (const row of input.bySequenceStep) {
    if (row.key === "no_step" || row.touchCount < MIN_STEP_TOUCHES) continue
    const { sequenceId, stepId } = resolveSequenceForStep(input, row.key)
    if (!sequenceId || !stepId || !matchesFilter(input, sequenceId)) continue
    const meta = input.stepMeta.find((s) => s.stepId === stepId)
    if (!meta || meta.delayDaysMax < 4) continue
    if (row.wins > 0 && (row.leadCount === 0 || row.wins / Math.max(row.leadCount, 1) > 0.05)) continue

    pushRec(out, seen, {
      id: recId("adjust_timing", sequenceId, stepId),
      recommendationType: "adjust_timing",
      title: `Adjust timing: ${stepLabel(input, stepId)}`,
      explanation: `Step delay ${meta.delayDaysMin}–${meta.delayDaysMax} days with weak outcomes (${row.touchCount} touches, ${row.wins} wins).`,
      evidence: [
        evidence("Delay range (days)", `${meta.delayDaysMin}–${meta.delayDaysMax}`),
        evidence("Touches", String(row.touchCount)),
        evidence("Wins", String(row.wins)),
      ],
      confidence: confidenceScore({ touchCount: row.touchCount, bonus: 5 }),
      sequenceId,
      sequenceLabel: sequenceLabel(input, sequenceId),
      sequenceStepId: stepId,
      sequenceStepLabel: stepLabel(input, stepId),
      expectedImpact: "Faster progression may improve reply-to-meeting conversion.",
      recommendedEdit: `Operator: shorten delay_days for step ${meta.stepOrder} in pattern editor (suggest −2 days trial).`,
      safetyNotes: GROWTH_SEQUENCE_OPTIMIZATION_SAFETY_NOTES,
      category: "channel_timing",
    })
  }

  for (const snap of input.sequenceSnapshots) {
    if (!matchesFilter(input, snap.sequenceId)) continue
    if (snap.replyPct >= 5 || snap.revenue <= 0) continue
    pushRec(out, seen, {
      id: recId("adjust_timing", snap.sequenceId),
      recommendationType: "adjust_timing",
      title: `Review cadence: ${sequenceLabel(input, snap.sequenceId)}`,
      explanation: `30d snapshot shows ${snap.replyPct}% reply rate — cadence may be too aggressive or mistimed.`,
      evidence: [
        evidence("Reply % (30d)", `${snap.replyPct}%`),
        evidence("Revenue (30d)", `$${Math.round(snap.revenue).toLocaleString()}`),
      ],
      confidence: 55,
      sequenceId: snap.sequenceId,
      sequenceLabel: sequenceLabel(input, snap.sequenceId),
      sequenceStepId: null,
      sequenceStepLabel: null,
      expectedImpact: "Improved engagement when spacing aligns with buyer cycle.",
      recommendedEdit: "Spread steps or align sends to governance send windows — manual pattern edit only.",
      safetyNotes: GROWTH_SEQUENCE_OPTIMIZATION_SAFETY_NOTES,
      category: "channel_timing",
    })
  }
}

function channelRecs(
  input: SequenceOptimizationEngineInput,
  seen: Set<string>,
  out: GrowthSequenceOptimizationRecommendation[],
): void {
  const ranked = [...input.channelEffectiveness].filter((c) => c.touchCount >= 5).sort(
    (a, b) => b.effectivenessScore - a.effectivenessScore,
  )
  if (ranked.length < 2) return

  const best = ranked[0]!
  const weak = ranked[ranked.length - 1]!
  if (best.effectivenessScore - weak.effectivenessScore < 15) return

  for (const meta of input.stepMeta) {
    if (meta.channel !== weak.channel || !matchesFilter(input, meta.sequenceId)) continue
    if (meta.channel === best.channel) continue

    pushRec(out, seen, {
      id: recId("change_channel", meta.sequenceId, meta.stepId),
      recommendationType: "change_channel",
      title: `Change channel on step ${meta.stepOrder}`,
      explanation: `${weak.channel} effectiveness score ${weak.effectivenessScore} vs ${best.channel} at ${best.effectivenessScore}.`,
      evidence: [
        evidence("Current channel", meta.channel),
        evidence("Suggested channel", best.channel),
        evidence("Effectiveness delta", String(best.effectivenessScore - weak.effectivenessScore)),
      ],
      confidence: Math.min(85, 50 + best.effectivenessScore - weak.effectivenessScore),
      sequenceId: meta.sequenceId,
      sequenceLabel: sequenceLabel(input, meta.sequenceId),
      sequenceStepId: meta.stepId,
      sequenceStepLabel: stepLabel(input, meta.stepId),
      expectedImpact: "Higher reply or meeting rate when channel matches buyer preference.",
      recommendedEdit: `Operator: change step ${meta.stepOrder} channel from ${meta.channel} to ${best.channel} after compliance review.`,
      safetyNotes: GROWTH_SEQUENCE_OPTIMIZATION_SAFETY_NOTES,
      category: "channel_timing",
    })
  }

  const emailWeak = input.byChannel.find(
    (c) => c.key === "email" && c.touchCount >= 15 && c.wins === 0,
  )
  const smsStrong = input.byChannel.find((c) => c.key === "sms" && c.wins >= 1)
  if (emailWeak && smsStrong) {
    const seq = input.bySequence.find((s) => s.wins >= 1)
    const sequenceId = seq && seq.key !== "no_sequence" ? seq.key : null
    if (!sequenceId || matchesFilter(input, sequenceId)) {
      pushRec(out, seen, {
        id: recId("change_channel", sequenceId ?? "global"),
        recommendationType: "change_channel",
        title: "Consider SMS follow-up after email",
        explanation: "Email touches show volume without wins while SMS shows attributed wins in range.",
        evidence: [
          evidence("Email touches", String(emailWeak.touchCount)),
          evidence("SMS wins", String(smsStrong.wins)),
        ],
        confidence: 60,
        sequenceId,
        sequenceLabel: sequenceId ? sequenceLabel(input, sequenceId) : "All sequences",
        sequenceStepId: null,
        sequenceStepLabel: null,
        expectedImpact: "Multichannel lift for stalled email threads.",
        recommendedEdit: "Add human-approved SMS step after email sequence — no auto channel switch.",
        safetyNotes: GROWTH_SEQUENCE_OPTIMIZATION_SAFETY_NOTES,
        category: "channel_timing",
      })
    }
  }
}

function addStepRecs(
  input: SequenceOptimizationEngineInput,
  seen: Set<string>,
  out: GrowthSequenceOptimizationRecommendation[],
): void {
  const reply = input.funnel.find((s) => s.stage === "reply")
  const meeting = input.funnel.find((s) => s.stage === "meeting")
  if (!reply || !meeting || reply.count < 5 || meeting.count > 0) return
  if ((meeting.conversionRatePct ?? 100) > 20) return

  for (const row of input.bySequence) {
    if (row.key === "no_sequence" || !matchesFilter(input, row.key)) continue
    if (row.wins < 1 && row.touchCount < 20) continue
    const stepsForSeq = input.stepMeta.filter((s) => s.sequenceId === row.key)
    if (stepsForSeq.length >= 8) continue

    pushRec(out, seen, {
      id: recId("add_step", row.key),
      recommendationType: "add_step",
      title: `Add follow-up step: ${row.label}`,
      explanation: "Replies recorded but few meeting touches — pattern may need a dedicated meeting CTA step.",
      evidence: [
        evidence("Replies (funnel)", String(reply.count)),
        evidence("Meetings (funnel)", String(meeting.count)),
        evidence("Pattern steps", String(stepsForSeq.length)),
      ],
      confidence: 58,
      sequenceId: row.key,
      sequenceLabel: row.label,
      sequenceStepId: null,
      sequenceStepLabel: null,
      expectedImpact: "Improved reply-to-meeting conversion with explicit scheduling step.",
      recommendedEdit: "Operator: add human-approved meeting-booking step after positive-reply branch.",
      safetyNotes: GROWTH_SEQUENCE_OPTIMIZATION_SAFETY_NOTES,
      category: "step_structure",
    })
  }
}

function replyQualityRecs(
  input: SequenceOptimizationEngineInput,
  seen: Set<string>,
  out: GrowthSequenceOptimizationRecommendation[],
): void {
  for (const row of input.replyQualityBySequence) {
    if (!matchesFilter(input, row.sequenceId)) continue
    if (row.totalReplies < 5 || row.objectionRate < 25) continue
    pushRec(out, seen, {
      id: recId("improve_opener", row.sequenceId),
      recommendationType: "improve_opener",
      title: `Reply quality review: ${sequenceLabel(input, row.sequenceId)}`,
      explanation: `Reply learning shows ${row.objectionRate}% objection rate across ${row.totalReplies} replies.`,
      evidence: [
        evidence("Objection rate", `${row.objectionRate}%`),
        evidence("Reply quality score", String(row.replyQualityScore)),
        evidence("Positive reply rate", `${row.positiveReplyRate}%`),
      ],
      confidence: confidenceScore({ touchCount: row.totalReplies, bonus: row.objectionRate > 35 ? 10 : 0 }),
      sequenceId: row.sequenceId,
      sequenceLabel: sequenceLabel(input, row.sequenceId),
      sequenceStepId: null,
      sequenceStepLabel: null,
      expectedImpact: "Fewer objections when opener and value prop align with ICP pain.",
      recommendedEdit: "Revise step 1 opener and objection-handling branch — manual edit only.",
      safetyNotes: GROWTH_SEQUENCE_OPTIMIZATION_SAFETY_NOTES,
      category: "copy_improvement",
    })
  }
}

function buildRollups(input: SequenceOptimizationEngineInput): GrowthSequenceOptimizationRollups {
  return {
    topSequences: input.bySequence
      .filter((r) => r.wins >= 1)
      .slice(0, 5)
      .map((r) => ({
        sequenceId: r.key,
        label: r.label,
        wins: r.wins,
        revenue: r.attributedRevenue,
      })),
    weakSteps: input.bySequenceStep
      .filter((r) => r.touchCount >= MIN_STEP_TOUCHES && r.wins === 0)
      .slice(0, 5)
      .map((r) => ({
        stepId: r.key,
        label: r.label,
        touches: r.touchCount,
        wins: r.wins,
      })),
    topSubjectCategories: input.subjectSignals.slice(0, 3).map((r) => ({
      key: r.key,
      label: r.label,
      replyRatePct: r.replyRatePct,
      sends: r.sends,
    })),
    topOpenerStrategies: input.openerSignals.slice(0, 3).map((r) => ({
      key: r.key,
      label: r.label,
      replyRatePct: r.replyRatePct,
      sends: r.sends,
    })),
    channelScores: input.channelEffectiveness.slice(0, 5).map((c) => ({
      channel: c.channel,
      effectivenessScore: c.effectivenessScore,
    })),
    generatedAt: new Date().toISOString(),
  }
}

export function generateSequenceOptimizationRecommendations(
  input: SequenceOptimizationEngineInput,
): GrowthSequenceOptimizationRecommendationsPayload {
  const seen = new Set<string>()
  const all: GrowthSequenceOptimizationRecommendation[] = []

  sequenceScaleRecs(input, seen, all)
  stepWinnerRecs(input, seen, all)
  stepUnderperformerRecs(input, seen, all)
  copyImprovementRecs(input, seen, all)
  timingRecs(input, seen, all)
  channelRecs(input, seen, all)
  addStepRecs(input, seen, all)
  replyQualityRecs(input, seen, all)

  all.sort((a, b) => b.confidence - a.confidence || a.title.localeCompare(b.title))

  return {
    qa_marker: GROWTH_SEQUENCE_OPTIMIZATION_V2_QA_MARKER,
    recommendations: all,
    winningAngles: all.filter((r) => r.category === "winning_angle"),
    copyImprovements: all.filter((r) => r.category === "copy_improvement"),
    stepStructure: all.filter((r) => r.category === "step_structure" || r.category === "underperformer"),
    channelTiming: all.filter((r) => r.category === "channel_timing"),
    underperformers: all.filter((r) => r.category === "underperformer"),
    rollups: buildRollups(input),
    touchesAnalyzed: input.touchesAnalyzed,
    lastCalculatedAt: new Date().toISOString(),
  }
}
