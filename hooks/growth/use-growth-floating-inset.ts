"use client"

import {
  GROWTH_AIDEN_SAFE_AREA_PB_SCROLL,
  GROWTH_AIDEN_SAFE_AREA_PR,
  GROWTH_STICKY_ACTION_BAR_INNER_LAYOUT,
  GROWTH_STICKY_ACTION_BAR_SURFACE,
  GROWTH_WIZARD_ACTION_ROW,
  GROWTH_WORKSPACE_SAFE_AREA,
  GROWTH_WORKSPACE_SAFE_AREA_STICKY_FOOTER,
} from "@/lib/layout/aiden-safe-area"

/** Reusable class names + CSS var keys for Growth pages with AIden floating coach. */
export function useGrowthFloatingInset() {
  return {
    contentSafeAreaClassName: GROWTH_WORKSPACE_SAFE_AREA,
    scrollPaddingClassName: GROWTH_AIDEN_SAFE_AREA_PB_SCROLL,
    rightInsetClassName: GROWTH_AIDEN_SAFE_AREA_PR,
    stickyFooterContentClassName: GROWTH_WORKSPACE_SAFE_AREA_STICKY_FOOTER,
    wizardActionRowClassName: GROWTH_WIZARD_ACTION_ROW,
    stickyActionBarClassName: GROWTH_STICKY_ACTION_BAR_SURFACE,
    stickyActionBarInnerClassName: GROWTH_STICKY_ACTION_BAR_INNER_LAYOUT,
    insetStyle: {
      paddingRight: "var(--aiden-safe-area-right)",
      paddingBottom: "var(--aiden-safe-area-bottom)",
    } as const,
  }
}
