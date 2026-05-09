import type { OrgPermissions } from "@/lib/permissions/model"

export type AidenModuleId =
  | "dashboard"
  | "customers"
  | "equipment"
  | "work_orders"
  | "service_schedule"
  | "maintenance_plans"
  | "technicians"
  | "certificates"
  | "quotes"
  | "invoices"
  | "purchase_orders"
  | "vendors"
  | "inventory"
  | "catalog"
  | "reports"
  | "insights"
  | "ai_assistants"
  | "communications"
  | "settings"
  | "integrations"
  | "portal"
  | "admin"
  | "equipify"

export type AidenModuleDefinition = {
  id: AidenModuleId
  label: string
  routes: string[]
  summary: string
  limitations?: string[]
  quickPrompts: string[]
  allowedActions: Array<{
    label: string
    href: string
    anyOf?: Array<keyof OrgPermissions>
  }>
}

export const AIDEN_MODULES: AidenModuleDefinition[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    routes: ["/"],
    summary: "Operational overview, KPIs, shortcuts, and technician-focused home when restricted.",
    quickPrompts: ["What should I work on next?", "How do I find overdue work?", "How do I review my assigned jobs?"],
    allowedActions: [{ label: "Open Dashboard", href: "/" }],
  },
  {
    id: "customers",
    label: "Customers",
    routes: ["/customers"],
    summary: "Customer accounts, contacts, locations, and customer detail workflows.",
    limitations: ["Parent/child customer hierarchy is not fully modeled yet."],
    quickPrompts: ["How do I create a customer?", "How do I add a contact?", "How do I create a work order from this customer?"],
    allowedActions: [
      { label: "Open Customers", href: "/customers" },
      { label: "Create Work Order", href: "/work-orders?action=new-work-order", anyOf: ["canViewAllWorkOrders", "canManageDispatch"] },
    ],
  },
  {
    id: "equipment",
    label: "Equipment",
    routes: ["/equipment"],
    summary: "Asset registry, warranty fields, equipment detail, and service/certificate history.",
    limitations: ["Portal-facing equipment history is not fully available yet."],
    quickPrompts: ["How do I schedule service?", "How do I add warranty info?", "How do I create a certificate?"],
    allowedActions: [
      { label: "Open Equipment", href: "/equipment" },
      { label: "Schedule Service", href: "/service-schedule", anyOf: ["canManageDispatch"] },
    ],
  },
  {
    id: "work_orders",
    label: "Work Orders",
    routes: ["/work-orders"],
    summary: "Work order lifecycle: service details, assignment, scheduling, parts, attachments, signatures, and certificates.",
    quickPrompts: ["How do I update status?", "How do I upload photos?", "How do I complete this job?", "How do I create an invoice from a work order?"],
    allowedActions: [
      { label: "Open Work Orders", href: "/work-orders" },
      { label: "My Jobs Today", href: "/technicians/today", anyOf: ["canUseTechnicianWorkspace"] },
    ],
  },
  {
    id: "service_schedule",
    label: "Service Schedule",
    routes: ["/service-schedule"],
    summary: "Calendar service view with assigned appointments and dispatcher drag/drop scheduling.",
    limitations: ["Advanced route optimization and notification polish are still gaps."],
    quickPrompts: ["How do I schedule a service visit?", "How do I reassign a technician?", "Why can't I drag jobs?"],
    allowedActions: [
      { label: "Open Schedule", href: "/service-schedule" },
      { label: "My Jobs Today", href: "/technicians/today", anyOf: ["canUseTechnicianWorkspace"] },
    ],
  },
  {
    id: "maintenance_plans",
    label: "Maintenance Plans",
    routes: ["/maintenance-plans"],
    summary: "Recurring PM plans that can create due work orders.",
    limitations: ["Complex recurrence edge cases and notifications are still being refined."],
    quickPrompts: ["How do I add a maintenance plan?", "How do I reduce missed maintenance?", "How do due plans create work orders?"],
    allowedActions: [{ label: "Open Maintenance Plans", href: "/maintenance-plans", anyOf: ["canManageDispatch"] }],
  },
  {
    id: "technicians",
    label: "Technicians",
    routes: ["/technicians"],
    summary: "Technician roster, skill tags, signatures, certifications, and field views.",
    quickPrompts: ["How do I see my jobs today?", "How do technician signatures work?", "How do I manage skill tags?"],
    allowedActions: [
      { label: "Open Today", href: "/technicians/today", anyOf: ["canUseTechnicianWorkspace"] },
      { label: "Open Technicians", href: "/technicians", anyOf: ["canManageTechnicians"] },
    ],
  },
  {
    id: "certificates",
    label: "Certificates",
    routes: ["/calibration-templates"],
    summary: "Calibration templates, work-order certificate tabs, generated certificates, uploads, and portal release controls.",
    limitations: ["Technician signature analytics are still a gap."],
    quickPrompts: ["How do I generate a certificate?", "How do I upload a certificate PDF?", "How do I release a certificate to the portal?"],
    allowedActions: [{ label: "Open Certificates", href: "/calibration-templates", anyOf: ["canManageCertificateTemplates"] }],
  },
  {
    id: "quotes",
    label: "Quotes",
    routes: ["/quotes"],
    summary: "Quote authoring and customer approval flows.",
    limitations: ["Advanced terms/tax behavior is still evolving."],
    quickPrompts: ["How do I create a quote?", "How do I send a quote?", "How do I convert a quote?"],
    allowedActions: [{ label: "Open Quotes", href: "/quotes", anyOf: ["canViewQuotes", "canEditQuotes"] }],
  },
  {
    id: "invoices",
    label: "Invoices",
    routes: ["/invoices"],
    summary: "Invoice creation, email sending, QuickBooks export, and invoice-linked document visibility.",
    limitations: ["Payment allocation vs QuickBooks and jurisdiction tax are still gaps."],
    quickPrompts: ["How do I send an invoice?", "How do I record payment?", "How does QuickBooks export work?"],
    allowedActions: [{ label: "Open Invoices", href: "/invoices", anyOf: ["canViewBilling", "canEditInvoices"] }],
  },
  {
    id: "integrations",
    label: "Integrations",
    routes: ["/integrations", "/settings/integrations"],
    summary: "Integration catalog and real QuickBooks settings under Settings.",
    limitations: ["Some integration catalog entries are placeholders; QuickBooks is the implemented connector."],
    quickPrompts: ["How do I connect QuickBooks?", "How does invoice sync work?", "How do I reconnect QuickBooks?"],
    allowedActions: [{ label: "QuickBooks Settings", href: "/settings/integrations/quickbooks", anyOf: ["canManageIntegrations"] }],
  },
  {
    id: "inventory",
    label: "Inventory",
    routes: ["/inventory"],
    summary: "Stock, locations, vehicle inventory, receiving, transfer, consumption, adjustments, and low stock.",
    quickPrompts: ["How do I use parts on a work order?", "How do I request restock?", "How do I transfer stock?"],
    allowedActions: [{ label: "Open Inventory", href: "/inventory", anyOf: ["canManageInventory", "canConsumePartsOnWorkOrders"] }],
  },
  {
    id: "purchase_orders",
    label: "Purchase Orders",
    routes: ["/purchase-orders"],
    summary: "Purchasing workflow for replenishment and vendor orders.",
    quickPrompts: ["How do I create a purchase order?", "How do I receive items?", "How do purchase orders relate to inventory?"],
    allowedActions: [{ label: "Open Purchase Orders", href: "/purchase-orders", anyOf: ["canManageInventory"] }],
  },
  {
    id: "vendors",
    label: "Vendors",
    routes: ["/vendors"],
    summary: "Vendor records used by purchase orders and purchasing workflows.",
    quickPrompts: ["How do I add a vendor?", "How do I link vendors to purchase orders?", "How do I review vendor purchases?"],
    allowedActions: [{ label: "Open Vendors", href: "/vendors", anyOf: ["canManageInventory"] }],
  },
  {
    id: "catalog",
    label: "Catalog",
    routes: ["/catalog"],
    summary: "Catalog items and AI-assisted price list import workflows.",
    quickPrompts: ["How do I add catalog items?", "How does price list import work?", "How do catalog items become quote or invoice lines?"],
    allowedActions: [{ label: "Open Catalog", href: "/catalog", anyOf: ["canManageInventory"] }],
  },
  {
    id: "reports",
    label: "Reports",
    routes: ["/reports"],
    summary: "Operational and financial analytics, exports, and equipment-type reporting.",
    limitations: ["Large-tenant reporting views may need future SQL/materialized optimizations."],
    quickPrompts: ["How do I export reports?", "How do I review equipment type performance?", "Why can't I see financial reports?"],
    allowedActions: [{ label: "Open Reports", href: "/reports", anyOf: ["canViewOperationalReports", "canViewFinancialReports"] }],
  },
  {
    id: "insights",
    label: "Insights",
    routes: ["/insights"],
    summary: "AI-generated operational insight summaries and review workflow.",
    limitations: ["Insights explain operational patterns; they do not autonomously forecast or execute workflows."],
    quickPrompts: ["How do I generate insights?", "What should I do with overdue work insights?", "How do I reduce missed maintenance?"],
    allowedActions: [{ label: "Open Insights", href: "/insights", anyOf: ["canViewInsights"] }],
  },
  {
    id: "ai_assistants",
    label: "AI Assistants",
    routes: ["/ai-assistants"],
    summary: "Assistant jobs and AI-powered operational helpers.",
    limitations: ["Workflow execution, voice, screenshots, SOP generation, and customer-facing agents are future capabilities."],
    quickPrompts: ["What can AIden help with?", "How are AI assistants different from insights?", "What AI features are not available yet?"],
    allowedActions: [{ label: "Open AI Assistants", href: "/ai-assistants", anyOf: ["canViewInsights"] }],
  },
  {
    id: "settings",
    label: "Settings",
    routes: ["/settings"],
    summary: "Workspace, team, permissions, billing, portal, imports, integrations, automations, and security configuration.",
    quickPrompts: [
      "Where do I manage billing?",
      "How do I invite a customer to the portal?",
      "How do I invite a team member?",
      "How do I upload a technician signature?",
    ],
    allowedActions: [{ label: "Open Settings", href: "/settings/workspace", anyOf: ["canManageWorkspaceSettings"] }],
  },
  {
    id: "communications",
    label: "Communications",
    routes: ["/communications"],
    summary: "Communication feed, templates, metrics, automations, drafts, retry and read states.",
    quickPrompts: ["How do I review recent communications?", "How do I retry a failed message?", "How do communications automations work?"],
    allowedActions: [{ label: "Open Communications", href: "/communications", anyOf: ["canViewCommunications"] }],
  },
]

const FALLBACK_MODULE: AidenModuleDefinition = {
  id: "equipify",
  label: "Equipify",
  routes: [],
  summary: "Equipify workspace help.",
  quickPrompts: ["How do I create a work order?", "How do I send an invoice?", "How do I connect QuickBooks?"],
  allowedActions: [{ label: "Open Dashboard", href: "/" }],
}

export function moduleFromPath(pathname: string | null | undefined): AidenModuleDefinition {
  const path = pathname?.trim() || "/"
  if (path === "/") return AIDEN_MODULES.find((m) => m.id === "dashboard") ?? FALLBACK_MODULE
  const match = AIDEN_MODULES
    .filter((m) => m.routes.some((route) => route !== "/" && path.startsWith(route)))
    .sort((a, b) => Math.max(...b.routes.map((r) => r.length)) - Math.max(...a.routes.map((r) => r.length)))[0]
  return match ?? FALLBACK_MODULE
}

export function allowedModuleActions(
  module: AidenModuleDefinition,
  permissions: OrgPermissions,
) {
  return module.allowedActions.filter((action) => {
    if (!action.anyOf?.length) return true
    return action.anyOf.some((key) => permissions[key])
  })
}
