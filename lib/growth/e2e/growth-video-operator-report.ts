/** Growth Engine E1 — Video operator certification report (client-safe). */

export const GROWTH_VIDEO_OPERATOR_CERT_QA_MARKER = "growth-video-operator-certification-e1-v1" as const

export const GROWTH_VIDEO_OPERATOR_CERT_CONFIRM = "RUN_GROWTH_VIDEO_OPERATOR_CERTIFICATION" as const

export const GROWTH_VIDEO_OPERATOR_REPORT_SECTIONS = [
  "video_assets",
  "pages",
  "personalization",
  "thumbnails",
  "scripts",
  "voice",
  "avatar",
  "sequence_attachments",
  "analytics",
  "intelligence",
] as const

export type GrowthVideoOperatorReportSectionId = (typeof GROWTH_VIDEO_OPERATOR_REPORT_SECTIONS)[number]

export type GrowthVideoOperatorCheckStatus = "PASS" | "WARN" | "FAIL"

export type GrowthVideoOperatorBlockingSeverity = "none" | "low" | "medium" | "high" | "critical"

export type GrowthVideoOperatorCheckResult = {
  id: string
  label: string
  status: GrowthVideoOperatorCheckStatus
  pass: boolean
  rootCause?: string | null
  recommendedFix?: string | null
  blockingSeverity: GrowthVideoOperatorBlockingSeverity
  detail?: Record<string, unknown>
}

export type GrowthVideoOperatorScenarioId =
  | "scenario_1_upload_publish"
  | "scenario_2_personalization"
  | "scenario_3_thumbnails"
  | "scenario_4_scripts"
  | "scenario_5_voice"
  | "scenario_6_avatar"
  | "scenario_7_sequence_attach"
  | "scenario_8_channel_previews"
  | "scenario_9_engagement"
  | "scenario_10_intelligence"

export type GrowthVideoOperatorScenarioResult = {
  scenario_id: GrowthVideoOperatorScenarioId
  title: string
  status: GrowthVideoOperatorCheckStatus
  pass: boolean
  checks: GrowthVideoOperatorCheckResult[]
  sections: GrowthVideoOperatorReportSectionId[]
}

export type GrowthVideoOperatorSectionReport = {
  section_id: GrowthVideoOperatorReportSectionId
  label: string
  status: GrowthVideoOperatorCheckStatus
  pass: boolean
  check_count: number
  pass_count: number
  warn_count: number
  fail_count: number
  root_cause: string | null
  recommended_fix: string | null
  blocking_severity: GrowthVideoOperatorBlockingSeverity
  checks: GrowthVideoOperatorCheckResult[]
}

export type GrowthVideoOperatorCertificationReport = {
  ok: boolean
  qa_marker: typeof GROWTH_VIDEO_OPERATOR_CERT_QA_MARKER
  environment: "local" | "production"
  final_verdict: "PASS" | "WARN" | "FAIL"
  scenario_matrix: GrowthVideoOperatorScenarioResult[]
  section_reports: GrowthVideoOperatorSectionReport[]
  pass_count: number
  warn_count: number
  fail_count: number
  check_count: number
  blockers: string[]
  requires_human_review: true
  autonomous_execution_enabled: false
  outreach_execution: false
  enrollment_execution: false
  orchestration_enabled: false
}

const SECTION_LABELS: Record<GrowthVideoOperatorReportSectionId, string> = {
  video_assets: "Video Assets",
  pages: "Pages",
  personalization: "Personalization",
  thumbnails: "Thumbnails",
  scripts: "Scripts",
  voice: "Voice",
  avatar: "Avatar",
  sequence_attachments: "Sequence Attachments",
  analytics: "Analytics",
  intelligence: "Intelligence",
}

function severityRank(severity: GrowthVideoOperatorBlockingSeverity): number {
  switch (severity) {
    case "critical":
      return 5
    case "high":
      return 4
    case "medium":
      return 3
    case "low":
      return 2
    default:
      return 1
  }
}

function maxSeverity(
  current: GrowthVideoOperatorBlockingSeverity,
  next: GrowthVideoOperatorBlockingSeverity,
): GrowthVideoOperatorBlockingSeverity {
  return severityRank(next) > severityRank(current) ? next : current
}

function deriveScenarioStatus(checks: GrowthVideoOperatorCheckResult[]): GrowthVideoOperatorCheckStatus {
  if (checks.some((check) => check.status === "FAIL")) return "FAIL"
  if (checks.some((check) => check.status === "WARN")) return "WARN"
  return "PASS"
}

function deriveSectionStatus(checks: GrowthVideoOperatorCheckResult[]): GrowthVideoOperatorCheckStatus {
  return deriveScenarioStatus(checks)
}

export function buildGrowthVideoOperatorCheck(input: {
  id: string
  label: string
  pass: boolean
  warn?: boolean
  rootCause?: string | null
  recommendedFix?: string | null
  blockingSeverity?: GrowthVideoOperatorBlockingSeverity
  detail?: Record<string, unknown>
}): GrowthVideoOperatorCheckResult {
  const status: GrowthVideoOperatorCheckStatus = input.pass
    ? "PASS"
    : input.warn
      ? "WARN"
      : "FAIL"

  return {
    id: input.id,
    label: input.label,
    status,
    pass: input.pass,
    rootCause: input.rootCause ?? (input.pass ? null : input.label),
    recommendedFix: input.recommendedFix ?? null,
    blockingSeverity: input.pass ? "none" : input.blockingSeverity ?? (input.warn ? "low" : "high"),
    detail: input.detail,
  }
}

export function buildGrowthVideoOperatorScenarioResult(input: {
  scenario_id: GrowthVideoOperatorScenarioId
  title: string
  sections: GrowthVideoOperatorReportSectionId[]
  checks: GrowthVideoOperatorCheckResult[]
}): GrowthVideoOperatorScenarioResult {
  const status = deriveScenarioStatus(input.checks)
  return {
    scenario_id: input.scenario_id,
    title: input.title,
    status,
    pass: status !== "FAIL",
    checks: input.checks,
    sections: input.sections,
  }
}

export function buildGrowthVideoOperatorReport(input: {
  environment: "local" | "production"
  scenarios: GrowthVideoOperatorScenarioResult[]
  blockers?: string[]
}): GrowthVideoOperatorCertificationReport {
  const checksBySection = new Map<GrowthVideoOperatorReportSectionId, GrowthVideoOperatorCheckResult[]>()

  for (const section of GROWTH_VIDEO_OPERATOR_REPORT_SECTIONS) {
    checksBySection.set(section, [])
  }

  for (const scenario of input.scenarios) {
    for (const section of scenario.sections) {
      const existing = checksBySection.get(section) ?? []
      existing.push(...scenario.checks)
      checksBySection.set(section, existing)
    }
  }

  const section_reports: GrowthVideoOperatorSectionReport[] = GROWTH_VIDEO_OPERATOR_REPORT_SECTIONS.map(
    (section_id) => {
      const checks = checksBySection.get(section_id) ?? []
      const pass_count = checks.filter((check) => check.status === "PASS").length
      const warn_count = checks.filter((check) => check.status === "WARN").length
      const fail_count = checks.filter((check) => check.status === "FAIL").length
      const status = deriveSectionStatus(checks)

      const failedChecks = checks.filter((check) => check.status === "FAIL")
      const warnChecks = checks.filter((check) => check.status === "WARN")
      const primaryIssue = failedChecks[0] ?? warnChecks[0] ?? null

      let blocking_severity: GrowthVideoOperatorBlockingSeverity = "none"
      for (const check of checks) {
        blocking_severity = maxSeverity(blocking_severity, check.blockingSeverity)
      }

      return {
        section_id,
        label: SECTION_LABELS[section_id],
        status,
        pass: status !== "FAIL",
        check_count: checks.length,
        pass_count,
        warn_count,
        fail_count,
        root_cause: primaryIssue?.rootCause ?? null,
        recommended_fix: primaryIssue?.recommendedFix ?? null,
        blocking_severity,
        checks,
      }
    },
  )

  const allChecks = input.scenarios.flatMap((scenario) => scenario.checks)
  const pass_count = allChecks.filter((check) => check.status === "PASS").length
  const warn_count = allChecks.filter((check) => check.status === "WARN").length
  const fail_count = allChecks.filter((check) => check.status === "FAIL").length
  const scenarioFails = input.scenarios.filter((scenario) => scenario.status === "FAIL").length
  const sectionFails = section_reports.filter((section) => section.status === "FAIL").length

  const final_verdict: GrowthVideoOperatorCertificationReport["final_verdict"] =
    scenarioFails > 0 || sectionFails > 0 ? "FAIL" : warn_count > 0 ? "WARN" : "PASS"

  const blockers = [
    ...(input.blockers ?? []),
    ...input.scenarios
      .filter((scenario) => scenario.status === "FAIL")
      .map((scenario) => `scenario_failed:${scenario.scenario_id}`),
    ...section_reports
      .filter((section) => section.status === "FAIL")
      .map((section) => `section_failed:${section.section_id}`),
  ]

  return {
    ok: final_verdict !== "FAIL",
    qa_marker: GROWTH_VIDEO_OPERATOR_CERT_QA_MARKER,
    environment: input.environment,
    final_verdict,
    scenario_matrix: input.scenarios,
    section_reports,
    pass_count,
    warn_count,
    fail_count,
    check_count: allChecks.length,
    blockers: [...new Set(blockers)],
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
    orchestration_enabled: false,
  }
}
