// ─── Types ───────────────────────────────────────────────────────────────────

export type CustomerStatus = "Active" | "Inactive"
export type EquipmentStatus = "Active" | "Needs Service" | "Out of Service" | "In Repair"

export interface Contact {
  name: string
  role: string
  email: string
  phone: string
}

export interface Location {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
}

export interface Contract {
  id: string
  name: string
  type: "PM Plan" | "Full Coverage" | "Labor Only" | "Parts & Labor"
  startDate: string
  endDate: string
  value: number
}

export interface Customer {
  id: string
  name: string
  company: string
  status: CustomerStatus
  locations: Location[]
  contacts: Contact[]
  notes: string
  contracts: Contract[]
  equipmentCount: number
  openWorkOrders: number
  joinedDate: string
}

export interface ServiceHistoryEntry {
  id: string
  date: string
  type: "PM" | "Repair" | "Inspection" | "Install"
  technician: string
  workOrderId: string
  description: string
  cost: number
  status: "Completed" | "Cancelled"
}

export interface Equipment {
  id: string
  customerId: string
  customerName: string
  model: string
  manufacturer: string
  category: string
  serialNumber: string
  installDate: string
  warrantyExpiration: string
  lastServiceDate: string
  nextDueDate: string
  status: EquipmentStatus
  notes: string
  location: string
  photos: string[]
  manuals: string[]
  serviceHistory: ServiceHistoryEntry[]
}

// ─── Customers ────────────────────────────────────────────────────────────────

export const customers: Customer[] = [
  {
    id: "CUS-001",
    name: "Dale Whitmore",
    company: "Riverstone Logistics",
    status: "Active",
    equipmentCount: 14,
    openWorkOrders: 3,
    joinedDate: "2021-03-12",
    locations: [
      { id: "LOC-001", name: "Main Warehouse", address: "4400 Industrial Pkwy", city: "Columbus", state: "OH", zip: "43215" },
      { id: "LOC-002", name: "South Depot", address: "812 Commerce Blvd", city: "Columbus", state: "OH", zip: "43228" },
    ],
    contacts: [
      { name: "Dale Whitmore", role: "General Manager", email: "dale@riverstonelogistics.com", phone: "(614) 555-0142" },
      { name: "Rita Flores", role: "Maintenance Coordinator", email: "rita@riverstonelogistics.com", phone: "(614) 555-0198" },
    ],
    notes: "Preferred vendor for all forklift and material handling equipment. Net-30 payment terms.",
    contracts: [
      { id: "CON-101", name: "Annual PM Plan", type: "PM Plan", startDate: "2026-01-01", endDate: "2026-12-31", value: 18500 },
    ],
  },
  {
    id: "CUS-002",
    name: "Kevin Marsh",
    company: "Apex Fabricators",
    status: "Active",
    equipmentCount: 22,
    openWorkOrders: 5,
    joinedDate: "2020-07-08",
    locations: [
      { id: "LOC-003", name: "Plant A", address: "2201 Foundry Rd", city: "Dayton", state: "OH", zip: "45402" },
    ],
    contacts: [
      { name: "Kevin Marsh", role: "Plant Manager", email: "kmarsh@apexfab.com", phone: "(937) 555-0311" },
      { name: "Sandra Liu", role: "Safety Officer", email: "sliu@apexfab.com", phone: "(937) 555-0377" },
    ],
    notes: "High-volume CNC and fabrication equipment. Monthly scheduled PM visits required.",
    contracts: [
      { id: "CON-102", name: "Full Coverage Agreement", type: "Full Coverage", startDate: "2025-07-01", endDate: "2026-06-30", value: 42000 },
    ],
  },
  {
    id: "CUS-003",
    name: "Terrence Flynn",
    company: "Metro Warehousing",
    status: "Active",
    equipmentCount: 18,
    openWorkOrders: 2,
    joinedDate: "2022-01-20",
    locations: [
      { id: "LOC-004", name: "Distribution Center", address: "900 Logistics Lane", city: "Cincinnati", state: "OH", zip: "45202" },
      { id: "LOC-005", name: "Cold Storage Annex", address: "918 Logistics Lane", city: "Cincinnati", state: "OH", zip: "45202" },
    ],
    contacts: [
      { name: "Terrence Flynn", role: "Operations Director", email: "tflynn@metrowh.com", phone: "(513) 555-0521" },
    ],
    notes: "Cold storage equipment requires specialized refrigerant handling. Compliance inspections in Q2.",
    contracts: [
      { id: "CON-103", name: "Parts & Labor Plan", type: "Parts & Labor", startDate: "2026-01-01", endDate: "2026-12-31", value: 27000 },
    ],
  },
  {
    id: "CUS-004",
    name: "Angela Strom",
    company: "Summit Construction",
    status: "Active",
    equipmentCount: 31,
    openWorkOrders: 7,
    joinedDate: "2019-11-05",
    locations: [
      { id: "LOC-006", name: "Equipment Yard", address: "7700 Summit Blvd", city: "Cleveland", state: "OH", zip: "44101" },
    ],
    contacts: [
      { name: "Angela Strom", role: "Fleet Manager", email: "astrom@summitconst.com", phone: "(216) 555-0812" },
      { name: "Rob Gavin", role: "Site Supervisor", email: "rgavin@summitconst.com", phone: "(216) 555-0855" },
    ],
    notes: "Large crane and heavy equipment fleet. On-site service required for cranes over 50 tons.",
    contracts: [
      { id: "CON-104", name: "Labor Only Agreement", type: "Labor Only", startDate: "2025-11-01", endDate: "2026-10-31", value: 31500 },
      { id: "CON-105", name: "Crane PM Plan", type: "PM Plan", startDate: "2026-01-01", endDate: "2026-12-31", value: 14800 },
    ],
  },
  {
    id: "CUS-005",
    name: "Linda Park",
    company: "Clearfield Foods",
    status: "Active",
    equipmentCount: 9,
    openWorkOrders: 1,
    joinedDate: "2023-04-15",
    locations: [
      { id: "LOC-007", name: "Processing Plant", address: "3321 Clearfield Ave", city: "Akron", state: "OH", zip: "44301" },
    ],
    contacts: [
      { name: "Linda Park", role: "Facilities Manager", email: "lpark@clearfieldfoods.com", phone: "(330) 555-0633" },
    ],
    notes: "FDA-regulated facility. All service must be performed during scheduled maintenance windows (2am-6am).",
    contracts: [
      { id: "CON-106", name: "Full Coverage Agreement", type: "Full Coverage", startDate: "2026-04-01", endDate: "2027-03-31", value: 22000 },
    ],
  },
  {
    id: "CUS-006",
    name: "Morris Chen",
    company: "Lakefront Printing",
    status: "Inactive",
    equipmentCount: 4,
    openWorkOrders: 0,
    joinedDate: "2020-02-14",
    locations: [
      { id: "LOC-008", name: "Print Shop", address: "501 Harbor Dr", city: "Toledo", state: "OH", zip: "43601" },
    ],
    contacts: [
      { name: "Morris Chen", role: "Owner", email: "mchen@lakefrontprint.com", phone: "(419) 555-0290" },
    ],
    notes: "Account on hold pending contract renewal discussions.",
    contracts: [],
  },
]

// ─── Equipment ────────────────────────────────────────────────────────────────

export const equipment: Equipment[] = [
  {
    id: "EQ-188",
    customerId: "CUS-001",
    customerName: "Riverstone Logistics",
    model: "Toyota 8FGU25",
    manufacturer: "Toyota",
    category: "Forklift",
    serialNumber: "8FGU25-84721",
    installDate: "2022-06-10",
    warrantyExpiration: "2027-06-10",
    lastServiceDate: "2026-01-15",
    nextDueDate: "2026-04-30",
    status: "Needs Service",
    location: "Main Warehouse",
    notes: "Engine oil slightly dark. Recommend full PM at next visit.",
    photos: [],
    manuals: ["Toyota_8FGU25_Service_Manual.pdf"],
    serviceHistory: [
      { id: "SH-001", date: "2026-01-15", type: "PM", technician: "Marcus Webb", workOrderId: "WO-1980", description: "Semi-annual PM: oil change, filter, brake check", cost: 385, status: "Completed" },
      { id: "SH-002", date: "2025-07-20", type: "PM", technician: "Marcus Webb", workOrderId: "WO-1744", description: "Semi-annual PM: full inspection, fluid top-off", cost: 350, status: "Completed" },
      { id: "SH-003", date: "2025-01-08", type: "Repair", technician: "Tyler Oakes", workOrderId: "WO-1501", description: "Hydraulic lift cylinder seal replaced", cost: 720, status: "Completed" },
    ],
  },
  {
    id: "EQ-241",
    customerId: "CUS-002",
    customerName: "Apex Fabricators",
    model: "Ingersoll Rand UP6-15cTAS",
    manufacturer: "Ingersoll Rand",
    category: "Air Compressor",
    serialNumber: "IR-UP615-99234",
    installDate: "2021-09-05",
    warrantyExpiration: "2026-09-05",
    lastServiceDate: "2026-02-10",
    nextDueDate: "2026-05-03",
    status: "Active",
    location: "Plant A",
    notes: "Scheduled for filter replacement. No issues noted.",
    photos: [],
    manuals: ["IR_UP6-15_Manual.pdf"],
    serviceHistory: [
      { id: "SH-004", date: "2026-02-10", type: "PM", technician: "Sandra Liu", workOrderId: "WO-2010", description: "Quarterly PM: filter, belt tension, separator check", cost: 295, status: "Completed" },
      { id: "SH-005", date: "2025-11-05", type: "PM", technician: "Sandra Liu", workOrderId: "WO-1890", description: "Quarterly PM", cost: 295, status: "Completed" },
    ],
  },
  {
    id: "EQ-304",
    customerId: "CUS-002",
    customerName: "Apex Fabricators",
    model: "Haas VF-2SS",
    manufacturer: "Haas Automation",
    category: "CNC Machine",
    serialNumber: "HAAS-VF2-30481",
    installDate: "2020-03-15",
    warrantyExpiration: "2025-03-15",
    lastServiceDate: "2026-04-22",
    nextDueDate: "2026-07-22",
    status: "In Repair",
    location: "Plant A",
    notes: "Repeat motor overheating issue. Pending root cause analysis. 4th repair this year.",
    photos: [],
    manuals: ["Haas_VF2_SS_Operators_Manual.pdf"],
    serviceHistory: [
      { id: "SH-006", date: "2026-04-22", type: "Repair", technician: "Sandra Liu", workOrderId: "WO-2040", description: "Motor overheating - thermal fuse replaced", cost: 890, status: "Completed" },
      { id: "SH-007", date: "2026-03-11", type: "Repair", technician: "Sandra Liu", workOrderId: "WO-1995", description: "Motor overheating - coolant flush and fan replacement", cost: 1150, status: "Completed" },
      { id: "SH-008", date: "2026-02-02", type: "Repair", technician: "Marcus Webb", workOrderId: "WO-1940", description: "Motor overheating - relay board replaced", cost: 2200, status: "Completed" },
      { id: "SH-009", date: "2026-01-07", type: "Repair", technician: "Marcus Webb", workOrderId: "WO-1901", description: "Motor overheating - initial diagnosis", cost: 450, status: "Completed" },
    ],
  },
  {
    id: "EQ-305",
    customerId: "CUS-004",
    customerName: "Summit Construction",
    model: "JLG 600S",
    manufacturer: "JLG Industries",
    category: "Boom Lift",
    serialNumber: "JLG600S-71829",
    installDate: "2023-04-01",
    warrantyExpiration: "2026-04-01",
    lastServiceDate: "2026-02-20",
    nextDueDate: "2026-05-06",
    status: "Active",
    location: "Equipment Yard",
    notes: "Warranty just expired. Recommend enrolling in PM plan.",
    photos: [],
    manuals: ["JLG_600S_Safety_Manual.pdf", "JLG_600S_Service_Manual.pdf"],
    serviceHistory: [
      { id: "SH-010", date: "2026-02-20", type: "Inspection", technician: "Priya Mehta", workOrderId: "WO-1960", description: "Annual ANSI inspection passed", cost: 420, status: "Completed" },
      { id: "SH-011", date: "2025-08-14", type: "PM", technician: "Priya Mehta", workOrderId: "WO-1770", description: "Semi-annual PM: hydraulic fluid, filters, boom lubrication", cost: 510, status: "Completed" },
    ],
  },
  {
    id: "EQ-412",
    customerId: "CUS-003",
    customerName: "Metro Warehousing",
    model: "Crown PTH50",
    manufacturer: "Crown Equipment",
    category: "Pallet Jack",
    serialNumber: "CROWN-PTH50-52311",
    installDate: "2023-08-22",
    warrantyExpiration: "2026-08-22",
    lastServiceDate: "2026-02-15",
    nextDueDate: "2026-05-08",
    status: "Active",
    location: "Distribution Center",
    notes: "",
    photos: [],
    manuals: [],
    serviceHistory: [
      { id: "SH-012", date: "2026-02-15", type: "PM", technician: "Tyler Oakes", workOrderId: "WO-1955", description: "Quarterly PM service", cost: 180, status: "Completed" },
    ],
  },
  {
    id: "EQ-500",
    customerId: "CUS-003",
    customerName: "Metro Warehousing",
    model: "Carrier 50XCZ060",
    manufacturer: "Carrier",
    category: "HVAC",
    serialNumber: "CAR-50XCZ-88120",
    installDate: "2021-05-10",
    warrantyExpiration: "2024-05-10",
    lastServiceDate: "2026-04-29",
    nextDueDate: "2026-10-29",
    status: "Active",
    location: "Cold Storage Annex",
    notes: "Out-of-warranty. Refrigerant R-410A. Compliant with EPA 608.",
    photos: [],
    manuals: ["Carrier_50XCZ_Service_Manual.pdf"],
    serviceHistory: [
      { id: "SH-013", date: "2026-04-29", type: "Inspection", technician: "Tyler Oakes", workOrderId: "WO-2039", description: "Semi-annual HVAC inspection: coils cleaned, refrigerant checked", cost: 340, status: "Completed" },
      { id: "SH-014", date: "2025-10-12", type: "PM", technician: "James Torres", workOrderId: "WO-1850", description: "Fall PM: belt replacement, filter change", cost: 275, status: "Completed" },
    ],
  },
  {
    id: "EQ-601",
    customerId: "CUS-004",
    customerName: "Summit Construction",
    model: "Liebherr LTM 1050-3.1",
    manufacturer: "Liebherr",
    category: "Crane",
    serialNumber: "LH-LTM1050-19982",
    installDate: "2019-06-01",
    warrantyExpiration: "2024-06-01",
    lastServiceDate: "2026-04-25",
    nextDueDate: "2026-07-25",
    status: "In Repair",
    location: "Equipment Yard",
    notes: "Cable tension repeat issue. Third occurrence this year. Engineering review scheduled.",
    photos: [],
    manuals: ["Liebherr_LTM1050_Operations_Manual.pdf"],
    serviceHistory: [
      { id: "SH-015", date: "2026-04-25", type: "Repair", technician: "Priya Mehta", workOrderId: "WO-2038", description: "Cable tension adjustment - load line re-spooled", cost: 1800, status: "Completed" },
      { id: "SH-016", date: "2026-03-02", type: "Repair", technician: "Priya Mehta", workOrderId: "WO-1970", description: "Cable tension - secondary hoist line replaced", cost: 3400, status: "Completed" },
      { id: "SH-017", date: "2026-01-20", type: "Inspection", technician: "Marcus Webb", workOrderId: "WO-1910", description: "OSHA annual crane inspection", cost: 680, status: "Completed" },
    ],
  },
  {
    id: "EQ-712",
    customerId: "CUS-005",
    customerName: "Clearfield Foods",
    model: "Heatcraft LCE060AGD",
    manufacturer: "Heatcraft",
    category: "Refrigeration",
    serialNumber: "HC-LCE060-44501",
    installDate: "2023-04-15",
    warrantyExpiration: "2026-04-15",
    lastServiceDate: "2026-04-10",
    nextDueDate: "2026-10-10",
    status: "Active",
    location: "Processing Plant",
    notes: "Warranty just expired. Pump failure flagged 3x this cycle.",
    photos: [],
    manuals: ["Heatcraft_LCE060_Installation_Manual.pdf"],
    serviceHistory: [
      { id: "SH-018", date: "2026-04-10", type: "Repair", technician: "James Torres", workOrderId: "WO-2025", description: "Pump seal failure - seal kit replaced", cost: 640, status: "Completed" },
      { id: "SH-019", date: "2026-02-28", type: "Repair", technician: "James Torres", workOrderId: "WO-1975", description: "Pump seal failure - secondary pump rebuilt", cost: 920, status: "Completed" },
      { id: "SH-020", date: "2025-12-05", type: "PM", technician: "James Torres", workOrderId: "WO-1880", description: "Winter PM: coils, defrost cycle, drain check", cost: 310, status: "Completed" },
    ],
  },
  {
    id: "EQ-820",
    customerId: "CUS-004",
    customerName: "Summit Construction",
    model: "Cat 320 GC",
    manufacturer: "Caterpillar",
    category: "Excavator",
    serialNumber: "CAT320GC-DJE00481",
    installDate: "2023-05-01",
    warrantyExpiration: "2026-05-15",
    lastServiceDate: "2026-03-05",
    nextDueDate: "2026-06-05",
    status: "Active",
    location: "Equipment Yard",
    notes: "Warranty expires in 15 days. Schedule pre-warranty inspection.",
    photos: [],
    manuals: ["Cat_320GC_Operation_Manual.pdf"],
    serviceHistory: [
      { id: "SH-021", date: "2026-03-05", type: "PM", technician: "Priya Mehta", workOrderId: "WO-1985", description: "1000-hour PM: fluids, filters, undercarriage inspection", cost: 875, status: "Completed" },
    ],
  },
]

// ─── Stats ────────────────────────────────────────────────────────────────────

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
