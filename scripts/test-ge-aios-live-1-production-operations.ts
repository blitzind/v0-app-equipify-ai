/**
 * GE-AIOS-LIVE-1 — Local certification (no production DB).
 */
import {
  GE_AIOS_LIVE_1_QA_MARKER,
  GE_AIOS_LIVE_1_PHASE,
} from "@/lib/growth/live-operations/ge-aios-live-1-types"
import { LIVE_1_REQUIRED_QA_MARKERS } from "@/lib/growth/live-operations/ge-aios-live-1-operations-analysis"

const PHASE = GE_AIOS_LIVE_1_PHASE

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Local certification`)
  assert(GE_AIOS_LIVE_1_QA_MARKER === "ge-aios-live-1-autonomous-production-operations-v1", "QA marker")
  assert(LIVE_1_REQUIRED_QA_MARKERS.live === GE_AIOS_LIVE_1_QA_MARKER, "live marker in bundle")
  assert(typeof LIVE_1_REQUIRED_QA_MARKERS.admission === "string", "admission marker")
  assert(typeof LIVE_1_REQUIRED_QA_MARKERS.evidence === "string", "evidence marker")
  assert(typeof LIVE_1_REQUIRED_QA_MARKERS.canonical === "string", "canonical marker")
  console.log(`[${PHASE}] PASS`)
}

void main()
