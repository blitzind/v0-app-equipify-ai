/** AIOS-TRAINING-BUSINESS-STRATEGY-1C — Business Strategy sections currently exposed in Training UI.
 * Reserved schema sections remain in storage/validation but do not count until their UI ships.
 */

export const GROWTH_BUSINESS_STRATEGY_TRAINABLE_SECTIONS = [
  {
    key: "company_principles",
    label: "company principles",
    formTitle: "Company principles",
  },
  {
    key: "messaging",
    label: "messaging & tone",
    formTitle: "Messaging & tone",
  },
  {
    key: "positioning",
    label: "positioning & pricing",
    formTitle: "Positioning & pricing",
  },
  {
    key: "sales_philosophy",
    label: "sales philosophy",
    formTitle: "Sales philosophy",
  },
  {
    key: "objections",
    label: "objections",
    formTitle: "Objections",
  },
  {
    key: "sales_and_relationships",
    label: "sales & relationships",
    formTitle: "Sales & relationships",
  },
] as const

export type GrowthBusinessStrategyTrainableSectionKey =
  (typeof GROWTH_BUSINESS_STRATEGY_TRAINABLE_SECTIONS)[number]["key"]

export const GROWTH_BUSINESS_STRATEGY_TRAINABLE_SECTION_COUNT =
  GROWTH_BUSINESS_STRATEGY_TRAINABLE_SECTIONS.length

export const GROWTH_BUSINESS_STRATEGY_TRAINABLE_SECTION_QA_MARKER =
  "aios-training-business-strategy-trainable-sections-1c-v1" as const
