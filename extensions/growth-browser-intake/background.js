chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
  }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "equipify-open-side-panel") return

  const windowId = sender.tab?.windowId
  if (windowId == null || !chrome.sidePanel?.open) {
    sendResponse({ ok: false })
    return
  }

  chrome.sidePanel
    .open({ windowId })
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false }))

  return true
})
