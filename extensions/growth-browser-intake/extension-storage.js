/** chrome.storage helpers for settings and recent capture history. */

const STORAGE_KEYS = {
  settings: "equipifyGrowthExtensionSettings",
  recentCaptures: "equipifyGrowthRecentCaptures",
}

const MAX_RECENT_CAPTURES = 5

const DEFAULT_SETTINGS = {
  apiPreset: "production",
  apiBaseUrl: "https://app.equipify.ai",
  verifyEmailBeforeSave: false,
  queueContactDiscovery: false,
}

async function loadExtensionSettings() {
  const stored = await chrome.storage.sync.get(STORAGE_KEYS.settings)
  const settings = stored[STORAGE_KEYS.settings]
  if (!settings || typeof settings !== "object") {
    return { ...DEFAULT_SETTINGS }
  }
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
  }
}

async function saveExtensionSettings(settings) {
  await chrome.storage.sync.set({
    [STORAGE_KEYS.settings]: {
      ...DEFAULT_SETTINGS,
      ...settings,
    },
  })
}

async function loadRecentCaptures() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.recentCaptures)
  const list = stored[STORAGE_KEYS.recentCaptures]
  return Array.isArray(list) ? list : []
}

async function addRecentCapture(capture) {
  const existing = await loadRecentCaptures()
  const next = [
    capture,
    ...existing.filter((item) => item.lead_id !== capture.lead_id),
  ].slice(0, MAX_RECENT_CAPTURES)
  await chrome.storage.local.set({ [STORAGE_KEYS.recentCaptures]: next })
  return next
}

window.EquipifyGrowthExtensionStorage = {
  STORAGE_KEYS,
  MAX_RECENT_CAPTURES,
  DEFAULT_SETTINGS,
  loadExtensionSettings,
  saveExtensionSettings,
  loadRecentCaptures,
  addRecentCapture,
}
