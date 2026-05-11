/**
 * Canonical user-facing copy for failure states (Phase 62.4).
 * Prefer importing these strings over ad-hoc “Something went wrong” variants.
 */
export const FAILURE_COPY = {
  /** Route / React error boundary — generic staff app */
  routeAppTitle: "We couldn't load this screen.",
  routeAppDescription:
    "Try again. If this keeps happening, contact your workspace admin or try signing out and back in.",

  /** Nested boundary while sidebar chrome may still show */
  routeDashboardTitle: "We couldn't load this part of the app.",
  routeDashboardDescription: "Try again or return to the dashboard.",

  routePortalTitle: "We couldn't load this page.",
  routePortalDescription:
    "Try again. If you still have trouble, contact your service provider.",

  routeAdminTitle: "We couldn't load this admin screen.",
  routeAdminDescription: "Try again. If the issue persists, sign out and back in.",

  /** Global root failure (minimal chrome) */
  routeGlobalTitle: "Equipify hit an unexpected error.",
  routeGlobalDescription: "Try refreshing this page or returning to the home page.",

  /** HTTP 404-style */
  notFoundTitle: "This page isn't available.",
  notFoundDescription: "It may have been moved or removed. Check the link or go back.",

  /** Section / drawer / list fetch */
  loadData: "We couldn't load this data.",

  permissionDenied: "You don't have permission to view this.",
  entitlementLocked: "This feature is not available on your current plan.",
  offlineRequired: "This action needs an internet connection.",
  integrationQuickBooks: "QuickBooks could not complete the sync.",
  recordMissing: "This record may have been deleted or moved.",

  retryAction: "Try again",
  goHome: "Go to home",
  goDashboard: "Go to dashboard",

  /** Server-side job sanitization fallback when the error is not an Error instance */
  processingStepFailed: "We couldn't complete this step.",
} as const
