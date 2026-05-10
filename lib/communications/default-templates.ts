/** Seed rows for `communication_templates` (organization-scoped). */
export const DEFAULT_COMMUNICATION_TEMPLATES = [
  {
    template_key: "quote_follow_up",
    name: "Quote follow-up",
    category: "quote_follow_up" as const,
    subject: "Following up on your quote from {{company_name}}",
    body:
      "Hi {{customer_name}},\n\nI wanted to follow up on the quote we sent for {{quote_summary}}. Please let us know if you have any questions or would like to move forward.\n\nThank you,\n{{sender_name}}",
    channel: "email" as const,
  },
  {
    template_key: "invoice_reminder",
    name: "Invoice reminder",
    category: "invoice_reminder" as const,
    subject: "Reminder: invoice {{invoice_number}} is due",
    body:
      "Hi {{customer_name}},\n\nThis is a friendly reminder that invoice {{invoice_number}} for {{amount}} was due on {{due_date}}. You can reply to this email if you need a copy or have questions.\n\nThanks,\n{{sender_name}}",
    channel: "email" as const,
  },
  {
    template_key: "maintenance_reminder",
    name: "Maintenance reminder",
    category: "maintenance_reminder" as const,
    subject: "Upcoming maintenance: {{plan_name}}",
    body:
      "Hi {{customer_name}},\n\nYour scheduled maintenance for {{equipment_or_plan}} is coming up on {{service_date}}. Reply to confirm or reschedule.\n\n— {{sender_name}}",
    channel: "email" as const,
  },
  {
    template_key: "thank_you",
    name: "Thank you",
    category: "thank_you" as const,
    subject: "Thank you for choosing {{company_name}}",
    body:
      "Hi {{customer_name}},\n\nThank you for your business. We appreciate the opportunity to serve you and welcome any feedback.\n\nBest,\n{{sender_name}}",
    channel: "email" as const,
  },
  {
    template_key: "review_request",
    name: "Review request",
    category: "review_request" as const,
    subject: "How did we do?",
    body:
      "Hi {{customer_name}},\n\nIf you have a moment, we would love a short review of your recent service experience. Your feedback helps our team improve.\n\nThank you,\n{{sender_name}}",
    channel: "email" as const,
  },
  {
    template_key: "sms_appointment_reminder",
    name: "SMS — appointment reminder",
    category: "sms_reminder" as const,
    subject: null,
    body: "{{company_name}}: Hi {{customer_name}}, reminder — we have you scheduled {{appointment_date}}. Questions? Reply to this thread. Reply STOP to opt out.",
    channel: "sms" as const,
  },
]
