export function computeTranscriptQualityScore(input: {
  finalChunkCount: number
  averageConfidence: number
  keywordHitRate: number
  speakerSeparationEnabled: boolean
  speakerLabelsPresent: boolean
}): number {
  if (input.finalChunkCount <= 0) return 0
  let score = input.averageConfidence
  if (input.keywordHitRate > 0) score += Math.min(10, input.keywordHitRate * 10)
  if (input.speakerSeparationEnabled && input.speakerLabelsPresent) score += 5
  return Math.max(0, Math.min(100, Math.round(score)))
}
