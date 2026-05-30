/**
 * Shared contact-saved event bus for Equipify Sales extension surfaces.
 */
;(function initEquipifyContactSavedEvents() {
  const EVENT_NAME = "equipify-sales-contact-saved"

  function trimOrNull(value) {
    const trimmed = (value ?? "").trim()
    return trimmed ? trimmed : null
  }

  function buildContactSavedDetail(payload) {
    const leadId = trimOrNull(payload?.lead_id)
    const linkedinUrl = trimOrNull(payload?.linkedin_url)
    const sourceUrl = trimOrNull(payload?.source_url)
    const crmUrl = trimOrNull(payload?.crm_url)
    return {
      lead_id: leadId,
      linkedin_url: linkedinUrl,
      source_url: sourceUrl,
      crm_url: crmUrl,
      matched: payload?.matched !== false,
      company_name: trimOrNull(payload?.company_name),
      contact_name: trimOrNull(payload?.contact_name),
    }
  }

  function dispatchEquipifyContactSaved(payload) {
    const detail = buildContactSavedDetail(payload)
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }))
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: EVENT_NAME, ...detail }, "*")
    }
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: EVENT_NAME, ...detail }).catch(() => {})
    }
    return detail
  }

  function onEquipifyContactSaved(handler) {
    const wrapped = (event) => {
      const detail = event?.detail ?? event?.data ?? null
      if (!detail || detail.matched !== true) return
      handler(detail)
    }
    window.addEventListener(EVENT_NAME, wrapped)
    window.addEventListener("message", (event) => {
      if (event.data?.type !== EVENT_NAME) return
      wrapped({ detail: event.data })
    })
    if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message) => {
        if (message?.type !== EVENT_NAME) return undefined
        wrapped({ detail: message })
        return undefined
      })
    }
    return () => window.removeEventListener(EVENT_NAME, wrapped)
  }

  window.EquipifySalesContactSaved = {
    EVENT_NAME,
    buildContactSavedDetail,
    dispatchEquipifyContactSaved,
    onEquipifyContactSaved,
  }
})()
