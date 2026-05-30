chrome.runtime.onInstalled.addListener(() => {
  console.info("[Equipify Sales:background] installed")
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
  }
})

const LINKEDIN_PROFILE_RE = /^https:\/\/(?:www\.)?linkedin\.com\/(?:in|company)\//i

const CONTENT_SCRIPT_FILES = [
  "extension-storage.js",
  "extension-config.js",
  "extension-lookup-cache.js",
  "extension-contact-saved.js",
  "linkedin-context.js",
  "linkedin-status-shared.js",
  "linkedin-crm-shared.js",
  "page-metadata.js",
  "linkedin-inpage-sidebar.js",
  "linkedin-crm-overlay.js",
  "linkedin-floating-dock.js",
]

const CONTENT_CSS_FILES = [
  "linkedin-inpage-sidebar.css",
  "linkedin-crm-overlay.css",
  "linkedin-floating-dock.css",
]

function logError(scope, error, details = {}) {
  const message = error instanceof Error ? error.message : String(error ?? "unknown")
  console.error("[Equipify Sales:background]", scope, message, details, error)
}

async function sendOpenSidebar(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: "equipify-open-inpage-sidebar" })
}

async function ensureContentScripts(tabId) {
  for (const css of CONTENT_CSS_FILES) {
    await chrome.scripting.insertCSS({ target: { tabId }, files: [css] }).catch(() => {})
  }
  await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_SCRIPT_FILES })
}

async function openPopupFallback(tabId) {
  await chrome.action.setPopup({ tabId, popup: "popup.html" })
  if (chrome.action.openPopup) {
    await chrome.action.openPopup()
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  const tabId = tab?.id
  const url = tab?.url ?? ""
  if (!tabId) return

  if (!LINKEDIN_PROFILE_RE.test(url)) {
    try {
      await openPopupFallback(tabId)
    } catch (error) {
      logError("open_popup_fallback_failed", error, { tabId, url })
      if (chrome.sidePanel?.open && tab.windowId != null) {
        await chrome.sidePanel.open({ windowId: tab.windowId }).catch((sidePanelError) => {
          logError("open_sidepanel_fallback_failed", sidePanelError, { tabId, url })
        })
      }
    }
    return
  }

  await chrome.action.setPopup({ tabId, popup: "" }).catch(() => {})

  try {
    await sendOpenSidebar(tabId)
    return
  } catch (firstError) {
    logError("content_open_sidebar_first_attempt_failed", firstError, { tabId, url })
  }

  try {
    await ensureContentScripts(tabId)
    await sendOpenSidebar(tabId)
  } catch (error) {
    logError("content_open_sidebar_retry_failed", error, { tabId, url })
    if (chrome.sidePanel?.open && tab.windowId != null) {
      await chrome.sidePanel.open({ windowId: tab.windowId }).catch((sidePanelError) => {
        logError("open_sidepanel_after_retry_failed", sidePanelError, { tabId, url })
      })
    }
  }
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "complete") return
  const url = changeInfo.url ?? tab.url ?? ""
  if (LINKEDIN_PROFILE_RE.test(url)) {
    chrome.action.setPopup({ tabId, popup: "" }).catch((error) => {
      logError("clear_popup_for_linkedin_failed", error, { tabId, url })
    })
  }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "equipify-open-inpage-sidebar") {
    const tabId = sender.tab?.id
    if (tabId == null) {
      sendResponse({ ok: false })
      return true
    }
    chrome.tabs
      .sendMessage(tabId, { type: "equipify-open-inpage-sidebar" })
      .then((result) => sendResponse(result ?? { ok: true }))
      .catch((error) => {
        logError("relay_open_inpage_sidebar_failed", error, { tabId })
        sendResponse({ ok: false })
      })
    return true
  }

  if (message?.type === "equipify-open-side-panel") {
    const windowId = sender.tab?.windowId
    if (windowId == null || !chrome.sidePanel?.open) {
      sendResponse({ ok: false })
      return true
    }
    chrome.sidePanel
      .open({ windowId })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        logError("open_native_sidepanel_failed", error, { windowId })
        sendResponse({ ok: false })
      })
    return true
  }

  if (message?.type === "equipify-sales-contact-saved") {
    const tabId = sender.tab?.id
    if (tabId) {
      chrome.tabs.sendMessage(tabId, message).catch((error) => {
        logError("relay_contact_saved_failed", error, { tabId })
      })
    }
    sendResponse({ ok: true })
    return true
  }

  if (message?.type === "equipify-enrich-company-page") {
    const companyUrl = trimOrNull(message.url)
    if (!companyUrl) {
      sendResponse({ ok: false, message: "Company URL is required." })
      return true
    }

    chrome.tabs.create({ url: companyUrl, active: false }, (tab) => {
      const tabId = tab?.id
      if (!tabId) {
        sendResponse({ ok: false, message: "Could not open company page tab." })
        return
      }

      const timeoutId = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(onUpdated)
        chrome.tabs.remove(tabId).catch(() => {})
        sendResponse({ ok: false, message: "Company page enrichment timed out." })
      }, 15000)

      function onUpdated(updatedTabId, info) {
        if (updatedTabId !== tabId || info.status !== "complete") return
        chrome.tabs.onUpdated.removeListener(onUpdated)
        clearTimeout(timeoutId)

        chrome.scripting
          .executeScript({ target: { tabId }, files: ["page-metadata.js", "linkedin-company-people.js"] })
          .then(() =>
            chrome.scripting.executeScript({
              target: { tabId },
              func: () => ({
                metadata: window.__equipifyGrowthExtract?.() ?? null,
                visiblePeople: window.__equipifyGrowthLinkedInCompanyPeople?.() ?? [],
              }),
            }),
          )
          .then((results) => {
            chrome.tabs.remove(tabId).catch(() => {})
            const payload = results?.[0]?.result ?? null
            if (!payload?.metadata) {
              sendResponse({ ok: false, message: "No public company metadata found on LinkedIn page." })
              return
            }
            sendResponse({
              ok: true,
              metadata: payload.metadata,
              visiblePeople: payload.visiblePeople ?? [],
            })
          })
          .catch((error) => {
            chrome.tabs.remove(tabId).catch(() => {})
            sendResponse({ ok: false, message: error instanceof Error ? error.message : "Company enrichment failed." })
          })
      }

      chrome.tabs.onUpdated.addListener(onUpdated)
    })

    return true
  }

  return undefined
})

function trimOrNull(value) {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed ? trimmed : null
}
