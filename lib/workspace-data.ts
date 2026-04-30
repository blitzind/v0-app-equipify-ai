/**
 * workspace-data.ts
 * Central registry that maps a workspace ID to its full set of demo data.
 * Each store listens for RESET actions carrying this bundle.
 */

import {
  customers,
  equipment,
  workOrders,
  maintenancePlans,
  notificationLog,
  technicians,
  adminQuotes,
  adminInvoices,
  mockStats,
  revenueData,
  workOrdersByStatus,
  recentWorkOrders,
  equipmentDueSoon,
  repeatRepairs,
  expiringWarranties,
  type Customer,
  type Equipment,
  type WorkOrder,
  type MaintenancePlan,
  type NotificationLogEntry,
  type Technician,
  type AdminQuote,
  type AdminInvoice,
  type AiInsight,
} from "@/lib/mock-data"

import {
  medCustomers,
  medEquipment,
  medWorkOrders,
  medMaintenancePlans,
  medNotificationLog,
  medTechnicians,
  medQuotes,
  medInvoices,
  medStats,
  medRevenueData,
  medWorkOrdersByStatus,
  medRecentWorkOrders,
  medEquipmentDueSoon,
  medRepeatRepairs,
  medExpiringWarranties,
  medInsights,
} from "@/lib/medology-data"

export interface DashboardStats {
  equipmentDueThisMonth: number
  overdueService: number
  openWorkOrders: number
  monthlyRevenue: string
  revenueSubtitle: string
  revenueTrend: string
  expiringWarranties: number
  warrantyTrend: string
  repeatRepairAlerts: number
}

export interface WorkspaceDataBundle {
  customers: Customer[]
  equipment: Equipment[]
  workOrders: WorkOrder[]
  maintenancePlans: MaintenancePlan[]
  notificationLog: NotificationLogEntry[]
  technicians: Technician[]
  quotes: AdminQuote[]
  invoices: AdminInvoice[]
  stats: DashboardStats
  revenueData: typeof revenueData
  workOrdersByStatus: typeof workOrdersByStatus
  recentWorkOrders: typeof recentWorkOrders
  equipmentDueSoon: typeof equipmentDueSoon
  repeatRepairs: typeof repeatRepairs
  expiringWarranties: typeof expiringWarranties
  aiInsights: AiInsight[]
}

const ACME_INSIGHTS: AiInsight[] = [
  {
    id: "od-1",
    category: "overdue_client",
    severity: "critical",
    title: "14 units are past their service due date",
    description: "Greenfield Industrial has 6 HVAC units averaging 47 days overdue. Continued deferral increases failure risk by ~3x and may void warranty coverage.",
    meta: "Last checked 4 min ago",
    value: "47 days avg overdue",
    actionLabel: "View overdue units",
    actionHref: "/service-schedule",
  },
  {
    id: "od-2",
    category: "overdue_client",
    severity: "high",
    title: "Summit Logistics: 3 compressors past due",
    description: "Refrigeration compressors at Summit Logistics' warehouse have missed their Q1 2026 service window. Schedule before summer peak load.",
    meta: "Due Q1 2026",
    value: "+23 days",
    actionLabel: "Schedule now",
    actionHref: "/work-orders",
  },
  {
    id: "rf-1",
    category: "repeat_failure",
    severity: "critical",
    title: "Carrier 50XC unit failing repeatedly at Apex Corp",
    description: "Unit #EQ-1042 has had 5 work orders in 90 days — all for the same fault code (E04). Root cause has not been addressed. Consider replacing the condenser coil assembly.",
    meta: "5 repairs in 90 days",
    value: "5x in 90 days",
    actionLabel: "View equipment",
    actionHref: "/equipment",
  },
  {
    id: "rev-1",
    category: "revenue_opportunity",
    severity: "medium",
    title: "Apex Fabricators contract renewal opportunity",
    description: "Their current PM Plan contract ends June 30. Upselling to Full Coverage could add $8,200 ARR. Prior engagement history shows 92% renewal rate for accounts with 3+ completed PMs.",
    meta: "Renewal due Jun 30",
    value: "+$8,200 ARR est.",
    actionLabel: "View account",
    actionHref: "/customers",
  },
  {
    id: "tech-1",
    category: "upsell",
    severity: "low",
    title: "Marcus Webb is approaching capacity this week",
    description: "Marcus has 4 confirmed jobs this week at 88% utilization. If WO-2044 is added, reassigning to Sandra Liu (75% utilized, same skill set) would prevent overtime.",
    meta: "88% utilization",
    value: "4 jobs this week",
    actionLabel: "View technicians",
    actionHref: "/technicians",
  },
]

const WORKSPACE_DATA: Record<string, WorkspaceDataBundle> = {
  "ws-acme": {
    customers,
    equipment,
    workOrders,
    maintenancePlans,
    notificationLog,
    technicians,
    quotes: adminQuotes,
    invoices: adminInvoices,
    stats: mockStats,
    revenueData,
    workOrdersByStatus,
    recentWorkOrders,
    equipmentDueSoon,
    repeatRepairs,
    expiringWarranties,
    aiInsights: ACME_INSIGHTS,
  },
  "ws-medology": {
    customers: medCustomers,
    equipment: medEquipment,
    workOrders: medWorkOrders,
    maintenancePlans: medMaintenancePlans,
    notificationLog: medNotificationLog,
    technicians: medTechnicians,
    quotes: medQuotes,
    invoices: medInvoices,
    stats: medStats,
    revenueData: medRevenueData,
    workOrdersByStatus: medWorkOrdersByStatus,
    recentWorkOrders: medRecentWorkOrders,
    equipmentDueSoon: medEquipmentDueSoon,
    repeatRepairs: medRepeatRepairs,
    expiringWarranties: medExpiringWarranties,
    aiInsights: medInsights,
  },
}

// Fallback to Acme data if workspace not found
export function getWorkspaceData(workspaceId: string): WorkspaceDataBundle {
  return WORKSPACE_DATA[workspaceId] ?? WORKSPACE_DATA["ws-acme"]
}
