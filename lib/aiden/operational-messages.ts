/** Growth workspaces: operational copilot is Scale-only (Phase 5). Link "Scale" in UI to `/settings/billing`. */
export const OPERATIONAL_SCALE_ONLY_MESSAGE_BEFORE_LINK =
  "Operational insights are available on "
export const OPERATIONAL_SCALE_ONLY_MESSAGE_AFTER_LINK =
  ". Your Growth workspace still has productivity summaries and drafts from AIden."

/** Plain full sentence (e.g. logs); UI uses the BEFORE / AFTER fragments + linked Scale. */
export const OPERATIONAL_SCALE_ONLY_MESSAGE =
  `${OPERATIONAL_SCALE_ONLY_MESSAGE_BEFORE_LINK}Scale${OPERATIONAL_SCALE_ONLY_MESSAGE_AFTER_LINK}`

/** API 403 when plan is below Scale (reuse wording — calm, not pushy). */
export const OPERATIONAL_PLAN_REQUIRED_MESSAGE =
  "Operational recommendations are available on Scale. Support chat and other AIden tools for your plan stay unchanged."
