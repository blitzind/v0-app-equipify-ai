/**
 * Browser-side document scroll leak audit (plain JS).
 */
export function auditGrowthDocumentScrollLeak() {
  const px = (v) => parseFloat(v) || 0
  const doc = document.documentElement
  const body = document.body
  const main = document.getElementById("main-content")
  if (main) main.scrollTop = main.scrollHeight

  const chain = []
  let el = main
  while (el) {
    const s = getComputedStyle(el)
    chain.push({
      tag: el.tagName,
      id: el.id || null,
      class: (el.className || "").toString().slice(0, 120),
      marker: el.getAttribute("data-qa-marker"),
      offsetHeight: el.offsetHeight,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      rectBottom: el.getBoundingClientRect().bottom,
      overflow: `${s.overflow}/${s.overflowY}`,
      minH: s.minHeight,
      h: s.height,
      pb: s.paddingBottom,
      mb: s.marginBottom,
      position: s.position,
    })
    el = el.parentElement
  }

  const tall = []
  for (const node of document.querySelectorAll("body *")) {
    const r = node.getBoundingClientRect()
    const sh = node.scrollHeight
    if (r.bottom > window.innerHeight + 50 || sh > window.innerHeight + 200) {
      const s = getComputedStyle(node)
      if (s.position === "fixed" || s.display === "none" || s.visibility === "hidden") continue
      tall.push({
        tag: node.tagName,
        id: node.id || null,
        class: (node.className || "").toString().slice(0, 100),
        marker: node.getAttribute("data-qa-marker"),
        rectBottom: r.bottom,
        scrollHeight: sh,
        offsetHeight: node.offsetHeight,
        overflowY: s.overflowY,
        position: s.position,
        pb: s.paddingBottom,
      })
    }
  }
  tall.sort((a, b) => b.rectBottom - a.rectBottom)

  const pb24 = []
  for (const node of document.querySelectorAll(
    "[class*='pb-24'], .growth-aiden-safe-area-pb-scroll, .growth-workspace-safe-area",
  )) {
    const s = getComputedStyle(node)
    if (px(s.paddingBottom) >= 48) {
      pb24.push({
        tag: node.tagName,
        class: (node.className || "").toString().slice(0, 120),
        pb: s.paddingBottom,
        marker: node.getAttribute("data-qa-marker"),
      })
    }
  }

  const mainInner = main?.firstElementChild ?? null
  const lastEl = mainInner?.lastElementChild ?? null
  let contentGapPx = null
  if (main && mainInner && lastEl) {
    const lastBottomInMainScroll =
      lastEl.getBoundingClientRect().bottom - main.getBoundingClientRect().top + main.scrollTop
    contentGapPx = Math.max(0, main.scrollHeight - lastBottomInMainScroll - px(getComputedStyle(mainInner).paddingBottom))
  }

  return {
    doc: {
      scrollHeight: doc.scrollHeight,
      clientHeight: doc.clientHeight,
      overflow: getComputedStyle(doc).overflow,
    },
    body: {
      scrollHeight: body.scrollHeight,
      clientHeight: body.clientHeight,
      overflow: getComputedStyle(body).overflow,
    },
    main: main
      ? {
          scrollHeight: main.scrollHeight,
          clientHeight: main.clientHeight,
          scrollTop: main.scrollTop,
          contentGapPx,
        }
      : null,
    chain,
    topTall: tall.slice(0, 12),
    pb24,
  }
}
