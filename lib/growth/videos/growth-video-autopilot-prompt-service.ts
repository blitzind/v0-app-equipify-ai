/** Growth Engine F1 — Video Autopilot prompt + model schema (client-safe). */

import { z } from "zod"
import type {
  GrowthVideoAutopilotInputSnapshot,
  GrowthVideoAutopilotRecommendedAssets,
  GrowthVideoAutopilotScores,
  GrowthVideoAutopilotVideoType,
} from "@/lib/growth/videos/growth-video-autopilot-types"

export const growthVideoAutopilotModelSchema = z.object({
  script: z.string().min(1),
  hook: z.string().min(1),
  talking_points: z.array(z.string()).min(1).max(6),
  cta_copy: z.string().min(1),
  thumbnail_text: z.string().min(1),
  overlay_text: z.string().min(1),
  follow_up_summary: z.string().min(1),
  rationale: z.string().min(1),
})

export type GrowthVideoAutopilotModelOutput = z.infer<typeof growthVideoAutopilotModelSchema>

export function buildGrowthVideoAutopilotSystemPrompt(): string {
  return [
    "You are a Growth Engine video campaign strategist.",
    "Design personalized video campaign recommendations for B2B prospects.",
    "Return strict JSON only.",
    "Never propose autonomous sends, enrollment, or sequence execution.",
    "All recommendations require explicit human approval before any action.",
  ].join(" ")
}

export function buildGrowthVideoAutopilotUserPrompt(input: {
  snapshot: GrowthVideoAutopilotInputSnapshot
  scores: GrowthVideoAutopilotScores
  videoType: GrowthVideoAutopilotVideoType
  shouldSendVideo: boolean
}): string {
  return [
    "Generate a personalized video campaign recommendation package.",
    `Should send video: ${input.shouldSendVideo ? "yes" : "no"}`,
    `Video type: ${input.videoType}`,
    `Opportunity score: ${input.scores.videoOpportunityScore}`,
    `Personalization score: ${input.scores.personalizationScore}`,
    `Priority: ${input.scores.recommendedPriority}`,
    `Reasons: ${input.scores.reasons.join(", ") || "none"}`,
    "",
    "Prospect context:",
    JSON.stringify(input.snapshot, null, 2),
    "",
    "Return JSON with: script, hook, talking_points, cta_copy, thumbnail_text, overlay_text, follow_up_summary, rationale.",
  ].join("\n")
}

export function buildDeterministicGrowthVideoAutopilotRecommendation(input: {
  snapshot: GrowthVideoAutopilotInputSnapshot
  scores: GrowthVideoAutopilotScores
  videoType: GrowthVideoAutopilotVideoType
  shouldSendVideo: boolean
  channel: GrowthVideoAutopilotRecommendedAssets["channel"]
}): GrowthVideoAutopilotRecommendedAssets {
  const firstName = input.snapshot.contactName?.split(/\s+/)[0] ?? "there"
  const company = input.snapshot.companyName ?? "your team"
  const pain = input.snapshot.painPoints[0] ?? "manual follow-up and missed opportunities"
  const hook = `Hi ${firstName}, I recorded a quick ${input.videoType.replace(/_/g, " ")} for ${company}.`

  const script = [
    hook,
    "",
    `I noticed ${company} may be dealing with ${pain}.`,
    input.snapshot.researchSummary ? input.snapshot.researchSummary : "",
    "",
    "I put together a short personalized video with next steps.",
    "Let me know if you'd like to walk through it together.",
  ]
    .filter(Boolean)
    .join("\n")

  return {
    script,
    thumbnailText: `${firstName} — personalized video`,
    overlayText: `Quick video for ${company}`,
    ctaLabel: input.scores.reasons.includes("meeting_ready") ? "Book a meeting" : "Watch video",
    ctaUrl: null,
    calendarUrl: null,
    voiceEnabled: input.channel === "voice_drop" || input.scores.recommendedPriority === "high",
    avatarEnabled: input.scores.videoOpportunityScore >= 70,
    channel: input.channel,
    followUpSummary: `Follow up after ${input.videoType.replace(/_/g, " ")} video with ${firstName} at ${company}.`,
  }
}

export function mapGrowthVideoAutopilotModelToRecommended(
  output: GrowthVideoAutopilotModelOutput,
  channel: GrowthVideoAutopilotRecommendedAssets["channel"],
): GrowthVideoAutopilotRecommendedAssets {
  return {
    script: output.script,
    thumbnailText: output.thumbnail_text,
    overlayText: output.overlay_text,
    ctaLabel: output.cta_copy,
    ctaUrl: null,
    calendarUrl: null,
    voiceEnabled: channel === "voice_drop",
    avatarEnabled: true,
    channel,
    followUpSummary: output.follow_up_summary,
  }
}
