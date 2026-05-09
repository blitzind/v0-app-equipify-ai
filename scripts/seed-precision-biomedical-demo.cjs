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
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (for demo technician auth users)
 *   DATABASE_URL (default: local Supabase Postgres)
 *   Migration `20260505190000_org_quotes_invoices.sql` applied (org_quotes / org_invoices tables).
 *
 * Exact command (local Supabase example):
 *   DEMO_SEED_OWNER_ID='<your-auth-users-uuid>' SUPABASE_URL='http://127.0.0.1:54321' SUPABASE_SERVICE_ROLE_KEY='<service-role-key>' pnpm seed:demo-precision
 *
 * Optional:
 *   CONFIRM_DEMO_SEED=1  — required when DATABASE_URL host is not localhost/127.0.0.1
 *   PRECISION_ORG_SLUG=precision-biomedical-demo  — must match `organizations.slug` for the org you switch to in the app
 */

const fs = require("fs")
const path = require("path")
const postgres = require("postgres")
const { createClient } = require("@supabase/supabase-js")

const DEFAULT_PRECISION_SLUG = "precision-biomedical-demo"
const DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

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
 * Prospects, vendors, catalog/stock, communications — called inside the main seed transaction.
 */
async function seedPrecisionExtendedRelations(tx, {
  orgId,
  ownerId,
  techUserIds,
  customerIds,
  seededWorkOrders,
  now,
}) {
  const prospectRows = buildProspectSeedRows(now)
  const prospectIds = []
  for (const p of prospectRows) {
    const aid = techUserIds[p.assigned_idx % techUserIds.length]
    const lid = techUserIds[p.next_owner_idx % techUserIds.length]
    const [{ id: pid }] = await tx`
      insert into public.prospects (
        organization_id,
        company_name,
        contact_name,
        contact_email,
        contact_phone,
        lead_source,
        status,
        next_follow_up_at,
        last_contacted_at,
        estimated_value_cents,
        notes,
        assigned_to_user_id,
        last_contacted_by_user_id,
        next_action_owner_user_id,
        created_by
      )
      values (
        ${orgId},
        ${p.company_name},
        ${p.contact_name},
        ${p.contact_email}::citext,
        ${p.contact_phone},
        ${p.lead_source},
        ${p.status},
        ${p.next_follow_up_at}::timestamptz,
        ${p.last_contacted_at}::timestamptz,
        ${p.estimated_value_cents},
        ${p.notes},
        ${aid}::uuid,
        ${aid}::uuid,
        ${lid}::uuid,
        ${ownerId}::uuid
      )
      returning id
    `
    prospectIds.push(pid)
  }

  const vendorIds = []
  for (const v of PBS_VENDOR_SEED) {
    const [{ id: vid }] = await tx`
      insert into public.org_vendors (
        organization_id,
        name,
        email,
        phone,
        contact_name,
        billing_address,
        shipping_address,
        notes,
        is_sample
      )
      values (
        ${orgId},
        ${v.name},
        ${v.email},
        ${v.phone},
        ${v.contact_name},
        ${"500 Distribution Pkwy, Sacramento CA 95828"},
        ${"500 Distribution Pkwy, Sacramento CA 95828"},
        ${v.notes},
        true
      )
      returning id
    `
    vendorIds.push(vid)
  }

  const catalogIds = []
  for (let i = 0; i < PBS_CATALOG_SEED.length; i++) {
    const [pn, name, cat, itype, mfr, vIdx, cost] = PBS_CATALOG_SEED[i]
    const sku = `${SEED_SKU_PREFIX}${String(i + 1).padStart(3, "0")}`
    const vid = vendorIds[vIdx % vendorIds.length]
    const listPrice = cost > 0 ? Math.round(cost * 1.22 * 100) / 100 : 395
    const salePrice = cost > 0 ? Math.round(cost * 1.12 * 100) / 100 : 350
    const [{ id: cid }] = await tx`
      insert into public.catalog_items (
        organization_id,
        vendor_id,
        manufacturer_name,
        category,
        item_type,
        part_number,
        sku,
        name,
        description,
        cost,
        list_price,
        sale_price,
        unit,
        status,
        source_type,
        notes,
        is_sample
      )
      values (
        ${orgId},
        ${vid}::uuid,
        ${mfr},
        ${cat},
        ${itype},
        ${pn},
        ${sku},
        ${name},
        ${"Precision Biomedical marketing inventory seed."},
        ${cost > 0 ? cost : null},
        ${listPrice},
        ${salePrice},
        ${"ea"},
        ${"active"},
        ${"manual"},
        ${itype === "rental" ? "Loaner asset — coordinate with dispatch." : "Stocked for demo replenishment scenarios."},
        true
      )
      returning id
    `
    catalogIds.push(cid)
  }

  const [{ id: locWh }] = await tx`
    insert into public.inventory_locations (
      organization_id, name, code, location_type, is_active, notes
    )
    values (
      ${orgId},
      ${"Fresno Central Parts — PBS"},
      ${"PBS-SEED-WH1"},
      ${"warehouse"},
      true,
      ${"Marketing seed — main biomedical storeroom."}
    )
    returning id
  `
  const [{ id: locVan1 }] = await tx`
    insert into public.inventory_locations (
      organization_id, name, code, location_type, is_active, notes
    )
    values (
      ${orgId},
      ${"Van 04 — Central Valley"},
      ${"PBS-SEED-VAN04"},
      ${"vehicle"},
      true,
      ${"Marketing seed — primary route stock."}
    )
    returning id
  `
  const [{ id: locVan2 }] = await tx`
    insert into public.inventory_locations (
      organization_id, name, code, location_type, is_active, notes
    )
    values (
      ${orgId},
      ${"Van 07 — Bay / Peninsula"},
      ${"PBS-SEED-VAN07"},
      ${"vehicle"},
      true,
      ${"Marketing seed — audiology & imaging heavy route."}
    )
    returning id
  `

  const stockScenario = (idx) => {
    if (idx % 11 === 0) return { oh: 0, rp: 6 }
    if (idx % 9 === 0) return { oh: 2, rp: 10 }
    if (idx % 7 === 0) return { oh: 14, rp: 12 }
    return { oh: 42 + (idx % 18), rp: 10 + (idx % 6) }
  }

  for (let i = 0; i < catalogIds.length; i++) {
    const cid = catalogIds[i]
    const sc = stockScenario(i)
    const loc = i % 5 === 0 ? locVan2 : i % 3 === 0 ? locVan1 : locWh
    await tx`
      insert into public.inventory_stock (
        organization_id,
        catalog_item_id,
        location_id,
        quantity_on_hand,
        quantity_allocated,
        reorder_point,
        reorder_quantity
      )
      values (
        ${orgId},
        ${cid}::uuid,
        ${loc}::uuid,
        ${sc.oh},
        ${i % 17 === 0 ? 1 : 0},
        ${sc.rp},
        ${sc.rp >= 10 ? sc.rp : 12}
      )
    `
  }

  const metaJson = (extra) => tx.json({ pbs_demo_seed: true, ...extra })

  const completedWos = seededWorkOrders.filter((w) => w.status === "completed" || w.status === "invoiced")
  const openWos = seededWorkOrders.filter((w) => ["open", "scheduled", "in_progress"].includes(w.status))

  let commIdx = 0
  const pushComm = async (row) => {
    commIdx += 1
    await tx`
      insert into public.communication_events (
        organization_id,
        channel,
        direction,
        event_type,
        title,
        summary,
        body,
        audience,
        counts_toward_unread,
        delivery_status,
        recipient_kind,
        recipient_customer_id,
        recipient_address,
        related_entity_type,
        related_entity_id,
        provider,
        metadata,
        scheduled_at,
        sent_at,
        created_at,
        created_by
      )
      values (
        ${orgId},
        ${row.channel},
        ${row.direction},
        ${row.event_type},
        ${row.title},
        ${row.summary},
        ${row.body},
        ${row.audience},
        ${row.counts_unread},
        ${row.delivery_status},
        ${row.recipient_kind},
        ${row.recipient_customer_id},
        ${row.recipient_address},
        ${row.related_entity_type},
        ${row.related_entity_id},
        ${"manual"},
        ${metaJson(row.meta_extra ?? {})},
        ${row.scheduled_at},
        ${row.sent_at},
        ${row.created_at}::timestamptz,
        ${ownerId}::uuid
      )
    `
  }

  const hoursAgo = (h) => new Date(now.getTime() - h * 3600000).toISOString()

  for (let i = 0; i < Math.min(12, prospectIds.length); i++) {
    const pid = prospectIds[i]
    await pushComm({
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
    await pushComm({
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
    await pushComm({
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
    await pushComm({
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
    await pushComm({
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
    await pushComm({
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
    await pushComm({
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
}

/** Public app paths (Next.js `public/`) — must match `lib/mock-data` demo headshots. */
function precisionDemoTechAvatarPath(index) {
  return `/demo-techs/technician-${String(index + 1).padStart(2, "0")}.png`
}

/**
 * Set profiles.avatar_url for each seeded demo technician (idempotent).
 * Call on every script run so avatars stay in sync even when tenant data seed is skipped.
 */
async function syncPrecisionDemoTechnicianAvatars(sql) {
  for (let i = 0; i < TECH_SEED.length; i++) {
    const t = TECH_SEED[i]
    const url = precisionDemoTechAvatarPath(i)
    const found = await sql`
      select u.id from auth.users u where u.email = ${t.email} limit 1
    `
    if (!found.length) continue
    await sql`
      update public.profiles
      set avatar_url = ${url}, updated_at = now()
      where id = ${found[0].id}::uuid
    `
  }
}

function assertSafeDbUrl(url) {
  try {
    const u = new URL(url)
    const host = u.hostname
    if (host !== "127.0.0.1" && host !== "localhost" && process.env.CONFIRM_DEMO_SEED !== "1") {
      console.error(
        "Refusing to run against non-local database without CONFIRM_DEMO_SEED=1 (safety guard).",
      )
      process.exit(1)
    }
  } catch {
    console.error("Invalid DATABASE_URL")
    process.exit(1)
  }
}

function repairLogJson(title) {
  return {
    problemReported: `Service request: ${title}`,
    diagnosis: "Field assessment documented; corrective actions per manufacturer IFU where applicable.",
    partsUsed: [],
    laborHours: 0,
    technicianNotes: "Biomed documentation attached to CMMS. Customer clinical engineering notified.",
    photos: [],
    signatureDataUrl: "",
    signedBy: "",
    signedAt: "",
    tasks: [],
  }
}

/** Seeded calendar years stay in a realistic clinical range (equipment, warranties, etc.). */
const SEED_CAL_YEAR_MIN = 2024
const SEED_CAL_YEAR_MAX = 2027

/** Hard guard: reject garbage dates before any SQL insert. */
const SEED_YEAR_GUARD_MIN = 2020
const SEED_YEAR_GUARD_MAX = 2030

function assertSeedDateOk(isoDateStr, label) {
  const d = new Date(`${isoDateStr}T12:00:00.000Z`)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Precision seed: invalid calendar date (${label}): ${isoDateStr}`)
  }
  const y = d.getUTCFullYear()
  if (y < SEED_YEAR_GUARD_MIN || y > SEED_YEAR_GUARD_MAX) {
    throw new Error(`Precision seed: date year ${y} out of bounds ${SEED_YEAR_GUARD_MIN}–${SEED_YEAR_GUARD_MAX} (${label})`)
  }
}

function assertIsoTimestamptzOk(isoStr, label) {
  const d = new Date(isoStr)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Precision seed: invalid timestamptz (${label})`)
  }
  const y = d.getUTCFullYear()
  if (y < SEED_YEAR_GUARD_MIN || y > SEED_YEAR_GUARD_MAX) {
    throw new Error(`Precision seed: timestamptz year ${y} out of bounds (${label})`)
  }
}

/** Build `YYYY-MM-DD` in UTC; throws if the calendar triplet rolls over (e.g. Feb 30). */
function utcDateParts(year, monthIndex0, day) {
  const d = new Date(Date.UTC(year, monthIndex0, day, 12, 0, 0, 0))
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Precision seed: invalid utcDateParts(${year}, ${monthIndex0}, ${day})`)
  }
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== monthIndex0 || d.getUTCDate() !== day) {
    throw new Error(`Precision seed: date rollover for ${year}-${monthIndex0 + 1}-${day}`)
  }
  const s = d.toISOString().slice(0, 10)
  assertSeedDateOk(s, `utcDateParts(${year},${monthIndex0},${day})`)
  return s
}

function utcMonthBounds(d) {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const monthStart = utcDateParts(y, m, 1)
  const lastD = new Date(Date.UTC(y, m + 1, 0, 12, 0, 0, 0)).getUTCDate()
  const monthEnd = utcDateParts(y, m, lastD)
  const today = d.toISOString().slice(0, 10)
  return { y, m, monthStart, monthEnd, today, lastD }
}

function isoDateAddDays(isoYmd, deltaDays) {
  const t = new Date(`${isoYmd}T12:00:00.000Z`)
  t.setUTCDate(t.getUTCDate() + deltaDays)
  const s = t.toISOString().slice(0, 10)
  assertSeedDateOk(s, `isoDateAddDays(${isoYmd},${deltaDays})`)
  return s
}

/** Dashboard revenue: current month $35k–$65k; prior 6 months show a rising trend. */
function revenueSpecForDashboard(now, revIdx) {
  const y = now.getUTCFullYear()
  const mo = now.getUTCMonth()
  if (revIdx < 20) {
    const day = 1 + (revIdx % 22)
    const hour = 9 + (revIdx % 8)
    const ts = new Date(Date.UTC(y, mo, Math.min(day, 28), hour, 10 + (revIdx % 40), 0)).toISOString()
    const labor = 185_000 + (revIdx % 11) * 14_000
    const parts = 42_000 + (revIdx % 6) * 9_500
    return { updatedAt: ts, laborCents: labor, partsCents: parts }
  }
  if (revIdx < 20 + 48) {
    const band = revIdx - 20
    const monthsBack = 1 + Math.floor(band / 8)
    const day = 3 + (band % 17)
    const ts = new Date(Date.UTC(y, mo - monthsBack, Math.min(day, 28), 11, 20 + (band % 30), 0)).toISOString()
    const ramp = monthsBack * 16_000
    const labor = 52_000 + ramp + (band % 7) * 6_500
    const parts = 14_000 + monthsBack * 3_200 + (band % 5) * 2_100
    return { updatedAt: ts, laborCents: labor, partsCents: parts }
  }
  const band = revIdx - 68
  const monthsBack = 7 + (band % 5)
  const day = 5 + (band % 20)
  const ts = new Date(Date.UTC(y, mo - monthsBack, Math.min(day, 28), 10, 0, 0)).toISOString()
  const labor = 38_000 + (band % 9) * 4_000
  const parts = 9_000 + (band % 4) * 1_800
  return { updatedAt: ts, laborCents: labor, partsCents: parts }
}

async function ensureTechUsers(sql, supabase) {
  const ids = []
  const password = "PrecisionSeed2026!"
  for (const t of TECH_SEED) {
    const existing = await sql`
      select id from auth.users where email = ${t.email} limit 1
    `
    if (existing.length) {
      ids.push(existing[0].id)
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

/** Remove tenant rows for Precision org only (preserves organization + members). */
async function clearPrecisionTenantData(tx, orgId) {
  await tx`
    delete from public.inventory_transactions it
    using public.catalog_items ci
    where it.organization_id = ${orgId}
      and ci.id = it.catalog_item_id
      and ci.organization_id = ${orgId}
      and ci.sku like ${SEED_SKU_PREFIX + "%"}
  `
  await tx`
    delete from public.inventory_stock ist
    using public.catalog_items ci
    where ist.organization_id = ${orgId}
      and ci.id = ist.catalog_item_id
      and ci.organization_id = ${orgId}
      and ci.sku like ${SEED_SKU_PREFIX + "%"}
  `
  await tx`
    delete from public.technician_vehicle_stock tvs
    where tvs.organization_id = ${orgId}
      and exists (
        select 1
        from public.inventory_locations il
        where il.id = tvs.inventory_location_id
          and il.organization_id = ${orgId}
          and il.code like 'PBS-SEED-%'
      )
  `
  await tx`
    delete from public.inventory_locations
    where organization_id = ${orgId}
      and code like 'PBS-SEED-%'
  `
  await tx`
    delete from public.catalog_items
    where organization_id = ${orgId}
      and sku like ${SEED_SKU_PREFIX + "%"}
  `
  await tx`
    delete from public.org_vendors
    where organization_id = ${orgId}
      and email::text like ${"%@" + SEED_VENDOR_EMAIL_DOMAIN}
  `
  await tx`
    delete from public.communication_events
    where organization_id = ${orgId}
      and coalesce(metadata ->> 'pbs_demo_seed', '') = 'true'
  `
  await tx`
    delete from public.prospects
    where organization_id = ${orgId}
      and contact_email::text like ${"%@" + SEED_LEAD_EMAIL_DOMAIN}
  `

  await tx`delete from public.org_invoices where organization_id = ${orgId}`
  await tx`delete from public.org_quotes where organization_id = ${orgId}`
  await tx`delete from public.work_orders where organization_id = ${orgId}`
  await tx`delete from public.maintenance_plans where organization_id = ${orgId}`
  await tx`delete from public.equipment where organization_id = ${orgId}`
  await tx`delete from public.customer_contacts where organization_id = ${orgId}`
  await tx`delete from public.customer_locations where organization_id = ${orgId}`
  await tx`delete from public.customers where organization_id = ${orgId}`
}

async function main() {
  loadDotEnvLocal()
  const ownerId = process.env.DEMO_SEED_OWNER_ID
  const databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const orgSlug = (process.env.PRECISION_ORG_SLUG || DEFAULT_PRECISION_SLUG).trim().toLowerCase()

  if (!ownerId) {
    console.error("Set DEMO_SEED_OWNER_ID to your auth.users id (UUID).")
    process.exit(1)
  }
  if (!supabaseUrl || !serviceKey) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service role) for technician user creation.")
    process.exit(1)
  }
  assertSafeDbUrl(databaseUrl)

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const sql = postgres(databaseUrl, { max: 1 })
  const now = new Date()

  try {
    const [tbl] = await sql`
      select
        to_regclass('public.org_quotes') as quotes_reg,
        to_regclass('public.org_invoices') as invoices_reg
    `
    if (!tbl.quotes_reg || !tbl.invoices_reg) {
      console.error(
        "Missing public.org_quotes / public.org_invoices. Apply Supabase migrations (includes 20260505190000_org_quotes_invoices.sql), then re-run.",
      )
      process.exit(1)
    }

    await syncPrecisionDemoTechnicianAvatars(sql)

    let [{ id: orgId } = { id: null }] = await sql`
      select id from public.organizations where slug = ${orgSlug}::citext limit 1
    `

    if (!orgId) {
      const ins = await sql`
        insert into public.organizations (name, slug, created_by)
        values (
          ${"Precision Biomedical Services"},
          ${orgSlug}::citext,
          ${ownerId}::uuid
        )
        returning id
      `
      orgId = ins[0].id
      console.log("Created organization", orgSlug, orgId)
    }

    await sql`
      insert into public.organization_members (organization_id, user_id, role, status, invited_by)
      values (${orgId}, ${ownerId}::uuid, ${"owner"}, ${"active"}, ${ownerId}::uuid)
      on conflict (organization_id, user_id) do nothing
    `

    const custLike = `${SEED_CUST_PREFIX}%`
    const eqLike = `${SEED_EQ_PREFIX}%`
    const qtLike = `${SEED_QUOTE_KEY_PREFIX}%`
    const invLike = `${SEED_INV_KEY_PREFIX}%`
    const leadDomainLike = `%@${SEED_LEAD_EMAIL_DOMAIN}`
    const vendorDomainLike = `%@${SEED_VENDOR_EMAIL_DOMAIN}`
    const skuLike = `${SEED_SKU_PREFIX}%`
    const [seedCheck] = await sql`
      select
        (select count(*)::int from public.customers c
          where c.organization_id = ${orgId}
            and c.external_code is not null
            and c.external_code like ${custLike}) as seed_customers,
        (select count(*)::int from public.equipment e
          where e.organization_id = ${orgId}
            and e.equipment_code like ${eqLike}) as seed_equipment,
        (select count(*)::int from public.work_orders w where w.organization_id = ${orgId}) as wo_total,
        (select count(*)::int from public.maintenance_plans p where p.organization_id = ${orgId}) as plan_total,
        (select count(*)::int from public.org_quotes q
          where q.organization_id = ${orgId} and q.seed_key like ${qtLike}) as quote_total,
        (select count(*)::int from public.org_invoices inv
          where inv.organization_id = ${orgId} and inv.seed_key like ${invLike}) as invoice_total,
        (select count(*)::int from public.prospects pr
          where pr.organization_id = ${orgId}
            and pr.contact_email::text like ${leadDomainLike}) as seed_prospects,
        (select count(*)::int from public.catalog_items ci
          where ci.organization_id = ${orgId}
            and ci.sku like ${skuLike}) as seed_catalog,
        (select count(*)::int from public.org_vendors ov
          where ov.organization_id = ${orgId}
            and ov.email::text like ${vendorDomainLike}) as seed_vendors,
        (select count(*)::int from public.communication_events ce
          where ce.organization_id = ${orgId}
            and coalesce(ce.metadata ->> 'pbs_demo_seed', '') = 'true') as seed_comm
    `
    const seedCustomers = Number(seedCheck?.seed_customers ?? 0)
    const seedEquipment = Number(seedCheck?.seed_equipment ?? 0)
    const woTotal = Number(seedCheck?.wo_total ?? 0)
    const planTotal = Number(seedCheck?.plan_total ?? 0)
    const quoteTotal = Number(seedCheck?.quote_total ?? 0)
    const invoiceTotal = Number(seedCheck?.invoice_total ?? 0)
    const seedProspects = Number(seedCheck?.seed_prospects ?? 0)
    const seedCatalog = Number(seedCheck?.seed_catalog ?? 0)
    const seedVendors = Number(seedCheck?.seed_vendors ?? 0)
    const seedComm = Number(seedCheck?.seed_comm ?? 0)

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
    const techUserIds = await ensureTechUsers(sql, supabase)
    await syncPrecisionDemoTechnicianAvatars(sql)

    await sql.begin(async (tx) => {
      await clearPrecisionTenantData(tx, orgId)

      for (const uid of techUserIds) {
        await tx`
          insert into public.organization_members (organization_id, user_id, role, status, invited_by)
          values (${orgId}, ${uid}::uuid, ${"tech"}, ${"active"}, ${ownerId}::uuid)
          on conflict (organization_id, user_id) do nothing
        `
      }

      const mb = utcMonthBounds(now)

      const customerIds = []
      for (let i = 0; i < CUSTOMERS.length; i++) {
        const c = CUSTOMERS[i]
        const ext = `${SEED_CUST_PREFIX}${String(i + 1).padStart(2, "0")}`
        const [{ id: cid }] = await tx`
          insert into public.customers (
            organization_id, external_code, company_name, status, joined_at, created_by
          )
          values (
            ${orgId},
            ${ext},
            ${c.company},
            ${"active"},
            ${utcDateParts(2024, 5, 1)},
            ${ownerId}::uuid
          )
          returning id
        `
        customerIds.push({ id: cid, ...c })
        await tx`
          insert into public.customer_locations (
            organization_id, customer_id, name, address_line1, city, state, postal_code, is_default
          )
          values (
            ${orgId}, ${cid}, ${"Primary campus"}, ${c.line1}, ${c.city}, ${c.state}, ${c.zip}, true
          )
        `
        const contactName = c.company.includes("Dental") ? "Dr. Morgan Ellis" : "Clinical Engineering Manager"
        const idx = customerIds.length
        const emailLocal = `ce-${cid.replace(/-/g, "")}`.slice(0, 48)
        await tx`
          insert into public.customer_contacts (
            organization_id, customer_id, full_name, role, email, phone, is_primary
          )
          values (
            ${orgId},
            ${cid},
            ${contactName},
            ${"Clinical Engineering"},
            ${`${emailLocal}@pbs-demo.local`},
            ${`(209) 555-${String(2000 + idx).slice(-4)}`},
            true
          )
        `
      }

      await tx`alter table public.equipment disable trigger trg_equipment_set_created_by`
      const equipmentIds = []
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
        const st = "active"
        const [{ id: eid }] = await tx`
          insert into public.equipment (
            organization_id, customer_id, equipment_code, name, manufacturer, category, serial_number,
            status, install_date, warranty_expires_at, last_service_at, next_due_at, location_label,
            notes, created_by
          )
          values (
            ${orgId},
            ${cust.id},
            ${code},
            ${tpl.model},
            ${tpl.mfr},
            ${tpl.cat},
            ${serial},
            ${st},
            ${install}::date,
            ${warranty}::date,
            ${lastSvc}::date,
            ${nextDue}::date,
            ${tpl.loc},
            ${"Biomedical asset — Precision marketing seed."},
            ${ownerId}::uuid
          )
          returning id
        `
        equipmentIds.push({ id: eid, customerId: cust.id })
      }
      await tx`alter table public.equipment enable trigger trg_equipment_set_created_by`

      const quoteStatuses = ["draft", "sent", "sent", "approved", "declined"]
      for (let i = 0; i < TARGET_QUOTES; i++) {
        const cust = customerIds[i % customerIds.length]
        const seedKey = `${SEED_QUOTE_KEY_PREFIX}${String(i + 1).padStart(3, "0")}`
        const qn = `QT-PBS-${String(8800 + i)}`
        const title = `Quoted — ${WO_TITLES[i % WO_TITLES.length]}`.slice(0, 220)
        const amt = 420000 + (i % 50) * 12500
        await tx`
          insert into public.org_quotes (
            organization_id, customer_id, seed_key, quote_number, title, amount_cents, status, created_by
          )
          values (
            ${orgId},
            ${cust.id},
            ${seedKey},
            ${qn},
            ${title},
            ${amt},
            ${quoteStatuses[i % quoteStatuses.length]},
            ${ownerId}::uuid
          )
        `
      }

      const invStatuses = ["paid", "paid", "paid", "overdue", "sent"]
      for (let i = 0; i < TARGET_INVOICES; i++) {
        const eq = equipmentIds[(i * 2 + 5) % equipmentIds.length]
        const seedKey = `${SEED_INV_KEY_PREFIX}${String(i + 1).padStart(3, "0")}`
        const invNo = `INV-AR-PBS-${String(7000 + i)}`
        const title = `Service invoice — ${WO_TITLES[(i + 3) % WO_TITLES.length]}`.slice(0, 220)
        const amt = 280000 + (i % 35) * 9200
        const st = invStatuses[i % invStatuses.length]
        const monthsBack = i % 10
        const refY = Math.min(SEED_CAL_YEAR_MAX, Math.max(SEED_CAL_YEAR_MIN, now.getUTCFullYear()))
        const issued = new Date(
          Date.UTC(refY, now.getUTCMonth() - monthsBack, Math.min(10 + (i % 15), 28), 12, 0, 0, 0),
        )
        if (Number.isNaN(issued.getTime())) {
          throw new Error(`Precision seed: invalid invoice issued date (i=${i})`)
        }
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
        await tx`
          insert into public.org_invoices (
            organization_id, customer_id, equipment_id, seed_key, invoice_number, title,
            amount_cents, status, issued_at, paid_at, created_by
          )
          values (
            ${orgId},
            ${eq.customerId},
            ${eq.id},
            ${seedKey},
            ${invNo},
            ${title},
            ${amt},
            ${st},
            ${issuedStr}::date,
            ${paidAt},
            ${ownerId}::uuid
          )
        `
      }

      await tx`alter table public.maintenance_plans disable trigger trg_maintenance_plans_set_created_by`
      const units = [
        { u: "month", v: 1 },
        { u: "month", v: 3 },
        { u: "month", v: 6 },
        { u: "year", v: 1 },
      ]
      const seededPlans = []
      for (let i = 0; i < TARGET_PLANS; i++) {
        const eq = equipmentIds[(i * 3) % equipmentIds.length]
        const { u, v } = units[i % units.length]
        const dueStr = utcDateParts(
          2025 + (i % 3),
          (i * 2 + now.getUTCMonth()) % 12,
          Math.min(1 + (i % 22), 28),
        )
        assertSeedDateOk(dueStr, `maintenance_plans next_due i=${i}`)
        const svc = [
          { name: "Visual inspection & safety interlocks", interval: "Per visit" },
          { name: "Functional test & documentation", interval: "Per visit" },
        ]
        const rules = [{ id: `r-${i}`, offsetDays: 14, channel: "email", target: "clinical.engineering@demo.org" }]
        const assignee = techUserIds[i % techUserIds.length]
        const [{ id: planId }] = await tx`
          insert into public.maintenance_plans (
            organization_id, customer_id, equipment_id, assigned_user_id, name, status, priority,
            interval_value, interval_unit, last_service_date, next_due_date, auto_create_work_order,
            notes, services, notification_rules, created_by
          )
          values (
            ${orgId},
            ${eq.customerId},
            ${eq.id},
            ${assignee}::uuid,
            ${PLAN_NAMES[i % PLAN_NAMES.length]},
            ${i % 11 === 0 ? "paused" : "active"},
            ${i % 8 === 0 ? "high" : "normal"},
            ${v},
            ${u},
            ${utcDateParts(2025, 10, 1)}::date,
            ${dueStr}::date,
            ${i % 3 === 0},
            ${"Preventive maintenance agreement — marketing seed."},
            ${tx.json(svc)},
            ${tx.json(rules)},
            ${ownerId}::uuid
          )
          returning id
        `
        seededPlans.push({
          id: planId,
          customerId: eq.customerId,
          equipmentId: eq.id,
        })
      }
      await tx`alter table public.maintenance_plans enable trigger trg_maintenance_plans_set_created_by`

      const seededWorkOrders = []

      const priorities = ["low", "normal", "normal", "high", "critical"]
      const types = ["repair", "pm", "inspection", "install", "emergency"]
      let revenueSlotIdx = 0

      const repeatBandStart = TARGET_OPEN_WOS + TARGET_COMPLETED_WOS + TARGET_INVOICED_WOS

      for (let i = 0; i < TARGET_WORK_ORDERS; i++) {
        const repeatSlot = i - repeatBandStart
        const eq =
          i >= repeatBandStart
            ? equipmentIds[repeatSlot % 8]
            : equipmentIds[(i * 5 + 7) % equipmentIds.length]
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
          i >= repeatBandStart
            ? `Follow-up service — ${WO_TITLES[i % WO_TITLES.length]}`
            : WO_TITLES[i % WO_TITLES.length]
        const schedY = Math.min(SEED_CAL_YEAR_MAX, Math.max(SEED_CAL_YEAR_MIN, now.getUTCFullYear()))
        const sched = utcDateParts(schedY, i % 12, Math.min((i % 26) + 1, 28))
        assertSeedDateOk(sched, `work_orders scheduled_on i=${i}`)
        const assign = i % 7 === 0 ? null : techUserIds[i % techUserIds.length]
        const invIdx = i - (TARGET_OPEN_WOS + TARGET_COMPLETED_WOS)
        const inv =
          st === "invoiced" ? `INV-WO-PBS-${now.getFullYear()}-${String(invIdx + 1).padStart(4, "0")}` : null
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

        const [woRow] = await tx`
          insert into public.work_orders (
            organization_id, customer_id, equipment_id, title, status, priority, type,
            scheduled_on, scheduled_time, completed_at, assigned_user_id, invoice_number,
            total_labor_cents, total_parts_cents, repair_log, notes, created_by,
            created_at, updated_at, maintenance_plan_id
          )
          values (
            ${orgId},
            ${eq.customerId},
            ${eq.id},
            ${title},
            ${st},
            ${pr},
            ${ty},
            ${sched}::date,
            ${"09:30:00"},
            ${completedAt},
            ${assign},
            ${inv},
            ${laborCents},
            ${partsCents},
            ${tx.json(repairLogJson(title))},
            ${"Marketing seed — Precision Biomedical Services only."},
            ${ownerId}::uuid,
            ${createdAt}::timestamptz,
            ${updatedAt}::timestamptz,
            null
          )
          returning id, customer_id, title, status
        `
        seededWorkOrders.push({
          id: woRow.id,
          customer_id: woRow.customer_id,
          title: woRow.title,
          status: woRow.status,
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
        const [pmWo] = await tx`
          insert into public.work_orders (
            organization_id, customer_id, equipment_id, title, status, priority, type,
            scheduled_on, scheduled_time, completed_at, assigned_user_id, invoice_number,
            total_labor_cents, total_parts_cents, repair_log, notes, created_by,
            created_at, updated_at, maintenance_plan_id
          )
          values (
            ${orgId},
            ${plan.customerId},
            ${plan.equipmentId},
            ${title},
            ${"scheduled"},
            ${"normal"},
            ${"pm"},
            ${mb.monthStart}::date,
            ${"08:00:00"},
            null,
            ${techUserIds[p % techUserIds.length]}::uuid,
            null,
            ${88_000 + p * 4_200},
            ${12_000 + (p % 5) * 1_800},
            ${tx.json(repairLogJson(title))},
            ${"Generated from active maintenance plan (marketing seed)."},
            ${ownerId}::uuid,
            ${createdAt}::timestamptz,
            ${updatedAt}::timestamptz,
            ${plan.id}
          )
          returning id, customer_id, title, status
        `
        seededWorkOrders.push({
          id: pmWo.id,
          customer_id: pmWo.customer_id,
          title: pmWo.title,
          status: pmWo.status,
        })
      }

      await seedPrecisionExtendedRelations(tx, {
        orgId,
        ownerId,
        techUserIds,
        customerIds,
        seededWorkOrders,
        now,
      })
    })

    console.log("Done. Precision Biomedical Services marketing seed applied.")
    console.log(`  Org slug: ${orgSlug}`)
    console.log(
      `  Customers: ${TARGET_CUSTOMERS}, Equipment: ${TARGET_EQUIPMENT}, Work orders: ${TARGET_TOTAL_WORK_ORDERS} (incl. ${TARGET_PM_PLAN_WORK_ORDERS} PM-from-plan), Plans: ${TARGET_PLANS}, Quotes: ${TARGET_QUOTES}, Invoices: ${TARGET_INVOICES}`,
    )
    console.log(
      `  Prospects: ${TARGET_PROSPECTS}, Catalog/inventory SKUs: ${TARGET_CATALOG_ITEMS}, Vendors: ${TARGET_VENDOR_ROWS}, Communications: ${TARGET_COMM_EVENTS}`,
    )
    console.log("  Technician demo logins (password for all): PrecisionSeed2026!")
    for (const t of TECH_SEED) console.log(`    - ${t.email} (${t.name})`)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
