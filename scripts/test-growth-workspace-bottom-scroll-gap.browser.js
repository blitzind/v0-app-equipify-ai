/**
 * Browser-side bottom gap assertions for Growth workspace pages.
 */
export function measureGrowthWorkspaceBottomScrollGap() {
  const px = (value) => parseFloat(value) || 0
  const doc = document.documentElement
  const body = document.body
  const main = document.getElementById("main-content")
  if (main) main.scrollTop = main.scrollHeight

  const mainInner = main?.firstElementChild ?? null
  const lastEl = mainInner?.lastElementChild ?? null
  let mainBottomGapPx = null
  if (main && mainInner && lastEl) {
    const lastBottomInMainScroll =
      lastEl.getBoundingClientRect().bottom - main.getBoundingClientRect().top + main.scrollTop
    mainBottomGapPx = Math.max(
      0,
      main.scrollHeight - lastBottomInMainScroll - px(getComputedStyle(mainInner).paddingBottom),
    )
  }

  const documentScrollLeakPx = Math.max(0, doc.scrollHeight - body.clientHeight)

  return {
    documentScrollHeight: doc.scrollHeight,
    bodyClientHeight: body.clientHeight,
    documentScrollLeakPx,
    mainBottomGapPx,
    mainScrollHeight: main?.scrollHeight ?? null,
  }
}
