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
  addressLine2?: string
  city: string
  state: string
  zip: string
  phone?: string
  contactPerson?: string
  notes?: string
  isDefault?: boolean
  archived?: boolean
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

// ─── Calibration Certificates ─────────────────────────────────────────────────

export interface CalibrationCertificate {
  id: string
  equipmentId: string
  equipmentName: string
  customerId: string
  customerName: string
  fileName: string
  fileSize: number        // bytes
  fileType: string        // e.g. "application/pdf"
  dataUrl: string         // base64 data URL (client-only demo)
  uploadedAt: string      // ISO datetime
  uploadedBy: string
  expiryDate: string      // ISO date — empty string = no expiry
  notes: string
  /** Invoice IDs this certificate is attached to */
  attachedToInvoices: string[]
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
  /** Tenant asset code from Supabase `equipment_code`; optional on legacy mock rows. */
  equipmentCode?: string
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
  /** Estimated replacement cost in USD */
  replacementCost?: number
  /** Technician ID primarily responsible for this equipment */
  assignedTechnician?: string
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
    replacementCost: 28000,
    assignedTechnician: "Marcus Webb",
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
    replacementCost: 6500,
    assignedTechnician: "Sandra Liu",
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
    replacementCost: 145000,
    assignedTechnician: "Sandra Liu",
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
    replacementCost: 72000,
    assignedTechnician: "Priya Mehta",
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
    replacementCost: 4800,
    assignedTechnician: "Tyler Oakes",
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
    replacementCost: 18500,
    assignedTechnician: "Tyler Oakes",
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
    replacementCost: 1200000,
    assignedTechnician: "Priya Mehta",
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
    replacementCost: 22000,
    assignedTechnician: "James Torres",
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
    replacementCost: 265000,
    assignedTechnician: "Priya Mehta",
    photos: [],
    manuals: ["Cat_320GC_Operation_Manual.pdf"],
    serviceHistory: [
      { id: "SH-021", date: "2026-03-05", type: "PM", technician: "Priya Mehta", workOrderId: "WO-1985", description: "1000-hour PM: fluids, filters, undercarriage inspection", cost: 875, status: "Completed" },
    ],
  },
]

// ─── Work Orders ─────────────────────────────────────────────────────────────

export type WorkOrderStatus = "Open" | "Scheduled" | "In Progress" | "Completed" | "Invoiced"
export type WorkOrderPriority = "Low" | "Normal" | "High" | "Critical"
export type WorkOrderType = "Repair" | "PM" | "Inspection" | "Install" | "Emergency"

export interface Part {
  id: string
  name: string
  partNumber: string
  quantity: number
  unitCost: number
}

export interface RepairLog {
  problemReported: string
  diagnosis: string
  partsUsed: Part[]
  laborHours: number
  technicianNotes: string
  photos: string[]          // base64 or URL placeholders
  signatureDataUrl: string  // base64 canvas data or ""
  signedBy: string
  signedAt: string
  /** Optional checklist persisted in `repair_log` JSON (not a separate table). */
  tasks?: { id: string; label: string; done: boolean }[]
}

export interface WorkOrder {
  id: string
  /** Supabase monotonic per org; UI shows `WO-` + 7 digits. Optional on legacy mock rows that use `WO-####` ids. */
  workOrderNumber?: number
  customerId: string
  customerName: string
  equipmentId: string
  equipmentName: string
  location: string
  type: WorkOrderType
  status: WorkOrderStatus
  priority: WorkOrderPriority
  technicianId: string
  technicianName: string
  /** Public profile photo URL from `profiles.avatar_url` when assigned user has one. */
  technicianAvatarUrl?: string | null
  scheduledDate: string   // ISO date string
  scheduledTime: string   // "HH:MM"
  completedDate: string
  createdAt: string
  createdBy: string
  description: string
  repairLog: RepairLog
  totalLaborCost: number
  totalPartsCost: number
  invoiceNumber: string
  /** Set when this work order was created from a maintenance plan (Supabase `maintenance_plan_id`). */
  maintenancePlanId?: string | null
  maintenancePlanName?: string | null
  /** True when created by nightly PM automation (`created_by_pm_automation`). */
  createdByPmAutomation?: boolean
}

const emptyRepairLog = (): RepairLog => ({
  problemReported: "",
  diagnosis: "",
  partsUsed: [],
  laborHours: 0,
  technicianNotes: "",
  photos: [],
  signatureDataUrl: "",
  signedBy: "",
  signedAt: "",
  tasks: [],
})

export const workOrders: WorkOrder[] = [
  {
    id: "WO-2041",
    customerId: "CUS-001",
    customerName: "Riverstone Logistics",
    equipmentId: "EQ-188",
    equipmentName: "Toyota 8FGU25 Forklift",
    location: "Main Warehouse",
    type: "PM",
    status: "In Progress",
    priority: "High",
    technicianId: "T-01",
    technicianName: "Marcus Webb",
    scheduledDate: "2026-04-30",
    scheduledTime: "08:00",
    completedDate: "",
    createdAt: "2026-04-28T09:14:00Z",
    createdBy: "Admin",
    description: "Semi-annual PM service due. Engine oil dark, brake check required.",
    totalLaborCost: 320,
    totalPartsCost: 65,
    invoiceNumber: "",
    repairLog: {
      problemReported: "Engine oil overdue for change. Brakes feel soft per operator.",
      diagnosis: "Oil degraded past service interval. Rear brake pads at 15% — replacement required.",
      partsUsed: [
        { id: "P-001", name: "Engine Oil 10W-30 (5qt)", partNumber: "OIL-10W30-5Q", quantity: 2, unitCost: 18.50 },
        { id: "P-002", name: "Oil Filter", partNumber: "FIL-OF-8FGU", quantity: 1, unitCost: 12.00 },
        { id: "P-003", name: "Rear Brake Pad Set", partNumber: "BRK-8FGU-R", quantity: 1, unitCost: 34.00 },
      ],
      laborHours: 3.5,
      technicianNotes: "Recommend hydraulic fluid flush at next visit. Tires at 60% tread.",
      photos: [],
      signatureDataUrl: "",
      signedBy: "",
      signedAt: "",
    },
  },
  {
    id: "WO-2040",
    customerId: "CUS-002",
    customerName: "Apex Fabricators",
    equipmentId: "EQ-304",
    equipmentName: "Haas VF-2SS CNC Machine",
    location: "Plant A",
    type: "Repair",
    status: "Open",
    priority: "Critical",
    technicianId: "T-02",
    technicianName: "Sandra Liu",
    scheduledDate: "2026-04-30",
    scheduledTime: "07:00",
    completedDate: "",
    createdAt: "2026-04-29T06:50:00Z",
    createdBy: "Admin",
    description: "Motor overheating — 4th occurrence. Machine offline. Root cause analysis required.",
    totalLaborCost: 640,
    totalPartsCost: 250,
    invoiceNumber: "",
    repairLog: {
      problemReported: "Machine tripped thermal overload at 11:45am. Fourth incident this year.",
      diagnosis: "",
      partsUsed: [],
      laborHours: 0,
      technicianNotes: "",
      photos: [],
      signatureDataUrl: "",
      signedBy: "",
      signedAt: "",
    },
  },
  {
    id: "WO-2039",
    customerId: "CUS-003",
    customerName: "Metro Warehousing",
    equipmentId: "EQ-500",
    equipmentName: "Carrier 50XCZ060 HVAC",
    location: "Cold Storage Annex",
    type: "Inspection",
    status: "Completed",
    priority: "Normal",
    technicianId: "T-03",
    technicianName: "Tyler Oakes",
    scheduledDate: "2026-04-29",
    scheduledTime: "09:00",
    completedDate: "2026-04-29",
    createdAt: "2026-04-25T11:00:00Z",
    createdBy: "Admin",
    description: "Semi-annual HVAC inspection: coils, refrigerant, drains.",
    totalLaborCost: 240,
    totalPartsCost: 100,
    invoiceNumber: "INV-4412",
    repairLog: {
      problemReported: "Scheduled semi-annual inspection.",
      diagnosis: "Unit operating within spec. Minor coil buildup on evaporator side. R-410A charge confirmed.",
      partsUsed: [
        { id: "P-010", name: "Coil Cleaner (1 gal)", partNumber: "CLN-COIL-1G", quantity: 1, unitCost: 28.00 },
        { id: "P-011", name: "Drain Pan Treatment Tablets", partNumber: "DRN-TAB-12", quantity: 2, unitCost: 14.00 },
      ],
      laborHours: 2.5,
      technicianNotes: "Evaporator coil cleaned. Drain lines flushed. No refrigerant added. Next inspection: Oct 2026.",
      photos: [],
      signatureDataUrl: "SIGNED",
      signedBy: "Terrence Flynn",
      signedAt: "2026-04-29T14:32:00Z",
    },
  },
  {
    id: "WO-2038",
    customerId: "CUS-004",
    customerName: "Summit Construction",
    equipmentId: "EQ-601",
    equipmentName: "Liebherr LTM 1050-3.1 Crane",
    location: "Equipment Yard",
    type: "Repair",
    status: "Scheduled",
    priority: "High",
    technicianId: "T-04",
    technicianName: "Priya Mehta",
    scheduledDate: "2026-05-02",
    scheduledTime: "06:30",
    completedDate: "",
    createdAt: "2026-04-26T14:22:00Z",
    createdBy: "Admin",
    description: "Cable tension repeat issue. Engineering review + load line replacement.",
    totalLaborCost: 0,
    totalPartsCost: 0,
    invoiceNumber: "",
    repairLog: {
      problemReported: "Cable tension alarm triggered during 40-ton lift. Third occurrence this year.",
      diagnosis: "",
      partsUsed: [],
      laborHours: 0,
      technicianNotes: "",
      photos: [],
      signatureDataUrl: "",
      signedBy: "",
      signedAt: "",
    },
  },
  {
    id: "WO-2037",
    customerId: "CUS-005",
    customerName: "Clearfield Foods",
    equipmentId: "EQ-712",
    equipmentName: "Heatcraft LCE060AGD Refrigeration",
    location: "Processing Plant",
    type: "Repair",
    status: "Open",
    priority: "Normal",
    technicianId: "T-05",
    technicianName: "James Torres",
    scheduledDate: "2026-05-05",
    scheduledTime: "02:00",
    completedDate: "",
    createdAt: "2026-04-29T10:00:00Z",
    createdBy: "Admin",
    description: "Pump seal failure — third occurrence. Must be serviced in 2am–6am window.",
    totalLaborCost: 0,
    totalPartsCost: 0,
    invoiceNumber: "",
    repairLog: {
      problemReported: "Pump pressure dropped below threshold. Seal leak confirmed by on-site team.",
      diagnosis: "",
      partsUsed: [],
      laborHours: 0,
      technicianNotes: "",
      photos: [],
      signatureDataUrl: "",
      signedBy: "",
      signedAt: "",
    },
  },
  {
    id: "WO-2036",
    customerId: "CUS-004",
    customerName: "Summit Construction",
    equipmentId: "EQ-820",
    equipmentName: "Cat 320 GC Excavator",
    location: "Equipment Yard",
    type: "PM",
    status: "Invoiced",
    priority: "Normal",
    technicianId: "T-04",
    technicianName: "Priya Mehta",
    scheduledDate: "2026-04-25",
    scheduledTime: "08:00",
    completedDate: "2026-04-25",
    createdAt: "2026-04-20T08:00:00Z",
    createdBy: "Admin",
    description: "500-hour PM service. Pre-warranty expiration inspection.",
    totalLaborCost: 480,
    totalPartsCost: 395,
    invoiceNumber: "INV-4411",
    repairLog: {
      problemReported: "Scheduled 500-hour PM. Warranty expires 2026-05-15.",
      diagnosis: "All systems within spec. Undercarriage at 45% wear. Track tension adjusted.",
      partsUsed: [
        { id: "P-020", name: "Hydraulic Filter Set", partNumber: "FIL-HYD-320", quantity: 1, unitCost: 145.00 },
        { id: "P-021", name: "Engine Air Filter", partNumber: "FIL-AIR-320", quantity: 1, unitCost: 62.00 },
        { id: "P-022", name: "Hydraulic Fluid (5gal)", partNumber: "FLD-HYD-5G", quantity: 4, unitCost: 47.00 },
      ],
      laborHours: 4.0,
      technicianNotes: "Recommend undercarriage replacement at 1000hrs. Track tension re-torqued to spec. Photos on file.",
      photos: [],
      signatureDataUrl: "SIGNED",
      signedBy: "Angela Strom",
      signedAt: "2026-04-25T15:45:00Z",
    },
  },
  {
    id: "WO-2035",
    customerId: "CUS-001",
    customerName: "Riverstone Logistics",
    equipmentId: "EQ-188",
    equipmentName: "Toyota 8FGU25 Forklift",
    location: "South Depot",
    type: "Inspection",
    status: "Scheduled",
    priority: "Low",
    technicianId: "T-01",
    technicianName: "Marcus Webb",
    scheduledDate: "2026-05-08",
    scheduledTime: "10:00",
    completedDate: "",
    createdAt: "2026-04-27T13:00:00Z",
    createdBy: "Admin",
    description: "Annual OSHA forklift inspection.",
    totalLaborCost: 0,
    totalPartsCost: 0,
    invoiceNumber: "",
    repairLog: {
      problemReported: "Annual regulatory inspection due.",
      diagnosis: "",
      partsUsed: [],
      laborHours: 0,
      technicianNotes: "",
      photos: [],
      signatureDataUrl: "",
      signedBy: "",
      signedAt: "",
    },
  },
  {
    id: "WO-2034",
    customerId: "CUS-002",
    customerName: "Apex Fabricators",
    equipmentId: "EQ-241",
    equipmentName: "Ingersoll Rand UP6-15 Air Compressor",
    location: "Plant A",
    type: "PM",
    status: "Scheduled",
    priority: "Normal",
    technicianId: "T-02",
    technicianName: "Sandra Liu",
    scheduledDate: "2026-05-12",
    scheduledTime: "07:30",
    completedDate: "",
    createdAt: "2026-04-29T09:00:00Z",
    createdBy: "Admin",
    description: "Quarterly PM: filter replacement, belt tension check, separator element.",
    totalLaborCost: 0,
    totalPartsCost: 0,
    invoiceNumber: "",
    repairLog: {
      problemReported: "Scheduled quarterly PM.",
      diagnosis: "",
      partsUsed: [],
      laborHours: 0,
      technicianNotes: "",
      photos: [],
      signatureDataUrl: "",
      signedBy: "",
      signedAt: "",
    },
  },
]

// ─── Maintenance Plans ────────────────────────────────────────────────────────

export type PlanInterval = "Annual" | "Semi-Annual" | "Quarterly" | "Monthly" | "Custom"
export type PlanStatus = "Active" | "Paused" | "Expired"
export type NotificationChannel = "Email" | "SMS" | "Internal Alert"
export type NotificationTriggerDays = 30 | 14 | 7 | 1 | number

export type WeekdayTrigger = "thursday" | "monday" | "friday" | null

export interface NotificationRule {
  id: string
  channel: NotificationChannel
  triggerDays: NotificationTriggerDays
  /** When set, fires on every occurrence of this weekday until the service date */
  weekdayTrigger?: WeekdayTrigger
  enabled: boolean
  recipients: string[]   // email addresses or phone numbers
}

export interface MaintenancePlanService {
  id: string
  name: string
  description: string
  estimatedHours: number
  estimatedCost: number
}

export interface MaintenancePlan {
  id: string
  name: string
  customerId: string
  customerName: string
  equipmentId: string
  equipmentName: string
  equipmentCategory: string
  location: string
  technicianId: string
  technicianName: string
  interval: PlanInterval
  customIntervalDays: number   // only used when interval === "Custom"
  status: PlanStatus
  startDate: string            // ISO date
  lastServiceDate: string
  nextDueDate: string
  services: MaintenancePlanService[]
  notificationRules: NotificationRule[]
  autoCreateWorkOrder: boolean
  workOrderType: WorkOrderType
  workOrderPriority: WorkOrderPriority
  /** Preferred start time (HH:MM) for auto-created WOs; maps to plan services JSONB defaults. */
  preferredServiceTime?: string
  notes: string
  createdAt: string
  totalServicesCompleted: number
}

// Notification log entry — each fired notification is recorded here
export interface NotificationLogEntry {
  id: string
  planId: string
  planName: string
  equipmentName: string
  customerName: string
  channel: NotificationChannel
  triggerDays: NotificationTriggerDays
  sentAt: string    // ISO datetime
  recipient: string
  message: string
  status: "Sent" | "Failed" | "Simulated"
}

function buildDefaultRules(emails: string[], phones: string[]): NotificationRule[] {
  const rules: NotificationRule[] = []
  const days: NotificationTriggerDays[] = [30, 14, 7, 1]
  days.forEach((d) => {
    rules.push({ id: `r-email-${d}`, channel: "Email", triggerDays: d, enabled: true, recipients: emails })
    rules.push({ id: `r-internal-${d}`, channel: "Internal Alert", triggerDays: d, enabled: d <= 7, recipients: ["admin@equipify.ai"] })
    if (phones.length) {
      rules.push({ id: `r-sms-${d}`, channel: "SMS", triggerDays: d, enabled: d <= 7, recipients: phones })
    }
  })
  return rules
}

export const maintenancePlans: MaintenancePlan[] = [
  {
    id: "MP-001",
    name: "Forklift Semi-Annual PM",
    customerId: "CUS-001",
    customerName: "Riverstone Logistics",
    equipmentId: "EQ-188",
    equipmentName: "Toyota 8FGU25 Forklift",
    equipmentCategory: "Forklift",
    location: "Main Warehouse",
    technicianId: "T-01",
    technicianName: "Marcus Webb",
    interval: "Semi-Annual",
    customIntervalDays: 0,
    status: "Active",
    startDate: "2022-06-10",
    lastServiceDate: "2026-01-15",
    nextDueDate: "2026-07-15",
    services: [
      { id: "SVC-001", name: "Engine Oil & Filter Change", description: "Drain and replace engine oil, install new filter", estimatedHours: 0.5, estimatedCost: 65 },
      { id: "SVC-002", name: "Brake System Inspection", description: "Inspect pads, drums, lines. Replace if under 20%", estimatedHours: 0.75, estimatedCost: 80 },
      { id: "SVC-003", name: "Hydraulic Fluid Check", description: "Check level, inspect for contamination", estimatedHours: 0.25, estimatedCost: 30 },
      { id: "SVC-004", name: "Tire & Wheel Inspection", description: "Inspect tread, air pressure, lug torque", estimatedHours: 0.5, estimatedCost: 40 },
    ],
    notificationRules: buildDefaultRules(["dale@riverstonelogistics.com", "rita@riverstonelogistics.com"], ["(614) 555-0142"]),
    autoCreateWorkOrder: true,
    workOrderType: "PM",
    workOrderPriority: "Normal",
    notes: "Service required during operational hours. Forklift must be parked and locked out before work begins.",
    createdAt: "2022-06-10T08:00:00Z",
    totalServicesCompleted: 8,
  },
  {
    id: "MP-002",
    name: "Air Compressor Quarterly PM",
    customerId: "CUS-002",
    customerName: "Apex Fabricators",
    equipmentId: "EQ-241",
    equipmentName: "Ingersoll Rand UP6-15 Air Compressor",
    equipmentCategory: "Air Compressor",
    location: "Plant A",
    technicianId: "T-02",
    technicianName: "Sandra Liu",
    interval: "Quarterly",
    customIntervalDays: 0,
    status: "Active",
    startDate: "2021-09-05",
    lastServiceDate: "2026-02-10",
    nextDueDate: "2026-05-10",
    services: [
      { id: "SVC-005", name: "Air Filter Replacement", description: "Remove and replace intake air filter", estimatedHours: 0.25, estimatedCost: 28 },
      { id: "SVC-006", name: "Belt Tension Check", description: "Check and adjust drive belt tension", estimatedHours: 0.25, estimatedCost: 20 },
      { id: "SVC-007", name: "Separator Element Inspection", description: "Inspect air/oil separator element. Replace if saturated", estimatedHours: 0.5, estimatedCost: 90 },
      { id: "SVC-008", name: "Drain Valve Function Test", description: "Test auto-drain valve cycling", estimatedHours: 0.25, estimatedCost: 15 },
    ],
    notificationRules: buildDefaultRules(["kmarsh@apexfab.com", "sliu@apexfab.com"], []),
    autoCreateWorkOrder: true,
    workOrderType: "PM",
    workOrderPriority: "Normal",
    notes: "Compressor must be depressurized before inspection. Notify plant floor 24hrs in advance.",
    createdAt: "2021-09-05T08:00:00Z",
    totalServicesCompleted: 18,
  },
  {
    id: "MP-003",
    name: "Crane Annual Safety Inspection",
    customerId: "CUS-004",
    customerName: "Summit Construction",
    equipmentId: "EQ-601",
    equipmentName: "Liebherr LTM 1050-3.1 Crane",
    equipmentCategory: "Crane",
    location: "Equipment Yard",
    technicianId: "T-04",
    technicianName: "Priya Mehta",
    interval: "Annual",
    customIntervalDays: 0,
    status: "Active",
    startDate: "2019-06-01",
    lastServiceDate: "2026-01-20",
    nextDueDate: "2027-01-20",
    services: [
      { id: "SVC-009", name: "OSHA Annual Inspection", description: "Full crane inspection per OSHA 1926.1412", estimatedHours: 4, estimatedCost: 680 },
      { id: "SVC-010", name: "Wire Rope Inspection", description: "Inspect all load lines for wear, kinks, broken wires", estimatedHours: 2, estimatedCost: 240 },
      { id: "SVC-011", name: "Load Test", description: "Perform rated capacity load test at 100% and 125%", estimatedHours: 3, estimatedCost: 450 },
      { id: "SVC-012", name: "Hydraulic System Service", description: "Fluid change, filter replacement, cylinder check", estimatedHours: 3, estimatedCost: 580 },
    ],
    notificationRules: buildDefaultRules(["astrom@summitconst.com", "rgavin@summitconst.com"], ["(216) 555-0812"]),
    autoCreateWorkOrder: true,
    workOrderType: "Inspection",
    workOrderPriority: "High",
    notes: "OSHA certification required. Angela Strom must be on-site for load test sign-off.",
    createdAt: "2019-06-01T08:00:00Z",
    totalServicesCompleted: 7,
  },
  {
    id: "MP-004",
    name: "Refrigeration Bi-Annual PM",
    customerId: "CUS-005",
    customerName: "Clearfield Foods",
    equipmentId: "EQ-712",
    equipmentName: "Heatcraft LCE060AGD Refrigeration",
    equipmentCategory: "Refrigeration",
    location: "Processing Plant",
    technicianId: "T-05",
    technicianName: "James Torres",
    interval: "Semi-Annual",
    customIntervalDays: 0,
    status: "Active",
    startDate: "2023-04-15",
    lastServiceDate: "2026-04-10",
    nextDueDate: "2026-10-10",
    services: [
      { id: "SVC-013", name: "Evaporator Coil Clean", description: "Chemical clean evaporator coil, flush drain pans", estimatedHours: 1, estimatedCost: 120 },
      { id: "SVC-014", name: "Refrigerant Level Check", description: "Check refrigerant charge per nameplate spec", estimatedHours: 0.5, estimatedCost: 60 },
      { id: "SVC-015", name: "Defrost Cycle Verification", description: "Verify defrost timer, heater output, termination", estimatedHours: 0.5, estimatedCost: 55 },
      { id: "SVC-016", name: "Pump Seal Inspection", description: "Inspect pump shaft seal for leaks. Log condition.", estimatedHours: 0.75, estimatedCost: 90 },
    ],
    notificationRules: buildDefaultRules(["lpark@clearfieldfoods.com"], ["(330) 555-0633"]),
    autoCreateWorkOrder: true,
    workOrderType: "PM",
    workOrderPriority: "High",
    notes: "FDA facility — all work must be in 2am–6am window. Technician must sign food-safety compliance form.",
    createdAt: "2023-04-15T08:00:00Z",
    totalServicesCompleted: 4,
  },
  {
    id: "MP-005",
    name: "HVAC Custom 6-Month Service",
    customerId: "CUS-003",
    customerName: "Metro Warehousing",
    equipmentId: "EQ-500",
    equipmentName: "Carrier 50XCZ060 HVAC",
    equipmentCategory: "HVAC",
    location: "Cold Storage Annex",
    technicianId: "T-03",
    technicianName: "Tyler Oakes",
    interval: "Custom",
    customIntervalDays: 183,
    status: "Active",
    startDate: "2021-05-10",
    lastServiceDate: "2026-04-29",
    nextDueDate: "2026-10-29",
    services: [
      { id: "SVC-017", name: "Coil Cleaning", description: "Clean evaporator and condenser coils", estimatedHours: 1.5, estimatedCost: 160 },
      { id: "SVC-018", name: "Filter Replacement", description: "Replace all return air filters", estimatedHours: 0.5, estimatedCost: 45 },
      { id: "SVC-019", name: "Refrigerant Charge Check", description: "Verify R-410A charge, check for leaks (EPA 608)", estimatedHours: 0.75, estimatedCost: 90 },
      { id: "SVC-020", name: "Drain Pan & Line Flush", description: "Flush condensate drain pans and lines", estimatedHours: 0.5, estimatedCost: 40 },
    ],
    notificationRules: buildDefaultRules(["tflynn@metrowh.com"], []),
    autoCreateWorkOrder: true,
    workOrderType: "PM",
    workOrderPriority: "Normal",
    notes: "Cold storage annex — entry requires cold-weather PPE. Coordinate with warehouse night shift.",
    createdAt: "2021-05-10T08:00:00Z",
    totalServicesCompleted: 10,
  },
  {
    id: "MP-006",
    name: "Boom Lift Semi-Annual Hydraulic Service",
    customerId: "CUS-004",
    customerName: "Summit Construction",
    equipmentId: "EQ-305",
    equipmentName: "JLG 600S Boom Lift",
    equipmentCategory: "Boom Lift",
    location: "Equipment Yard",
    technicianId: "T-04",
    technicianName: "Priya Mehta",
    interval: "Semi-Annual",
    customIntervalDays: 0,
    status: "Paused",
    startDate: "2023-04-01",
    lastServiceDate: "2025-08-14",
    nextDueDate: "2026-02-14",
    services: [
      { id: "SVC-021", name: "Hydraulic Fluid Replacement", description: "Drain and fill hydraulic reservoir", estimatedHours: 1, estimatedCost: 140 },
      { id: "SVC-022", name: "Boom Cylinder Inspection", description: "Inspect all cylinders for leaks, scoring", estimatedHours: 1.5, estimatedCost: 180 },
      { id: "SVC-023", name: "Outrigger Function Test", description: "Extend/retract all outriggers, check pads", estimatedHours: 0.5, estimatedCost: 55 },
    ],
    notificationRules: buildDefaultRules(["astrom@summitconst.com"], ["(216) 555-0812"]),
    autoCreateWorkOrder: false,
    workOrderType: "PM",
    workOrderPriority: "Normal",
    notes: "Paused pending warranty expiry resolution. Warranty expired April 2026 — review before resuming.",
    createdAt: "2023-04-01T08:00:00Z",
    totalServicesCompleted: 3,
  },
  {
    id: "MP-007",
    name: "Excavator 250-Hour PM",
    customerId: "CUS-004",
    customerName: "Summit Construction",
    equipmentId: "EQ-820",
    equipmentName: "Cat 320 GC Excavator",
    equipmentCategory: "Excavator",
    location: "Equipment Yard",
    technicianId: "T-04",
    technicianName: "Priya Mehta",
    interval: "Custom",
    customIntervalDays: 60,
    status: "Active",
    startDate: "2023-05-01",
    lastServiceDate: "2026-03-05",
    nextDueDate: "2026-05-04",
    services: [
      { id: "SVC-024", name: "Engine Oil & Filter", description: "250-hour engine oil and filter change", estimatedHours: 0.5, estimatedCost: 95 },
      { id: "SVC-025", name: "Undercarriage Inspection", description: "Measure track pad wear, adjust tension", estimatedHours: 1, estimatedCost: 120 },
      { id: "SVC-026", name: "Hydraulic Filter Replacement", description: "Replace return line hydraulic filter", estimatedHours: 0.5, estimatedCost: 85 },
    ],
    notificationRules: buildDefaultRules(["astrom@summitconst.com"], ["(216) 555-0812"]),
    autoCreateWorkOrder: true,
    workOrderType: "PM",
    workOrderPriority: "Normal",
    notes: "Hour-meter based. Verify actual hours from telematics before scheduling.",
    createdAt: "2023-05-01T08:00:00Z",
    totalServicesCompleted: 6,
  },
]

// ─── Notification Log (simulated fired alerts) ────────────────────────────────

export const notificationLog: NotificationLogEntry[] = [
  {
    id: "NL-001", planId: "MP-007", planName: "Excavator 250-Hour PM",
    equipmentName: "Cat 320 GC Excavator", customerName: "Summit Construction",
    channel: "Email", triggerDays: 30, sentAt: "2026-04-04T08:00:00Z",
    recipient: "astrom@summitconst.com",
    message: "Reminder: Cat 320 GC Excavator PM is due in 30 days (2026-05-04).",
    status: "Sent",
  },
  {
    id: "NL-002", planId: "MP-002", planName: "Air Compressor Quarterly PM",
    equipmentName: "Ingersoll Rand UP6-15 Air Compressor", customerName: "Apex Fabricators",
    channel: "Email", triggerDays: 30, sentAt: "2026-04-10T08:00:00Z",
    recipient: "kmarsh@apexfab.com",
    message: "Reminder: Air Compressor Quarterly PM is due in 30 days (2026-05-10).",
    status: "Sent",
  },
  {
    id: "NL-003", planId: "MP-007", planName: "Excavator 250-Hour PM",
    equipmentName: "Cat 320 GC Excavator", customerName: "Summit Construction",
    channel: "Email", triggerDays: 14, sentAt: "2026-04-20T08:00:00Z",
    recipient: "astrom@summitconst.com",
    message: "Reminder: Cat 320 GC Excavator PM is due in 14 days (2026-05-04).",
    status: "Sent",
  },
  {
    id: "NL-004", planId: "MP-007", planName: "Excavator 250-Hour PM",
    equipmentName: "Cat 320 GC Excavator", customerName: "Summit Construction",
    channel: "Internal Alert", triggerDays: 14, sentAt: "2026-04-20T08:00:00Z",
    recipient: "admin@equipify.ai",
    message: "Internal: Excavator PM due in 14 days. Assign technician.",
    status: "Sent",
  },
  {
    id: "NL-005", planId: "MP-002", planName: "Air Compressor Quarterly PM",
    equipmentName: "Ingersoll Rand UP6-15 Air Compressor", customerName: "Apex Fabricators",
    channel: "Email", triggerDays: 14, sentAt: "2026-04-26T08:00:00Z",
    recipient: "kmarsh@apexfab.com",
    message: "Reminder: Air Compressor Quarterly PM is due in 14 days (2026-05-10).",
    status: "Sent",
  },
  {
    id: "NL-006", planId: "MP-007", planName: "Excavator 250-Hour PM",
    equipmentName: "Cat 320 GC Excavator", customerName: "Summit Construction",
    channel: "SMS", triggerDays: 7, sentAt: "2026-04-27T08:00:00Z",
    recipient: "(216) 555-0812",
    message: "Equipify: Excavator 320 GC PM due in 7 days (May 4). Reply STOP to opt out.",
    status: "Sent",
  },
  {
    id: "NL-007", planId: "MP-007", planName: "Excavator 250-Hour PM",
    equipmentName: "Cat 320 GC Excavator", customerName: "Summit Construction",
    channel: "Internal Alert", triggerDays: 7, sentAt: "2026-04-27T08:00:00Z",
    recipient: "admin@equipify.ai",
    message: "Internal: Excavator PM due in 7 days. Work order auto-creation scheduled.",
    status: "Sent",
  },
  {
    id: "NL-008", planId: "MP-002", planName: "Air Compressor Quarterly PM",
    equipmentName: "Ingersoll Rand UP6-15 Air Compressor", customerName: "Apex Fabricators",
    channel: "Internal Alert", triggerDays: 7, sentAt: "2026-05-03T08:00:00Z",
    recipient: "admin@equipify.ai",
    message: "Internal: Air Compressor PM due in 7 days. Work order auto-created.",
    status: "Simulated",
  },
]

// ─── Stats ────────────────────────────────────────────────────────────────────

export const mockStats = {
  equipmentDueThisMonth: 47,
  overdueService: 12,
  openWorkOrders: 83,
  monthlyRevenue: "$184K",
  revenueSubtitle: "April 2026",
  revenueTrend: "+7.1% vs March",
  expiringWarranties: 19,
  warrantyTrend: "3 expire this week",
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
    equipment: "Toyota 8FGU25 Forklift",
    type: "PM",
    technician: "Marcus Webb",
    status: "In Progress",
    priority: "High",
    due: "2026-04-30",
  },
  {
    id: "WO-2040",
    customer: "Apex Fabricators",
    equipment: "Haas VF-2SS CNC Machine",
    type: "Repair",
    technician: "Sandra Liu",
    status: "Open",
    priority: "Critical",
    due: "2026-04-30",
  },
  {
    id: "WO-2039",
    customer: "Metro Warehousing",
    equipment: "Carrier 50XCZ060 HVAC",
    type: "Inspection",
    technician: "Tyler Oakes",
    status: "Completed",
    priority: "Normal",
    due: "2026-04-29",
  },
  {
    id: "WO-2038",
    customer: "Summit Construction",
    equipment: "Liebherr LTM 1050-3.1 Crane",
    type: "Repair",
    technician: "Priya Mehta",
    status: "Scheduled",
    priority: "High",
    due: "2026-05-02",
  },
  {
    id: "WO-2037",
    customer: "Clearfield Foods",
    equipment: "Heatcraft LCE060AGD Refrigeration",
    type: "Repair",
    technician: "James Torres",
    status: "Open",
    priority: "Normal",
    due: "2026-05-05",
  },
]

export const equipmentDueSoon = [
  { id: "EQ-188", name: "Toyota 8FGU25 Forklift", customer: "Riverstone Logistics", nextService: "2026-04-30", type: "Semi-Annual PM" },
  { id: "EQ-241", name: "Ingersoll Rand UP6-15 Air Compressor", customer: "Apex Fabricators", nextService: "2026-05-03", type: "Quarterly PM" },
  { id: "EQ-305", name: "JLG 600S Boom Lift", customer: "Summit Construction", nextService: "2026-05-06", type: "Hydraulic Service" },
  { id: "EQ-412", name: "Crown PTH50 Pallet Jack", customer: "Metro Warehousing", nextService: "2026-05-08", type: "Quarterly PM" },
]

export const repeatRepairs = [
  { equipment: "Haas VF-2SS CNC Machine", customer: "Apex Fabricators", repairs: 4, lastRepair: "2026-04-22", issue: "Motor Overheating" },
  { equipment: "Heatcraft LCE060AGD Refrigeration", customer: "Clearfield Foods", repairs: 3, lastRepair: "2026-04-10", issue: "Pump Seal Failure" },
  { equipment: "Liebherr LTM 1050-3.1 Crane", customer: "Summit Construction", repairs: 3, lastRepair: "2026-04-25", issue: "Cable Tension" },
]

export const expiringWarranties = [
  { equipment: "Cat 320 GC Excavator", customer: "Summit Construction", expires: "2026-05-15", daysLeft: 15 },
  { equipment: "Ingersoll Rand UP6-15 Air Compressor", customer: "Apex Fabricators", expires: "2026-09-05", daysLeft: 128 },
  { equipment: "Crown PTH50 Pallet Jack", customer: "Metro Warehousing", expires: "2026-08-22", daysLeft: 114 },
]

// ─── Portal ───────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string
  workOrderId: string
  customerId: string
  date: string
  dueDate: string
  amount: number
  status: "Paid" | "Unpaid" | "Overdue" | "Draft"
  lineItems: { description: string; qty: number; unit: number }[]
  pdfUrl: string
}

export interface Quote {
  id: string
  customerId: string
  equipmentId: string
  equipmentName: string
  date: string
  expiresDate: string
  amount: number
  status: "Pending Approval" | "Approved" | "Declined" | "Expired"
  description: string
  lineItems: { description: string; qty: number; unit: number }[]
  notes: string
}

export interface PortalReport {
  id: string
  customerId: string
  title: string
  type: "Service Summary" | "Equipment Health" | "PM Compliance" | "Cost Analysis"
  period: string
  generatedDate: string
  sizeKb: number
  pdfUrl: string
}

export const portalInvoices: Invoice[] = [
  {
    id: "INV-4412",
    workOrderId: "WO-2039",
    customerId: "CUS-003",
    date: "2026-04-29",
    dueDate: "2026-05-29",
    amount: 340,
    status: "Unpaid",
    pdfUrl: "#",
    lineItems: [
      { description: "HVAC Inspection — Carrier 50XCZ060", qty: 1, unit: 240 },
      { description: "Coil Cleaner (1 gal)", qty: 1, unit: 28 },
      { description: "Drain Pan Treatment Tablets", qty: 2, unit: 14 },
      { description: "Drain Pan Treatment Tablets", qty: 2, unit: 14 },
    ],
  },
  {
    id: "INV-4411",
    workOrderId: "WO-2036",
    customerId: "CUS-004",
    date: "2026-04-25",
    dueDate: "2026-05-25",
    amount: 875,
    status: "Paid",
    pdfUrl: "#",
    lineItems: [
      { description: "Cat 320 GC Excavator — 500-hr PM Labor", qty: 4, unit: 120 },
      { description: "Hydraulic Filter Set", qty: 1, unit: 145 },
      { description: "Engine Air Filter", qty: 1, unit: 62 },
      { description: "Hydraulic Fluid (5gal)", qty: 4, unit: 47 },
    ],
  },
  {
    id: "INV-4408",
    workOrderId: "WO-2025",
    customerId: "CUS-005",
    date: "2026-04-10",
    dueDate: "2026-04-25",
    amount: 640,
    status: "Overdue",
    pdfUrl: "#",
    lineItems: [
      { description: "Refrigeration Pump Seal Repair — Labor", qty: 2, unit: 180 },
      { description: "Pump Seal Kit — Heatcraft LCE060", qty: 1, unit: 280 },
    ],
  },
  {
    id: "INV-4401",
    workOrderId: "WO-1980",
    customerId: "CUS-001",
    date: "2026-01-20",
    dueDate: "2026-02-20",
    amount: 385,
    status: "Paid",
    pdfUrl: "#",
    lineItems: [
      { description: "Forklift Semi-Annual PM — Labor", qty: 3.5, unit: 80 },
      { description: "Engine Oil 10W-30 (5qt)", qty: 2, unit: 18.50 },
      { description: "Oil Filter", qty: 1, unit: 12 },
      { description: "Rear Brake Pad Set", qty: 1, unit: 34 },
    ],
  },
]

export const portalQuotes: Quote[] = [
  {
    id: "QT-881",
    customerId: "CUS-002",
    equipmentId: "EQ-304",
    equipmentName: "Haas VF-2SS CNC Machine",
    date: "2026-04-28",
    expiresDate: "2026-05-28",
    amount: 4800,
    status: "Pending Approval",
    description: "Root cause analysis and full motor replacement for repeat overheating issue. Includes extended burn-in test.",
    notes: "If motor replacement is approved, downtime estimated at 3 business days. Loaner available.",
    lineItems: [
      { description: "CNC Spindle Motor Assembly (OEM)", qty: 1, unit: 2800 },
      { description: "Motor Replacement Labor", qty: 8, unit: 125 },
      { description: "Burn-in Test & Calibration", qty: 4, unit: 125 },
      { description: "Root Cause Engineering Report", qty: 1, unit: 600 },
    ],
  },
  {
    id: "QT-874",
    customerId: "CUS-004",
    equipmentId: "EQ-601",
    equipmentName: "Liebherr LTM 1050-3.1 Crane",
    date: "2026-04-26",
    expiresDate: "2026-05-26",
    amount: 7200,
    status: "Pending Approval",
    description: "Full wire rope replacement and load-line re-engineering to address repeat cable tension failures.",
    notes: "Crane must be out of service for 2 days. Load certification test included.",
    lineItems: [
      { description: "Wire Rope Assembly — Main Hoist (OEM)", qty: 1, unit: 3400 },
      { description: "Wire Rope Assembly — Secondary Hoist (OEM)", qty: 1, unit: 2100 },
      { description: "Rope Replacement Labor", qty: 6, unit: 150 },
      { description: "Load Test Certification", qty: 1, unit: 800 },
    ],
  },
  {
    id: "QT-860",
    customerId: "CUS-004",
    equipmentId: "EQ-820",
    equipmentName: "Cat 320 GC Excavator",
    date: "2026-04-01",
    expiresDate: "2026-05-01",
    amount: 3150,
    status: "Approved",
    description: "Undercarriage replacement at 50% wear threshold. Recommended from 1000-hr PM inspection.",
    notes: "Track shoe sets shipped from depot — 5 business days lead time.",
    lineItems: [
      { description: "Track Shoe Set (Left)", qty: 1, unit: 1100 },
      { description: "Track Shoe Set (Right)", qty: 1, unit: 1100 },
      { description: "Undercarriage Install Labor", qty: 6, unit: 150 },
    ],
  },
  {
    id: "QT-841",
    customerId: "CUS-001",
    equipmentId: "EQ-188",
    equipmentName: "Toyota 8FGU25 Forklift",
    date: "2026-02-15",
    expiresDate: "2026-03-15",
    amount: 820,
    status: "Declined",
    description: "Hydraulic lift cylinder full replacement (vs. seal-only repair).",
    notes: "Customer opted for seal repair instead. Cylinder flagged for next review.",
    lineItems: [
      { description: "Hydraulic Lift Cylinder Assembly (OEM)", qty: 1, unit: 540 },
      { description: "Cylinder Replacement Labor", qty: 2, unit: 140 },
    ],
  },
]

export const portalReports: PortalReport[] = [
  {
    id: "RPT-CUS001-Q1",
    customerId: "CUS-001",
    title: "Q1 2026 Service Summary — Riverstone Logistics",
    type: "Service Summary",
    period: "Jan–Mar 2026",
    generatedDate: "2026-04-03",
    sizeKb: 284,
    pdfUrl: "#",
  },
  {
    id: "RPT-CUS002-HEALTH",
    customerId: "CUS-002",
    title: "Equipment Health Report — Apex Fabricators",
    type: "Equipment Health",
    period: "Q1 2026",
    generatedDate: "2026-04-05",
    sizeKb: 512,
    pdfUrl: "#",
  },
  {
    id: "RPT-CUS004-PM",
    customerId: "CUS-004",
    title: "PM Compliance Report — Summit Construction",
    type: "PM Compliance",
    period: "2025 Annual",
    generatedDate: "2026-01-10",
    sizeKb: 398,
    pdfUrl: "#",
  },
  {
    id: "RPT-CUS003-COST",
    customerId: "CUS-003",
    title: "Cost Analysis Report — Metro Warehousing",
    type: "Cost Analysis",
    period: "Jan–Mar 2026",
    generatedDate: "2026-04-07",
    sizeKb: 320,
    pdfUrl: "#",
  },
  {
    id: "RPT-CUS005-Q4",
    customerId: "CUS-005",
    title: "Q4 2025 Service Summary — Clearfield Foods",
    type: "Service Summary",
    period: "Oct–Dec 2025",
    generatedDate: "2026-01-08",
    sizeKb: 196,
    pdfUrl: "#",
  },
]

// ─── Admin Quotes ─────────────────────────────────────────────────────────────

export type QuoteStatus = "Draft" | "Sent" | "Pending Approval" | "Approved" | "Declined" | "Expired"

export interface AdminQuote {
  id: string
  /** Display number from org_quotes.quote_number when loaded from DB (e.g. QT-PBS-8801). */
  quoteNumber?: string
  customerId: string
  customerName: string
  equipmentId: string
  equipmentName: string
  createdDate: string
  expiresDate: string
  sentDate: string
  amount: number
  status: QuoteStatus
  description: string
  createdBy: string
  workOrderId: string
  /** When linked to a Supabase work order, enables WO-####### display without an extra fetch. */
  workOrderNumber?: number
  lineItems: { description: string; qty: number; unit: number }[]
  notes: string
  /** Team-only notes (not shown on customer-facing materials). */
  internalNotes?: string
}

export const adminQuotes: AdminQuote[] = [
  {
    id: "QT-881",
    customerId: "CUS-002",
    customerName: "Apex Fabricators",
    equipmentId: "EQ-304",
    equipmentName: "Haas VF-2SS CNC Machine",
    createdDate: "2026-04-28",
    expiresDate: "2026-05-28",
    sentDate: "2026-04-28",
    amount: 4800,
    status: "Pending Approval",
    description: "Root cause analysis and full motor replacement for repeat overheating issue.",
    createdBy: "Marcus Webb",
    workOrderId: "WO-2040",
    notes: "If approved, downtime estimated at 3 business days. Loaner available.",
    lineItems: [
      { description: "CNC Spindle Motor Assembly (OEM)", qty: 1, unit: 2800 },
      { description: "Motor Replacement Labor", qty: 8, unit: 125 },
      { description: "Burn-in Test & Calibration", qty: 4, unit: 125 },
      { description: "Root Cause Engineering Report", qty: 1, unit: 600 },
    ],
  },
  {
    id: "QT-874",
    customerId: "CUS-004",
    customerName: "Summit Construction",
    equipmentId: "EQ-601",
    equipmentName: "Liebherr LTM 1050-3.1 Crane",
    createdDate: "2026-04-26",
    expiresDate: "2026-05-26",
    sentDate: "2026-04-26",
    amount: 7200,
    status: "Pending Approval",
    description: "Full wire rope replacement and load-line re-engineering.",
    createdBy: "Priya Mehta",
    workOrderId: "WO-2038",
    notes: "Crane must be out of service for 2 days. Load certification included.",
    lineItems: [
      { description: "Wire Rope Assembly — Main Hoist (OEM)", qty: 1, unit: 3400 },
      { description: "Wire Rope Assembly — Secondary Hoist (OEM)", qty: 1, unit: 2100 },
      { description: "Rope Replacement Labor", qty: 6, unit: 150 },
      { description: "Load Test Certification", qty: 1, unit: 800 },
    ],
  },
  {
    id: "QT-868",
    customerId: "CUS-001",
    customerName: "Riverstone Logistics",
    equipmentId: "EQ-188",
    equipmentName: "Toyota 8FGU25 Forklift",
    createdDate: "2026-04-20",
    expiresDate: "2026-05-20",
    sentDate: "2026-04-21",
    amount: 1250,
    status: "Sent",
    description: "Hydraulic fluid flush and mast chain lubrication kit.",
    createdBy: "Marcus Webb",
    workOrderId: "WO-2041",
    notes: "Customer requested quote after PM inspection flagged fluid condition.",
    lineItems: [
      { description: "Hydraulic Fluid Flush — Labor", qty: 2, unit: 95 },
      { description: "Hydraulic Fluid ISO 46 (5gal)", qty: 4, unit: 68 },
      { description: "Mast Chain Lubrication Kit", qty: 1, unit: 870 },
    ],
  },
  {
    id: "QT-860",
    customerId: "CUS-004",
    customerName: "Summit Construction",
    equipmentId: "EQ-820",
    equipmentName: "Cat 320 GC Excavator",
    createdDate: "2026-04-01",
    expiresDate: "2026-05-01",
    sentDate: "2026-04-01",
    amount: 3150,
    status: "Approved",
    description: "Undercarriage replacement at 50% wear threshold.",
    createdBy: "Priya Mehta",
    workOrderId: "WO-1985",
    notes: "Track shoe sets shipped from depot — 5 business days lead time.",
    lineItems: [
      { description: "Track Shoe Set (Left)", qty: 1, unit: 1100 },
      { description: "Track Shoe Set (Right)", qty: 1, unit: 1100 },
      { description: "Undercarriage Install Labor", qty: 6, unit: 150 },
    ],
  },
  {
    id: "QT-851",
    customerId: "CUS-003",
    customerName: "Metro Warehousing",
    equipmentId: "EQ-500",
    equipmentName: "Carrier 50XCZ060 HVAC",
    createdDate: "2026-03-18",
    expiresDate: "2026-04-18",
    sentDate: "2026-03-19",
    amount: 980,
    status: "Expired",
    description: "Condenser coil deep clean and refrigerant top-off.",
    createdBy: "Tyler Oakes",
    workOrderId: "",
    notes: "Quote expired. Recommend re-quoting at next service visit.",
    lineItems: [
      { description: "Condenser Coil Deep Clean — Labor", qty: 2, unit: 110 },
      { description: "R-410A Refrigerant (lbs)", qty: 4, unit: 85 },
      { description: "Coil Cleaner (commercial)", qty: 2, unit: 55 },
    ],
  },
  {
    id: "QT-841",
    customerId: "CUS-001",
    customerName: "Riverstone Logistics",
    equipmentId: "EQ-188",
    equipmentName: "Toyota 8FGU25 Forklift",
    createdDate: "2026-02-15",
    expiresDate: "2026-03-15",
    sentDate: "2026-02-15",
    amount: 820,
    status: "Declined",
    description: "Hydraulic lift cylinder full replacement (vs. seal-only repair).",
    createdBy: "Marcus Webb",
    workOrderId: "WO-1501",
    notes: "Customer opted for seal repair instead.",
    lineItems: [
      { description: "Hydraulic Lift Cylinder Assembly (OEM)", qty: 1, unit: 540 },
      { description: "Cylinder Replacement Labor", qty: 2, unit: 140 },
    ],
  },
  {
    id: "QT-830",
    customerId: "CUS-005",
    customerName: "Clearfield Foods",
    equipmentId: "EQ-712",
    equipmentName: "Heatcraft LCE060AGD Refrigeration",
    createdDate: "2026-02-01",
    expiresDate: "2026-03-01",
    sentDate: "",
    amount: 2600,
    status: "Draft",
    description: "Full pump assembly replacement to resolve repeat seal failures.",
    createdBy: "James Torres",
    workOrderId: "",
    notes: "Awaiting internal review before sending to customer.",
    lineItems: [
      { description: "Refrigeration Pump Assembly (OEM)", qty: 1, unit: 1750 },
      { description: "Pump Installation Labor", qty: 4, unit: 180 },
      { description: "System Pressure Test", qty: 1, unit: 310 },
    ],
  },
]

// ─── Admin Invoices ────���───────────────────────────────────────────────────────

export type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Unpaid" | "Overdue" | "Void"

export interface AdminInvoice {
  id: string
  /** Display number from org_invoices.invoice_number when loaded from DB. */
  invoiceNumber?: string
  customerId: string
  customerName: string
  workOrderId: string
  equipmentId: string
  equipmentName: string
  issueDate: string
  dueDate: string
  paidDate: string
  amount: number
  status: InvoiceStatus
  createdBy: string
  lineItems: { description: string; qty: number; unit: number }[]
  notes: string
  /** Linked quote UUID from org_invoices.quote_id. */
  quoteId?: string
  internalNotes?: string
  /** ISO timestamp from org_invoices.sent_at when the invoice was emailed/sent. */
  sentAt?: string
}

export const adminInvoices: AdminInvoice[] = [
  {
    id: "INV-4415",
    customerId: "CUS-002",
    customerName: "Apex Fabricators",
    workOrderId: "WO-1995",
    equipmentId: "EQ-304",
    equipmentName: "Haas VF-2SS CNC Machine",
    issueDate: "2026-04-29",
    dueDate: "2026-05-29",
    paidDate: "",
    amount: 1150,
    status: "Sent",
    createdBy: "Admin",
    notes: "",
    lineItems: [
      { description: "CNC Motor Repair — Coolant Flush & Fan", qty: 1, unit: 850 },
      { description: "Cooling Fan Assembly", qty: 1, unit: 300 },
    ],
  },
  {
    id: "INV-4412",
    customerId: "CUS-003",
    customerName: "Metro Warehousing",
    workOrderId: "WO-2039",
    equipmentId: "EQ-500",
    equipmentName: "Carrier 50XCZ060 HVAC",
    issueDate: "2026-04-29",
    dueDate: "2026-05-29",
    paidDate: "",
    amount: 340,
    status: "Unpaid",
    createdBy: "Admin",
    notes: "",
    lineItems: [
      { description: "HVAC Inspection — Carrier 50XCZ060", qty: 1, unit: 240 },
      { description: "Coil Cleaner (1 gal)", qty: 1, unit: 28 },
      { description: "Drain Pan Treatment Tablets", qty: 2, unit: 14 },
    ],
  },
  {
    id: "INV-4411",
    customerId: "CUS-004",
    customerName: "Summit Construction",
    workOrderId: "WO-2036",
    equipmentId: "EQ-820",
    equipmentName: "Cat 320 GC Excavator",
    issueDate: "2026-04-25",
    dueDate: "2026-05-25",
    paidDate: "2026-04-28",
    amount: 875,
    status: "Paid",
    createdBy: "Admin",
    notes: "",
    lineItems: [
      { description: "Cat 320 GC Excavator — 500-hr PM Labor", qty: 4, unit: 120 },
      { description: "Hydraulic Filter Set", qty: 1, unit: 145 },
      { description: "Engine Air Filter", qty: 1, unit: 62 },
      { description: "Hydraulic Fluid (5gal)", qty: 4, unit: 47 },
    ],
  },
  {
    id: "INV-4408",
    customerId: "CUS-005",
    customerName: "Clearfield Foods",
    workOrderId: "WO-2025",
    equipmentId: "EQ-712",
    equipmentName: "Heatcraft LCE060 Refrigeration",
    issueDate: "2026-04-10",
    dueDate: "2026-04-25",
    paidDate: "",
    amount: 640,
    status: "Overdue",
    createdBy: "Admin",
    notes: "Second notice sent 2026-04-27.",
    lineItems: [
      { description: "Refrigeration Pump Seal Repair — Labor", qty: 2, unit: 180 },
      { description: "Pump Seal Kit — Heatcraft LCE060", qty: 1, unit: 280 },
    ],
  },
  {
    id: "INV-4402",
    customerId: "CUS-004",
    customerName: "Summit Construction",
    workOrderId: "WO-1970",
    equipmentId: "EQ-601",
    equipmentName: "Liebherr LTM 1050 Crane",
    issueDate: "2026-03-05",
    dueDate: "2026-04-05",
    paidDate: "2026-03-28",
    amount: 3400,
    status: "Paid",
    createdBy: "Admin",
    notes: "",
    lineItems: [
      { description: "Secondary Hoist Line Replacement — Labor", qty: 6, unit: 150 },
      { description: "Wire Rope Assembly — Secondary Hoist", qty: 1, unit: 2500 },
    ],
  },
  {
    id: "INV-4401",
    customerId: "CUS-001",
    customerName: "Riverstone Logistics",
    workOrderId: "WO-1980",
    equipmentId: "EQ-188",
    equipmentName: "Toyota 8FGU25 Forklift",
    issueDate: "2026-01-20",
    dueDate: "2026-02-20",
    paidDate: "2026-02-18",
    amount: 385,
    status: "Paid",
    createdBy: "Admin",
    notes: "",
    lineItems: [
      { description: "Forklift Semi-Annual PM — Labor", qty: 3.5, unit: 80 },
      { description: "Engine Oil 10W-30 (5qt)", qty: 2, unit: 18.50 },
      { description: "Oil Filter", qty: 1, unit: 12 },
      { description: "Rear Brake Pad Set", qty: 1, unit: 34 },
    ],
  },
  {
    id: "INV-4390",
    customerId: "CUS-002",
    customerName: "Apex Fabricators",
    workOrderId: "WO-1940",
    equipmentId: "EQ-304",
    equipmentName: "Haas VF-2SS CNC Machine",
    issueDate: "2026-02-05",
    dueDate: "2026-03-05",
    paidDate: "2026-02-28",
    amount: 2200,
    status: "Paid",
    createdBy: "Admin",
    notes: "",
    lineItems: [
      { description: "CNC Motor Repair — Relay Board Replacement", qty: 1, unit: 1400 },
      { description: "Relay Board (OEM)", qty: 1, unit: 800 },
    ],
  },
  {
    id: "INV-4375",
    customerId: "CUS-006",
    customerName: "Lakefront Printing",
    workOrderId: "WO-1840",
    equipmentId: "EQ-900",
    equipmentName: "Printing Press",
    issueDate: "2025-12-15",
    dueDate: "2026-01-15",
    paidDate: "",
    amount: 480,
    status: "Void",
    createdBy: "Admin",
    notes: "Voided — customer disputed service scope.",
    lineItems: [
      { description: "Press Roller Calibration — Labor", qty: 2, unit: 120 },
      { description: "Roller Alignment Kit", qty: 1, unit: 240 },
    ],
  },
]

// ─── AI Insights Data ─────────────────────────────────────────────────────────

export type InsightSeverity = "critical" | "high" | "medium" | "low"
export type InsightCategory =
  | "overdue_client"
  | "repeat_failure"
  | "upsell"
  | "expiring_warranty"
  | "revenue_opportunity"

export interface AiInsight {
  id: string
  category: InsightCategory
  severity: InsightSeverity
  title: string
  description: string
  meta?: string               // short display label shown under description
  value?: string              // highlight value shown in the card
  customerId?: string
  customerName?: string
  equipmentId?: string
  equipmentName?: string
  confidence?: number         // 0–100
  estimatedValue?: number     // revenue opportunity in $
  actionLabel: string
  actionHref: string
  detectedAt?: string
  dataPoints?: { label: string; value: string }[]
}

export const aiInsights: AiInsight[] = [
  // ── Overdue clients ────────────────────────────────────────────────────────
  {
    id: "INS-001",
    category: "overdue_client",
    severity: "critical",
    title: "Apex Fabricators — 5 open work orders, 22-day avg age",
    description: "This account has the highest open WO backlog in the system. Two critical-priority orders have been open for over 18 days with no scheduled visit. Risk of client escalation is high.",
    customerId: "CUS-002",
    customerName: "Apex Fabricators",
    confidence: 96,
    actionLabel: "View Work Orders",
    actionHref: "/work-orders",
    detectedAt: "2026-04-30T08:00:00Z",
    dataPoints: [
      { label: "Open WOs", value: "5" },
      { label: "Avg age", value: "22 days" },
      { label: "Critical WOs", value: "2" },
      { label: "Last visit", value: "Apr 10, 2026" },
    ],
  },
  {
    id: "INS-002",
    category: "overdue_client",
    severity: "high",
    title: "Summit Construction — 7 open orders across 31 units",
    description: "Summit has the largest equipment fleet and a growing backlog. The crane repair scheduled for May 2 has upstream dependencies — delaying it risks cascading project delays for the customer.",
    customerId: "CUS-004",
    customerName: "Summit Construction",
    confidence: 88,
    actionLabel: "View Account",
    actionHref: "/customers/CUS-004",
    detectedAt: "2026-04-30T08:00:00Z",
    dataPoints: [
      { label: "Open WOs", value: "7" },
      { label: "Fleet size", value: "31 units" },
      { label: "Next critical WO", value: "May 2" },
      { label: "Contract value", value: "$46,300/yr" },
    ],
  },
  {
    id: "INS-003",
    category: "overdue_client",
    severity: "medium",
    title: "Clearfield Foods — overdue invoice $640 at risk",
    description: "INV-4408 is 5 days past due. Clearfield has a Full Coverage contract renewing in June. Unresolved invoice balances typically delay contract renewals by 30–45 days.",
    customerId: "CUS-005",
    customerName: "Clearfield Foods",
    confidence: 82,
    estimatedValue: 22000,
    actionLabel: "View Invoice",
    actionHref: "/billing",
    detectedAt: "2026-04-30T08:00:00Z",
    dataPoints: [
      { label: "Overdue invoice", value: "$640" },
      { label: "Days past due", value: "5" },
      { label: "Contract renewal", value: "Jun 2026" },
      { label: "Contract value", value: "$22,000/yr" },
    ],
  },

  // ── Repeat failures ────────────────────────────────────────────────────────
  {
    id: "INS-004",
    category: "repeat_failure",
    severity: "critical",
    title: "Haas VF-2SS — motor overheating 4x in 4 months",
    description: "EQ-304 has had the same failure mode repaired 4 times since January 2026 at a cumulative cost of $5,290. Pattern analysis suggests the root cause is an upstream electrical supply issue, not the motor itself. Component-level repair will continue to fail.",
    customerId: "CUS-002",
    customerName: "Apex Fabricators",
    equipmentId: "EQ-304",
    equipmentName: "Haas VF-2SS CNC Machine",
    confidence: 94,
    estimatedValue: 4800,
    actionLabel: "View Equipment",
    actionHref: "/equipment",
    detectedAt: "2026-04-30T08:00:00Z",
    dataPoints: [
      { label: "Repair count", value: "4 (90 days)" },
      { label: "Cumulative cost", value: "$5,290" },
      { label: "Failure mode", value: "Motor Overheating" },
      { label: "Pending quote", value: "QT-881 · $4,800" },
    ],
  },
  {
    id: "INS-005",
    category: "repeat_failure",
    severity: "high",
    title: "Liebherr LTM 1050 — cable tension alarm 3x in 3 months",
    description: "EQ-601 has triggered cable tension failures 3 times this year at a total cost of $5,880. Engineering review is recommended before the next lift operation. Continued operation poses a safety and liability risk.",
    customerId: "CUS-004",
    customerName: "Summit Construction",
    equipmentId: "EQ-601",
    equipmentName: "Liebherr LTM 1050-3.1 Crane",
    confidence: 91,
    estimatedValue: 7200,
    actionLabel: "View Equipment",
    actionHref: "/equipment",
    detectedAt: "2026-04-30T08:00:00Z",
    dataPoints: [
      { label: "Repair count", value: "3 (90 days)" },
      { label: "Cumulative cost", value: "$5,880" },
      { label: "Failure mode", value: "Cable Tension" },
      { label: "Pending quote", value: "QT-874 · $7,200" },
    ],
  },
  {
    id: "INS-006",
    category: "repeat_failure",
    severity: "high",
    title: "Heatcraft LCE060 — pump seal failure 3x in 5 months",
    description: "EQ-712 has had 3 pump seal failures since December 2025 ($1,870 cumulative). The seal kit used in prior repairs may be the wrong spec for the unit's operating pressure. Recommend OEM seal review.",
    customerId: "CUS-005",
    customerName: "Clearfield Foods",
    equipmentId: "EQ-712",
    equipmentName: "Heatcraft LCE060AGD Refrigeration",
    confidence: 87,
    actionLabel: "View Equipment",
    actionHref: "/equipment",
    detectedAt: "2026-04-30T08:00:00Z",
    dataPoints: [
      { label: "Repair count", value: "3 (150 days)" },
      { label: "Cumulative cost", value: "$1,870" },
      { label: "Failure mode", value: "Pump Seal" },
      { label: "Warranty status", value: "Expired Apr 2026" },
    ],
  },

  // ── Upsells ────────────────────────────────────────────────────────────────
  {
    id: "INS-007",
    category: "upsell",
    severity: "high",
    title: "Lakefront Printing — inactive account, re-engagement opportunity",
    description: "CUS-006 went inactive in early 2026 and has no active contracts. Their 4 units are now out of warranty coverage. A targeted outreach with a Full Coverage quote could reactivate this account at an estimated $14,000–18,000 ARR.",
    customerId: "CUS-006",
    customerName: "Lakefront Printing",
    confidence: 79,
    estimatedValue: 16000,
    actionLabel: "View Customer",
    actionHref: "/customers/CUS-006",
    detectedAt: "2026-04-30T08:00:00Z",
    dataPoints: [
      { label: "Status", value: "Inactive" },
      { label: "Units registered", value: "4" },
      { label: "Active contracts", value: "0" },
      { label: "Est. ARR opportunity", value: "$16,000" },
    ],
  },
  {
    id: "INS-008",
    category: "upsell",
    severity: "medium",
    title: "Riverstone Logistics — 14 units, only 1 PM plan active",
    description: "Riverstone has 14 registered units but only 1 active maintenance plan covering the forklift fleet. 11 units have no scheduled service coverage. Upselling a multi-unit PM bundle could yield $22,000–28,000 in additional ARR.",
    customerId: "CUS-001",
    customerName: "Riverstone Logistics",
    confidence: 85,
    estimatedValue: 25000,
    actionLabel: "View Maintenance Plans",
    actionHref: "/maintenance-plans",
    detectedAt: "2026-04-30T08:00:00Z",
    dataPoints: [
      { label: "Total units", value: "14" },
      { label: "Plans active", value: "1" },
      { label: "Uncovered units", value: "11" },
      { label: "Est. upsell value", value: "$25,000/yr" },
    ],
  },
  {
    id: "INS-009",
    category: "upsell",
    severity: "medium",
    title: "Summit Construction — Labor Only contract, upgrade to Full Coverage",
    description: "Summit currently has a Labor Only contract ($31,500/yr) but incurred $10,480 in unplanned parts costs in Q1 2026. Upgrading to Full Coverage would protect them from cost variance while increasing ARR by ~$18,000.",
    customerId: "CUS-004",
    customerName: "Summit Construction",
    confidence: 80,
    estimatedValue: 18000,
    actionLabel: "View Contracts",
    actionHref: "/customers/CUS-004",
    detectedAt: "2026-04-30T08:00:00Z",
    dataPoints: [
      { label: "Current contract", value: "Labor Only · $31,500" },
      { label: "Q1 parts spend", value: "$10,480" },
      { label: "Upgrade target", value: "Full Coverage" },
      { label: "Est. ARR increase", value: "$18,000" },
    ],
  },

  // ── Expiring warranties ────────────────────────────────────────────────────
  {
    id: "INS-010",
    category: "expiring_warranty",
    severity: "high",
    title: "Cat 320 GC Excavator — warranty expires May 15 (15 days)",
    description: "EQ-820 warranty expires in 15 days. No pre-warranty inspection has been scheduled. Now is the last window to surface and file any warranty claims before the unit becomes fully out-of-pocket for Summit Construction.",
    customerId: "CUS-004",
    customerName: "Summit Construction",
    equipmentId: "EQ-820",
    equipmentName: "Cat 320 GC Excavator",
    confidence: 100,
    estimatedValue: 3150,
    actionLabel: "Schedule Inspection",
    actionHref: "/work-orders",
    detectedAt: "2026-04-30T08:00:00Z",
    dataPoints: [
      { label: "Warranty expires", value: "May 15, 2026" },
      { label: "Days remaining", value: "15" },
      { label: "Last service", value: "Mar 5, 2026" },
      { label: "Approved quote", value: "QT-860 · $3,150" },
    ],
  },
  {
    id: "INS-011",
    category: "expiring_warranty",
    severity: "medium",
    title: "JLG 600S Boom Lift — warranty expired Apr 1, plan paused",
    description: "EQ-305 warranty expired April 1, 2026, and its maintenance plan is currently paused. Without coverage, any failure is fully billable to Summit. Resuming the PM plan now reduces breakdown risk and surfaces a PM upsell.",
    customerId: "CUS-004",
    customerName: "Summit Construction",
    equipmentId: "EQ-305",
    equipmentName: "JLG 600S Boom Lift",
    confidence: 92,
    estimatedValue: 8500,
    actionLabel: "Resume Plan",
    actionHref: "/maintenance-plans",
    detectedAt: "2026-04-30T08:00:00Z",
    dataPoints: [
      { label: "Warranty expired", value: "Apr 1, 2026" },
      { label: "Plan status", value: "Paused" },
      { label: "Last service", value: "Aug 14, 2025" },
      { label: "Est. plan value", value: "$8,500/yr" },
    ],
  },

  // ── Revenue opportunities ──────────────────────────────────────────────────
  {
    id: "INS-012",
    category: "revenue_opportunity",
    severity: "high",
    title: "$12,000 in pending quotes awaiting approval",
    description: "Quotes QT-881 ($4,800) and QT-874 ($7,200) are both pending customer approval and expire within 28 days. Proactive follow-up could close both this month, adding $12,000 to recognized revenue.",
    customerId: "CUS-002",
    customerName: "Apex Fabricators / Summit Construction",
    confidence: 88,
    estimatedValue: 12000,
    actionLabel: "View Quotes",
    actionHref: "/billing",
    detectedAt: "2026-04-30T08:00:00Z",
    dataPoints: [
      { label: "Pending quotes", value: "2" },
      { label: "Total value", value: "$12,000" },
      { label: "QT-881 expires", value: "May 28, 2026" },
      { label: "QT-874 expires", value: "May 26, 2026" },
    ],
  },
  {
    id: "INS-013",
    category: "revenue_opportunity",
    severity: "medium",
    title: "Clearfield Foods Full Coverage renewal — $22,000 ARR at risk",
    description: "CUS-005's Full Coverage contract expires April 1, 2027 — renewal outreach should begin now (90 days out is best practice). Combined with the overdue invoice, early engagement prevents churn. Client has a 100% renewal history.",
    customerId: "CUS-005",
    customerName: "Clearfield Foods",
    confidence: 83,
    estimatedValue: 22000,
    actionLabel: "View Account",
    actionHref: "/customers/CUS-005",
    detectedAt: "2026-04-30T08:00:00Z",
    dataPoints: [
      { label: "Contract expires", value: "Apr 1, 2027" },
      { label: "Annual value", value: "$22,000" },
      { label: "Renewal health", value: "At Risk" },
      { label: "Outstanding balance", value: "$640" },
    ],
  },
]

// ── AI summary report ─────────────────────────────────────────────────────────

export interface AiSummaryReport {
  generatedAt: string
  period: string
  totalInsights: number
  criticalCount: number
  highCount: number
  totalEstimatedOpportunity: number
  revenueAtRisk: number
  topRisks: string[]
  topOpportunities: string[]
  recommendedActions: { priority: number; action: string; impact: string }[]
}

export const aiSummaryReport: AiSummaryReport = {
  generatedAt: "2026-04-30T08:00:00Z",
  period: "April 30, 2026",
  totalInsights: 13,
  criticalCount: 2,
  highCount: 6,
  totalEstimatedOpportunity: 108450,
  revenueAtRisk: 34000,
  topRisks: [
    "Haas VF-2SS repeat failure pattern indicates root cause not yet resolved — continued repairs risk client trust and equipment downtime.",
    "Liebherr LTM crane cable tension failures present a safety and liability risk if machine returns to operation before full engineering review.",
    "Clearfield Foods overdue invoice may delay contract renewal for a $22,000/yr account.",
  ],
  topOpportunities: [
    "Close QT-881 and QT-874 before month-end to capture $12,000 in immediate revenue.",
    "Upsell Riverstone Logistics multi-unit PM bundle — 11 uncovered units represent $25,000/yr opportunity.",
    "Re-engage Lakefront Printing with a targeted Full Coverage proposal — estimated $16,000 ARR.",
    "Upgrade Summit Construction to Full Coverage — saves client $10,000+/yr in parts variance, adds $18,000 ARR.",
  ],
  recommendedActions: [
    { priority: 1, action: "Call Apex Fabricators — schedule root cause engineering review for Haas VF-2SS", impact: "Prevent $5,290+ in continued repair costs; protect $42,000/yr contract" },
    { priority: 2, action: "Follow up on QT-881 and QT-874 approval — 28-day window closing", impact: "$12,000 immediate recognized revenue" },
    { priority: 3, action: "Schedule pre-warranty inspection for Cat 320 GC before May 15", impact: "Last chance to file warranty claims; prevent full cost exposure" },
    { priority: 4, action: "Send contract upgrade proposal to Summit Construction", impact: "$18,000 ARR increase; client saves on parts cost variance" },
    { priority: 5, action: "Re-activate Lakefront Printing account with Full Coverage quote", impact: "$16,000 ARR recovery from inactive account" },
  ],
}

export type TechStatus = "Available" | "On Job" | "Off" | "Vacation"
export type TechSkill =
  | "HVAC"
  | "Electrical"
  | "Calibration"
  | "Medical Equipment"
  | "Industrial Repair"
  | "Installations"
  | "Refrigeration"
  | "Hydraulics"
  | "Welding"
  | "PLC / Controls"
  // Audiology
  | "Audiometers"
  | "ABR Systems"
  | "Tympanometers"
  | "OAE Systems"
  | "VNG Systems"
  | "Balance Systems"
  | "Otoscopes"
  | "Sound Booths"
  | "Real Ear Systems"
  | "Scheduling"
  | "Customer Communication"
  | "PM Plans"
  | "Invoicing"
  | "Field Service"

export interface TechCertification {
  name: string
  issuer: string
  issuedDate: string
  expiryDate: string
}

export interface TechScheduleEntry {
  date: string
  time: string
  customer: string
  jobType: string
  woId: string
  status: "Confirmed" | "Tentative" | "Completed"
}

export interface TechHistoryEntry {
  woId: string
  customer: string
  jobType: string
  completedDate: string
  duration: string
  rating: number
}

export interface Technician {
  id: string
  name: string
  avatar: string
  /** Supabase Storage public URL for profile photo when set (`profiles.avatar_url`). */
  avatarUrl?: string | null
  /** From `organization_members.status` when roster is loaded from Supabase. */
  membershipStatus?: "active" | "invited" | "suspended"
  role: string
  region: string
  email: string
  phone: string
  hireDate: string
  status: TechStatus
  skills: TechSkill[]
  jobsThisWeek: number
  completionPct: number
  rating: number
  utilizationPct: number
  totalCompleted: number
  avgJobDurationHrs: number
  certifications: TechCertification[]
  schedule: TechScheduleEntry[]
  history: TechHistoryEntry[]
  bio: string
}

export const technicians: Technician[] = [
  {
    id: "T-01",
    name: "Marcus Webb",
    avatar: "MW",
    avatarUrl: "/demo-techs/technician-01.png",
    role: "Senior Field Technician",
    region: "Midwest",
    email: "m.webb@equipify.ai",
    phone: "(312) 555-0192",
    hireDate: "2018-03-12",
    status: "On Job",
    skills: ["HVAC", "Electrical", "Installations"],
    jobsThisWeek: 4,
    completionPct: 96,
    rating: 4.9,
    utilizationPct: 88,
    totalCompleted: 312,
    avgJobDurationHrs: 3.2,
    bio: "Marcus is a senior field tech with 8 years of experience specializing in commercial HVAC systems and large-scale electrical installations. Consistently rated in the top 5% for customer satisfaction.",
    certifications: [
      { name: "EPA 608 Universal", issuer: "Environmental Protection Agency", issuedDate: "2019-06-01", expiryDate: "2029-06-01" },
      { name: "NATE Core", issuer: "NATE", issuedDate: "2020-09-15", expiryDate: "2025-09-15" },
      { name: "OSHA 30", issuer: "OSHA", issuedDate: "2021-02-10", expiryDate: "2027-02-10" },
    ],
    schedule: [
      { date: "2026-04-30", time: "08:00 AM", customer: "Riverstone Logistics", jobType: "Toyota 8FGU25 Forklift PM", woId: "WO-2041", status: "Confirmed" },
      { date: "2026-05-08", time: "10:00 AM", customer: "Riverstone Logistics", jobType: "Forklift Annual Inspection", woId: "WO-2035", status: "Confirmed" },
      { date: "2026-05-01", time: "9:00 AM", customer: "Metro Warehousing", jobType: "Electrical Inspection", woId: "WO-2044", status: "Tentative" },
      { date: "2026-05-02", time: "10:00 AM", customer: "Apex Fabricators", jobType: "HVAC System PM", woId: "WO-2048", status: "Confirmed" },
    ],
    history: [
      { woId: "WO-1980", customer: "Riverstone Logistics", jobType: "Toyota 8FGU25 Semi-Annual PM", completedDate: "2026-01-15", duration: "3.5 hrs", rating: 5 },
      { woId: "WO-1744", customer: "Riverstone Logistics", jobType: "Toyota 8FGU25 Semi-Annual PM", completedDate: "2025-07-20", duration: "3.0 hrs", rating: 5 },
      { woId: "WO-1940", customer: "Apex Fabricators", jobType: "Haas VF-2SS Motor Diagnosis", completedDate: "2026-02-02", duration: "4.5 hrs", rating: 4 },
      { woId: "WO-1910", customer: "Summit Construction", jobType: "Liebherr Crane Annual Inspection", completedDate: "2026-01-20", duration: "6.0 hrs", rating: 5 },
    ],
  },
  {
    id: "T-02",
    name: "Sandra Liu",
    avatar: "SL",
    avatarUrl: "/demo-techs/technician-02.png",
    role: "Lead Calibration Specialist",
    region: "Northeast",
    email: "s.liu@equipify.ai",
    phone: "(617) 555-0347",
    hireDate: "2020-07-06",
    status: "Available",
    skills: ["Calibration", "Medical Equipment", "Electrical"],
    jobsThisWeek: 3,
    completionPct: 99,
    rating: 4.8,
    utilizationPct: 75,
    totalCompleted: 198,
    avgJobDurationHrs: 4.1,
    bio: "Sandra specializes in precision calibration and medical-grade equipment servicing. She holds multiple ISO and medical device certifications and is the team lead for all regulated instrument work.",
    certifications: [
      { name: "ISO 17025 Internal Auditor", issuer: "ANSI", issuedDate: "2021-03-20", expiryDate: "2026-03-20" },
      { name: "Biomedical Equipment Technician (BMET)", issuer: "AAMI", issuedDate: "2020-11-01", expiryDate: "2026-11-01" },
      { name: "OSHA 10", issuer: "OSHA", issuedDate: "2020-07-15", expiryDate: "2026-07-15" },
    ],
    schedule: [
      { date: "2026-04-30", time: "07:00 AM", customer: "Apex Fabricators", jobType: "CNC Motor Root Cause Analysis", woId: "WO-2040", status: "Confirmed" },
      { date: "2026-05-12", time: "07:30 AM", customer: "Apex Fabricators", jobType: "Air Compressor Quarterly PM", woId: "WO-2034", status: "Confirmed" },
      { date: "2026-05-02", time: "8:30 AM", customer: "Metro Warehousing", jobType: "Equipment Calibration Audit", woId: "WO-2045", status: "Tentative" },
    ],
    history: [
      { woId: "WO-2027", customer: "Apex Fabricators", jobType: "Torque Wrench Calibration", completedDate: "2026-04-18", duration: "2.5 hrs", rating: 5 },
      { woId: "WO-2011", customer: "Metro Warehousing", jobType: "Scale Calibration", completedDate: "2026-04-05", duration: "3.0 hrs", rating: 5 },
      { woId: "WO-1995", customer: "Clearfield Foods", jobType: "Pressure Gauge Calibration", completedDate: "2026-03-22", duration: "2.0 hrs", rating: 4 },
    ],
  },
  {
    id: "T-03",
    name: "Tyler Oakes",
    avatar: "TO",
    avatarUrl: "/demo-techs/technician-03.png",
    role: "Industrial Repair Technician",
    region: "Southwest",
    email: "t.oakes@equipify.ai",
    phone: "(512) 555-0884",
    hireDate: "2021-01-18",
    status: "On Job",
    skills: ["Industrial Repair", "Hydraulics", "Welding"],
    jobsThisWeek: 5,
    completionPct: 91,
    rating: 4.7,
    utilizationPct: 94,
    totalCompleted: 174,
    avgJobDurationHrs: 5.8,
    bio: "Tyler handles the heaviest industrial repair work on the team — cranes, excavators, and large hydraulic systems. His 94% utilization rate makes him the most deployed technician in the region.",
    certifications: [
      { name: "AWS Certified Welder", issuer: "American Welding Society", issuedDate: "2021-06-01", expiryDate: "2027-06-01" },
      { name: "Hydraulic Specialist Cert.", issuer: "IFPS", issuedDate: "2022-02-15", expiryDate: "2027-02-15" },
      { name: "OSHA 30", issuer: "OSHA", issuedDate: "2021-01-25", expiryDate: "2027-01-25" },
      { name: "Crane Operator Safety", issuer: "NCCCO", issuedDate: "2023-05-10", expiryDate: "2026-05-10" },
    ],
    schedule: [
      { date: "2026-04-29", time: "09:00 AM", customer: "Metro Warehousing", jobType: "Carrier 50XCZ060 HVAC Inspection", woId: "WO-2039", status: "Completed" },
      { date: "2026-05-01", time: "08:00 AM", customer: "Metro Warehousing", jobType: "Crown PTH50 Pallet Jack PM", woId: "WO-2046", status: "Confirmed" },
      { date: "2026-05-05", time: "09:00 AM", customer: "Clearfield Foods", jobType: "Heatcraft LCE060 Pump Seal Repair", woId: "WO-2037", status: "Confirmed" },
    ],
    history: [
      { woId: "WO-2039", customer: "Metro Warehousing", jobType: "Carrier HVAC Semi-Annual Inspection", completedDate: "2026-04-29", duration: "2.5 hrs", rating: 5 },
      { woId: "WO-1955", customer: "Metro Warehousing", jobType: "Crown PTH50 Quarterly PM", completedDate: "2026-02-15", duration: "2.0 hrs", rating: 4 },
      { woId: "WO-1501", customer: "Riverstone Logistics", jobType: "Forklift Hydraulic Cylinder Repair", completedDate: "2025-01-08", duration: "5.5 hrs", rating: 5 },
    ],
  },
  {
    id: "T-04",
    name: "Priya Mehta",
    avatar: "PM",
    avatarUrl: "/demo-techs/technician-04.png",
    role: "Field Technician II",
    region: "Southeast",
    email: "p.mehta@equipify.ai",
    phone: "(404) 555-0561",
    hireDate: "2022-05-02",
    status: "Available",
    skills: ["Hydraulics", "Industrial Repair", "Installations"],
    jobsThisWeek: 3,
    completionPct: 97,
    rating: 4.9,
    utilizationPct: 80,
    totalCompleted: 142,
    avgJobDurationHrs: 3.6,
    bio: "Priya joined from the heavy construction equipment sector and specializes in cranes, excavators, and aerial work platforms. She is the primary technician for Summit Construction and manages all heavy equipment inspections and PMs in the Southeast.",
    certifications: [
      { name: "NCCCO Mobile Crane Operator", issuer: "NCCCO", issuedDate: "2022-07-01", expiryDate: "2027-07-01" },
      { name: "OSHA 30 Construction", issuer: "OSHA", issuedDate: "2022-06-01", expiryDate: "2028-06-01" },
      { name: "Hydraulic Specialist Cert.", issuer: "IFPS", issuedDate: "2023-03-15", expiryDate: "2028-03-15" },
    ],
    schedule: [
      { date: "2026-05-02", time: "06:30 AM", customer: "Summit Construction", jobType: "Crane Cable Tension Repair", woId: "WO-2038", status: "Confirmed" },
      { date: "2026-05-04", time: "08:00 AM", customer: "Summit Construction", jobType: "Excavator 250-Hour PM", woId: "WO-2043", status: "Tentative" },
      { date: "2026-05-08", time: "10:00 AM", customer: "Riverstone Logistics", jobType: "Forklift Annual Inspection", woId: "WO-2035", status: "Confirmed" },
    ],
    history: [
      { woId: "WO-2021", customer: "Summit Construction", jobType: "Cat 320 GC 500-Hour PM", completedDate: "2026-04-25", duration: "4.0 hrs", rating: 5 },
      { woId: "WO-1970", customer: "Summit Construction", jobType: "Crane Cable Hoist Repair", completedDate: "2026-03-05", duration: "6.5 hrs", rating: 5 },
      { woId: "WO-1960", customer: "Summit Construction", jobType: "JLG 600S Annual Inspection", completedDate: "2026-02-20", duration: "3.5 hrs", rating: 4 },
    ],
  },
  {
    id: "T-05",
    name: "James Torres",
    avatar: "JT",
    avatarUrl: "/demo-techs/technician-05.png",
    role: "Field Technician I",
    region: "West",
    email: "j.torres@equipify.ai",
    phone: "(310) 555-0728",
    hireDate: "2023-09-11",
    status: "Vacation",
    skills: ["Electrical", "PLC / Controls", "Industrial Repair"],
    jobsThisWeek: 0,
    completionPct: 88,
    rating: 4.6,
    utilizationPct: 62,
    totalCompleted: 87,
    avgJobDurationHrs: 4.4,
    bio: "James is a newer team member with a background in industrial automation and PLC programming. He is ramping up quickly and handles most of the West Coast electrical and controls work.",
    certifications: [
      { name: "OSHA 10", issuer: "OSHA", issuedDate: "2023-09-20", expiryDate: "2029-09-20" },
      { name: "NFPA 70E (Arc Flash)", issuer: "NFPA", issuedDate: "2024-01-15", expiryDate: "2027-01-15" },
    ],
    schedule: [],
    history: [
      { woId: "WO-2014", customer: "Apex Fabricators", jobType: "PLC Diagnostic", completedDate: "2026-04-07", duration: "6.0 hrs", rating: 4 },
      { woId: "WO-1999", customer: "Riverstone Logistics", jobType: "Electrical Repair", completedDate: "2026-03-25", duration: "3.5 hrs", rating: 5 },
    ],
  },
  {
    id: "T-06",
    name: "Denise Harmon",
    avatar: "DH",
    avatarUrl: "/demo-techs/technician-06.png",
    role: "Senior Field Technician",
    region: "Midwest",
    email: "d.harmon@equipify.ai",
    phone: "(773) 555-0312",
    hireDate: "2017-11-28",
    status: "Off",
    skills: ["HVAC", "Electrical", "Calibration", "Installations"],
    jobsThisWeek: 2,
    completionPct: 98,
    rating: 4.8,
    utilizationPct: 71,
    totalCompleted: 389,
    avgJobDurationHrs: 3.8,
    bio: "Denise is the most experienced technician on the team with over 8 years at Equipify. She mentors junior technicians and handles escalated repairs across HVAC and complex electrical systems.",
    certifications: [
      { name: "EPA 608 Universal", issuer: "Environmental Protection Agency", issuedDate: "2018-04-01", expiryDate: "2028-04-01" },
      { name: "NATE Core", issuer: "NATE", issuedDate: "2019-08-10", expiryDate: "2025-08-10" },
      { name: "OSHA 30", issuer: "OSHA", issuedDate: "2020-03-05", expiryDate: "2026-03-05" },
      { name: "Electrical Inspector Cert.", issuer: "ICC", issuedDate: "2022-07-20", expiryDate: "2025-07-20" },
    ],
    schedule: [
      { date: "2026-05-04", time: "8:00 AM", customer: "Riverstone Logistics", jobType: "Annual HVAC Inspection", woId: "WO-2051", status: "Confirmed" },
    ],
    history: [
      { woId: "WO-2020", customer: "Metro Warehousing", jobType: "Electrical Panel PM", completedDate: "2026-04-14", duration: "4.0 hrs", rating: 5 },
      { woId: "WO-2006", customer: "Apex Fabricators", jobType: "HVAC Repair", completedDate: "2026-04-01", duration: "3.5 hrs", rating: 5 },
      { woId: "WO-1985", customer: "Riverstone Logistics", jobType: "AC Install", completedDate: "2026-03-10", duration: "5.5 hrs", rating: 4 },
    ],
  },
  {
    id: "T-07",
    name: "Omar Haddad",
    avatar: "OH",
    avatarUrl: "/demo-techs/technician-07.png",
    role: "Clinical Engineering Technician",
    region: "Northeast",
    email: "o.haddad@equipify.ai",
    phone: "(718) 555-0144",
    hireDate: "2019-04-22",
    status: "Available",
    skills: ["Medical Equipment", "Calibration", "Electrical"],
    jobsThisWeek: 2,
    completionPct: 95,
    rating: 4.8,
    utilizationPct: 78,
    totalCompleted: 241,
    avgJobDurationHrs: 3.5,
    bio: "Omar supports imaging and patient-monitoring systems for hospitals and clinics, with a focus on preventive maintenance and regulatory documentation.",
    certifications: [
      { name: "CBET", issuer: "AAMI", issuedDate: "2019-11-01", expiryDate: "2027-11-01" },
      { name: "OSHA 10 Healthcare", issuer: "OSHA", issuedDate: "2019-05-10", expiryDate: "2026-05-10" },
    ],
    schedule: [],
    history: [
      { woId: "WO-1990", customer: "Clearfield Foods", jobType: "Sterilizer annual PM", completedDate: "2026-03-28", duration: "3.0 hrs", rating: 5 },
    ],
  },
  {
    id: "T-08",
    name: "Nina Kowalski",
    avatar: "NK",
    avatarUrl: "/demo-techs/technician-08.png",
    role: "Biomedical Equipment Specialist",
    region: "Midwest",
    email: "n.kowalski@equipify.ai",
    phone: "(414) 555-0289",
    hireDate: "2021-08-16",
    status: "Available",
    skills: ["Medical Equipment", "PLC / Controls", "Calibration"],
    jobsThisWeek: 3,
    completionPct: 94,
    rating: 4.7,
    utilizationPct: 82,
    totalCompleted: 156,
    avgJobDurationHrs: 3.9,
    bio: "Nina installs and verifies infusion pumps, ventilators, and diagnostic devices, and trains clinical staff on safe operation.",
    certifications: [
      { name: "AAMI BMET", issuer: "AAMI", issuedDate: "2021-10-01", expiryDate: "2027-10-01" },
      { name: "ISO 13485 awareness", issuer: "Internal", issuedDate: "2022-01-15", expiryDate: "2026-01-15" },
    ],
    schedule: [],
    history: [
      { woId: "WO-2002", customer: "Metro Warehousing", jobType: "Lab analyzer QC visit", completedDate: "2026-04-02", duration: "2.5 hrs", rating: 5 },
    ],
  },
]
