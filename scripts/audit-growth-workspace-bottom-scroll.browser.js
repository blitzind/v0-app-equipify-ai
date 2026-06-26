/**
 * Browser-side audit logic (plain JS — must not be transformed by tsx/esbuild).
 * Invoked via page.evaluate(auditGrowthBottomScrollInBrowser, params).
 */
export function auditGrowthBottomScrollInBrowser({ marker, routePath, viewportHeight }) {
  const px = (value) => {
    const n = Number.parseFloat(value)
    return Number.isFinite(n) ? n : 0
  }

  const auditElement = (el, selector, label) => {
    if (!el) {
      return {
        selector,
        label,
        found: false,
        rect: null,
        scroll: null,
        computed: null,
        className: "",
        dataAttributes: {},
      }
    }
    const html = el
    const rect = html.getBoundingClientRect()
    const style = getComputedStyle(html)
    const dataAttributes = {}
    for (const attr of Array.from(html.attributes)) {
      if (attr.name.startsWith("data-")) dataAttributes[attr.name] = attr.value
    }
    const scroll =
      html.scrollHeight > html.clientHeight || style.overflowY === "auto" || style.overflowY === "scroll"
        ? {
            scrollHeight: html.scrollHeight,
            clientHeight: html.clientHeight,
            scrollTop: html.scrollTop,
          }
        : null
    return {
      selector,
      label,
      found: true,
      rect: {
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
        width: rect.width,
      },
      scroll,
      computed: {
        paddingTop: style.paddingTop,
        paddingBottom: style.paddingBottom,
        marginTop: style.marginTop,
        marginBottom: style.marginBottom,
        minHeight: style.minHeight,
        height: style.height,
        maxHeight: style.maxHeight,
        overflowY: style.overflowY,
        boxSizing: style.boxSizing,
        position: style.position,
      },
      className: html.className?.toString?.() ?? "",
      dataAttributes,
    }
  }

  const main = document.getElementById("main-content")
  const mainInner =
    main?.querySelector('[data-qa-marker="workspace-shell-v1"]') ?? main?.firstElementChild ?? null
  const pageRoot =
    mainInner?.querySelector('[data-qa-marker="growth-workspace-page-content-v1"]') ??
    mainInner?.firstElementChild ??
    null

  const sectionCandidates = Array.from(
    document.querySelectorAll(
      "#main-content section, #main-content [data-section], #main-content article, #main-content .rounded-2xl.border",
    ),
  )
  const visibleSections = sectionCandidates.filter((el) => {
    const r = el.getBoundingClientRect()
    return r.height > 40 && r.width > 100
  })
  const lastSectionEl =
    visibleSections.sort((a, b) => a.getBoundingClientRect().bottom - b.getBoundingClientRect().bottom).at(-1) ??
    null

  const aidenLauncher =
    document.querySelector('[data-aiden-ask-launcher="growth-v1"]') ??
    document.querySelector("[data-aiden-ask-launcher]")
  const aidenParent = aidenLauncher?.parentElement ?? null

  const mainAudit = auditElement(main, "#main-content", "main")
  const mainInnerAudit = auditElement(mainInner, "main-inner", "main inner")
  const pageRootAudit = auditElement(pageRoot, "page-root", "page root")
  const lastSectionAudit = auditElement(lastSectionEl, "last-section", "last visible section/card")
  const aidenAudit = auditElement(aidenLauncher, "[data-aiden-ask-launcher]", "Aiden launcher")
  const aidenParentAudit = auditElement(aidenParent, "aiden-parent", "Aiden launcher parent")

  const docEl = document.documentElement
  const body = document.body

  let bottomReservePx = 0
  let lastContentToScrollBottomPx = 0

  if (main && mainInner) {
    const mainRect = main.getBoundingClientRect()
    const innerRect = mainInner.getBoundingClientRect()
    const innerStyle = getComputedStyle(mainInner)
    const innerPaddingBottom = px(innerStyle.paddingBottom)

    const lastBottom = lastSectionEl
      ? lastSectionEl.getBoundingClientRect().bottom
      : innerRect.bottom - innerPaddingBottom

    const lastBottomInMainScrollSpace = lastBottom - mainRect.top + main.scrollTop
    lastContentToScrollBottomPx = Math.max(0, main.scrollHeight - lastBottomInMainScrollSpace - innerPaddingBottom)

    const visibleGapBelowLastContent = Math.max(0, mainRect.bottom - lastBottom)
    bottomReservePx = Math.max(lastContentToScrollBottomPx, visibleGapBelowLastContent)
  }

  const chainEls = []
  if (docEl) chainEls.push({ el: docEl, label: "documentElement", selector: "html" })
  if (body) chainEls.push({ el: body, label: "body", selector: "body" })
      const shellRoot = document.querySelector('[data-qa-marker="growth-workspace-shell-v2"]')
        ?? document.querySelector('[data-qa-marker="growth-workspace-shell-v1"]')
  if (shellRoot)
    chainEls.push({
      el: shellRoot,
      label: "growth shell root",
      selector: '[data-qa-marker="growth-workspace-shell-v1"]',
    })
  if (main) chainEls.push({ el: main, label: "main", selector: "#main-content" })
  if (mainInner) chainEls.push({ el: mainInner, label: "main inner", selector: "main-inner" })
  if (pageRoot) chainEls.push({ el: pageRoot, label: "page root", selector: "page-root" })
  if (lastSectionEl) chainEls.push({ el: lastSectionEl, label: "last section", selector: "last-section" })
  if (aidenLauncher) chainEls.push({ el: aidenLauncher, label: "aiden launcher", selector: "[data-aiden-ask-launcher]" })

  const culpritCandidates = chainEls.map(({ el, label, selector }) => {
    const html = el
    const style = getComputedStyle(html)
    const paddingBottomPx = px(style.paddingBottom)
    const marginBottomPx = px(style.marginBottom)
    const minHeightPx = px(style.minHeight)
    let extraBottomPx = paddingBottomPx + marginBottomPx
    if (main && el === mainInner && lastSectionEl) {
      const mainRect = main.getBoundingClientRect()
      const lastBottomInMainScrollSpace =
        lastSectionEl.getBoundingClientRect().bottom - mainRect.top + main.scrollTop
      extraBottomPx = Math.max(0, html.scrollHeight - lastBottomInMainScrollSpace)
    } else if (main && el === main) {
      extraBottomPx = lastContentToScrollBottomPx
    }
    return {
      label,
      selector,
      extraBottomPx,
      paddingBottomPx,
      marginBottomPx,
      minHeightPx,
      className: html.className?.toString?.() ?? "",
    }
  })

  culpritCandidates.sort((a, b) => b.extraBottomPx - a.extraBottomPx)

  return {
    route: routePath,
    url: location.href,
    viewport: { width: window.innerWidth, height: viewportHeight },
    document: { scrollHeight: docEl.scrollHeight, clientHeight: docEl.clientHeight },
    body: { scrollHeight: body.scrollHeight, clientHeight: body.clientHeight },
    main: mainAudit,
    mainInner: mainInnerAudit,
    pageRoot: pageRootAudit,
    lastSection: lastSectionAudit,
    aidenLauncher: aidenAudit,
    aidenParent: aidenParentAudit,
    bottomReservePx,
    lastContentToScrollBottomPx,
    culpritCandidates,
    marker,
  }
}
