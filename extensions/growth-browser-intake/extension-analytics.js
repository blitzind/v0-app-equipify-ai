/** Operator-only extension analytics — local storage, no browsing history. */

const ANALYTICS_KEY = "equipifyGrowthExtensionAnalytics"
const MAX_EVENTS = 500

async function loadAnalyticsEvents() {
  const stored = await chrome.storage.local.get(ANALYTICS_KEY)
  const list = stored[ANALYTICS_KEY]
  return Array.isArray(list) ? list : []
}

async function saveAnalyticsEvents(events) {
  const trimmed = events.slice(-MAX_EVENTS)
  await chrome.storage.local.set({ [ANALYTICS_KEY]: trimmed })
  return trimmed
}

async function recordAnalyticsEvent(type) {
  const events = await loadAnalyticsEvents()
  events.push({ type, at: new Date().toISOString() })
  return saveAnalyticsEvents(events)
}

function periodStart(period, now = new Date()) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (period === "today") return start
  if (period === "week") {
    start.setDate(start.getDate() - 6)
    return start
  }
  start.setDate(start.getDate() - 29)
  return start
}

function emptyCounts() {
  return {
    captures_created: 0,
    companies_captured: 0,
    contacts_captured: 0,
    duplicates_prevented: 0,
    research_briefs_generated: 0,
    call_preps_generated: 0,
    queue_saves: 0,
  }
}

function aggregateAnalytics(events, period, now = new Date()) {
  const startMs = periodStart(period, now).getTime()
  const counts = emptyCounts()
  let total = 0

  for (const event of events) {
    const atMs = Date.parse(event.at)
    if (Number.isNaN(atMs) || atMs < startMs) continue
    if (typeof counts[event.type] !== "number") continue
    counts[event.type] += 1
    total += 1
  }

  return { period, counts, total_events: total }
}

async function getAnalyticsSummary(period) {
  const events = await loadAnalyticsEvents()
  return aggregateAnalytics(events, period)
}

function formatAnalyticsLabel(key) {
  return key.replace(/_/g, " ")
}

function renderAnalyticsHtml(summary) {
  const rows = Object.entries(summary.counts)
    .map(
      ([key, value]) =>
        `<div class="analytics-row"><span class="analytics-label">${formatAnalyticsLabel(key)}</span><strong>${value}</strong></div>`,
    )
    .join("")
  return `<div class="analytics-grid">${rows}</div><p class="muted analytics-total">${summary.total_events} tracked actions</p>`
}

window.EquipifyGrowthExtensionAnalytics = {
  ANALYTICS_KEY,
  MAX_EVENTS,
  loadAnalyticsEvents,
  recordAnalyticsEvent,
  getAnalyticsSummary,
  renderAnalyticsHtml,
  aggregateAnalytics,
}
