/**
 * Enrollment visibility & navigation UX regression checks.
 * Run: pnpm test:growth-enrollment-visibility
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_PATTERN_ENROLLMENT_DETAIL_QA_MARKER,
  growthPatternEnrollmentDetailHref,
  growthSequenceExecutionHref,
} from "../lib/growth/sequence-enrollment/enrollment-navigation"
import { GROWTH_ENROLLMENT_PLANES_DOC } from "../lib/growth/sequence-enrollment/enrollment-planes-doc"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

assert.equal(GROWTH_PATTERN_ENROLLMENT_DETAIL_QA_MARKER, "growth-pattern-enrollment-detail-v1")
assert.equal(GROWTH_ENROLLMENT_PLANES_DOC.recommendation, "pattern_primary")
assert.match(growthPatternEnrollmentDetailHref("00000000-0000-4000-8000-000000000001"), /\/enrollments\//)
assert.match(
  growthSequenceExecutionHref({
    enrollmentId: "00000000-0000-4000-8000-000000000001",
    leadId: "00000000-0000-4000-8000-000000000002",
    highlightJobId: "00000000-0000-4000-8000-000000000003",
  }),
  /enrollmentId=/,
)

const bulkDialog = readSource("components/growth/growth-bulk-sequence-enrollment-dialog.tsx")
assert.match(bulkDialog, /View Enrollment/)
assert.match(bulkDialog, /Run Scheduler Now/)
assert.match(bulkDialog, /Back to Leads/)
assert.match(bulkDialog, /Already enrolled in this sequence/)
assert.match(bulkDialog, /View enrollment/)
assert.match(bulkDialog, /const showSuccess = Boolean\(result && !result\.dryRun\)/)
assert.match(bulkDialog, /Enrollment complete/)

const detailPage = readSource("app/(admin)/admin/growth/sequences/enrollments/[enrollmentId]/page.tsx")
assert.match(detailPage, /GrowthPatternEnrollmentDetail/)

const detailApi = readSource("app/api/platform/growth/sequences/enrollments/[enrollmentId]/route.ts")
assert.match(detailApi, /fetchPatternEnrollmentDetail/)

const detailRepo = readSource("lib/growth/sequence-enrollment/enrollment-detail.ts")
assert.match(detailRepo, /fetchPatternEnrollmentWithSteps/)
assert.match(detailRepo, /listSequenceExecutionJobsForEnrollment/)

const patternStatsRepo = readSource("lib/growth/sequence-enrollment/pattern-enrollment-stats.ts")
assert.match(patternStatsRepo, /sequence_enrollments/)

const executionPage = readSource("app/(admin)/admin/growth/sequences/execution/page.tsx")
assert.match(executionPage, /GrowthEnrollmentExecutionContext/)
assert.match(executionPage, /enrollmentId/)
assert.match(executionPage, /highlightJobId/)

const executionContext = readSource("components/growth/growth-enrollment-execution-context.tsx")
assert.match(executionContext, /no execution job planned yet/i)
assert.match(executionContext, /Run Scheduler Now/)
assert.match(executionContext, /pending approval/)

const foundation = readSource("components/growth/growth-sequence-execution-foundation-dashboard.tsx")
assert.match(foundation, /Pattern Enrollments \(Outbound\)/)
assert.match(foundation, /pattern_stats/)

const sidebar = readSource("hooks/use-growth-sidebar-console.ts")
assert.match(sidebar, /patternEnrollmentStatsRes/)
assert.match(sidebar, /patternActiveCount/)

const statsApi = readSource("app/api/platform/growth/sequences/enrollments/stats/route.ts")
assert.match(statsApi, /fetchPatternEnrollmentStats/)

const crmPage = readSource("app/(admin)/admin/growth/leads/crm/page.tsx")
const tableSource = readSource("components/growth/growth-leads-table.tsx")

assert.match(crmPage, /refreshLeadsInBackground/)
assert.match(crmPage, /onBulkEnrollDismissed/)
assert.doesNotMatch(crmPage, /onBulkEnrolled/)
assert.doesNotMatch(crmPage, /onBulkEnrollDismissed[\s\S]{0,120}void load\(\)/)

assert.match(tableSource, /onDismissAfterSuccess=\{onBulkEnrollDismissed\}/)
assert.doesNotMatch(tableSource, /onBulkEnrolled/)

assert.match(bulkDialog, /onDismissAfterSuccess/)
assert.match(bulkDialog, /handleOpenChange/)
assert.match(bulkDialog, /notifySuccessDismissal/)
assert.doesNotMatch(bulkDialog, /onCompleted/)
assert.match(bulkDialog, /setResult\(data\.result\)/)
assert.doesNotMatch(
  bulkDialog.slice(bulkDialog.indexOf("async function runScheduler"), bulkDialog.indexOf("function renderOutcomeRow")),
  /onDismissAfterSuccess/,
)
assert.match(bulkDialog, /result\.enrolled\.length/)
assert.match(bulkDialog, /result\.skippedAlreadyEnrolled\.length/)
assert.match(bulkDialog, /result\.skippedBlocked\.length/)
assert.match(bulkDialog, /result\.failed\.length/)
assert.match(bulkDialog, /onClick=\{notifySuccessDismissal\}/)
assert.match(bulkDialog, /Run Scheduler Now/)

console.log("growth enrollment visibility tests passed")
