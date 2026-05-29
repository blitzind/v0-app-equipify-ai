/**
 * Equipify Sales shared UI — popup tabs, settings drawer, section titles.
 */
;(function initEquipifySalesExtensionUi() {
  const SECTION_TITLES = {
    crm: "CRM",
    research: "Research",
    call_prep: "Call Prep",
    similar: "Similar Companies",
    relationship: "Relationship Map",
    timeline: "Timeline",
    notes: "Notes",
    queue: "Prospect Queue",
    analytics: "Analytics",
    committee: "Buying Committee",
  }

  function initPopupTabs() {
    const buttons = document.querySelectorAll("[data-popup-tab-btn]")
    const panels = document.querySelectorAll("[data-popup-panel]")
    if (!buttons.length) return

    function switchPopupTab(tabId) {
      buttons.forEach((btn) => btn.classList.toggle("active", btn.dataset.popupTabBtn === tabId))
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.popupPanel !== tabId
      })
    }

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => switchPopupTab(btn.dataset.popupTabBtn))
    })
  }

  function initSettingsDrawer() {
    const drawer = document.getElementById("settings-drawer")
    const openBtn = document.getElementById("settings-toggle-btn")
    const closeBtn = document.getElementById("settings-close-btn")
    if (!drawer || !openBtn) return

    openBtn.addEventListener("click", () => {
      drawer.hidden = false
      window.__equipifyRefreshSettingsAnalytics?.()
    })
    closeBtn?.addEventListener("click", () => {
      drawer.hidden = true
    })
    drawer.addEventListener("click", (event) => {
      if (event.target === drawer) drawer.hidden = true
    })
  }

  function initSidepanelResearchShortcut() {
    document.getElementById("popup-open-sidepanel-research")?.addEventListener("click", async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const windowId = tabs[0]?.windowId
      if (windowId != null && chrome.sidePanel?.open) {
        await chrome.sidePanel.open({ windowId })
      }
    })
    document.getElementById("copilot-generate-research-btn-inline")?.addEventListener("click", () => {
      window.__equipifyCopilotHooks?.switchTab?.("research")
      document.getElementById("copilot-generate-research-btn")?.click()
    })
  }

  function updateSectionTitle(tabId) {
    const titleEl = document.getElementById("es-section-title")
    if (titleEl && SECTION_TITLES[tabId]) titleEl.textContent = SECTION_TITLES[tabId]
  }

  function updateQueueBadge(count) {
    const badge = document.getElementById("popup-queue-badge")
    if (!badge) return
    if (count > 0) {
      badge.hidden = false
      badge.textContent = String(count)
    } else {
      badge.hidden = true
    }
  }

  initPopupTabs()
  initSettingsDrawer()
  initSidepanelResearchShortcut()

  window.EquipifySalesExtensionUi = {
    updateSectionTitle,
    updateQueueBadge,
    SECTION_TITLES,
  }
})()
