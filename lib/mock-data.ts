export const mockStats = {
  equipmentDueThisMonth: 47,
  overdueService: 12,
  openWorkOrders: 83,
  monthlyRevenue: 184_250,
  expiringWarranties: 19,
  repeatRepairAlerts: 6,
}

export const revenueData = [
  { month: "Nov", revenue: 142000 },
  { month: "Dec", revenue: 158000 },
  { month: "Jan", revenue: 135000 },
  { month: "Feb", revenue: 161000 },
  { month: "Mar", revenue: 172000 },
  { month: "Apr", revenue: 184250 },
]

export const workOrdersByStatus = [
  { status: "Open", count: 83, color: "var(--color-chart-1)" },
  { status: "In Progress", count: 41, color: "var(--color-chart-2)" },
  { status: "Completed", count: 214, color: "var(--color-status-success)" },
  { status: "On Hold", count: 17, color: "var(--color-status-warning)" },
]

export const recentWorkOrders = [
  {
    id: "WO-2041",
    customer: "Riverstone Logistics",
    equipment: "Forklift #FL-08",
    type: "Preventive Maintenance",
    technician: "Marcus Webb",
    status: "In Progress",
    priority: "High",
    due: "2026-04-30",
  },
  {
    id: "WO-2040",
    customer: "Apex Fabricators",
    equipment: "CNC Machine #CNC-3",
    type: "Corrective Repair",
    technician: "Sandra Liu",
    status: "Open",
    priority: "Critical",
    due: "2026-04-30",
  },
  {
    id: "WO-2039",
    customer: "Metro Warehousing",
    equipment: "HVAC Unit #HV-12",
    type: "Inspection",
    technician: "Tyler Oakes",
    status: "Completed",
    priority: "Normal",
    due: "2026-04-29",
  },
  {
    id: "WO-2038",
    customer: "Summit Construction",
    equipment: "Crane #CR-02",
    type: "Corrective Repair",
    technician: "Priya Mehta",
    status: "On Hold",
    priority: "High",
    due: "2026-05-01",
  },
  {
    id: "WO-2037",
    customer: "Clearfield Foods",
    equipment: "Refrigeration Unit #RF-5",
    type: "Preventive Maintenance",
    technician: "James Torres",
    status: "Open",
    priority: "Normal",
    due: "2026-05-02",
  },
]

export const equipmentDueSoon = [
  { id: "EQ-188", name: "Forklift #FL-08", customer: "Riverstone Logistics", nextService: "2026-04-30", type: "Annual Inspection" },
  { id: "EQ-241", name: "Air Compressor #AC-2", customer: "Apex Fabricators", nextService: "2026-05-03", type: "Filter Replacement" },
  { id: "EQ-305", name: "Boom Lift #BL-1", customer: "Summit Construction", nextService: "2026-05-06", type: "Hydraulic Service" },
  { id: "EQ-412", name: "Pallet Jack #PJ-7", customer: "Metro Warehousing", nextService: "2026-05-08", type: "PM Service" },
]

export const repeatRepairs = [
  { equipment: "CNC Machine #CNC-3", customer: "Apex Fabricators", repairs: 4, lastRepair: "2026-04-22", issue: "Motor Overheating" },
  { equipment: "Pump Unit #PU-11", customer: "Clearfield Foods", repairs: 3, lastRepair: "2026-04-18", issue: "Seal Failure" },
  { equipment: "Crane #CR-02", customer: "Summit Construction", repairs: 3, lastRepair: "2026-04-25", issue: "Cable Tension" },
]

export const expiringWarranties = [
  { equipment: "Excavator #EX-4", customer: "Summit Construction", expires: "2026-05-15", daysLeft: 15 },
  { equipment: "Welding Station #WS-2", customer: "Apex Fabricators", expires: "2026-05-20", daysLeft: 20 },
  { equipment: "Conveyor #CV-9", customer: "Metro Warehousing", expires: "2026-05-28", daysLeft: 28 },
]

export const technicians = [
  { id: "T-01", name: "Marcus Webb", active: 3, completed: 28, rating: 4.9, avatar: "MW" },
  { id: "T-02", name: "Sandra Liu", active: 2, completed: 31, rating: 4.8, avatar: "SL" },
  { id: "T-03", name: "Tyler Oakes", active: 4, completed: 19, rating: 4.7, avatar: "TO" },
  { id: "T-04", name: "Priya Mehta", active: 2, completed: 24, rating: 4.9, avatar: "PM" },
  { id: "T-05", name: "James Torres", active: 1, completed: 22, rating: 4.6, avatar: "JT" },
]
