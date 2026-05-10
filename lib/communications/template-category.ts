/** Must match `communication_templates_category_check` in migrations. */
export const COMMUNICATION_TEMPLATE_CATEGORIES = [
  "quote_follow_up",
  "invoice_reminder",
  "maintenance_reminder",
  "thank_you",
  "review_request",
  "service_request",
  "work_order",
  "quote",
  "invoice",
  "portal",
  "general",
  "customer",
  "sms_reminder",
] as const

export type CommunicationTemplateCategory = (typeof COMMUNICATION_TEMPLATE_CATEGORIES)[number]
