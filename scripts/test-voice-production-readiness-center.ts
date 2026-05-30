/**
 * Voice Production Readiness Center — regression checks.
 * Run: pnpm test:voice-production-readiness-center
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  VOICE_PRODUCTION_READINESS_CENTER_QA_MARKER,
  VOICE_PRODUCTION_READINESS_SECTION_IDS,
} from "../lib/voice/production-readiness/types"

assert.equal(VOICE_PRODUCTION_READINESS_CENTER_QA_MARKER, "voice-production-readiness-center-v1")
assert.equal(VOICE_PRODUCTION_READINESS_SECTION_IDS.length, 12)

const typesSource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/production-readiness/types.ts"),
  "utf8",
)
assert.match(typesSource, /twilio_connection/)
assert.match(typesSource, /multi_channel/)

const builderSource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/production-readiness/build-voice-production-readiness-center.ts"),
  "utf8",
)
assert.match(builderSource, /fetchVoiceOperationsReadiness/)
assert.match(builderSource, /fetchVoiceBrowserCallingReadiness/)
assert.match(builderSource, /fetchAiReceptionistReadiness/)
assert.match(builderSource, /fetchComplianceReadiness/)
assert.match(builderSource, /buildTwilioConnectionSection/)
assert.match(builderSource, /buildMultiChannelSection/)

const routeSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/readiness/route.ts"),
  "utf8",
)
assert.match(routeSource, /buildVoiceProductionReadinessCenter/)
assert.match(routeSource, /VOICE_PRODUCTION_READINESS_CENTER_QA_MARKER/)
assert.doesNotMatch(routeSource, /fetchVoiceOperationsReadiness/)

const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/voice/readiness/page.tsx"),
  "utf8",
)
assert.match(pageSource, /GrowthVoiceProductionReadinessDashboard/)
assert.match(pageSource, /VOICE_PRODUCTION_READINESS_CENTER_QA_MARKER/)
assert.match(pageSource, /data-voice-production-readiness-page-qa-marker/)

const dashboardSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-voice-production-readiness-dashboard.tsx"),
  "utf8",
)
assert.match(dashboardSource, /Re-run readiness check/)
assert.match(dashboardSource, /Copy URL/)
assert.match(dashboardSource, /Open provider settings/)
assert.match(dashboardSource, /data-voice-readiness-section/)

const navSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/navigation/growth-navigation-destinations.ts"),
  "utf8",
)
assert.match(navSource, /\/admin\/growth\/voice\/readiness/)

const docsSource = fs.readFileSync(
  path.join(process.cwd(), "docs/VOICE_ENVIRONMENT_REQUIREMENTS.md"),
  "utf8",
)
assert.match(docsSource, /\/admin\/growth\/voice\/readiness/)

console.log("voice-production-readiness-center checks passed")
