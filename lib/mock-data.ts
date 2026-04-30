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
}

export interface WorkOrder {
  id: string
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
export type NotificationTriggerDays = 30 | 14 | 7 | 1

export interface NotificationRule {
  id: string
  channel: NotificationChannel
  triggerDays: NotificationTriggerDays
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

export const technicians = [
  { id: "T-01", name: "Marcus Webb", active: 3, completed: 28, rating: 4.9, avatar: "MW" },
  { id: "T-02", name: "Sandra Liu", active: 2, completed: 31, rating: 4.8, avatar: "SL" },
  { id: "T-03", name: "Tyler Oakes", active: 4, completed: 19, rating: 4.7, avatar: "TO" },
  { id: "T-04", name: "Priya Mehta", active: 2, completed: 24, rating: 4.9, avatar: "PM" },
  { id: "T-05", name: "James Torres", active: 1, completed: 22, rating: 4.6, avatar: "JT" },
]
