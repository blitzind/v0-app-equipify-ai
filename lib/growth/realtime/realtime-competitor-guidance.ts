import { detectRealtimeCompetitors } from "@/lib/growth/realtime/realtime-objections"
import type { GrowthRealtimeCompetitorGuidance } from "@/lib/growth/realtime/realtime-call-types"

const COMPETITOR_ANGLES: Record<string, string> = {
  "Housecall Pro": "What would you improve today?",
  ServiceTitan: "Where does ServiceTitan create friction for your team?",
  Jobber: "What made Jobber fall short of what you need now?",
  FieldEdge: "What would you change about your current FieldEdge workflow?",
  Salesforce: "How is Salesforce supporting—or blocking—field operations?",
  HubSpot: "Where does HubSpot break down for your service workflow?",
}

export function buildRealtimeCompetitorGuidance(transcriptText: string): GrowthRealtimeCompetitorGuidance[] {
  const competitors = detectRealtimeCompetitors(transcriptText)
  return competitors.map((competitor) => ({
    competitor,
    suggestedAngle: COMPETITOR_ANGLES[competitor] ?? "What would you improve about your current setup?",
  }))
}
