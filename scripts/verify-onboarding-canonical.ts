/**
 * Smoke test: every legacy / marketing variant resolves to the canonical
 * onboarding option that matches the `<select>` value rendered in
 * `app/(auth)/onboarding/page.tsx`. Run with `pnpm tsx scripts/verify-onboarding-canonical.ts`.
 */
import {
  ONBOARDING_CURRENT_SYSTEM_OPTIONS,
  ONBOARDING_TEAM_SIZE_OPTIONS,
  normalizeOnboardingCurrentSystem,
  normalizeOnboardingIndustry,
  normalizeOnboardingTeamSize,
  parseOnboardingSearchParams,
} from "@/lib/onboarding-canonical"

type Case<T> = { input: string | null | undefined; expected: T }

function run<T>(label: string, cases: Case<T>[], fn: (input: string | null | undefined) => T): void {
  let failures = 0
  for (const c of cases) {
    const actual = fn(c.input)
    if (actual !== c.expected) {
      failures += 1
      console.error(`✗ ${label}: ${JSON.stringify(c.input)} → ${JSON.stringify(actual)} (expected ${JSON.stringify(c.expected)})`)
    }
  }
  if (failures === 0) console.log(`✓ ${label} — ${cases.length} cases`)
  if (failures > 0) process.exitCode = 1
}

run<string>(
  "industry",
  [
    { input: "medical-equipment", expected: "biomedical_medical_equipment" },
    { input: "Medical Equipment", expected: "biomedical_medical_equipment" },
    { input: "biomedical-equipment", expected: "biomedical_medical_equipment" },
    { input: "Biomedical / Medical Equipment", expected: "biomedical_medical_equipment" },
    { input: "biomedical-medical-equipment", expected: "biomedical_medical_equipment" },
    { input: "medical-equipment-service", expected: "biomedical_medical_equipment" },
    { input: "biomedical-equipment-service", expected: "biomedical_medical_equipment" },
    { input: "industrial-equipment-service", expected: "industrial_equipment" },
    { input: "elevator-lift-service", expected: "elevator_service" },
    { input: "property-management-maintenance", expected: "property_management" },
    { input: "other-field-service", expected: "field_service" },
    { input: "generator-power", expected: "generator_power" },
    { input: "hvac-r", expected: "hvac_r" },
    { input: "commercial-equipment", expected: "commercial_equipment" },
    { input: null, expected: "commercial_equipment" },
    { input: "", expected: "commercial_equipment" },
    { input: "totally-unknown-vertical", expected: "commercial_equipment" },
  ],
  normalizeOnboardingIndustry,
)

run<string | null>(
  "teamSize",
  [
    { input: "1-3", expected: "1-3" },
    { input: "4-10", expected: "4-10" },
    { input: "100+", expected: "100+" },
    { input: "Just me", expected: "1-3" },
    { input: "just-me", expected: "1-3" },
    { input: "2–5 people", expected: "4-10" },
    { input: "6–15 people", expected: "11-25" },
    { input: "16–50 people", expected: "26-50" },
    { input: "50+ people", expected: "51-100" },
    { input: "100", expected: "100+" },
    { input: "", expected: null },
    { input: null, expected: null },
    { input: "weird-bucket", expected: null },
  ],
  normalizeOnboardingTeamSize,
)

run<string | null>(
  "currentSystem",
  [
    { input: "Spreadsheets / Paper", expected: "Spreadsheets / Paper" },
    { input: "spreadsheets-paper", expected: "Spreadsheets / Paper" },
    { input: "ServiceTitan", expected: "ServiceTitan" },
    { input: "service-titan", expected: "ServiceTitan" },
    { input: "Workiz", expected: "Workiz" },
    { input: "FieldPulse", expected: "FieldPulse" },
    { input: "Knowify", expected: "Knowify" },
    { input: "Other", expected: "Other FSM Software" },
    { input: "other", expected: "Other FSM Software" },
    { input: "None / Not using one", expected: "None / Starting Fresh" },
    { input: "none-not-using-one", expected: "None / Starting Fresh" },
    { input: "None / Starting Fresh", expected: "None / Starting Fresh" },
    { input: null, expected: null },
    { input: "", expected: null },
    { input: "Some custom thing", expected: null },
  ],
  normalizeOnboardingCurrentSystem,
)

// Sanity: every canonical option is a fixed point of itself.
for (const value of ONBOARDING_CURRENT_SYSTEM_OPTIONS) {
  if (normalizeOnboardingCurrentSystem(value) !== value) {
    process.exitCode = 1
    console.error(`✗ currentSystem identity failed for ${value}`)
  }
}
for (const value of ONBOARDING_TEAM_SIZE_OPTIONS) {
  if (normalizeOnboardingTeamSize(value) !== value) {
    process.exitCode = 1
    console.error(`✗ teamSize identity failed for ${value}`)
  }
}

// Sanity: parseOnboardingSearchParams reads `current_system` legacy alias.
{
  const fakeParams = new Map<string, string>([
    ["industry", "medical-equipment-service"],
    ["current_system", "Workiz"],
    ["team_size", "Just me"],
  ])
  const sp = { get: (k: string) => fakeParams.get(k) ?? null }
  const out = parseOnboardingSearchParams(sp)
  if (out.industry !== "biomedical_medical_equipment") {
    process.exitCode = 1
    console.error(`✗ parseOnboardingSearchParams.industry: ${out.industry}`)
  }
  if (out.currentSystem !== "Workiz") {
    process.exitCode = 1
    console.error(`✗ parseOnboardingSearchParams.currentSystem: ${out.currentSystem}`)
  }
  if (out.teamSize !== "1-3") {
    process.exitCode = 1
    console.error(`✗ parseOnboardingSearchParams.teamSize: ${out.teamSize}`)
  }
  if (process.exitCode !== 1) {
    console.log("✓ parseOnboardingSearchParams reads legacy current_system + team_size")
  }
}

if (process.exitCode === 1) {
  console.error("\nonboarding canonical normalization FAILED")
} else {
  console.log("\nonboarding canonical normalization OK")
}
