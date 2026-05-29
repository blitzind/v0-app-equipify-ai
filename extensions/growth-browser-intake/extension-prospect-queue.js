/** Local prospect queue storage — operator-initiated processing only. */

const PROSPECT_QUEUE_KEY = "equipifyGrowthProspectQueue"
const MAX_QUEUE_ITEMS = 50

function createQueueItemId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `queue-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

async function loadProspectQueue() {
  const stored = await chrome.storage.local.get(PROSPECT_QUEUE_KEY)
  const list = stored[PROSPECT_QUEUE_KEY]
  return Array.isArray(list) ? list : []
}

async function saveProspectQueue(items) {
  await chrome.storage.local.set({ [PROSPECT_QUEUE_KEY]: items })
  return items
}

async function addProspectQueueItem(item) {
  const existing = await loadProspectQueue()
  const nextItem = {
    queue_item_id: createQueueItemId(),
    queued_at: new Date().toISOString(),
    ...item,
  }
  const next = [nextItem, ...existing].slice(0, MAX_QUEUE_ITEMS)
  await saveProspectQueue(next)
  return nextItem
}

async function removeProspectQueueItem(queueItemId) {
  const existing = await loadProspectQueue()
  const next = existing.filter((item) => item.queue_item_id !== queueItemId)
  await saveProspectQueue(next)
  return next
}

async function updateProspectQueueItem(queueItemId, patch) {
  const existing = await loadProspectQueue()
  const next = existing.map((item) =>
    item.queue_item_id === queueItemId ? { ...item, ...patch } : item,
  )
  await saveProspectQueue(next)
  return next
}

async function clearProspectQueue() {
  await saveProspectQueue([])
  return []
}

function inferQueueItemKind(input) {
  const linkedin = (input.linkedin_url ?? "").trim()
  const hasContact = Boolean(
    (input.contact_name ?? "").trim() ||
      (input.email ?? "").trim() ||
      (input.phone ?? "").trim(),
  )
  if (linkedin && !hasContact) return "linkedin_page"
  if (hasContact) return "contact"
  return "company"
}

window.EquipifyGrowthProspectQueue = {
  PROSPECT_QUEUE_KEY,
  MAX_QUEUE_ITEMS,
  loadProspectQueue,
  saveProspectQueue,
  addProspectQueueItem,
  removeProspectQueueItem,
  updateProspectQueueItem,
  clearProspectQueue,
  inferQueueItemKind,
}
