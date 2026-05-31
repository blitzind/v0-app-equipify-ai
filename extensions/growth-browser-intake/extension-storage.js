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

/** Bump when default keys change — triggers backfill for undefined keys only. */
const SETTINGS_SCHEMA_VERSION = 4333

const DEFAULT_SETTINGS = {
  apiPreset: "production",
  apiBaseUrl: "https://app.equipify.ai",
  prospectingMode: true,
  showLinkedInFloatingButton: true,
  verifyEmailBeforeSave: false,
  queueContactDiscovery: true,
}

const DEFAULT_LINKEDIN_FLOATING_DOCK = {
  enabled: true,
  topPx: null,
}

function mergeSettingsWithDefaults(stored) {
  if (!stored || typeof stored !== "object") {
    return { ...DEFAULT_SETTINGS }
  }
  const merged = { ...stored }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (merged[key] === undefined) {
      merged[key] = value
    }
  }
  return merged
}

function settingsNeedBackfill(stored) {
  if (!stored || typeof stored !== "object") return true
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (stored[key] === undefined) return true
  }
  return false
}

async function persistSettingsIfBackfilled(stored) {
  const merged = mergeSettingsWithDefaults(stored)
  if (!settingsNeedBackfill(stored)) return merged
  await chrome.storage.sync.set({
    [STORAGE_KEYS.settings]: merged,
  })
  return merged
}

async function loadExtensionSettings() {
  const stored = await chrome.storage.sync.get(STORAGE_KEYS.settings)
  return persistSettingsIfBackfilled(stored[STORAGE_KEYS.settings])
}

async function saveExtensionSettings(settings) {
  const merged = mergeSettingsWithDefaults(settings)
  await chrome.storage.sync.set({
    [STORAGE_KEYS.settings]: merged,
  })
  return merged
}

async function loadLinkedInFloatingDockPrefs() {
  const stored = await chrome.storage.local.get(LOCAL_STORAGE_KEYS.linkedInFloatingDock)
  const prefs = stored[LOCAL_STORAGE_KEYS.linkedInFloatingDock]
  if (!prefs || typeof prefs !== "object") {
    const settingsStored = await chrome.storage.sync.get(STORAGE_KEYS.settings)
    const settings = mergeSettingsWithDefaults(settingsStored[STORAGE_KEYS.settings])
    const enabled =
      settings.showLinkedInFloatingButton === undefined
        ? DEFAULT_LINKEDIN_FLOATING_DOCK.enabled
        : settings.showLinkedInFloatingButton !== false
    return {
      ...DEFAULT_LINKEDIN_FLOATING_DOCK,
      enabled,
    }
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
  SETTINGS_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  DEFAULT_LINKEDIN_FLOATING_DOCK,
  mergeSettingsWithDefaults,
  settingsNeedBackfill,
  loadExtensionSettings,
  saveExtensionSettings,
  loadLinkedInFloatingDockPrefs,
  saveLinkedInFloatingDockPrefs,
  loadRecentCaptures,
  addRecentCapture,
}
