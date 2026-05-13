import type { ExecutiveOperationalReport } from "@/lib/reporting/executive-operational-report-types"

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const PRINT_CSS = `
@page { size: A4; margin: 14mm; }
@media print {
  body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .no-print { display: none !important; }
  a[href^="http"]::after { content: ""; }
}
body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111827; line-height: 1.45; font-size: 11pt; margin: 0; padding: 0; }
h1 { font-size: 18pt; margin: 0 0 8px; font-weight: 700; }
h2 { font-size: 12pt; margin: 20px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
.meta { color: #4b5563; font-size: 9.5pt; margin-bottom: 16px; }
table.data { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 10pt; }
table.data th, table.data td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; vertical-align: top; }
table.data th { background: #f9fafb; font-weight: 600; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; background: #eef2ff; color: #3730a3; font-size: 9pt; font-weight: 600; }
ul.compact { margin: 4px 0 12px 16px; padding: 0; }
ul.compact li { margin: 3px 0; }
.section-note { font-size: 9pt; color: #6b7280; margin-top: -4px; margin-bottom: 8px; }
.footer { margin-top: 24px; font-size: 8.5pt; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 8px; }
`

/** PDF-ready HTML: semantic sections + print CSS; no external assets. */
export function renderExecutiveOperationalReportHtml(report: ExecutiveOperationalReport): string {
  const org = escapeHtml(report.organizationName ?? report.organizationId)
  const title = `${report.cadence === "weekly" ? "Weekly" : "Monthly"} executive operational report`
  const loc =
    report.customerLocationId ?
      ` · Site: ${escapeHtml(report.customerLocationName ?? report.customerLocationId)}`
    : " · All service sites"
  const health = report.operationalHealthAtGeneration
  const rows = report.volumeTrends
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.label)}</td><td>${r.currentPeriod}</td><td>${r.priorPeriod}</td><td>${escapeHtml(r.direction)}</td></tr>`,
    )
    .join("")
  const branchRows = report.branchSlices
    .map(
      (b) =>
        `<tr><td>${escapeHtml(b.locationName)}</td><td>${escapeHtml(b.customerLocationId)}</td><td>${b.workOrdersCreatedInWindow}</td></tr>`,
    )
    .join("")
  const pmRows = report.pmAndMixTrends
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.weekStartUtc)}</td><td>${p.pm}</td><td>${p.emergency}</td><td>${p.inspection}</td><td>${p.other}</td></tr>`,
    )
    .join("")
  const riskRows = report.operationalRiskFacts
    .map((f) => `<li>${escapeHtml(f.statement)} <span class="section-note">(${escapeHtml(f.evidencePath)})</span></li>`)
    .join("")
  const lim = report.limitations.map((x) => `<li>${escapeHtml(x)}</li>`).join("")
  const readiness = report.readinessSummary.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")
  const inspectionFactors = report.inspectionComplianceSummary.contributingFactorLabels
    .map((x) => `<li>${escapeHtml(x)}</li>`)
    .join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — ${org}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">
      <span class="badge">${escapeHtml(report.cadence)}</span>
      ${escapeHtml(report.generatedAt)} · ${escapeHtml(report.industryDisplayLabel)}${loc}
    </div>
    <p class="section-note">${escapeHtml(report.sectorFramingOneLiner ?? "Sector framing uses workspace onboarding defaults.")}</p>
  </header>

  <h2>Period throughput (bounded windows)</h2>
  <p class="section-note">Current: ${escapeHtml(report.currentPeriod.label)} (${escapeHtml(report.currentPeriod.startUtc)} → ${escapeHtml(report.currentPeriod.endUtc)}). Prior: ${escapeHtml(report.priorPeriod.label)}.</p>
  <table class="data">
    <thead><tr><th>Metric</th><th>Current</th><th>Prior</th><th>Direction</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <h2>PM health & mix (weekly UTC buckets, sampled)</h2>
  <p class="section-note">Source: operational timeline intelligence — last ${report.pmAndMixTrends.length} ISO week(s) in snapshot sample.</p>
  <table class="data">
    <thead><tr><th>Week start (UTC)</th><th>PM</th><th>Emergency</th><th>Inspection</th><th>Other</th></tr></thead>
    <tbody>${pmRows || "<tr><td colspan=\"5\">No trend rows in sample.</td></tr>"}</tbody>
  </table>

  <h2>Dispatch posture (as of generation)</h2>
  <ul class="compact">
    <li>Unassigned active work orders: ${report.dispatchAtGeneration.activeWorkOrdersUnassigned}</li>
    <li>Active with scheduled date before today: ${report.dispatchAtGeneration.scheduledDatePassedStillActive}</li>
    <li>Peak jobs same day / same assignee (next-7d sample): ${report.dispatchAtGeneration.maxJobsSameDaySameAssignee}</li>
    <li>Schedule congestion examples in sample: ${report.dispatchAtGeneration.scheduleCongestionExamplesCount}</li>
  </ul>
  <p class="section-note">${escapeHtml(report.dispatchAtGeneration.methodologyNote)}</p>

  <h2>Readiness summary (industry-aware, deterministic)</h2>
  <p>${escapeHtml(report.readinessSummary.headline)}</p>
  <ul class="compact">${readiness || "<li>No dashboard summary lines in snapshot.</li>"}</ul>

  <h2>Inspection compliance (health index)</h2>
  <p>Category score (when included in overall): ${report.inspectionComplianceSummary.categoryScore ?? "n/a"}</p>
  <ul class="compact">${inspectionFactors || "<li>No contributing factors listed.</li>"}</ul>

  <h2>Operational health (as of generation)</h2>
  ${
    health ?
      `<p>Overall ${health.overallScore} — ${escapeHtml(health.overallLabel)} (${escapeHtml(health.overallBand)}).</p>
       <p class="section-note">${escapeHtml(health.methodologyNote)}</p>`
    : `<p class="section-note">Health scores unavailable (empty assigned scope or insufficient snapshot).</p>`
  }

  <h2>Branch / service site ranking (current period)</h2>
  ${
    report.customerLocationId ?
      `<p class="section-note">Filtered to one service site — org-wide branch ranking omitted.</p>`
    : `<p class="section-note">${report.branchRankingRowCap ? `Ranking may be capped (sample up to ${report.branchRankingRowCap} rows).` : "Full sample under cap."}</p>
       <table class="data">
         <thead><tr><th>Site</th><th>Id</th><th>Created in period</th></tr></thead>
         <tbody>${branchRows || "<tr><td colspan=\"3\">No site-attributed creations in window.</td></tr>"}</tbody>
       </table>`
  }

  <h2>Operational risk facts (evidence-backed)</h2>
  <ul class="compact">${riskRows || "<li>No risk facts triggered threshold rules.</li>"}</ul>

  <h2>Limitations</h2>
  <ul class="compact">${lim || "<li>None noted.</li>"}</ul>

  <footer class="footer">
    Schema ${escapeHtml(report.schemaVersion)} · Equipify executive operational reporting — deterministic assembly only; no LLM conclusions.
  </footer>
</body>
</html>`
}

export function executiveOperationalReportPlainText(report: ExecutiveOperationalReport): string {
  const lines: string[] = []
  lines.push(`${report.cadence} executive operational report`)
  lines.push(`${report.organizationName ?? report.organizationId} · ${report.generatedAt}`)
  lines.push(`Industry: ${report.industryDisplayLabel}`)
  lines.push(`Period: ${report.currentPeriod.label} ${report.currentPeriod.startUtc} → ${report.currentPeriod.endUtc}`)
  lines.push("")
  lines.push("Volume trends:")
  for (const r of report.volumeTrends) {
    lines.push(`- ${r.label}: ${r.currentPeriod} vs ${r.priorPeriod} (${r.direction})`)
  }
  lines.push("")
  lines.push("Risk facts:")
  for (const f of report.operationalRiskFacts) lines.push(`- ${f.statement} [${f.evidencePath}]`)
  lines.push("")
  lines.push("Limitations:")
  for (const l of report.limitations) lines.push(`- ${l}`)
  return lines.join("\n")
}
