/**
 * GE-AI-UX-3A — AI Teammate Identity & Personalization Foundation certification (static).
 * Run: pnpm test:ge-ai-ux-3a-ai-teammate-identity-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthHomeExecutiveBriefingCertDashboard,
  buildGrowthHomeExecutiveBriefingCertFixture,
  synthesizeGrowthHomeExecutiveBriefing,
} from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  buildGrowthAiOsOperatorExperienceCertFixture,
  synthesizeGrowthAiOsOperatorExperience,
} from "../lib/growth/aios/operator-experience/growth-ai-os-operator-experience-synthesizer"
import { GROWTH_AI_OS_OPERATOR_EXPERIENCE_QA_MARKER } from "../lib/growth/aios/operator-experience/growth-ai-os-operator-experience-types"
import {
  AI_TEAMMATE_DEFAULT_NAME,
  AI_TEAMMATE_DEFAULT_ROLE,
  GE_AI_UX_3A_QA_MARKER,
  isValidAiTeammateName,
  normalizeAiTeammateName,
  resolveAiTeammatePresentation,
} from "../lib/workspace/ai-teammate-identity"
import { teammateHomeIntro } from "../lib/workspace/ai-teammate-voice"
import { AI_OS_WORKSPACE_LABEL } from "../lib/workspace/ai-os-workspace-branding"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[GE-AI-UX-3A] AI Teammate Identity & Personalization Foundation certification`)

assert.equal(GE_AI_UX_3A_QA_MARKER, "ge-ai-ux-3a-ai-teammate-identity-foundation-v1")
assert.equal(AI_TEAMMATE_DEFAULT_NAME, "Ava")
assert.equal(AI_TEAMMATE_DEFAULT_ROLE, "Equipify's AI Growth Operator")
assert.ok(isValidAiTeammateName("Emma"))
assert.ok(isValidAiTeammateName("Scout"))
assert.equal(isValidAiTeammateName("A"), false)
console.log("  ✓ default teammate identity is Ava with editable name validation")

const customTeammate = resolveAiTeammatePresentation("Jordan")
const homeCustom = synthesizeGrowthHomeExecutiveBriefing({
  dashboard: buildGrowthHomeExecutiveBriefingCertDashboard(),
  teammate: customTeammate,
})
assert.ok(homeCustom.executiveBrief.introLine.includes("Jordan handled"))
assert.equal(homeCustom.executiveBrief.teammateName, "Jordan")
console.log("  ✓ Home narrative uses configured teammate name")

const homeDefault = buildGrowthHomeExecutiveBriefingCertFixture()
assert.ok(homeDefault.executiveBrief.introLine.includes("Ava handled"))
assert.ok(homeDefault.executiveBrief.completedOutcomes[0]?.startsWith("She "))
console.log("  ✓ default Home copy attributes completed work to Ava")

const operatorView = synthesizeGrowthAiOsOperatorExperience(buildGrowthAiOsOperatorExperienceCertFixture())
assert.equal(operatorView.executiveBrief.teammateName, "Ava")
assert.ok(operatorView.executiveBrief.introLine.includes("Ava handled"))
assert.ok(operatorView.aiWorking[0]?.label.includes("Ava is"))
console.log("  ✓ AI Operations uses teammate presence language")

assert.equal(GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER, "growth-ge-ai-arch-2c-ai-os-v1-product-alignment-v1")
assert.equal(GROWTH_AI_OS_OPERATOR_EXPERIENCE_QA_MARKER, "growth-ge-ai-ux-3a-teammate-operator-experience-v1")
console.log("  ✓ QA markers bumped for teammate identity layer")

const requiredFiles = [
  "lib/workspace/ai-teammate-identity.ts",
  "lib/workspace/ai-teammate-voice.ts",
  "components/growth/ai-teammate/ai-teammate-identity-provider.tsx",
  "components/growth/ai-teammate/growth-ai-teammate-profile.tsx",
  "components/growth/ai-teammate/growth-ai-teammate-onboarding-dialog.tsx",
  "components/growth/settings/growth-ai-teammate-settings-panel.tsx",
  "app/(growth)/growth/settings/ai-teammate/page.tsx",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`)
}
console.log(`  ✓ ${requiredFiles.length} teammate identity files present`)

const shell = readSource("components/growth/shell/growth-workspace-shell.tsx")
assert.ok(shell.includes("AiTeammateIdentityProvider"))
assert.ok(shell.includes("GrowthAiTeammateOnboardingDialog"))
console.log("  ✓ growth shell wires teammate provider and onboarding")

const topbar = readSource("components/growth/shell/growth-topbar.tsx")
assert.ok(topbar.includes("GrowthAiTeammateProfile"))
console.log("  ✓ topbar shows compact AI teammate profile")

const settingsNav = readSource("lib/growth/navigation/growth-workspace-settings-navigation.ts")
assert.ok(settingsNav.includes('"ai-teammate"'))
const settingsPanel = readSource("components/growth/settings/growth-ai-teammate-settings-panel.tsx")
assert.ok(settingsPanel.includes("AI Teammate"))
assert.ok(settingsPanel.includes("Role"))
assert.ok(settingsPanel.includes("Coming soon"))
console.log("  ✓ Settings → AI Teammate with read-only role and future placeholders")

assert.equal(AI_OS_WORKSPACE_LABEL, "AI OS")
const onboarding = readSource("components/growth/ai-teammate/growth-ai-teammate-onboarding-dialog.tsx")
assert.ok(onboarding.includes("AI_OS_WORKSPACE_LABEL"))
assert.ok(onboarding.includes("AI_TEAMMATE_DEFAULT_NAME"))
console.log("  ✓ platform remains AI OS; onboarding introduces Ava")

const identityModule = readSource("lib/workspace/ai-teammate-identity.ts")
assert.equal(identityModule.includes("fetch("), false)
assert.equal(identityModule.includes('import "server-only"'), false)
const homeSynthesizer = readSource("lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer.ts")
assert.equal(homeSynthesizer.includes("fetch("), false)
console.log("  ✓ presentation-only — localStorage identity, no backend/API changes")

assert.equal(normalizeAiTeammateName("  ava  "), "Ava")
assert.equal(teammateHomeIntro(resolveAiTeammatePresentation("Claire")), "Claire handled most of the work while you were away.")
console.log("  ✓ voice helpers produce professional teammate copy")

console.log(`[GE-AI-UX-3A] PASS — ${GE_AI_UX_3A_QA_MARKER}`)
