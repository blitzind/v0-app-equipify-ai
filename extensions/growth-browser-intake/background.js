chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
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
      .catch(() => sendResponse({ ok: false }))
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
      .catch(() => sendResponse({ ok: false }))
    return true
  }

  return undefined
})
