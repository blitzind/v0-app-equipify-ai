/**
 * Precision Biomedical Services — marketing-scale demo seed (Supabase only).
 *
 * - Seeds the Precision marketing org (default slug `precision-biomedical-demo`, same as the app workspace map).
 *   Override with PRECISION_ORG_SLUG if your project uses a different slug for the same org.
 * - Idempotent: skips when the full fingerprint is already present (no duplicate rows).
 * - Replaces ONLY that org’s tenant rows (customers → financials → work orders → prospects → vendors →
 *   catalog/inventory → communications) then inserts fresh marketing data.
 * - Does NOT delete or modify Acme, Zephyr, Medology, or any other organization.
 *
 * Requires:
 *   DEMO_SEED_OWNER_ID = auth.users UUID (your login user)
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (service role — all writes use PostgREST + Auth Admin API)
 *   Migration `20260505190000_org_quotes_invoices.sql` applied (org_quotes / org_invoices tables).
 *
 * DATABASE_URL is not used or required.
 *
 * Exact command (hosted Supabase example):
 *   CONFIRM_DEMO_SEED=1 DEMO_SEED_OWNER_ID='<uuid>' SUPABASE_URL='https://<project>.supabase.co' SUPABASE_SERVICE_ROLE_KEY='<service-role>' pnpm seed:demo-precision
 *
 * Optional:
 *   CONFIRM_DEMO_SEED=1  — required when seeding non-local Supabase (safety guard)
 *   PRECISION_ORG_SLUG=precision-biomedical-demo  — must match `organizations.slug` for the org you switch to in the app
 */

const fs = require("fs")
const path = require("path")
const { createClient } = require("@supabase/supabase-js")

const DEFAULT_PRECISION_SLUG = "precision-biomedical-demo"

const TARGET_CUSTOMERS = 22
const TARGET_EQUIPMENT = 60
/** Includes primary WOs + PM-from-plan rows counted by maintenance automation widget. */
const TARGET_WORK_ORDERS = 200
const TARGET_PM_PLAN_WORK_ORDERS = 12
const TARGET_TOTAL_WORK_ORDERS = TARGET_WORK_ORDERS + TARGET_PM_PLAN_WORK_ORDERS
const TARGET_PLANS = 40
const TARGET_QUOTES = 25
const TARGET_INVOICES = 30

/** Pipeline, supply chain, and communications — Precision marketing org only (stable prefixes / domains). */
const TARGET_PROSPECTS = 36
const TARGET_VENDOR_ROWS = 14
const TARGET_CATALOG_ITEMS = 28
const TARGET_COMM_EVENTS = 42
const SEED_SKU_PREFIX = "PBS-SEED-"
const SEED_VENDOR_EMAIL_DOMAIN = "pbs-vendor.seed"
const SEED_LEAD_EMAIL_DOMAIN = "pbs-lead.demo.local"

const TARGET_OPEN_WOS = 40
const TARGET_COMPLETED_WOS = 85
const TARGET_INVOICED_WOS = 55
const TARGET_REPEAT_EXTRA_WOS = 20
if (
  TARGET_OPEN_WOS + TARGET_COMPLETED_WOS + TARGET_INVOICED_WOS + TARGET_REPEAT_EXTRA_WOS !==
  TARGET_WORK_ORDERS
) {
  throw new Error("Precision seed: work order segment constants must sum to TARGET_WORK_ORDERS")
}
const SEED_CUST_PREFIX = "pbs-seed-cust-"
const SEED_EQ_PREFIX = "PBS-SEED-"
const SEED_QUOTE_KEY_PREFIX = "pbs-seed-qt-"
const SEED_INV_KEY_PREFIX = "pbs-seed-inv-"

function loadDotEnvLocal() {
  const p = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(p)) return
  const raw = fs.readFileSync(p, "utf8")
  for (const line of raw.split("\n")) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim())
    if (!m) continue
    const k = m[1]
    let v = m[2].replace(/^["']|["']$/g, "")
    if (process.env[k] === undefined) process.env[k] = v
  }
}

function chunkArray(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function throwOnError(result, context) {
  if (result.error) throw new Error(`${context}: ${result.error.message}`)
}

function isUniqueViolation(error) {
  if (!error) return false
  if (error.code === "23505") return true
  const m = String(error.message || "").toLowerCase()
  return m.includes("duplicate key") || m.includes("unique constraint")
}

/**
 * Hosted Supabase guard: refuse accidental remote seeds unless explicitly confirmed.
 */
function assertSafeSupabaseUrl(supabaseUrl) {
  let host = ""
  try {
    host = new URL(supabaseUrl).hostname
  } catch {
    console.error("Invalid SUPABASE_URL")
    process.exit(1)
  }
  const local = host === "127.0.0.1" || host === "localhost"
  if (!local && process.env.CONFIRM_DEMO_SEED !== "1") {
    console.error(
      "Refusing to run against non-local SUPABASE_URL without CONFIRM_DEMO_SEED=1 (safety guard).",
    )
    process.exit(1)
  }
}

/** Install / scheduling windows for equipment & work orders (UTC calendar years). */
const SEED_CAL_YEAR_MIN = 2021
const SEED_CAL_YEAR_MAX = 2026

/**
 * UTC calendar bounds for the month containing `now` (for warranty spread & PM scheduling windows).
 * @returns {{ y: number, m: number, lastD: number, monthStart: string, today: string }}
 *   m = 0–11 (Date.UTC month index). monthStart/today = YYYY-MM-DD.
 */
function utcMonthBounds(now) {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const lastD = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const pad = (n) => String(n).padStart(2, "0")
  const monthStart = `${y}-${pad(m + 1)}-01`
  const today = `${y}-${pad(m + 1)}-${pad(now.getUTCDate())}`
  return { y, m, lastD, monthStart, today }
}

/** YYYY-MM-DD in UTC from calendar components (month is 0–11, matching Date#getUTCMonth). */
function utcDateParts(year, month0to11, day) {
  const pad = (n) => String(n).padStart(2, "0")
  return `${year}-${pad(month0to11 + 1)}-${pad(day)}`
}

/** Add signed days to a YYYY-MM-DD string; result is UTC calendar date. */
function isoDateAddDays(isoDateStr, deltaDays) {
  const [yy, mo, dd] = isoDateStr.split("-").map((x) => parseInt(x, 10))
  const t = Date.UTC(yy, mo - 1, dd) + deltaDays * 86400000
  const d = new Date(t)
  const pad = (n) => String(n).padStart(2, "0")
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

function assertSeedDateOk(isoDateStr, ctx) {
  if (typeof isoDateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(isoDateStr)) {
    throw new Error(`Precision seed: invalid date (${ctx}): ${String(isoDateStr)}`)
  }
  const t = Date.parse(`${isoDateStr}T12:00:00.000Z`)
  if (!Number.isFinite(t)) throw new Error(`Precision seed: invalid date (${ctx}): ${isoDateStr}`)
}

function assertIsoTimestamptzOk(s, ctx) {
  if (typeof s !== "string" || !Number.isFinite(Date.parse(s))) {
    throw new Error(`Precision seed: invalid ISO timestamptz (${ctx}): ${String(s)}`)
  }
}

/**
 * Deterministic labor/parts and completion timestamps for completed / invoiced work orders (dashboard revenue spread).
 */
function revenueSpecForDashboard(now, slot) {
  const daysBackInt = 1 + (slot % 120)
  const jitterHrs = slot % 23
  const updatedAt = new Date(now.getTime() - daysBackInt * 86400000 - jitterHrs * 3600000).toISOString()
  const laborCents = 52_000 + (slot % 47) * 3_400 + (slot % 9) * 1_100
  const partsCents = 16_500 + (slot % 31) * 2_050 + (slot % 6) * 725
  return { updatedAt, laborCents, partsCents }
}

/** JSON for `work_orders.repair_log` (matches app `RepairLog` shape; seed-only copy). */
function repairLogJson(title) {
  return JSON.stringify({
    problemReported: title.slice(0, 240),
    diagnosis: "Synthetic marketing seed — measurements within tolerance where applicable.",
    partsUsed: [],
    laborHours: 0,
    technicianNotes: "Precision Biomedical marketing seed.",
    photos: [],
    signatureDataUrl: "",
    signedBy: "",
    signedAt: "",
    tasks: [],
  })
}

/** Resolve auth user id by email via Auth Admin API (no direct Postgres). */
async function authUserIdByEmail(supabase, email) {
  const want = email.trim().toLowerCase()
  let page = 1
  const perPage = 200
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    throwOnError({ error }, `auth.admin.listUsers page ${page}`)
    const u = data.users.find((x) => (x.email || "").toLowerCase() === want)
    if (u) return u.id
    if (!data.users.length || data.users.length < perPage) return null
    page += 1
  }
}

/** Healthcare sites — 22 accounts (hospitals, clinics, imaging, surgical, dental, rehab, urgent care). */
const CUSTOMERS = [
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
]

const EQUIPMENT_TEMPLATES = [
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
  { mfr: "Becton Dickinson", model: "BACTEC FX40 Blood Culture", cat: "Laboratory", loc: "Microbiology" },
  { mfr: "Siemens Healthineers", model: "MAGNETOM Altea 1.5T MRI", cat: "MRI", loc: "MRI Suite 1" },
  { mfr: "GE HealthCare", model: "SIGNA Voyager 1.5T MRI", cat: "MRI", loc: "MRI Suite 2" },
  { mfr: "Philips", model: "Ingenia Ambition 1.5T X MRI", cat: "MRI", loc: "Imaging Annex" },
  { mfr: "Canon Medical", model: "Aquilion ONE GENESIS Edition CT", cat: "CT", loc: "CT Suite A" },
  { mfr: "Siemens Healthineers", model: "SOMATOM go.Top Mobile CT", cat: "CT", loc: "ED Imaging" },
  { mfr: "Hologic", model: "Selenia Dimensions Mammography System", cat: "Mammography", loc: "Women's Imaging" },
  { mfr: "Roche Diagnostics", model: "cobas 6000 Analyzer Series", cat: "Laboratory", loc: "Core Lab" },
  { mfr: "Abbott", model: "ARCHITECT i2000SR Immunoassay", cat: "Laboratory", loc: "Core Lab" },
  { mfr: "Siemens Healthineers", model: "RAPIDPoint 500 Blood Gas", cat: "Point-of-care", loc: "ICU" },
  { mfr: "Stryker", model: "System 8 Power Tools Set", cat: "Surgical devices", loc: "Sterile Processing" },
  { mfr: "STERIS", model: "V-PRO maX Low-Temperature Sterilizer", cat: "Sterilization", loc: "SPD West" },
  { mfr: "Hillrom", model: "CareAssist ES Medical Surgical Bed", cat: "Furniture", loc: "Med/Surg 3E" },
  { mfr: "Dräger", model: "Evita V800 ICU Ventilator", cat: "Ventilation", loc: "ICU Pod C" },
  { mfr: "Medtronic", model: "Puritan Bennett 980 Ventilator", cat: "Ventilation", loc: "Respiratory" },
  { mfr: "Baxter", model: "Spectrum IQ Infusion System", cat: "Infusion", loc: "Oncology Infusion" },
  { mfr: "Carestream", model: "DRX-Revolution Mobile X-Ray", cat: "Imaging", loc: "Radiology Hallway" },
]

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
  "NIBP module drift verification — multi-site comparison",
  "Infusion pump drug library update — wireless deployment QA",
  "Anesthesia vaporizer concentration accuracy check",
  "HVAC-linked pressure swing in SPD — environmental correlation study",
]

const PLAN_NAMES = [
  "Annual electrical safety (SEP) & performance verification",
  "Quarterly infusion pump PM & occlusion calibration",
  "Monthly patient monitor inspection & alarm test",
  "Semi-annual sterilizer biological indicator program",
  "Annual anesthesia machine checkout (NFPA 99)",
  "Quarterly imaging QA & detector calibration",
  "Monthly laboratory temperature monitoring review",
  "Annual PM — vaccine storage & monitoring",
  "Biweekly code cart readiness verification",
  "Quarterly blood bank refrigerator temperature review",
]

const TECH_SEED = [
  { email: "demo.tech.rivera@precision-biomedical.seed", name: "Alex Rivera" },
  { email: "demo.tech.nguyen@precision-biomedical.seed", name: "Linh Nguyen" },
  { email: "demo.tech.patel@precision-biomedical.seed", name: "Sanjay Patel" },
  { email: "demo.tech.morrison@precision-biomedical.seed", name: "Casey Morrison" },
  { email: "demo.tech.hassan@precision-biomedical.seed", name: "Yasmin Hassan" },
  { email: "demo.tech.cho@precision-biomedical.seed", name: "Daniel Cho" },
  { email: "demo.tech.ibrahim@precision-biomedical.seed", name: "Amira Ibrahim" },
  { email: "demo.tech.kim@precision-biomedical.seed", name: "Jordan Kim" },
]

function buildProspectSeedRows(now) {
  const leadEmail = (n) => `lead${String(n).padStart(2, "0")}@${SEED_LEAD_EMAIL_DOMAIN}`
  const stages = [
    ...Array(6).fill("new"),
    ...Array(5).fill("attempting_contact"),
    ...Array(5).fill("contacted"),
    ...Array(5).fill("qualified"),
    ...Array(4).fill("proposal_sent"),
    ...Array(3).fill("won"),
    ...Array(3).fill("lost"),
    ...Array(5).fill("nurture"),
  ]
  const companies = [
    ["UCSF Audiology & Hearing Center", "Dr. Elena Ortiz", "Chief of Audiology"],
    ["Stanford Children's OR Biomedical", "Marcus Webb", "Perioperative Clinical Engineering"],
    ["Kaiser Fresno — Clinical Engineering Storeroom", "Priya Nandakumar", "Regional BMET Lead"],
    ["Sierra Surgery Center — SPD", "Chris Dalton", "SPD Manager"],
    ["Golden Gate ENT Partners", "Dr. Jamie Liu", "Practice Administrator"],
    ["UC Davis Vet Teaching Hospital — Lab Support", "Taylor Brooks", "Lab Operations"],
    ["Monterey Bay Hearing Center", "Samira Haddad", "Clinic Director"],
    ["Sharp Grossmont Diagnostic Imaging", "Renee Collins", "Imaging QA Coordinator"],
    ["Regional Medical Center — Cath Lab", "Omar Hassan", "Cardiology CE Supervisor"],
    ["North Coast ENT & Allergy", "Dr. Avery Cole", "Managing Partner"],
    ["Palm Desert Ambulatory Surgery Center", "Jordan Malik", "Facilities Director"],
    ["USC Keck Dept of Otolaryngology", "Dr. Nina Park", "Department Administrator"],
    ["VA Palo Alto — Audiology Service", "Leslie Tran", "Chief Audiologist"],
    ["Sutter Roseville — Clinical Engineering", "Greg Yoshida", "CE Manager"],
    ["Children's Hospital Oakland — NICU", "Morgan Ellis", "NICU Equipment Coordinator"],
    ["Solano Diagnostic Radiology", "Paul Neumann", "Radiology Operations"],
    ["Napa Valley Surgery Center", "Hailey Stone", "Materials Management"],
    ["UCSF Hearing & Balance Center", "Dr. Priya Raman", "Lead Audiologist"],
    ["Providence Santa Rosa — Clinical Engineering", "Casey Wu", "Regional BMET"],
    ["Barton Memorial Hospital — Imaging QA", "Skyler Moore", "Imaging Physics Liaison"],
    ["Torrance Memorial — Sleep Lab", "Dr. Devon Ellis", "Medical Director"],
    ["Desert Regional Medical Center — SPD", "Frank Ibarra", "SPD Supervisor"],
    ["Hoag Orthopedic Institute — Surgery", "Riley Santos", "Service Line Administrator"],
    ["St. Joseph Heritage — Infusion", "Ana Duarte", "Infusion Clinical Manager"],
    ["Coast Community College — Biotech Lab", "Jan Kowalski", "Lab Manager"],
    ["Loma Linda University Medical Center — Audiology Research", "Dr. Helena Moss", "Research Coordinator"],
    ["Bay Imaging Partners LLC", "Vik Mehta", "Operations"],
    ["Central Coast Ambulatory Surgery", "Brooke Chen", "Administrator"],
    ["Redwood Audiology Associates", "Dr. Noah Pierce", "Owner"],
    ["Golden State Pathology Labs", "Imani Wright", "Lab Director"],
    ["Pacific Hearing Services", "Denise Lowe", "Office Manager"],
    ["Mission Neuroscience Institute — EEG Lab", "Sydney Park", "Neurodiagnostics Lead"],
    ["Sacramento State Audiology Clinic", "Prof. Kim Alvarez", "Clinic Director"],
    ["Community Regional Medical Center — Facilities RFP", "Hardeep Singh", "VP Facilities"],
    ["Elite Surgical Suites — Ownership Office", "Mel Carter", "CEO"],
    ["Western University COMP — Simulation Center", "Dr. Rosa Mendez", "Simulation Director"],
  ]
  const sources = [
    "Website form",
    "Trade show — AAMI",
    "Customer referral",
    "Cold outreach — LinkedIn",
    "Purchasing cooperative RFP",
    "Manufacturer lead share",
    "Hospital system bundled RFP",
    "Audiology society networking",
    "Email campaign — Q1 outreach",
    "Partner referral — OEM",
  ]
  const rows = []
  for (let i = 0; i < TARGET_PROSPECTS; i++) {
    const [company, contact, role] = companies[i]
    const st = stages[i]
    const src = sources[i % sources.length]
    const estUsd =
      st === "won" || st === "proposal_sent"
        ? 120 + (i % 9) * 45
        : st === "lost"
          ? 35 + (i % 5) * 12
          : 18 + (i % 11) * 8
    const highValue = i === 12 || i === 21 || i === 33
    const estCents = (highValue ? estUsd * 4 : estUsd) * 100 * 100
    const overdue = i % 7 === 0 || i === 4 || i === 19
    const fuDays = overdue ? -(3 + (i % 5)) : 2 + (i % 18)
    const nextFu = new Date(now.getTime() + fuDays * 86400000)
    const lastDays = 1 + (i % 20)
    const lastAt = new Date(now.getTime() - lastDays * 86400000)
    const assignIdx = i % 8
    const nextOwnerIdx = i % 11 === 0 ? (assignIdx + 3) % 8 : assignIdx
    rows.push({
      company_name: company,
      contact_name: contact,
      contact_email: leadEmail(i + 1),
      contact_phone: `(559) 555-${String(1900 + i).slice(-4)}`,
      lead_source: src,
      status: st,
      notes: `${role} — ${["Hospital campus", "Outpatient clinic", "ENT practice", "ASC", "University lab", "Diagnostic center", "Surgery center"][i % 7]}; PBS marketing pipeline seed.`,
      estimated_value_cents: estCents,
      next_follow_up_at: nextFu.toISOString(),
      last_contacted_at: lastAt.toISOString(),
      assigned_idx: assignIdx,
      next_owner_idx: nextOwnerIdx,
    })
  }
  return rows
}

const PBS_VENDOR_SEED = [
  {
    name: "STERIS Instrument Management Services",
    email: `steris.orders@steris.${SEED_VENDOR_EMAIL_DOMAIN}`,
    phone: "(440) 555-0101",
    contact_name: "West Region Parts Desk",
    notes: "[Category: Sterilization OEM] Preferred SPD consumables & chamber components. Net 30.",
    preferred: true,
  },
  {
    name: "Philips Healthcare Parts & Service",
    email: `parts.west@philips.${SEED_VENDOR_EMAIL_DOMAIN}`,
    phone: "(978) 555-0140",
    contact_name: "Capital Parts Queue",
    notes: "[Category: Medical equipment manufacturer] Preferred monitoring & imaging spares.",
    preferred: true,
  },
  {
    name: "Fluke Biomedical",
    email: `orders@flukebiomed.${SEED_VENDOR_EMAIL_DOMAIN}`,
    phone: "(425) 555-0166",
    contact_name: "Calibration Sales",
    notes: "[Category: Calibration supplies] Electrical safety analyzers, test leads, references.",
    preferred: true,
  },
  {
    name: "Tektronix Healthcare Service Solutions",
    email: `svc.store@tek.${SEED_VENDOR_EMAIL_DOMAIN}`,
    phone: "(503) 555-0182",
    contact_name: "Bench Calibration Desk",
    notes: "[Category: Electronics / test equipment] Oscilloscope probes & compliance accessories.",
    preferred: true,
  },
  {
    name: "Henry Schein Medical — Capital Parts",
    email: `capital.parts@schein.${SEED_VENDOR_EMAIL_DOMAIN}`,
    phone: "(800) 555-0129",
    contact_name: "National Accounts",
    notes: "[Category: Parts distributor] Non-preferred for cables — longer lead times on imaging harnesses.",
    preferred: false,
  },
  {
    name: "Concordance Healthcare Solutions",
    email: `biomed.ops@concordance.${SEED_VENDOR_EMAIL_DOMAIN}`,
    phone: "(314) 555-0137",
    contact_name: "West Distribution Center",
    notes: "[Category: Parts distributor] Disposable SPD peel packs & chemical indicators.",
    preferred: true,
  },
  {
    name: "Digi-Key Electronics",
    email: `biomed.bulk@digikey.${SEED_VENDOR_EMAIL_DOMAIN}`,
    phone: "(218) 555-0199",
    contact_name: "Corporate Accounts",
    notes: "[Category: Electronics supplier] Connectors, ferrites, bench consumables.",
    preferred: true,
  },
  {
    name: "Cole-Parmer — Clinical Lab Supply",
    email: `clinical.orders@coleparmer.${SEED_VENDOR_EMAIL_DOMAIN}`,
    phone: "(800) 555-0170",
    contact_name: "Fluidics & Tubing",
    notes: "[Category: Tubing / filtration] Peristaltic pump tubing, filters, barbed fittings.",
    preferred: true,
  },
  {
    name: "FedEx Healthcare Priority",
    email: `acct.exec@fedexhc.${SEED_VENDOR_EMAIL_DOMAIN}`,
    phone: "(901) 555-0144",
    contact_name: "Cold Chain Specialist",
    notes: "[Category: Shipping / logistics] Time-definite returns & probe shipments.",
    preferred: true,
  },
  {
    name: "UPS Healthcare Logistics",
    email: `clinical.ops@upshealth.${SEED_VENDOR_EMAIL_DOMAIN}`,
    phone: "(404) 555-0118",
    contact_name: "West Clinical Desk",
    notes: "[Category: Shipping / logistics] Van stock replenishment & depot routing.",
    preferred: false,
  },
  {
    name: "West Coast Biomed Parts Exchange",
    email: `desk@wcbpx.${SEED_VENDOR_EMAIL_DOMAIN}`,
    phone: "(510) 555-0160",
    contact_name: "Exchange Coordinator",
    notes: "[Category: Specialty repair / depot] Legacy ultrasound boards & power supplies.",
    preferred: true,
  },
  {
    name: "Master Repair Solutions Inc.",
    email: `intake@mrsrepair.${SEED_VENDOR_EMAIL_DOMAIN}`,
    phone: "(714) 555-0155",
    contact_name: "Advanced Imaging Repair",
    notes: "[Category: Specialty repair supplier] DR detectors & portable X-ray boards.",
    preferred: true,
  },
  {
    name: "Maico / Natus Hearing Diagnostics",
    email: `na.spares@maico.${SEED_VENDOR_EMAIL_DOMAIN}`,
    phone: "(847) 555-0181",
    contact_name: "Audiology OEM Parts",
    notes: "[Category: Audiology equipment manufacturer] Audiometer inserts, calibration couplers.",
    preferred: true,
  },
  {
    name: "GE HealthCare Service Shop — Consumables",
    email: `consumables.west@gehc.${SEED_VENDOR_EMAIL_DOMAIN}`,
    phone: "(414) 555-0191",
    contact_name: "Consumables Queue",
    notes: "[Category: Medical equipment manufacturer] Imaging QA phantoms & printer supplies.",
    preferred: true,
  },
]

/** Each entry: part_number suffix, name, category, item_type, manufacturer, vendor_idx (into inserted vendors), cost_dollars */
const PBS_CATALOG_SEED = [
  ["CAL-SVA-10", "Electrical safety analyzer verification adapter kit", "Calibration", "accessory", "Fluke Biomedical", 2, 245],
  ["FLK-TL175", "IEC 60601 test lead set — guarded probes", "Field service consumables", "part", "Fluke Biomedical", 2, 189],
  ["PHL-MX-SPO2", "SpO₂ finger sensor — reusable adult", "Patient monitoring", "part", "Philips", 1, 312],
  ["PHL-NBP-HOSE", "NIBP hose & cuff interface kit", "Patient monitoring", "accessory", "Philips", 1, 118],
  ["GE-MAC-LEAD", "12-lead patient cable — MAC series", "Diagnostics / cardiology", "part", "GE HealthCare", 13, 428],
  ["SIEM-US-CBL", "Ultrasound probe extension cable — shielded", "Imaging", "part", "Siemens Healthineers", 5, 265],
  ["ZEB-ZT410-RBN", "Thermal transfer ribbon — cycle documentation printer", "SPD / sterilization", "accessory", "Zebra", 6, 54],
  ["MPR-PAPER-80", "Sterilizer cycle printer paper — 80mm rolls (case)", "SPD / sterilization", "part", "STERIS", 0, 72],
  ["ZOLL-XBAT-PACK", "Defibrillator battery pack — OEM compatible", "Emergency care", "part", "ZOLL", 5, 338],
  ["BD-ALRIS-BATT", "Infusion module battery — OEM", "Infusion", "part", "BD", 5, 156],
  ["MIND-FLU-O2", "Ventilator / anesthesia O₂ sensor cell", "Anesthesia / ventilation", "part", "Mindray", 5, 198],
  ["GET-DOOR-GSK", "Autoclave door gasket kit — HSG series", "SPD / sterilization", "part", "Getinge", 0, 412],
  ["SPI-FLT-H13", "Sterilizer intake HEPA filter element", "SPD / sterilization", "part", "STERIS", 0, 289],
  ["DK-BNC-KIT", "Shielded BNC & SMB connector repair kit", "Bench repair", "part", "Digi-Key", 6, 67],
  ["CP-TUBE-SIL", "Peristaltic pump silicone tubing — 15 ft roll", "Laboratory / fluids", "part", "Cole-Parmer", 7, 44],
  ["MAICO-EAR-35", "Audiometer insert earphones — screening pair", "Audiology", "part", "Maico", 12, 210],
  ["TYMP-TIP-KIT", "Disposable tympanometry probe tip kit (96 ct)", "Audiology", "accessory", "Maico", 12, 96],
  ["PHANT-CIRS", "CT QA phantom — routine constancy checks", "Imaging QA", "accessory", "GE HealthCare", 13, 4200],
  ["FLUKE-IMP-450", "Impulse / defib tester calibration module", "Calibration", "part", "Fluke Biomedical", 2, 890],
  ["LOAN-MX450", "Loaner pool — Philips MX450 transport monitor", "Loaner pool", "rental", "Philips", 1, 0],
  ["LOAN-MA42", "Loaner pool — Maico MA 42 screening audiometer", "Loaner pool", "rental", "Maico", 12, 0],
  ["PROBE-CVX-LEN", "Convex ultrasound probe lens assembly — refurbished", "Imaging repair", "part", "West Coast Biomed Parts Exchange", 10, 1450],
  ["BOARD-DR-DET", "Portable DR detector interface board — depot exchange", "Imaging repair", "part", "Master Repair Solutions", 11, 2800],
  ["KIT-SEP-BASIC", "Annual SEP documentation bundle — labels & forms", "Compliance", "service", "Precision Biomedical Services", 2, 350],
  ["CUFF-NBP-PED", "Pediatric NIBP cuff assortment kit", "Patient monitoring", "accessory", "Philips", 1, 155],
  ["LABEL-ZT230", "Direct thermal label roll — equipment asset tags", "Operations", "accessory", "Zebra", 6, 38],
  ["FILTER-AIR-SPD", "Sterilizer exhaust composite filter", "SPD / sterilization", "part", "STERIS", 0, 175],
  ["CASE-PELICAN-MED", "Pelican-style transport case — loaner monitor shipping", "Operations", "accessory", "FedEx Healthcare Priority", 8, 210],
]

if (PBS_VENDOR_SEED.length !== TARGET_VENDOR_ROWS) {
  throw new Error(`Precision seed: PBS_VENDOR_SEED length ${PBS_VENDOR_SEED.length} !== ${TARGET_VENDOR_ROWS}`)
}
if (PBS_CATALOG_SEED.length !== TARGET_CATALOG_ITEMS) {
  throw new Error(`Precision seed: PBS_CATALOG_SEED length ${PBS_CATALOG_SEED.length} !== ${TARGET_CATALOG_ITEMS}`)
}

/**
 * Prospects, vendors, catalog/stock, communications — service-role Supabase client only.
 */
async function seedPrecisionExtendedRelations(supabase, {
  orgId,
  ownerId,
  techUserIds,
  customerIds,
  seededWorkOrders,
  now,
}) {
  const prospectRows = buildProspectSeedRows(now)
  const prospectPayload = prospectRows.map((p) => {
    const aid = techUserIds[p.assigned_idx % techUserIds.length]
    const lid = techUserIds[p.next_owner_idx % techUserIds.length]
    return {
      organization_id: orgId,
      company_name: p.company_name,
      contact_name: p.contact_name,
      contact_email: p.contact_email,
      contact_phone: p.contact_phone,
      lead_source: p.lead_source,
      status: p.status,
      next_follow_up_at: p.next_follow_up_at,
      last_contacted_at: p.last_contacted_at,
      estimated_value_cents: p.estimated_value_cents,
      notes: p.notes,
      assigned_to_user_id: aid,
      last_contacted_by_user_id: aid,
      next_action_owner_user_id: lid,
      created_by: ownerId,
    }
  })
  const insProspects = await supabase.from("prospects").insert(prospectPayload).select("id")
  throwOnError(insProspects, "insert prospects")
  const prospectIds = (insProspects.data ?? []).map((r) => r.id)

  const vendorPayload = PBS_VENDOR_SEED.map((v) => ({
    organization_id: orgId,
    name: v.name,
    email: v.email,
    phone: v.phone,
    contact_name: v.contact_name,
    billing_address: "500 Distribution Pkwy, Sacramento CA 95828",
    shipping_address: "500 Distribution Pkwy, Sacramento CA 95828",
    notes: v.notes,
    is_sample: true,
  }))
  const insVendors = await supabase.from("org_vendors").insert(vendorPayload).select("id")
  throwOnError(insVendors, "insert org_vendors")
  const vendorIds = (insVendors.data ?? []).map((r) => r.id)

  const catalogPayload = []
  for (let i = 0; i < PBS_CATALOG_SEED.length; i++) {
    const [pn, name, cat, itype, mfr, vIdx, cost] = PBS_CATALOG_SEED[i]
    const sku = `${SEED_SKU_PREFIX}${String(i + 1).padStart(3, "0")}`
    const vid = vendorIds[vIdx % vendorIds.length]
    const listPrice = cost > 0 ? Math.round(cost * 1.22 * 100) / 100 : 395
    const salePrice = cost > 0 ? Math.round(cost * 1.12 * 100) / 100 : 350
    catalogPayload.push({
      organization_id: orgId,
      vendor_id: vid,
      manufacturer_name: mfr,
      category: cat,
      item_type: itype,
      part_number: pn,
      sku,
      name,
      description: "Precision Biomedical marketing inventory seed.",
      cost: cost > 0 ? cost : null,
      list_price: listPrice,
      sale_price: salePrice,
      unit: "ea",
      status: "active",
      source_type: "manual",
      notes:
        itype === "rental"
          ? "Loaner asset — coordinate with dispatch."
          : "Stocked for demo replenishment scenarios.",
      is_sample: true,
    })
  }
  const insCatalog = await supabase.from("catalog_items").insert(catalogPayload).select("id")
  throwOnError(insCatalog, "insert catalog_items")
  const catalogIds = (insCatalog.data ?? []).map((r) => r.id)

  const locPayload = [
    {
      organization_id: orgId,
      name: "Fresno Central Parts — PBS",
      code: "PBS-SEED-WH1",
      location_type: "warehouse",
      is_active: true,
      notes: "Marketing seed — main biomedical storeroom.",
    },
    {
      organization_id: orgId,
      name: "Van 04 — Central Valley",
      code: "PBS-SEED-VAN04",
      location_type: "vehicle",
      is_active: true,
      notes: "Marketing seed — primary route stock.",
    },
    {
      organization_id: orgId,
      name: "Van 07 — Bay / Peninsula",
      code: "PBS-SEED-VAN07",
      location_type: "vehicle",
      is_active: true,
      notes: "Marketing seed — audiology & imaging heavy route.",
    },
  ]
  const insLoc = await supabase.from("inventory_locations").insert(locPayload).select("id, code")
  throwOnError(insLoc, "insert inventory_locations")
  const locByCode = Object.fromEntries((insLoc.data ?? []).map((r) => [r.code, r.id]))
  const locWh = locByCode["PBS-SEED-WH1"]
  const locVan1 = locByCode["PBS-SEED-VAN04"]
  const locVan2 = locByCode["PBS-SEED-VAN07"]

  const stockScenario = (idx) => {
    if (idx % 11 === 0) return { oh: 0, rp: 6 }
    if (idx % 9 === 0) return { oh: 2, rp: 10 }
    if (idx % 7 === 0) return { oh: 14, rp: 12 }
    return { oh: 42 + (idx % 18), rp: 10 + (idx % 6) }
  }

  const stockRows = []
  for (let i = 0; i < catalogIds.length; i++) {
    const cid = catalogIds[i]
    const sc = stockScenario(i)
    const loc = i % 5 === 0 ? locVan2 : i % 3 === 0 ? locVan1 : locWh
    const wantAlloc = i % 17 === 0 ? 1 : 0
    stockRows.push({
      organization_id: orgId,
      catalog_item_id: cid,
      location_id: loc,
      quantity_on_hand: sc.oh,
      quantity_allocated: Math.min(wantAlloc, sc.oh),
      reorder_point: sc.rp,
      reorder_quantity: sc.rp >= 10 ? sc.rp : 12,
    })
  }
  const insStock = await supabase.from("inventory_stock").insert(stockRows)
  throwOnError(insStock, "insert inventory_stock")

  const completedWos = seededWorkOrders.filter((w) => w.status === "completed" || w.status === "invoiced")
  const openWos = seededWorkOrders.filter((w) => ["open", "scheduled", "in_progress"].includes(w.status))

  const hoursAgo = (h) => new Date(now.getTime() - h * 3600000).toISOString()

  const commRows = []
  let commIdx = 0

  const pushComm = (row) => {
    commIdx += 1
    commRows.push({
      organization_id: orgId,
      channel: row.channel,
      direction: row.direction,
      event_type: row.event_type,
      title: row.title,
      summary: row.summary,
      body: row.body,
      audience: row.audience,
      counts_toward_unread: row.counts_unread,
      delivery_status: row.delivery_status,
      recipient_kind: row.recipient_kind,
      recipient_customer_id: row.recipient_customer_id,
      recipient_address: row.recipient_address,
      related_entity_type: row.related_entity_type,
      related_entity_id: row.related_entity_id,
      provider: "manual",
      metadata: { pbs_demo_seed: true, ...(row.meta_extra ?? {}) },
      scheduled_at: row.scheduled_at,
      sent_at: row.sent_at,
      created_at: row.created_at,
      created_by: ownerId,
    })
  }

  for (let i = 0; i < Math.min(12, prospectIds.length); i++) {
    const pid = prospectIds[i]
    pushComm({
      channel: "email",
      direction: "outbound",
      event_type: "follow_up",
      title: `Follow-up: ${prospectRows[i].company_name}`.slice(0, 200),
      summary: "Queued recap of SEP capabilities & onboarding timeline.",
      body: `Hi ${prospectRows[i].contact_name.split(" ").slice(-2).join(" ")},\n\nFollowing up on biomedical coverage options for your department. Can we schedule a 20-minute facilities intro next week?\n\n— Precision Biomedical Dispatch`,
      audience: i % 3 === 0 ? "both" : "organization",
      counts_unread: i % 4 === 0,
      delivery_status: i % 5 === 0 ? "pending" : "sent",
      recipient_kind: "external",
      recipient_customer_id: null,
      recipient_address: prospectRows[i].contact_email,
      related_entity_type: "prospect",
      related_entity_id: pid,
      scheduled_at: null,
      sent_at: i % 5 === 0 ? null : hoursAgo(30 + i * 3),
      created_at: hoursAgo(31 + i * 3),
      meta_extra: { seed_index: commIdx },
    })
  }

  for (let i = 0; i < 6; i++) {
    pushComm({
      channel: "sms",
      direction: "inbound",
      event_type: "missed_call_note",
      title: `Missed call — BMET callback (${i + 1})`,
      summary: "Voicemail: infusion library question — returned during business hours.",
      body: `Caller left VM regarding pump fleet tagging; dispatch paged on-call tech.`,
      audience: "organization",
      counts_unread: true,
      delivery_status: "delivered",
      recipient_kind: "none",
      recipient_customer_id: null,
      recipient_address: null,
      related_entity_type: null,
      related_entity_id: null,
      scheduled_at: null,
      sent_at: hoursAgo(6 + i * 5),
      created_at: hoursAgo(6 + i * 5),
    })
  }

  for (let i = 0; i < Math.min(5, customerIds.length); i++) {
    const c = customerIds[i]
    pushComm({
      channel: "email",
      direction: "outbound",
      event_type: "customer_update_draft",
      title: `Draft customer update — ${c.company}`,
      summary: "Draft for approval — quarterly PM schedule shift.",
      body: `Team — draft note for ${c.company}: proposing consolidated SEP visits on Tuesdays starting next month.`,
      audience: "customer_timeline",
      counts_unread: false,
      delivery_status: "pending",
      recipient_kind: "customer",
      recipient_customer_id: c.id,
      recipient_address: null,
      related_entity_type: "customer",
      related_entity_id: c.id,
      scheduled_at: hoursAgo(2),
      sent_at: null,
      created_at: hoursAgo(2),
    })
  }

  for (let i = 0; i < Math.min(5, openWos.length); i++) {
    const wo = openWos[i]
    pushComm({
      channel: "sms",
      direction: "outbound",
      event_type: "appointment_confirmation",
      title: `Appointment confirmation — ${wo.title}`.slice(0, 200),
      summary: "Technician ETA window & parking instructions sent.",
      body: `Your biomedical visit is confirmed. Reply HELP for scheduling.`,
      audience: "both",
      counts_unread: false,
      delivery_status: "sent",
      recipient_kind: "customer",
      recipient_customer_id: wo.customer_id,
      recipient_address: null,
      related_entity_type: "work_order",
      related_entity_id: wo.id,
      scheduled_at: null,
      sent_at: hoursAgo(18 + i * 4),
      created_at: hoursAgo(19 + i * 4),
    })
  }

  for (let i = 0; i < Math.min(5, completedWos.length); i++) {
    const wo = completedWos[i]
    pushComm({
      channel: "email",
      direction: "outbound",
      event_type: "service_completion",
      title: `Service documentation uploaded — ${wo.title}`.slice(0, 200),
      summary: "CMMS packet & badge-close confirmation emailed to CE inbox.",
      body: `Work completed; drift checks within tolerance. Reports attached per IFU.`,
      audience: "customer_timeline",
      counts_unread: false,
      delivery_status: "delivered",
      recipient_kind: "customer",
      recipient_customer_id: wo.customer_id,
      recipient_address: null,
      related_entity_type: "work_order",
      related_entity_id: wo.id,
      scheduled_at: null,
      sent_at: hoursAgo(40 + i * 6),
      created_at: hoursAgo(41 + i * 6),
    })
  }

  for (let i = 0; i < Math.min(5, prospectIds.length - 12); i++) {
    const idx = 12 + i
    const pid = prospectIds[idx]
    pushComm({
      channel: "in_app",
      direction: "outbound",
      event_type: "quote_follow_up",
      title: `Quote follow-up — ${prospectRows[idx].company_name}`.slice(0, 200),
      summary: "Ask on revision window & volume assumptions.",
      body: `Internal playbook: confirm indemnification clause & SLA metrics before resending proposal.`,
      audience: "organization",
      counts_unread: i % 2 === 0,
      delivery_status: "sent",
      recipient_kind: "none",
      recipient_customer_id: null,
      recipient_address: null,
      related_entity_type: "prospect",
      related_entity_id: pid,
      scheduled_at: null,
      sent_at: hoursAgo(12 + i),
      created_at: hoursAgo(12 + i),
    })
  }

  for (let i = 0; i < 4; i++) {
    pushComm({
      channel: "in_app",
      direction: "outbound",
      event_type: "internal_note",
      title: `Dispatch stand-up note ${i + 1}`,
      summary: "Loaner monitor swap prioritized for cath lab contractor window.",
      body: `Operations: prioritize PBS-SEED loaner pool checkout before Thursday freeze.`,
      audience: "organization",
      counts_unread: true,
      delivery_status: "sent",
      recipient_kind: "none",
      recipient_customer_id: null,
      recipient_address: null,
      related_entity_type: "organization",
      related_entity_id: orgId,
      scheduled_at: null,
      sent_at: hoursAgo(3 + i * 2),
      created_at: hoursAgo(3 + i * 2),
    })
  }

  if (commIdx !== TARGET_COMM_EVENTS) {
    throw new Error(`Precision seed: expected ${TARGET_COMM_EVENTS} communications, built ${commIdx}`)
  }

  const insComm = await supabase.from("communication_events").insert(commRows)
  throwOnError(insComm, "insert communication_events")
}

/** Public app paths (Next.js `public/`) — must match `lib/mock-data` demo headshots. */
function precisionDemoTechAvatarPath(index) {
  return `/demo-techs/technician-${String(index + 1).padStart(2, "0")}.png`
}

/**
 * Set profiles.avatar_url for each seeded demo technician (idempotent).
 * Call on every script run so avatars stay in sync even when tenant data seed is skipped.
 */
/**
 * Set profiles.avatar_url for each seeded demo technician (idempotent).
 */
async function syncPrecisionDemoTechnicianAvatars(supabase) {
  for (let i = 0; i < TECH_SEED.length; i++) {
    const t = TECH_SEED[i]
    const url = precisionDemoTechAvatarPath(i)
    const uid = await authUserIdByEmail(supabase, t.email)
    if (!uid) continue
    const up = await supabase.from("profiles").update({ avatar_url: url, updated_at: new Date().toISOString() }).eq("id", uid)
    throwOnError(up, `profile avatar ${t.email}`)
  }
}

async function ensureTechUsers(supabase) {
  const ids = []
  const password = "PrecisionSeed2026!"
  for (const t of TECH_SEED) {
    let uid = await authUserIdByEmail(supabase, t.email)
    if (uid) {
      ids.push(uid)
      continue
    }
    const { data, error } = await supabase.auth.admin.createUser({
      email: t.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: t.name },
    })
    if (error) throw new Error(`Auth createUser failed for ${t.email}: ${error.message}`)
    ids.push(data.user.id)
  }
  return ids
}

async function clearPrecisionTenantDataSupabase(supabase, orgId) {
  const catRes = await supabase
    .from("catalog_items")
    .select("id")
    .eq("organization_id", orgId)
    .like("sku", `${SEED_SKU_PREFIX}%`)
  throwOnError(catRes, "select catalog_items for clear")
  const catIds = (catRes.data ?? []).map((r) => r.id)
  for (const chunk of chunkArray(catIds, 80)) {
    const d1 = await supabase.from("inventory_transactions").delete().eq("organization_id", orgId).in("catalog_item_id", chunk)
    throwOnError(d1, "delete inventory_transactions")
    const d2 = await supabase.from("inventory_stock").delete().eq("organization_id", orgId).in("catalog_item_id", chunk)
    throwOnError(d2, "delete inventory_stock")
  }

  const locRes = await supabase
    .from("inventory_locations")
    .select("id")
    .eq("organization_id", orgId)
    .like("code", "PBS-SEED-%")
  throwOnError(locRes, "select inventory_locations")
  const locIds = (locRes.data ?? []).map((r) => r.id)
  for (const chunk of chunkArray(locIds, 80)) {
    const d = await supabase.from("technician_vehicle_stock").delete().eq("organization_id", orgId).in("inventory_location_id", chunk)
    throwOnError(d, "delete technician_vehicle_stock")
  }

  const dl = await supabase.from("inventory_locations").delete().eq("organization_id", orgId).like("code", "PBS-SEED-%")
  throwOnError(dl, "delete inventory_locations")

  const dc = await supabase.from("catalog_items").delete().eq("organization_id", orgId).like("sku", `${SEED_SKU_PREFIX}%`)
  throwOnError(dc, "delete catalog_items")

  // Hostnames are `*.pbs-vendor.seed` — match suffix, not only `@pbs-vendor.seed`.
  const dv = await supabase.from("org_vendors").delete().eq("organization_id", orgId).like("email", `%${SEED_VENDOR_EMAIL_DOMAIN}`)
  throwOnError(dv, "delete org_vendors")

  const dce = await supabase
    .from("communication_events")
    .delete()
    .eq("organization_id", orgId)
    .contains("metadata", { pbs_demo_seed: true })
  throwOnError(dce, "delete communication_events")

  const dp = await supabase.from("prospects").delete().eq("organization_id", orgId).like("contact_email", `%@${SEED_LEAD_EMAIL_DOMAIN}`)
  throwOnError(dp, "delete prospects")

  const tablesTail = ["org_invoices", "org_quotes", "work_orders", "maintenance_plans", "equipment", "customer_contacts", "customer_locations", "customers"]
  for (const t of tablesTail) {
    const r = await supabase.from(t).delete().eq("organization_id", orgId)
    throwOnError(r, `delete ${t}`)
  }
}

async function fetchSeedFingerprint(supabase, orgId) {
  const custLike = `${SEED_CUST_PREFIX}%`
  const eqLike = `${SEED_EQ_PREFIX}%`
  const qtLike = `${SEED_QUOTE_KEY_PREFIX}%`
  const invLike = `${SEED_INV_KEY_PREFIX}%`

  const q = (table, filters) => {
    let qb = supabase.from(table).select("*", { count: "exact", head: true }).eq("organization_id", orgId)
    for (const f of filters) {
      if (f.op === "like") qb = qb.like(f.col, f.val)
      if (f.op === "contains") qb = qb.contains(f.col, f.val)
    }
    return qb
  }

  const run = async (label, promise) => {
    const r = await promise
    throwOnError(r, `fingerprint ${label}`)
    return r.count ?? 0
  }

  const seed_customers = await run(
    "customers",
    q("customers", [{ op: "like", col: "external_code", val: custLike }]),
  )
  const seed_equipment = await run("equipment", q("equipment", [{ op: "like", col: "equipment_code", val: eqLike }]))
  const wo_total = await run("work_orders", q("work_orders", []))
  const plan_total = await run("maintenance_plans", q("maintenance_plans", []))
  const quote_total = await run("org_quotes", q("org_quotes", [{ op: "like", col: "seed_key", val: qtLike }]))
  const invoice_total = await run("org_invoices", q("org_invoices", [{ op: "like", col: "seed_key", val: invLike }]))
  const seed_prospects = await run(
    "prospects",
    q("prospects", [{ op: "like", col: "contact_email", val: `%@${SEED_LEAD_EMAIL_DOMAIN}` }]),
  )
  const seed_catalog = await run("catalog_items", q("catalog_items", [{ op: "like", col: "sku", val: `${SEED_SKU_PREFIX}%` }]))
  const seed_vendors = await run(
    "org_vendors",
    q("org_vendors", [{ op: "like", col: "email", val: `%${SEED_VENDOR_EMAIL_DOMAIN}` }]),
  )
  const seed_comm = await run(
    "communication_events",
    q("communication_events", [{ op: "contains", col: "metadata", val: { pbs_demo_seed: true } }]),
  )

  return {
    seed_customers,
    seed_equipment,
    wo_total,
    plan_total,
    quote_total,
    invoice_total,
    seed_prospects,
    seed_catalog,
    seed_vendors,
    seed_comm,
  }
}

async function seedPrecisionMarketingTenant(supabase, { orgId, ownerId, techUserIds, now }) {
  await clearPrecisionTenantDataSupabase(supabase, orgId)

  const memberRows = techUserIds.map((uid) => ({
    organization_id: orgId,
    user_id: uid,
    role: "tech",
    status: "active",
    invited_by: ownerId,
  }))
  for (const row of memberRows) {
    const insMem = await supabase.from("organization_members").insert(row)
    if (insMem.error && !isUniqueViolation(insMem.error)) throwOnError(insMem, "organization_members tech")
  }

  const mb = utcMonthBounds(now)

  const custPayload = CUSTOMERS.map((c, i) => ({
    organization_id: orgId,
    external_code: `${SEED_CUST_PREFIX}${String(i + 1).padStart(2, "0")}`,
    company_name: c.company,
    status: "active",
    joined_at: utcDateParts(2024, 5, 1),
    created_by: ownerId,
  }))
  const insCust = await supabase.from("customers").insert(custPayload).select("id")
  throwOnError(insCust, "insert customers")
  const customerIds = CUSTOMERS.map((c, i) => ({
    id: insCust.data[i].id,
    ...c,
  }))

  const locPayload = customerIds.map((row) => ({
    organization_id: orgId,
    customer_id: row.id,
    name: "Primary campus",
    address_line1: row.line1,
    city: row.city,
    state: row.state,
    postal_code: row.zip,
    is_default: true,
  }))
  const insLoc = await supabase.from("customer_locations").insert(locPayload)
  throwOnError(insLoc, "insert customer_locations")

  const contactPayload = customerIds.map((row, idx) => {
    const contactName = row.company.includes("Dental") ? "Dr. Morgan Ellis" : "Clinical Engineering Manager"
    const emailLocal = `ce-${row.id.replace(/-/g, "")}`.slice(0, 48)
    return {
      organization_id: orgId,
      customer_id: row.id,
      full_name: contactName,
      role: "Clinical Engineering",
      email: `${emailLocal}@pbs-demo.local`,
      phone: `(209) 555-${String(2000 + idx + 1).slice(-4)}`,
      is_primary: true,
    }
  })
  const insContact = await supabase.from("customer_contacts").insert(contactPayload)
  throwOnError(insContact, "insert customer_contacts")

  const equipmentPayload = []
  for (let i = 0; i < TARGET_EQUIPMENT; i++) {
    const cust = customerIds[i % customerIds.length]
    const tpl = EQUIPMENT_TEMPLATES[i % EQUIPMENT_TEMPLATES.length]
    const code = `PBS-SEED-${String(i + 1).padStart(5, "0")}`
    const serial = `SN-PBS-${2024 + (i % 4)}-${String(10000 + i)}`
    const installY = SEED_CAL_YEAR_MIN + (i % (SEED_CAL_YEAR_MAX - SEED_CAL_YEAR_MIN + 1))
    const install = utcDateParts(installY, i % 12, Math.min(10 + (i % 15), 28))
    let warranty
    if (i < 14) {
      warranty = isoDateAddDays(mb.today, 4 + (i % 22))
    } else {
      warranty = utcDateParts(2026 + (i % 2), (i + 5) % 12, Math.min(12 + (i % 16), 28))
    }
    const refY = Math.min(SEED_CAL_YEAR_MAX, Math.max(SEED_CAL_YEAR_MIN, now.getUTCFullYear()))
    const lastSvc = utcDateParts(refY, now.getUTCMonth(), Math.min(10, 28))
    let nextDue
    if (i < 45) {
      const dom = 1 + Math.floor((i * Math.max(1, mb.lastD - 1)) / Math.max(1, 44))
      nextDue = utcDateParts(mb.y, mb.m, Math.min(Math.max(dom, 1), mb.lastD))
    } else {
      nextDue = isoDateAddDays(mb.monthStart, -(6 + (i % 24)))
    }
    equipmentPayload.push({
      organization_id: orgId,
      customer_id: cust.id,
      equipment_code: code,
      name: tpl.model,
      manufacturer: tpl.mfr,
      category: tpl.cat,
      serial_number: serial,
      status: "active",
      install_date: install,
      warranty_expires_at: warranty,
      last_service_at: lastSvc,
      next_due_at: nextDue,
      location_label: tpl.loc,
      notes: "Biomedical asset — Precision marketing seed.",
      created_by: ownerId,
    })
  }
  const insEq = await supabase.from("equipment").insert(equipmentPayload).select("id, customer_id")
  throwOnError(insEq, "insert equipment")
  const equipmentIds = (insEq.data ?? []).map((r) => ({ id: r.id, customerId: r.customer_id }))

  const quoteStatuses = ["draft", "sent", "sent", "approved", "declined"]
  const quotePayload = Array.from({ length: TARGET_QUOTES }, (_, i) => {
    const cust = customerIds[i % customerIds.length]
    const seedKey = `${SEED_QUOTE_KEY_PREFIX}${String(i + 1).padStart(3, "0")}`
    const qn = `QT-PBS-${String(8800 + i)}`
    const title = `Quoted — ${WO_TITLES[i % WO_TITLES.length]}`.slice(0, 220)
    const amt = 420000 + (i % 50) * 12500
    return {
      organization_id: orgId,
      customer_id: cust.id,
      seed_key: seedKey,
      quote_number: qn,
      title,
      amount_cents: amt,
      status: quoteStatuses[i % quoteStatuses.length],
      created_by: ownerId,
    }
  })
  const insQt = await supabase.from("org_quotes").insert(quotePayload)
  throwOnError(insQt, "insert org_quotes")

  const invStatuses = ["paid", "paid", "paid", "overdue", "sent"]
  const invPayload = []
  for (let i = 0; i < TARGET_INVOICES; i++) {
    const eq = equipmentIds[(i * 2 + 5) % equipmentIds.length]
    const seedKey = `${SEED_INV_KEY_PREFIX}${String(i + 1).padStart(3, "0")}`
    const invNo = `INV-AR-PBS-${String(7000 + i)}`
    const title = `Service invoice — ${WO_TITLES[(i + 3) % WO_TITLES.length]}`.slice(0, 220)
    const amt = 280000 + (i % 35) * 9200
    const st = invStatuses[i % invStatuses.length]
    const monthsBack = i % 10
    const refY = Math.min(SEED_CAL_YEAR_MAX, Math.max(SEED_CAL_YEAR_MIN, now.getUTCFullYear()))
    const issued = new Date(Date.UTC(refY, now.getUTCMonth() - monthsBack, Math.min(10 + (i % 15), 28), 12, 0, 0, 0))
    const issuedStr = issued.toISOString().slice(0, 10)
    assertSeedDateOk(issuedStr, `org_invoices issued i=${i}`)
    const paidAt =
      st === "paid"
        ? (() => {
            const p = new Date(issued.getTime() + 18 * 86400000)
            const ps = p.toISOString().slice(0, 10)
            assertSeedDateOk(ps, `org_invoices paid i=${i}`)
            return ps
          })()
        : null
    invPayload.push({
      organization_id: orgId,
      customer_id: eq.customerId,
      equipment_id: eq.id,
      seed_key: seedKey,
      invoice_number: invNo,
      title,
      amount_cents: amt,
      status: st,
      issued_at: issuedStr,
      paid_at: paidAt,
      created_by: ownerId,
    })
  }
  const insInv = await supabase.from("org_invoices").insert(invPayload)
  throwOnError(insInv, "insert org_invoices")

  const units = [
    { u: "month", v: 1 },
    { u: "month", v: 3 },
    { u: "month", v: 6 },
    { u: "year", v: 1 },
  ]
  const planPayload = []
  const seededPlansMeta = []
  for (let i = 0; i < TARGET_PLANS; i++) {
    const eq = equipmentIds[(i * 3) % equipmentIds.length]
    const { u, v } = units[i % units.length]
    const dueStr = utcDateParts(2025 + (i % 3), (i * 2 + now.getUTCMonth()) % 12, Math.min(1 + (i % 22), 28))
    assertSeedDateOk(dueStr, `maintenance_plans next_due i=${i}`)
    const svc = [
      { name: "Visual inspection & safety interlocks", interval: "Per visit" },
      { name: "Functional test & documentation", interval: "Per visit" },
    ]
    const rules = [{ id: `r-${i}`, offsetDays: 14, channel: "email", target: "clinical.engineering@demo.org" }]
    const assignee = techUserIds[i % techUserIds.length]
    planPayload.push({
      organization_id: orgId,
      customer_id: eq.customerId,
      equipment_id: eq.id,
      assigned_user_id: assignee,
      name: PLAN_NAMES[i % PLAN_NAMES.length],
      status: i % 11 === 0 ? "paused" : "active",
      priority: i % 8 === 0 ? "high" : "normal",
      interval_value: v,
      interval_unit: u,
      last_service_date: utcDateParts(2025, 10, 1),
      next_due_date: dueStr,
      auto_create_work_order: i % 3 === 0,
      notes: "Preventive maintenance agreement — marketing seed.",
      services: svc,
      notification_rules: rules,
      created_by: ownerId,
    })
    seededPlansMeta.push({ customerId: eq.customerId, equipmentId: eq.id })
  }
  const insPlans = await supabase.from("maintenance_plans").insert(planPayload).select("id")
  throwOnError(insPlans, "insert maintenance_plans")
  const seededPlans = (insPlans.data ?? []).map((row, i) => ({
    id: row.id,
    customerId: seededPlansMeta[i].customerId,
    equipmentId: seededPlansMeta[i].equipmentId,
  }))

  const seededWorkOrders = []
  const priorities = ["low", "normal", "normal", "high", "critical"]
  const types = ["repair", "pm", "inspection", "install", "emergency"]
  let revenueSlotIdx = 0
  const repeatBandStart = TARGET_OPEN_WOS + TARGET_COMPLETED_WOS + TARGET_INVOICED_WOS

  for (let i = 0; i < TARGET_WORK_ORDERS; i++) {
    const repeatSlot = i - repeatBandStart
    const eq =
      i >= repeatBandStart ? equipmentIds[repeatSlot % 8] : equipmentIds[(i * 5 + 7) % equipmentIds.length]
    let st
    if (i < TARGET_OPEN_WOS) {
      const openMix = ["open", "scheduled", "in_progress"]
      st = openMix[i % 3]
    } else if (i < TARGET_OPEN_WOS + TARGET_COMPLETED_WOS) {
      st = "completed"
    } else if (i < repeatBandStart) {
      st = "invoiced"
    } else {
      st = "completed"
    }
    const pr = priorities[(i * 2) % priorities.length]
    const ty = types[i % types.length]
    const title =
      i >= repeatBandStart ? `Follow-up service — ${WO_TITLES[i % WO_TITLES.length]}` : WO_TITLES[i % WO_TITLES.length]
    const schedY = Math.min(SEED_CAL_YEAR_MAX, Math.max(SEED_CAL_YEAR_MIN, now.getUTCFullYear()))
    const sched = utcDateParts(schedY, i % 12, Math.min((i % 26) + 1, 28))
    assertSeedDateOk(sched, `work_orders scheduled_on i=${i}`)
    const assign = i % 7 === 0 ? null : techUserIds[i % techUserIds.length]
    const invIdx = i - (TARGET_OPEN_WOS + TARGET_COMPLETED_WOS)
    const inv = st === "invoiced" ? `INV-WO-PBS-${now.getFullYear()}-${String(invIdx + 1).padStart(4, "0")}` : null
    let completedAt = null
    let updatedAt
    let createdAt
    let laborCents = 12_000 + (i % 52) * 2_800 + (i % 5) * 900
    let partsCents = (i % 11) * 2_100 + (i % 4) * 450

    if (i >= repeatBandStart) {
      const hrsAgo = 8 + repeatSlot * 28
      createdAt = new Date(now.getTime() - hrsAgo * 3600000).toISOString()
      updatedAt = createdAt
      completedAt = updatedAt
      laborCents = 48_000 + (repeatSlot % 7) * 5_500
      partsCents = 11_000 + (repeatSlot % 5) * 2_800
    } else if (st === "completed" || st === "invoiced") {
      const spec = revenueSpecForDashboard(now, revenueSlotIdx++)
      updatedAt = spec.updatedAt
      laborCents = spec.laborCents
      partsCents = spec.partsCents
      completedAt = updatedAt
      createdAt = new Date(new Date(updatedAt).getTime() - 72 * 3600000).toISOString()
    } else if (i < 18) {
      createdAt = new Date(now.getTime() - i * 3_600_000).toISOString()
      updatedAt = createdAt
    } else {
      createdAt = new Date(now.getTime() - (TARGET_WORK_ORDERS - i) * 36 * 3600000).toISOString()
      updatedAt = createdAt
    }

    assertIsoTimestamptzOk(createdAt, `work_orders created_at i=${i}`)
    assertIsoTimestamptzOk(updatedAt, `work_orders updated_at i=${i}`)
    if (completedAt) assertIsoTimestamptzOk(completedAt, `work_orders completed_at i=${i}`)

    const woIns = await supabase
      .from("work_orders")
      .insert({
        organization_id: orgId,
        customer_id: eq.customerId,
        equipment_id: eq.id,
        title,
        status: st,
        priority: pr,
        type: ty,
        scheduled_on: sched,
        scheduled_time: "09:30:00",
        completed_at: completedAt,
        assigned_user_id: assign,
        invoice_number: inv,
        total_labor_cents: laborCents,
        total_parts_cents: partsCents,
        repair_log: repairLogJson(title),
        notes: "Marketing seed — Precision Biomedical Services only.",
        created_by: ownerId,
        created_at: createdAt,
        updated_at: updatedAt,
        maintenance_plan_id: null,
      })
      .select("id, customer_id, title, status")
      .single()
    throwOnError(woIns, `insert work_orders i=${i}`)
    seededWorkOrders.push({
      id: woIns.data.id,
      customer_id: woIns.data.customer_id,
      title: woIns.data.title,
      status: woIns.data.status,
    })
  }

  const monthStartTs = `${mb.monthStart}T08:00:00.000Z`
  for (let p = 0; p < TARGET_PM_PLAN_WORK_ORDERS; p++) {
    const plan = seededPlans[p % seededPlans.length]
    const eqRow = equipmentIds.find((e) => e.id === plan.equipmentId)
    if (!eqRow) throw new Error("Precision seed: plan equipment missing for PM work order")
    const createdAt = new Date(new Date(monthStartTs).getTime() + p * 3_600_000).toISOString()
    const updatedAt = createdAt
    const title = `Auto-scheduled PM — ${PLAN_NAMES[p % PLAN_NAMES.length]}`.slice(0, 200)
    assertIsoTimestamptzOk(createdAt, `pm_from_plan created p=${p}`)
    assertIsoTimestamptzOk(updatedAt, `pm_from_plan updated p=${p}`)
    const pmIns = await supabase
      .from("work_orders")
      .insert({
        organization_id: orgId,
        customer_id: plan.customerId,
        equipment_id: plan.equipmentId,
        title,
        status: "scheduled",
        priority: "normal",
        type: "pm",
        scheduled_on: mb.monthStart,
        scheduled_time: "08:00:00",
        completed_at: null,
        assigned_user_id: techUserIds[p % techUserIds.length],
        invoice_number: null,
        total_labor_cents: 88_000 + p * 4_200,
        total_parts_cents: 12_000 + (p % 5) * 1_800,
        repair_log: repairLogJson(title),
        notes: "Generated from active maintenance plan (marketing seed).",
        created_by: ownerId,
        created_at: createdAt,
        updated_at: updatedAt,
        maintenance_plan_id: plan.id,
      })
      .select("id, customer_id, title, status")
      .single()
    throwOnError(pmIns, `insert pm work_orders p=${p}`)
    seededWorkOrders.push({
      id: pmIns.data.id,
      customer_id: pmIns.data.customer_id,
      title: pmIns.data.title,
      status: pmIns.data.status,
    })
  }

  await seedPrecisionExtendedRelations(supabase, {
    orgId,
    ownerId,
    techUserIds,
    customerIds,
    seededWorkOrders,
    now,
  })
}

async function main() {
  loadDotEnvLocal()
  const ownerId = process.env.DEMO_SEED_OWNER_ID
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const orgSlug = (process.env.PRECISION_ORG_SLUG || DEFAULT_PRECISION_SLUG).trim().toLowerCase()

  if (!ownerId) {
    console.error("Set DEMO_SEED_OWNER_ID to your auth.users id (UUID).")
    process.exit(1)
  }
  if (!supabaseUrl || !serviceKey) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service role).")
    process.exit(1)
  }
  assertSafeSupabaseUrl(supabaseUrl)

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const now = new Date()

  const ownerLookup = await supabase.auth.admin.getUserById(ownerId)
  throwOnError(ownerLookup, "admin.getUserById(DEMO_SEED_OWNER_ID)")
  if (!ownerLookup.data?.user) {
    console.error("DEMO_SEED_OWNER_ID is not a valid auth user id.")
    process.exit(1)
  }

  const probe = await supabase.from("org_quotes").select("id").limit(1)
  if (probe.error) {
    console.error(
      `Cannot read org_quotes (${probe.error.message}). Apply Supabase migrations (includes 20260505190000_org_quotes_invoices.sql), then re-run.`,
    )
    process.exit(1)
  }

  await syncPrecisionDemoTechnicianAvatars(supabase)

  let orgRes = await supabase.from("organizations").select("id").eq("slug", orgSlug).maybeSingle()
  throwOnError(orgRes, "select organizations by slug")
  let orgId = orgRes.data?.id
  if (!orgId) {
    const insOrg = await supabase
      .from("organizations")
      .insert({
        name: "Precision Biomedical Services",
        slug: orgSlug,
        created_by: ownerId,
      })
      .select("id")
      .single()
    throwOnError(insOrg, "insert organizations")
    orgId = insOrg.data.id
    console.log("Created organization", orgSlug, orgId)
  }

  const insOwnerMem = await supabase.from("organization_members").insert({
    organization_id: orgId,
    user_id: ownerId,
    role: "owner",
    status: "active",
    invited_by: ownerId,
  })
  if (insOwnerMem.error && !isUniqueViolation(insOwnerMem.error)) throwOnError(insOwnerMem, "organization_members owner")

  const fp = await fetchSeedFingerprint(supabase, orgId)
  const {
    seed_customers: seedCustomers,
    seed_equipment: seedEquipment,
    wo_total: woTotal,
    plan_total: planTotal,
    quote_total: quoteTotal,
    invoice_total: invoiceTotal,
    seed_prospects: seedProspects,
    seed_catalog: seedCatalog,
    seed_vendors: seedVendors,
    seed_comm: seedComm,
  } = fp

  if (
    seedCustomers === TARGET_CUSTOMERS &&
    seedEquipment === TARGET_EQUIPMENT &&
    woTotal === TARGET_TOTAL_WORK_ORDERS &&
    planTotal === TARGET_PLANS &&
    quoteTotal === TARGET_QUOTES &&
    invoiceTotal === TARGET_INVOICES &&
    seedProspects === TARGET_PROSPECTS &&
    seedCatalog === TARGET_CATALOG_ITEMS &&
    seedVendors === TARGET_VENDOR_ROWS &&
    seedComm === TARGET_COMM_EVENTS
  ) {
    console.log(
      `Precision marketing seed already complete for slug ${orgSlug} (customers ${seedCustomers}, equipment ${seedEquipment}, WOs ${woTotal}, plans ${planTotal}, quotes ${quoteTotal}, invoices ${invoiceTotal}; prospects ${seedProspects}, catalog ${seedCatalog}, vendors ${seedVendors}, communications ${seedComm}). No changes.`,
    )
    return
  }

  console.log("Applying Precision Biomedical marketing seed…")
  const techUserIds = await ensureTechUsers(supabase)
  await syncPrecisionDemoTechnicianAvatars(supabase)

  await seedPrecisionMarketingTenant(supabase, { orgId, ownerId, techUserIds, now })

  const fpAfter = await fetchSeedFingerprint(supabase, orgId)
  console.log("Done. Precision Biomedical Services marketing seed applied.")
  console.log(`  Org slug: ${orgSlug}`)
  console.log(
    `  Customers: ${fpAfter.seed_customers}/${TARGET_CUSTOMERS}, Equipment: ${fpAfter.seed_equipment}/${TARGET_EQUIPMENT}, Work orders: ${fpAfter.wo_total}/${TARGET_TOTAL_WORK_ORDERS} (incl. ${TARGET_PM_PLAN_WORK_ORDERS} PM-from-plan), Plans: ${fpAfter.plan_total}/${TARGET_PLANS}, Quotes: ${fpAfter.quote_total}/${TARGET_QUOTES}, Invoices: ${fpAfter.invoice_total}/${TARGET_INVOICES}`,
  )
  console.log(
    `  Prospects: ${fpAfter.seed_prospects}/${TARGET_PROSPECTS}, Catalog SKUs: ${fpAfter.seed_catalog}/${TARGET_CATALOG_ITEMS}, Vendors: ${fpAfter.seed_vendors}/${TARGET_VENDOR_ROWS}, Communications: ${fpAfter.seed_comm}/${TARGET_COMM_EVENTS}`,
  )
  console.log("  Technician demo logins (password for all): PrecisionSeed2026!")
  for (const t of TECH_SEED) console.log(`    - ${t.email} (${t.name})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
