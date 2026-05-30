/** chrome.storage helpers for settings and recent capture history. */
console.log("[Equipify Sales] content script loaded")

const STORAGE_KEYS = {
  settings: "equipifyGrowthExtensionSettings",
  recentCaptures: "equipifyGrowthRecentCaptures",
}

const LOCAL_STORAGE_KEYS = {
  linkedInFloatingDock: "equipifySalesLinkedInFloatingDock",
}

const MAX_RECENT_CAPTURES = 5

const DEFAULT_SETTINGS = {
  apiPreset: "production",
  apiBaseUrl: "https://app.equipify.ai",
  verifyEmailBeforeSave: false,
  queueContactDiscovery: false,
  prospectingMode: false,
}

const DEFAULT_LINKEDIN_FLOATING_DOCK = {
  enabled: true,
  topPx: null,
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

async function loadLinkedInFloatingDockPrefs() {
  const stored = await chrome.storage.local.get(LOCAL_STORAGE_KEYS.linkedInFloatingDock)
  const prefs = stored[LOCAL_STORAGE_KEYS.linkedInFloatingDock]
  if (!prefs || typeof prefs !== "object") {
    return { ...DEFAULT_LINKEDIN_FLOATING_DOCK }
  }
  return {
    ...DEFAULT_LINKEDIN_FLOATING_DOCK,
    ...prefs,
    enabled: prefs.enabled !== false,
    topPx: typeof prefs.topPx === "number" && Number.isFinite(prefs.topPx) ? prefs.topPx : null,
  }
}

async function saveLinkedInFloatingDockPrefs(prefs) {
  await chrome.storage.local.set({
    [LOCAL_STORAGE_KEYS.linkedInFloatingDock]: {
      ...DEFAULT_LINKEDIN_FLOATING_DOCK,
      ...prefs,
      enabled: prefs.enabled !== false,
      topPx: typeof prefs.topPx === "number" && Number.isFinite(prefs.topPx) ? prefs.topPx : null,
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
  LOCAL_STORAGE_KEYS,
  MAX_RECENT_CAPTURES,
  DEFAULT_SETTINGS,
  DEFAULT_LINKEDIN_FLOATING_DOCK,
  loadExtensionSettings,
  saveExtensionSettings,
  loadLinkedInFloatingDockPrefs,
  saveLinkedInFloatingDockPrefs,
  loadRecentCaptures,
  addRecentCapture,
}
