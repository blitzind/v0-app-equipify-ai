/** Apollo Sequence Execution — sequence pattern lookup resolution (client-safe). */

import { APOLLO_CERTIFICATION_FALLBACK_TEMPLATE_KEYS } from "@/lib/growth/apollo/apollo-certification-multichannel-template-override"

export const APOLLO_SEQUENCE_EXECUTION_PATTERN_RESOLUTION_QA_MARKER =
  "apollo-sequence-execution-pattern-resolution-v1" as const

export const APOLLO_CERTIFICATION_SEQUENCE_PATTERN_KEYS = [
  ...APOLLO_CERTIFICATION_FALLBACK_TEMPLATE_KEYS,
] as const

export type ApolloSequencePatternSource = "persisted_pattern" | "certification_inline_pattern"

export type ApolloSequencePatternResolution = {
  sequence_pattern_lookup_key: string
  certification_fallback_pattern_used: boolean
  pattern_source: ApolloSequencePatternSource
}

export function isApolloCertificationSequencePatternKey(sequenceKey: string): boolean {
  return (APOLLO_CERTIFICATION_SEQUENCE_PATTERN_KEYS as readonly string[]).includes(sequenceKey.trim())
}

export function resolveApolloSequenceExecutionPatternLookup(
  input: {
    sequence_key: string
  },
): ApolloSequencePatternResolution {
  const sequenceKey = input.sequence_key.trim()

  if (isApolloCertificationSequencePatternKey(sequenceKey)) {
    return {
      sequence_pattern_lookup_key: sequenceKey,
      certification_fallback_pattern_used: true,
      pattern_source: "persisted_pattern",
    }
  }

  return {
    sequence_pattern_lookup_key: "multichannel_with_voice_drop",
    certification_fallback_pattern_used: false,
    pattern_source: "persisted_pattern",
  }
}
