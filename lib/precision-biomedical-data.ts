/**
 * Mock workspace bundle for Precision Biomedical Services (medical equipment field service).
 * Pairs with DB seed `scripts/seed-precision-biomedical-demo.cjs` for Supabase-backed screens.
 */

import type {
  Customer,
  Equipment,
  WorkOrder,
  MaintenancePlan,
  MaintenancePlanService,
  NotificationLogEntry,
  Technician,
  AdminQuote,
  AdminInvoice,
  AiInsight,
  NotificationRule,
  PlanInterval,
  TechSkill,
  QuoteStatus,
  InvoiceStatus,
} from "@/lib/mock-data"

// ─── Shared site list (aligns with seed CUSTOMERS) ───────────────────────────

const PBS_SITES = [
  { company: "Valley Regional Hospital", city: "Fresno", state: "CA", zip: "93721", line1: "1515 N Van Ness Ave" },
  { company: "Summit Surgical Center", city: "San Jose", state: "CA", zip: "95110", line1: "575 S Bascom Ave" },
  { company: "Greenview Family Clinic", city: "Modesto", state: "CA", zip: "95354", line1: "801 Scenic Dr" },
  { company: "Riverstone Imaging Center", city: "Sacramento", state: "CA", zip: "95816", line1: "2801 K St" },
  { company: "Oak Ridge Dental Group", city: "Visalia", state: "CA", zip: "93291", line1: "4125 W Nobel Ave" },
  { company: "Blue Harbor Rehab Center", city: "Monterey", state: "CA", zip: "93940", line1: "2 Lower Ragsdale Dr" },
  { company: "Starlight Urgent Care", city: "Merced", state: "CA", zip: "95348", line1: "333 Mercy Ave" },
  { company: "Northside Pediatrics", city: "Stockton", state: "CA", zip: "95207", line1: "1801 E March Ln" },
  { company: "Cedar Grove Endoscopy Center", city: "Santa Rosa", state: "CA", zip: "95404", line1: "1144 Sonoma Ave" },
  { company: "Maple Street Dialysis Clinic", city: "Bakersfield", state: "CA", zip: "93301", line1: "3838 San Dimas St" },
  { company: "Lakeside Cardiology Associates", city: "Redding", state: "CA", zip: "96001", line1: "2175 Rosaline Ave" },
  { company: "Horizon Women's Health Pavilion", city: "Chico", state: "CA", zip: "95926", line1: "101 Raley Blvd" },
  { company: "Redwood Community Hospital", city: "Eureka", state: "CA", zip: "95501", line1: "1100 St Joseph Dr" },
  { company: "Clearwater Veterans Clinic", city: "Palo Alto", state: "CA", zip: "94304", line1: "3801 Miranda Ave" },
  { company: "Pinecrest Sleep Disorders Lab", city: "San Luis Obispo", state: "CA", zip: "93401", line1: "1235 Osos St" },
  { company: "Meadowbrook Outpatient Surgery", city: "Santa Maria", state: "CA", zip: "93454", line1: "2400 S Broadway" },
  { company: "Cascade Orthopedic Institute", city: "Roseville", state: "CA", zip: "95661", line1: "3 Medical Plaza Dr" },
  { company: "Silverline Oncology Infusion Center", city: "Walnut Creek", state: "CA", zip: "94598", line1: "2401 Shadelands Dr" },
  { company: "Pacific Coast Orthopedic Surgery Center", city: "San Diego", state: "CA", zip: "92103", line1: "7910 Frost St" },
  { company: "Harborview Community Health Center", city: "Long Beach", state: "CA", zip: "90813", line1: "1333 Pacific Ave" },
  { company: "Sierra Peak Ambulatory Surgery", city: "Reno", state: "NV", zip: "89502", line1: "525 Hammill Ln" },
  { company: "Golden State Wound & Hyperbaric", city: "Fresno", state: "CA", zip: "93720", line1: "6121 N Thesta Ave" },
] as const

const PRIMARY_CONTACTS = [
  "Jordan Alvarez",
  "Priya Shah",
  "Elena Morales",
  "Dr. Morgan Ellis",
  "Noah Kim",
  "Riley Chen",
  "Taylor Brooks",
  "Sam Rivera",
  "Jamie Ortiz",
  "Casey Nguyen",
  "Morgan Patel",
  "Avery Hassan",
  "Quinn Ibrahim",
  "Reese Morrison",
  "Skyler Cho",
  "Drew Patel",
  "Blake Rivera",
  "Cameron Nguyen",
  "Jordan Kim",
  "Morgan Lee",
  "Riley Santos",
  "Taylor Kim",
] as const

const EQ_TEMPLATES = [
  { mfr: "Philips", model: "IntelliVue MX750 Patient Monitor", cat: "Patient monitoring", loc: "ICU Pod B" },
  { mfr: "GE HealthCare", model: "CARESCAPE B850 Monitor", cat: "Patient monitoring", loc: "Step-down Unit" },
  { mfr: "Mindray", model: "BeneVision N17 OR Monitor", cat: "Patient monitoring", loc: "OR 3" },
  { mfr: "STERIS", model: "AMSCO 400 Small Steam Sterilizer", cat: "Sterilization", loc: "Central Sterile" },
  { mfr: "Getinge", model: "HSG-A 9102 Autoclave", cat: "Sterilization", loc: "SPD East" },
  { mfr: "Becton Dickinson", model: "Alaris PC Unit + 8100 Pump Module", cat: "Infusion", loc: "Med/Surg 5W" },
  { mfr: "ICU Medical", model: "Plum 360 Large Volume Pump", cat: "Infusion", loc: "ER Trauma Bay 2" },
  { mfr: "ZOLL", model: "X Series Advanced Monitor/Defibrillator", cat: "Emergency care", loc: "ER Resuscitation" },
  { mfr: "Physio-Control", model: "LIFEPAK 15 Monitor/Defibrillator", cat: "Emergency care", loc: "Cardiac Cath Holding" },
  { mfr: "GE HealthCare", model: "MAC 5500 HD Resting ECG", cat: "Diagnostics", loc: "Cardiology Clinic" },
  { mfr: "Schiller", model: "AT-102 Plus ECG", cat: "Diagnostics", loc: "Outpatient Diagnostics" },
  { mfr: "GE HealthCare", model: "LOGIQ E10 Ultrasound", cat: "Imaging", loc: "Imaging Suite 2" },
  { mfr: "Philips", model: "EPIQ Elite Ultrasound", cat: "Imaging", loc: "Vascular Lab" },
  { mfr: "Siemens Healthineers", model: "Mobilett Elara Max Mobile X-Ray", cat: "Imaging", loc: "Radiology" },
  { mfr: "Fujifilm", model: "Persona CS Mobile DR", cat: "Imaging", loc: "Orthopedics" },
  { mfr: "Steelco", model: "DS 610 Washer-Disinfector", cat: "Sterilization", loc: "GI Lab Support" },
  { mfr: "Dräger", model: "Perseus A500 Anesthesia Workstation", cat: "Anesthesia", loc: "OR 1" },
  { mfr: "GE HealthCare", model: "Aisys CS² Anesthesia Delivery", cat: "Anesthesia", loc: "OR 4" },
  { mfr: "Hillrom", model: "Progressa ICU Bed", cat: "Furniture", loc: "ICU Pod A" },
  { mfr: "Stryker", model: "SMART Stretcher", cat: "Furniture", loc: "ER Triage" },
  { mfr: "Eppendorf", model: "5425 R Centrifuge", cat: "Laboratory", loc: "Core Lab" },
  { mfr: "Thermo Fisher Scientific", model: "TSX Series High-Performance Refrigerator", cat: "Cold storage", loc: "Pharmacy" },
  { mfr: "Helmer", model: "i.Series Horizon Line Blood Bank Refrigerator", cat: "Cold storage", loc: "Blood Bank" },
  { mfr: "BD", model: "BACTEC FX40 Blood Culture", cat: "Laboratory", loc: "Microbiology" },
] as const

const WO_TITLES = [
  "Annual electrical safety & performance verification (SEP-1)",
  "Quarterly infusion pump channel calibration (IEC 60601-2-24)",
  "Sterilizer cycle fault — chamber temperature variance during exhaust",
  "Patient monitor arrhythmia algorithm verification after software upgrade",
  "Portable X-ray image quality degradation — detector calibration",
  "Defibrillator battery pack end-of-service replacement",
  "Ultrasound probe lens delamination — probe evaluation & swap",
  "Anesthesia vaporizer annual leak test & documentation",
  "ECG leadset noise investigation — shielding & cable harness check",
  "PM: autoclave door gasket inspection & replacement",
  "Vaccine storage unit temperature mapping (STP per CDC VFC)",
  "Centrifuge imbalance sensor fault — rotor inspection",
  "OR table hydraulic drift — cylinder service & load test",
  "Imaging QA phantom test — reject analysis trending high",
  "Battery management warning on transport monitor — cell replacement",
  "Preventive maintenance: patient monitoring network switch audit",
  "Certification prep for TJC tracer — infusion library audit",
  "Emergency call: code cart defib failed self-test",
  "Semi-annual PM — anesthesia breathing system flow test",
  "Repair: sterilizer printer / cycle traceability interface",
] as const

const PLAN_NAMES = [
  "Annual electrical safety (SEP) & performance verification",
  "Quarterly infusion pump PM & occlusion calibration",
  "Monthly patient monitor inspection & alarm test",
  "Semi-annual sterilizer biological indicator program",
  "Annual anesthesia machine checkout (NFPA 99)",
  "Quarterly imaging QA & detector calibration",
  "Monthly laboratory temperature monitoring review",
  "Annual PM — vaccine storage & monitoring",
] as const

function pbsCid(i: number) {
  return `PBS-C${String(i + 1).padStart(2, "0")}`
}

function pbsEid(i: number) {
  return `PBS-E${String(i + 1).padStart(3, "0")}`
}

function buildRules(emails: string[], phones: string[]): NotificationRule[] {
  const days = [30, 14, 7, 1] as const
  const rules: NotificationRule[] = []
  days.forEach((d) => {
    rules.push({ id: `pbs-r-email-${d}`, channel: "Email", triggerDays: d, enabled: true, recipients: emails })
    rules.push({ id: `pbs-r-internal-${d}`, channel: "Internal Alert", triggerDays: d, enabled: d <= 7, recipients: ["dispatch@precisionbiomedical.demo"] })
    if (phones.length) {
      rules.push({ id: `pbs-r-sms-${d}`, channel: "SMS", triggerDays: d, enabled: d <= 7, recipients: phones })
    }
  })
  return rules
}

function planServices(label: string): MaintenancePlanService[] {
  return [
    {
      id: `${label}-s1`,
      name: "Safety & performance checks",
      description: "Visual inspection, alarms, safety interlocks, and documentation per manufacturer IFU.",
      estimatedHours: 1.5,
      estimatedCost: 285,
    },
    {
      id: `${label}-s2`,
      name: "Calibration / functional verification",
      description: "As-applicable functional tests, calibration certificates, and CMMS close-out.",
      estimatedHours: 2,
      estimatedCost: 360,
    },
  ]
}

function intervalFromSeed(i: number): PlanInterval {
  const m = i % 4
  if (m === 0) return "Monthly"
  if (m === 1) return "Quarterly"
  if (m === 2) return "Semi-Annual"
  return "Annual"
}

export const pbsCustomers: Customer[] = PBS_SITES.map((s, i) => {
  const id = pbsCid(i)
  const phone = `(209) 555-${String(2100 + i).slice(-4)}`
  return {
    id,
    name: PRIMARY_CONTACTS[i] ?? "Clinical Engineering",
    company: s.company,
    status: "Active",
    equipmentCount: 3 + (i % 5),
    openWorkOrders: 1 + (i % 4),
    joinedDate: `2023-${String((i % 9) + 1).padStart(2, "0")}-12`,
    locations: [
      {
        id: `${id}-LOC1`,
        name: "Primary campus",
        address: s.line1,
        city: s.city,
        state: s.state,
        zip: s.zip,
        phone,
        isDefault: true,
      },
    ],
    contacts: [
      {
        name: PRIMARY_CONTACTS[i] ?? "Clinical Engineering Manager",
        role: s.company.includes("Dental") ? "Owner / Dentist" : "Clinical Engineering Manager",
        email: `ce.facility${i + 1}@pbs-demo.org`,
        phone,
      },
    ],
    notes:
      "Joint Commission–ready documentation on request. After-hours clinical engineering escalation to on-call biomed.",
    contracts: [
      {
        id: `${id}-CON1`,
        name: i % 3 === 0 ? "Multi-year Clinical Engineering PM Agreement" : "Annual Biomedical PM & Calibration",
        type: i % 4 === 0 ? "Full Coverage" : "PM Plan",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        value: 12800 + i * 420,
      },
    ],
  }
})

export const pbsEquipment: Equipment[] = Array.from({ length: 60 }, (_, i) => {
  const custIdx = i % PBS_SITES.length
  const cid = pbsCid(custIdx)
  const tpl = EQ_TEMPLATES[i % EQ_TEMPLATES.length]
  const company = PBS_SITES[custIdx].company
  const stRotate: Equipment["status"][] = ["Active", "Active", "Active", "Needs Service", "In Repair"]
  return {
    id: pbsEid(i),
    customerId: cid,
    customerName: company,
    equipmentCode: `PBS-${String(i + 1).padStart(4, "0")}`,
    model: tpl.model,
    manufacturer: tpl.mfr,
    category: tpl.cat,
    serialNumber: `SN-PBS-${2020 + (i % 6)}-${10001 + i}`,
    installDate: `201${9 + (i % 7)}-${String((i % 11) + 1).padStart(2, "0")}-15`,
    warrantyExpiration: `202${6 + (i % 3)}-${String((i % 10) + 1).padStart(2, "0")}-28`,
    lastServiceDate: "2026-02-10",
    nextDueDate: `2026-${String(((i + 3) % 12) + 1).padStart(2, "0")}-${String((i % 26) + 1).padStart(2, "0")}`,
    status: stRotate[i % stRotate.length],
    notes: "Clinical asset under Precision Biomedical Services preventive service agreement.",
    location: tpl.loc,
    photos: [],
    manuals: [],
    serviceHistory: [
      {
        id: `PBS-SH-${i}-1`,
        date: "2025-11-18",
        type: "PM",
        technician: "Alex Rivera",
        workOrderId: `PBS-W${String(((i + 5) % 50) + 1).padStart(4, "0")}`,
        description: "Preventive maintenance with electrical safety subset completed.",
        cost: 420 + (i % 6) * 35,
        status: "Completed",
      },
    ],
    replacementCost: 18000 + (i % 20) * 900,
    assignedTechnician: `PBS-T${String((i % 8) + 1).padStart(2, "0")}`,
  }
})

/** Matches `public/demo-techs` headshots and seed script `TECH_SEED` order (1–8). */
function pbsDemoTechnicianAvatarUrl(indexZeroBased: number): string {
  return `/demo-techs/technician-${String(indexZeroBased + 1).padStart(2, "0")}.png`
}

const TECH_META: {
  id: string
  name: string
  email: string
  region: string
  skills: TechSkill[]
}[] = [
  { id: "PBS-T01", name: "Alex Rivera", email: "demo.tech.rivera@precision-biomedical.seed", region: "Central Valley", skills: ["Medical Equipment", "Calibration", "Field Service"] },
  { id: "PBS-T02", name: "Linh Nguyen", email: "demo.tech.nguyen@precision-biomedical.seed", region: "Bay Area", skills: ["Medical Equipment", "Calibration", "Installations"] },
  { id: "PBS-T03", name: "Sanjay Patel", email: "demo.tech.patel@precision-biomedical.seed", region: "Sacramento corridor", skills: ["Medical Equipment", "Industrial Repair", "Field Service"] },
  { id: "PBS-T04", name: "Casey Morrison", email: "demo.tech.morrison@precision-biomedical.seed", region: "North Coast", skills: ["Medical Equipment", "Electrical", "Field Service"] },
  { id: "PBS-T05", name: "Yasmin Hassan", email: "demo.tech.hassan@precision-biomedical.seed", region: "Monterey Bay", skills: ["Medical Equipment", "Refrigeration", "Calibration"] },
  { id: "PBS-T06", name: "Daniel Cho", email: "demo.tech.cho@precision-biomedical.seed", region: "Los Angeles basin", skills: ["Medical Equipment", "Calibration", "PLC / Controls"] },
  { id: "PBS-T07", name: "Amira Ibrahim", email: "demo.tech.ibrahim@precision-biomedical.seed", region: "Inland Empire", skills: ["Medical Equipment", "Field Service", "Installations"] },
  { id: "PBS-T08", name: "Jordan Kim", email: "demo.tech.kim@precision-biomedical.seed", region: "San Diego / Imperial", skills: ["Medical Equipment", "Imaging", "Calibration"] },
]

export const pbsTechnicians: Technician[] = TECH_META.map((t, i) => ({
  id: t.id,
  name: t.name,
  avatar: t.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2),
  avatarUrl: pbsDemoTechnicianAvatarUrl(i),
  role: "Biomedical Equipment Technician",
  region: t.region,
  email: t.email,
  phone: `(559) 555-${String(3100 + i).slice(-4)}`,
  hireDate: `201${8 + (i % 3)}-0${(i % 8) + 1}-12`,
  status: i === 0 ? "On Job" : "Available",
  skills: [...t.skills],
  jobsThisWeek: 3 + (i % 3),
  completionPct: 94 + (i % 5),
  rating: 4.7 + (i % 3) * 0.1,
  utilizationPct: 72 + (i % 7) * 3,
  totalCompleted: 180 + i * 22,
  avgJobDurationHrs: 2.4 + (i % 4) * 0.15,
  bio: `${t.name} supports acute-care and ambulatory accounts across ${t.region}, with emphasis on ${t.skills[0]?.toLowerCase() ?? "biomedical"} service and regulatory-ready documentation.`,
  certifications: [
    { name: "CBET — Certified Biomedical Equipment Technician", issuer: "AAMI", issuedDate: "2020-05-01", expiryDate: "2028-05-01" },
    { name: "NFPA 99 Health Care Facilities Code — Awareness", issuer: "NFPA", issuedDate: "2024-01-10", expiryDate: "2027-01-10" },
  ],
  schedule: [
    {
      date: "2026-05-06",
      time: "08:00 AM",
      customer: PBS_SITES[(i + 2) % PBS_SITES.length].company,
      jobType: "Quarterly infusion pump PM",
      woId: `PBS-W${String(i * 4 + 3).padStart(4, "0")}`,
      status: "Confirmed",
    },
    {
      date: "2026-05-08",
      time: "10:30 AM",
      customer: PBS_SITES[(i + 5) % PBS_SITES.length].company,
      jobType: "Sterilizer temperature variance follow-up",
      woId: `PBS-W${String(i * 4 + 11).padStart(4, "0")}`,
      status: "Confirmed",
    },
  ],
  history: [
    {
      woId: `PBS-W${String(120 + i).padStart(4, "0")}`,
      customer: PBS_SITES[i % PBS_SITES.length].company,
      jobType: "Annual SEP & performance verification",
      completedDate: "2026-03-22",
      duration: "3.5 hrs",
      rating: 5,
    },
    {
      woId: `PBS-W${String(88 + i).padStart(4, "0")}`,
      customer: PBS_SITES[(i + 3) % PBS_SITES.length].company,
      jobType: "Imaging QA & detector calibration",
      completedDate: "2026-02-14",
      duration: "4.0 hrs",
      rating: 5,
    },
  ],
}))

const WO_STATUSES: WorkOrder["status"][] = [
  "Open",
  "Scheduled",
  "In Progress",
  "Completed",
  "Invoiced",
]

const WO_TYPES: WorkOrder["type"][] = ["Repair", "PM", "Inspection", "Install", "Emergency"]
const WO_PRIORITIES: WorkOrder["priority"][] = ["Low", "Normal", "Normal", "High", "Critical"]

export const pbsWorkOrders: WorkOrder[] = Array.from({ length: 110 }, (_, i) => {
  const eqIdx = (i * 5 + 7) % pbsEquipment.length
  const eq = pbsEquipment[eqIdx]
  const techIdx = i % TECH_META.length
  const tech = TECH_META[techIdx]
  const st = WO_STATUSES[i % WO_STATUSES.length]
  const completed =
    st === "Completed" || st === "Invoiced" ? "2026-04-15" : ""
  return {
    id: `PBS-W${String(i + 1).padStart(4, "0")}`,
    workOrderNumber: 1000 + i,
    customerId: eq.customerId,
    customerName: eq.customerName,
    equipmentId: eq.id,
    equipmentName: eq.model,
    location: eq.location,
    type: WO_TYPES[i % WO_TYPES.length],
    status: st,
    priority: WO_PRIORITIES[(i * 2) % WO_PRIORITIES.length],
    technicianId: i % 6 === 0 ? "" : tech.id,
    technicianName: i % 6 === 0 ? "Unassigned" : tech.name,
    technicianAvatarUrl: i % 6 === 0 ? null : pbsDemoTechnicianAvatarUrl(techIdx),
    scheduledDate: `2026-${String((i % 10) + 1).padStart(2, "0")}-${String((i % 25) + 1).padStart(2, "0")}`,
    scheduledTime: "09:30",
    completedDate: completed,
    createdAt: "2026-04-01T14:00:00Z",
    createdBy: "Precision Biomedical Dispatch",
    description: WO_TITLES[i % WO_TITLES.length],
    repairLog: {
      problemReported: `Service ticket: ${WO_TITLES[i % WO_TITLES.length]}`,
      diagnosis: "Assessment documented; corrective path aligned with OEM service manual where applicable.",
      partsUsed: [],
      laborHours: st === "Completed" || st === "Invoiced" ? 2.5 + (i % 4) * 0.25 : 0,
      technicianNotes: "Biomed field notes attached in CMMS. Clinical engineering copy provided upon request.",
      photos: [],
      signatureDataUrl: "",
      signedBy: completed ? tech.name : "",
      signedAt: completed ? "2026-04-15T16:30:00Z" : "",
      tasks: [],
    },
    totalLaborCost: 120 + (i % 40) * 25,
    totalPartsCost: (i % 9) * 18,
    invoiceNumber: st === "Invoiced" ? `INV-PBS-2026${String(i + 1).padStart(4, "0")}` : "",
  }
})

export const pbsMaintenancePlans: MaintenancePlan[] = Array.from({ length: 42 }, (_, i) => {
  const eq = pbsEquipment[(i * 3) % pbsEquipment.length]
  const tech = TECH_META[i % TECH_META.length]
  const interval = intervalFromSeed(i)
  const due = new Date(2026, i % 12, 1 + (i % 20))
  if (i % 7 === 0) due.setMonth(due.getMonth() - 2)
  if (i % 9 === 0) due.setDate(due.getDate() + 45)
  const dueStr = due.toISOString().slice(0, 10)
  const name = PLAN_NAMES[i % PLAN_NAMES.length]
  return {
    id: `PBS-MP-${String(i + 1).padStart(3, "0")}`,
    name,
    customerId: eq.customerId,
    customerName: eq.customerName,
    equipmentId: eq.id,
    equipmentName: eq.model,
    equipmentCategory: eq.category,
    location: eq.location,
    technicianId: tech.id,
    technicianName: tech.name,
    interval,
    customIntervalDays: 0,
    status: i % 11 === 0 ? "Paused" : "Active",
    startDate: "2025-01-01",
    lastServiceDate: "2025-11-01",
    nextDueDate: dueStr,
    services: planServices(`pbs-mp-${i}`),
    notificationRules: buildRules([`ce.facility${(i % 22) + 1}@pbs-demo.org`], ["(209) 555-0199"]),
    autoCreateWorkOrder: i % 3 === 0,
    workOrderType: "PM",
    workOrderPriority: i % 8 === 0 ? "High" : "Normal",
    notes: "Preventive maintenance agreement with automated reminders and scheduled visits.",
    createdAt: "2025-12-01T10:00:00Z",
    totalServicesCompleted: 3 + (i % 8),
  }
})

export const pbsNotificationLog: NotificationLogEntry[] = [
  {
    id: "PBS-NL-001",
    planId: "PBS-MP-003",
    planName: PLAN_NAMES[2],
    equipmentName: EQ_TEMPLATES[1].model,
    customerName: PBS_SITES[2].company,
    channel: "Email",
    triggerDays: 30,
    sentAt: "2026-03-12T09:05:00Z",
    recipient: "ce.facility3@pbs-demo.org",
    message: "Reminder: patient monitor PM is due within 30 days.",
    status: "Sent",
  },
  {
    id: "PBS-NL-002",
    planId: "PBS-MP-011",
    planName: PLAN_NAMES[3],
    equipmentName: EQ_TEMPLATES[3].model,
    customerName: PBS_SITES[5].company,
    channel: "SMS",
    triggerDays: 7,
    sentAt: "2026-04-26T07:40:00Z",
    recipient: "(209) 555-2105",
    message: "Sterilizer biological indicator program visit is due in 7 days.",
    status: "Sent",
  },
  {
    id: "PBS-NL-003",
    planId: "PBS-MP-007",
    planName: PLAN_NAMES[4],
    equipmentName: EQ_TEMPLATES[16].model,
    customerName: PBS_SITES[7].company,
    channel: "Internal Alert",
    triggerDays: 1,
    sentAt: "2026-05-01T06:15:00Z",
    recipient: "dispatch@precisionbiomedical.demo",
    message: "Anesthesia annual checkout due tomorrow — assign CBET with vaporizer certification.",
    status: "Simulated",
  },
]

export const pbsQuotes: AdminQuote[] = Array.from({ length: 25 }, (_, i) => {
  const custIdx = i % PBS_SITES.length
  const tpl = EQ_TEMPLATES[(i * 3) % EQ_TEMPLATES.length]
  const st = (["Sent", "Pending Approval", "Draft", "Approved", "Sent"] as const)[i % 5] as QuoteStatus
  const tech = TECH_META[i % TECH_META.length]
  const amt = 2400 + (i % 17) * 3100 + ((i * 7) % 5) * 800
  const day = String(2 + (i % 25)).padStart(2, "0")
  const createdDate = `2026-04-${day}`
  const expiresDate = `2026-05-${String(Math.min(28, 3 + (i % 20))).padStart(2, "0")}`
  return {
    id: `PBS-QT-${2401 + i}`,
    customerId: pbsCid(custIdx),
    customerName: PBS_SITES[custIdx].company,
    equipmentId: pbsEid((i * 4) % 60),
    equipmentName: tpl.model,
    createdDate,
    expiresDate,
    sentDate: st === "Draft" ? "" : createdDate,
    amount: amt,
    status: st,
    description: `${tpl.model} — ${["PM renewal", "repair estimate", "calibration package", "capital replacement", "SPD compliance audit"][i % 5]} (${PBS_SITES[custIdx].company}).`,
    createdBy: tech.name,
    workOrderId: i % 3 === 0 ? "" : `PBS-W${String((i % 90) + 1).padStart(4, "0")}`,
    workOrderNumber: i % 3 === 0 ? undefined : 1000 + (i % 90),
    notes: "Quoted scope for on-site inspection, labor, and OEM-specified consumables.",
    lineItems: [
      { description: "Field labor (estimated)", qty: 6, unit: 195 },
      { description: "Parts / consumables", qty: 1, unit: Math.max(400, Math.round(amt * 0.32)) },
      { description: "Documentation & OEM coordination", qty: 1, unit: Math.max(250, Math.round(amt * 0.14)) },
    ],
  }
})

export const pbsInvoices: AdminInvoice[] = Array.from({ length: 35 }, (_, i) => {
  const custIdx = (i * 2) % PBS_SITES.length
  const tpl = EQ_TEMPLATES[(i + 4) % EQ_TEMPLATES.length]
  const st = (["Paid", "Sent", "Overdue", "Paid", "Sent", "Paid", "Paid", "Sent", "Overdue", "Paid"] as const)[
    i % 10
  ] as InvoiceStatus
  const tech = TECH_META[i % TECH_META.length]
  const amt = 980 + (i % 29) * 420 + ((i * 11) % 7) * 180
  const issue = new Date(2025, 7 + (i % 9), 3 + (i % 20))
  const issueDate = issue.toISOString().slice(0, 10)
  const due = new Date(issue)
  due.setDate(due.getDate() + 30)
  const dueDate = due.toISOString().slice(0, 10)
  let paidDate = ""
  if (st === "Paid") {
    const pd = new Date(due)
    pd.setDate(pd.getDate() - 4 - (i % 10))
    paidDate = pd.toISOString().slice(0, 10)
  }
  return {
    id: `PBS-INV-${5001 + i}`,
    customerId: pbsCid(custIdx),
    customerName: PBS_SITES[custIdx].company,
    workOrderId: `PBS-W${String((i % 90) + 1).padStart(4, "0")}`,
    equipmentId: pbsEid((i * 5 + 2) % 60),
    equipmentName: tpl.model,
    issueDate,
    dueDate,
    paidDate,
    amount: amt,
    status: st,
    createdBy: tech.name,
    notes:
      st === "Overdue"
        ? "Follow-up with accounts payable — second notice sent."
        : st === "Paid"
          ? "Paid via ACH — thank you."
          : "Net 30 — awaiting remittance.",
    lineItems: [
      { description: "Field labor", qty: 4 + (i % 6), unit: 185 },
      { description: "Parts / materials", qty: 1, unit: Math.max(120, Math.round(amt * 0.25)) },
    ],
  }
})

/** Legacy workspace bundle KPIs; main dashboard reads Supabase via `useSupabaseDashboard`. */
export const pbsStats = {
  equipmentDueThisMonth: 18,
  overdueService: 6,
  openWorkOrders: 36,
  monthlyRevenue: "$118K",
  revenueSubtitle: "Use dashboard for live totals",
  revenueTrend: "+6.4% YoY (illustrative)",
  expiringWarranties: 8,
  warrantyTrend: "Warranty pipeline healthy",
  repeatRepairAlerts: 4,
}

/** Twelve-month shape for workspace-only charts (e.g. reports); dashboard revenue is live from Supabase. */
export const pbsRevenueData = [
  { month: "Jun", revenue: 38200 },
  { month: "Jul", revenue: 40100 },
  { month: "Aug", revenue: 42800 },
  { month: "Sep", revenue: 41500 },
  { month: "Oct", revenue: 45200 },
  { month: "Nov", revenue: 46800 },
  { month: "Dec", revenue: 48900 },
  { month: "Jan", revenue: 47200 },
  { month: "Feb", revenue: 49800 },
  { month: "Mar", revenue: 52100 },
  { month: "Apr", revenue: 54800 },
  { month: "May", revenue: 56200 },
]

export const pbsWorkOrdersByStatus = [
  { status: "Open", count: 13, color: "var(--color-chart-1)" },
  { status: "Scheduled", count: 13, color: "var(--color-chart-3)" },
  { status: "In Progress", count: 12, color: "var(--color-chart-2)" },
  { status: "Completed", count: 38, color: "var(--color-status-success)" },
  { status: "Invoiced", count: 34, color: "var(--color-chart-4)" },
]

export const pbsRecentWorkOrders = pbsWorkOrders.slice(0, 5).map((wo) => ({
  id: wo.id,
  customer: wo.customerName,
  equipment: wo.equipmentName,
  type: wo.type,
  technician: wo.technicianName,
  status: wo.status,
  priority: wo.priority,
  due: wo.scheduledDate,
}))

export const pbsEquipmentDueSoon = [
  { id: "PBS-E006", name: EQ_TEMPLATES[5].model, customer: PBS_SITES[2].company, nextService: "2026-05-04", type: "Quarterly calibration" },
  { id: "PBS-E014", name: EQ_TEMPLATES[12].model, customer: PBS_SITES[4].company, nextService: "2026-05-09", type: "Imaging QA" },
  { id: "PBS-E021", name: EQ_TEMPLATES[18].model, customer: PBS_SITES[6].company, nextService: "2026-05-11", type: "Anesthesia checkout" },
  { id: "PBS-E033", name: EQ_TEMPLATES[7].model, customer: PBS_SITES[9].company, nextService: "2026-05-14", type: "Defibrillator PM" },
]

export const pbsRepeatRepairs = [
  {
    equipment: EQ_TEMPLATES[12].model,
    customer: PBS_SITES[3].company,
    repairs: 3,
    lastRepair: "2026-04-12",
    issue: "Image reject rate trending high after detector warm-up",
  },
  {
    equipment: EQ_TEMPLATES[3].model,
    customer: PBS_SITES[0].company,
    repairs: 2,
    lastRepair: "2026-03-30",
    issue: "Chamber temperature variance on exhaust phase",
  },
]

export const pbsExpiringWarranties = [
  { equipment: EQ_TEMPLATES[0].model, customer: PBS_SITES[1].company, expires: "2026-05-18", daysLeft: 16 },
  { equipment: EQ_TEMPLATES[11].model, customer: PBS_SITES[10].company, expires: "2026-06-02", daysLeft: 31 },
  { equipment: EQ_TEMPLATES[16].model, customer: PBS_SITES[5].company, expires: "2026-04-28", daysLeft: 0 },
]

export const pbsInsights: AiInsight[] = [
  {
    id: "pbs-i1",
    category: "overdue_client",
    severity: "high",
    title: "Maple Street Dialysis Clinic has four infusion devices due within 10 days",
    description:
      "Alaris and Plum modules share the same medication library revision window. Bundling calibration visits with pharmacy sign-off reduces repeat trips and supports Joint Commission tracer readiness.",
    meta: "4 devices | same campus",
    value: "Due before May 12",
    actionLabel: "Open schedule",
    actionHref: "/service-schedule",
  },
  {
    id: "pbs-i2",
    category: "repeat_failure",
    severity: "critical",
    title: "Riverstone Imaging Center shows repeat detector warm-up faults on mobile DR",
    description:
      "Three of the last five QA visits logged elevated reject rates during warm-up. Recommend detector stability burn-in and OEM field application engineer consult before summer census peak.",
    meta: "3 of 5 QA visits",
    value: "Pattern detected",
    actionLabel: "View equipment",
    actionHref: "/equipment",
  },
  {
    id: "pbs-i3",
    category: "revenue_opportunity",
    severity: "medium",
    title: "Valley Regional Hospital PM renewal is trending toward approval",
    description:
      "Multi-year clinical engineering contract renewal is in legal review. Attaching infusion and imaging bundles increases estimated ARR while locking preferred response SLAs for the ICU expansion project.",
    meta: "Renewal in review",
    value: "+$42.8K proposal",
    actionLabel: "View quotes",
    actionHref: "/quotes",
  },
  {
    id: "pbs-i4",
    category: "upsell",
    severity: "low",
    title: "Northside Pediatrics cold chain program is a strong add-on candidate",
    description:
      "Vaccine storage mapping was completed successfully in Q1. A recurring quarterly monitoring subscription would standardize documentation for VFC and reduce emergency call volume.",
    meta: "Pharmacy-led account",
    value: "+$5.1K ARR est.",
    actionLabel: "View customer",
    actionHref: "/customers",
  },
]
