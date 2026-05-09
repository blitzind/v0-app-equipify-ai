import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { DEMO_INDUSTRY_PROFILES, type DemoIndustryKey } from "@/lib/demo-seeding/profiles"
import { getStarterTemplatesForIndustry } from "@/lib/demo-seeding/industry-templates"

export type DemoSeedCounts = {
  customers: number
  equipment: number
  workOrders: number
  maintenancePlans: number
  technicians: number
  techniciansOperational: number
  vendors: number
  catalogItems: number
  quotes: number
  invoices: number
  purchaseOrders: number
  calibrationTemplates: number
  calibrationRecords: number
}

export type ExecuteDemoSeedArgs = {
  supabase: SupabaseClient
  organizationId: string
  ownerUserId: string
  industry: DemoIndustryKey
}

export type ExecuteDemoSeedResult = {
  seeded: boolean
  skipped: boolean
  industry: DemoIndustryKey
  counts?: DemoSeedCounts
  techniciansSeeded?: boolean
}

function pick<T>(items: readonly T[] | T[], idx: number): T {
  return items[idx % items.length]!
}

function addDays(base: Date, days: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const TECH_ROSTER: { fullName: string; region: string }[] = [
  { fullName: "Alex Rivera", region: "Central Valley" },
  { fullName: "Linh Nguyen", region: "Bay Area" },
  { fullName: "Sanjay Patel", region: "Sacramento corridor" },
  { fullName: "Casey Morrison", region: "North Coast" },
  { fullName: "Yasmin Hassan", region: "Monterey Bay" },
  { fullName: "Daniel Cho", region: "Los Angeles basin" },
  { fullName: "Amira Ibrahim", region: "Inland Empire" },
  { fullName: "Jordan Kim", region: "San Diego / Imperial" },
  { fullName: "Morgan Reyes", region: "Fresno / Visalia" },
  { fullName: "Priya Desai", region: "Silicon Valley" },
  { fullName: "Chris Okonkwo", region: "East Bay" },
  { fullName: "Sofia Martinez", region: "Orange County" },
]

/** Display titles aligned to biomedical demo personas (Calibration, Imaging QA, SPD, electrical safety, etc.). */
const TECH_JOB_TITLES = [
  "BMET — Electrical Safety & Performance (SEP)",
  "Clinical Engineering Technician — Imaging QA",
  "Biomedical Field Service Technician — Patient Monitoring",
  "Sterilizer & Autoclave Specialist — SPD",
  "Infusion Systems Specialist — IV / Drug Delivery",
  "Defibrillator & Emergency Care Equipment Tech",
  "Audiology & Diagnostic Equipment Technician",
  "Laboratory Centrifuge & Point-of-Care Support",
  "Radiology & Imaging QA Field Technician",
  "BMET — Endoscopy & Surgical Devices",
  "Low-Temperature Sterilization Specialist",
  "Portable Imaging & Fluoro QA Technician",
] as const

const SECONDARY_LOCATION_NAMES = [
  "Outpatient Pavilion",
  "Surgery Center Annex",
  "Rehab East Wing",
  "Imaging & Interventional Suite",
  "Central Supply / SPD",
]

const TERTIARY_LOCATION_NAMES = [
  "Oncology Infusion Center",
  "Pediatric Specialty Clinic",
  "Interventional Radiology Prep & Recovery",
  "Same-Day Surgery Pavilion",
  "Wound & Hyperbaric Annex",
]

const BIOMED_VENDOR_NAMES: { name: string; email: string; phone: string; contact: string }[] = [
  { name: "STERIS Instrument Care", email: "orders@steris-demo.example.com", phone: "(440) 555-0101", contact: "Regional Parts Desk" },
  { name: "Philips Healthcare Parts", email: "parts.west@philips-demo.example.com", phone: "(978) 555-0140", contact: "West Region OEM" },
  { name: "GE HealthCare Service Store", email: "svc.store@gehc-demo.example.com", phone: "(414) 555-0191", contact: "Consumables" },
  { name: "BD Pyxis Infusion Supply", email: "infusion.ops@bd-demo.example.com", phone: "(201) 555-0175", contact: "Channel Partner Ops" },
  { name: "ICU Medical OEM Supplies", email: "oem@icumed-demo.example.com", phone: "(949) 555-0122", contact: "West Distribution" },
  { name: "ConMed Orthopedic Power Tools", email: "biomed.orders@conmed-demo.example.com", phone: "(315) 555-0166", contact: "Capital Parts" },
  { name: "Mindray North America Spares", email: "na.spares@mindray-demo.example.com", phone: "(201) 555-0133", contact: "Spares Queue" },
  { name: "ZOLL Battery & Accessories", email: "ems.parts@zoll-demo.example.com", phone: "(978) 555-0188", contact: "EMS Channel" },
  { name: "Getinge SPD Consumables", email: "spd.us@getinge-demo.example.com", phone: "(303) 555-0150", contact: "SPD Accounts" },
  { name: "Dräger Medical Consumables", email: "us.orders@draeger-demo.example.com", phone: "(724) 555-0144", contact: "Consumables Desk" },
  { name: "Thermo Fisher Scientific Lab Supply", email: "clinical.orders@thermo-demo.example.com", phone: "(781) 555-0160", contact: "West Clinical Accounts" },
]

// Legacy CAL_TEMPLATE_FIELDS_A/B inlined here have moved into
// `lib/demo-seeding/industry-templates.ts` as part of the industry-aware
// templates foundation. Calibration record values for the rich biomedical
// path still reference these field IDs (`pf_g`, `pf_l`, `pf_alarm`, etc.)
// since the medical industry templates use the same shape.

async function seedTechnicianAuthMembers(params: {
  supabase: SupabaseClient
  organizationId: string
  ownerUserId: string
  industry: DemoIndustryKey
  specialties: string[]
  rosterSize: number
}): Promise<boolean> {
  const admin = createServiceRoleClient()
  if (!admin) return false

  const roster = TECH_ROSTER.slice(0, Math.min(params.rosterSize, TECH_ROSTER.length))
  for (let i = 0; i < roster.length; i += 1) {
    const { fullName, region } = roster[i]!
    const jobTitle = TECH_JOB_TITLES[i % TECH_JOB_TITLES.length]!
    const skillsForMember = [
      params.specialties[i % params.specialties.length]!,
      params.specialties[(i + 1) % params.specialties.length]!,
    ]
    const local = fullName.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.+|\.+$/g, "")
    const email = `${local}+${params.industry}@equipify.demo`
    let userId: string | null = null
    const { data: existingProfile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle()
    if (existingProfile?.id) {
      userId = existingProfile.id
    } else {
      const created = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: `EquipifyDemo!${Math.random().toString(36).slice(2, 10)}`,
        user_metadata: { full_name: fullName },
      })
      userId = created.data.user?.id ?? null
    }
    if (!userId) continue
    await admin.from("organization_members").upsert(
      {
        organization_id: params.organizationId,
        user_id: userId,
        role: "tech",
        status: "active",
        invited_by: params.ownerUserId,
        job_title: jobTitle,
        region,
        skills: skillsForMember,
        availability_status: pick(["Available", "Available", "On Job", "Available"], i),
        is_sample: true,
      },
      { onConflict: "organization_id,user_id" },
    )
  }
  return true
}

async function syncOperationalTechnicians(supabase: SupabaseClient, organizationId: string): Promise<number> {
  await supabase.from("technicians").delete().eq("organization_id", organizationId).eq("is_sample", true)

  const { data: members, error: mErr } = await supabase
    .from("organization_members")
    .select("membership_id, user_id, region, skills, job_title")
    .eq("organization_id", organizationId)
    .eq("role", "tech")
    .eq("is_sample", true)
  if (mErr) throw new Error(mErr.message)

  const ids = [...new Set((members ?? []).map((r) => r.user_id).filter(Boolean))] as string[]
  if (ids.length === 0) return 0

  const { data: profs, error: pErr } = await supabase.from("profiles").select("id, full_name, email").in("id", ids)
  if (pErr) throw new Error(pErr.message)
  const nameByUser = new Map<string, { full_name: string | null; email: string | null }>()
  for (const p of profs ?? []) {
    nameByUser.set(p.id, { full_name: (p as { full_name?: string }).full_name ?? null, email: p.email ?? null })
  }

  let n = 0
  for (const m of members ?? []) {
    const uid = m.user_id as string
    const memId = m.membership_id as string | null
    if (!memId) continue
    const pr = nameByUser.get(uid)
    const skills = Array.isArray(m.skills) ? (m.skills as string[]) : []
    const { error: insErr } = await supabase.from("technicians").insert({
      organization_id: organizationId,
      membership_id: memId,
      full_name: pr?.full_name?.trim() || "Field Technician",
      email: pr?.email ?? null,
      region: typeof m.region === "string" ? m.region : null,
      skills,
      job_title: typeof m.job_title === "string" ? m.job_title : "Clinical Engineering Technician",
      availability_status: pick(["Available", "Available", "On Job"], n),
      operational_status: "active",
      is_sample: true,
    })
    if (insErr) throw new Error(insErr.message)
    n += 1
  }
  return n
}

/** Spread WO statuses across ~150 rows for boards, kanban, and schedule screenshots. */
function woStatusForIndex(i: number): string {
  const cycle = [
    "open",
    "scheduled",
    "scheduled",
    "in_progress",
    "in_progress",
    "completed",
    "completed_pending_signature",
    "invoiced",
    "scheduled",
    "open",
    "in_progress",
    "completed",
    "scheduled",
    "invoiced",
    "completed_pending_signature",
  ]
  return cycle[i % cycle.length]!
}

function scheduledOnForWorkOrder(i: number, status: string): string {
  const today = new Date()
  const spread = (i * 47) % 91
  // Rolling window: past ~90d through upcoming ~60d so calendar & dispatch look alive.
  if (status === "open") return addDays(today, 2 + (i % 55))
  if (status === "scheduled") return addDays(today, -45 + spread)
  if (status === "in_progress") return addDays(today, -(i % 6))
  if (status === "completed" || status === "completed_pending_signature") return addDays(today, -(10 + (i % 82)))
  if (status === "invoiced") return addDays(today, -(28 + (i % 95)))
  return addDays(today, (i % 21) - 7)
}

function completedAtFor(status: string, i: number): string | null {
  if (status === "completed" || status === "completed_pending_signature") {
    return new Date(Date.now() - (5 + (i % 88)) * 86400000).toISOString()
  }
  if (status === "invoiced") {
    return new Date(Date.now() - (18 + (i % 100)) * 86400000).toISOString()
  }
  return null
}

export async function executeDemoSeed(args: ExecuteDemoSeedArgs): Promise<ExecuteDemoSeedResult> {
  const profile = DEMO_INDUSTRY_PROFILES[args.industry]
  const rich = args.industry === "biomedical_medical_equipment"

  const customerTarget = Math.max(profile.dashboardMetricTargets.customers, rich ? 25 : 20)
  const equipmentTarget = Math.max(profile.dashboardMetricTargets.equipment, rich ? 68 : 50)
  const workOrderTarget = Math.max(profile.dashboardMetricTargets.workOrders, rich ? 150 : 34)
  const planTarget = Math.max(profile.dashboardMetricTargets.maintenancePlans, rich ? 22 : 12)

  const vendorTarget = rich ? 12 : 0
  const catalogTarget = rich ? 56 : 0
  const quoteTarget = rich ? 20 : 0
  const invoiceTarget = rich ? 15 : 0
  const poTarget = rich ? 12 : 0
  const certTarget = rich ? 48 : 0

  const customerRows = Array.from({ length: customerTarget }, (_, i) => ({
    organization_id: args.organizationId,
    external_code: `DEMO-C${String(i + 1).padStart(2, "0")}`,
    company_name:
      profile.customerTypes[i] ??
      `${pick(profile.customerTypes, i)} ${Math.floor(i / profile.customerTypes.length) + 2}`,
    status: "active" as const,
    joined_at: addDays(new Date(), -(400 + i * 11)),
    created_by: args.ownerUserId,
    is_sample: true,
  }))

  const { data: customers, error: customerErr } = await args.supabase
    .from("customers")
    .insert(customerRows)
    .select("id, external_code")
  if (customerErr) throw new Error(customerErr.message)

  const customerIndex = new Map<string, string>()
  for (const c of customers ?? []) {
    if (c.external_code) customerIndex.set(c.external_code, c.id)
  }

  const primaryLocations = customerRows.map((c, i) => ({
    organization_id: args.organizationId,
    customer_id: customerIndex.get(c.external_code)!,
    name: "Primary campus",
    address_line1: `${120 + i * 9} Medical Center Dr`,
    city: pick(["Fresno", "San Jose", "Sacramento", "Oakland", "Monterey", "Stockton", "Modesto"], i),
    state: "CA",
    postal_code: `${93000 + ((i * 41) % 9899)}`,
    is_default: true,
  }))
  await args.supabase.from("customer_locations").insert(primaryLocations)

  if (rich) {
    const extraLocRows: typeof primaryLocations = []
    for (let i = 0; i < customerTarget; i += 1) {
      const code = `DEMO-C${String(i + 1).padStart(2, "0")}`
      const cid = customerIndex.get(code)!
      if (i % 2 === 1) {
        extraLocRows.push({
          organization_id: args.organizationId,
          customer_id: cid,
          name: pick(SECONDARY_LOCATION_NAMES, i),
          address_line1: `${210 + i * 5} Clinic Way`,
          city: pick(["Fresno", "San Jose", "Sacramento", "Modesto", "Stockton"], i + 2),
          state: "CA",
          postal_code: `${94000 + ((i * 17) % 9899)}`,
          is_default: false,
        })
      }
      if (i % 4 === 0) {
        extraLocRows.push({
          organization_id: args.organizationId,
          customer_id: cid,
          name: pick(TERTIARY_LOCATION_NAMES, i),
          address_line1: `${440 + i * 7} Specialty Blvd`,
          city: pick(["Oakland", "Santa Rosa", "Berkeley", "Salinas"], i + 1),
          state: "CA",
          postal_code: `${94100 + ((i * 23) % 9799)}`,
          is_default: false,
        })
      }
    }
    if (extraLocRows.length > 0) await args.supabase.from("customer_locations").insert(extraLocRows)
  }

  const contacts = customerRows.map((c, i) => ({
    organization_id: args.organizationId,
    customer_id: customerIndex.get(c.external_code)!,
    full_name: pick(
      [
        "Jordan Alvarez",
        "Priya Shah",
        "Elena Morales",
        "Noah Kim",
        "Taylor Brooks",
        "Morgan Patel",
        "Renee Collins",
        "David Okoro",
        "Mei Tan",
        "Samir Haddad",
      ],
      i,
    ),
    role: pick(["Clinical Engineering", "Facilities", "Imaging Director", "SPD Manager", "Biomed Lead"], i),
    email: `operations${i + 1}@${profile.industry}.demo`,
    phone: `(209) 555-${String(2100 + i).slice(-4)}`,
    is_primary: true,
  }))
  await args.supabase.from("customer_contacts").insert(contacts)

  const eqStatusCycle = [
    "active",
    "active",
    "needs_service",
    "active",
    "in_repair",
    "needs_service",
    "out_of_service",
    "active",
    "active",
    "in_repair",
  ] as const

  const equipmentRows = Array.from({ length: equipmentTarget }, (_, i) => {
    const code = `DEMO-C${String((i % customerTarget) + 1).padStart(2, "0")}`
    const type = pick(profile.equipmentAssetTypes, i)
    const st = eqStatusCycle[i % eqStatusCycle.length]
    const warrantyEnd = addDays(new Date(), 90 + (i % 400))
    const underWarrantyNote = i % 6 === 0 && st === "active"
    return {
      organization_id: args.organizationId,
      customer_id: customerIndex.get(code)!,
      equipment_code: `DEMO-E${String(i + 1).padStart(3, "0")}`,
      name: type.name,
      manufacturer: type.manufacturer,
      category: type.category,
      serial_number: `SN-${profile.industry.toUpperCase()}-${2020 + (i % 6)}-${10000 + i}`,
      status: st,
      install_date: addDays(new Date(), -(700 + i * 11)),
      warranty_expires_at:
        st === "out_of_service" ? addDays(new Date(), -400)
        : st === "active" && underWarrantyNote ? addDays(new Date(), 180 + (i % 120))
        : warrantyEnd,
      last_service_at: addDays(new Date(), -(15 + (i % 40))),
      next_due_at: addDays(new Date(), (i % 55) - 18),
      location_label: pick(
        ["ICU", "Radiology", "SPD / Sterile Processing", "Infusion Bay", "Emergency", "Lab — Blood Bank", "Oncology Suite"],
        i,
      ),
      notes:
        underWarrantyNote ?
          "Under OEM warranty — PM aligned with manufacturer IFU; traceable cal stickers current."
        : st === "needs_service" ?
          "Flagged after rounds — prioritize inspection/calibration window."
        : st === "out_of_service" ?
          "Retired from clinical service — disposition pending asset recovery policy."
        : `${profile.demoCompanyName} demo asset.`,
      created_by: args.ownerUserId,
      is_sample: true,
    }
  })

  const { data: equipment, error: eqErr } = await args.supabase
    .from("equipment")
    .insert(equipmentRows)
    .select("id, equipment_code, customer_id")
  if (eqErr) throw new Error(eqErr.message)

  const equipmentIndex = new Map<string, { id: string; customer_id: string }>()
  for (const e of equipment ?? []) equipmentIndex.set(e.equipment_code, { id: e.id, customer_id: e.customer_id })

  const techSeeded = await seedTechnicianAuthMembers({
    supabase: args.supabase,
    organizationId: args.organizationId,
    ownerUserId: args.ownerUserId,
    industry: args.industry,
    specialties: profile.technicianSpecialties,
    rosterSize: rich ? 12 : 6,
  })

  const operationalN = techSeeded ? await syncOperationalTechnicians(args.supabase, args.organizationId) : 0

  const { data: assignPool, error: poolErr } = await args.supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", args.organizationId)
    .eq("status", "active")
    .in("role", ["tech", "owner", "admin"])
  if (poolErr) throw new Error(poolErr.message)
  const assignableUsers = [
    args.ownerUserId,
    ...((assignPool ?? [])
      .map((r) => (r as { user_id: string }).user_id)
      .filter((id) => id && id !== args.ownerUserId)),
  ]

  const workOrderRows = Array.from({ length: workOrderTarget }, (_, i) => {
    const eqCode = `DEMO-E${String((i % equipmentTarget) + 1).padStart(3, "0")}`
    const eq = equipmentIndex.get(eqCode)!
    const status = woStatusForIndex(i)
    const scheduledOn = scheduledOnForWorkOrder(i, status)
    const completedAt = completedAtFor(status, i)
    const assignUser = pick(assignableUsers, i)
    const invoiceNumber =
      status === "invoiced" ? `INV-DEMO-${String(24000 + i).slice(-5)}` : null

    return {
      organization_id: args.organizationId,
      customer_id: eq.customer_id,
      equipment_id: eq.id,
      title: pick(profile.workOrderTitleExamples, i),
      status,
      priority: pick(["low", "normal", "normal", "high", "critical"], i),
      type: pick(["repair", "pm", "inspection", "install", "emergency"], i),
      scheduled_on: scheduledOn,
      scheduled_time: `${String(8 + (i % 9)).padStart(2, "0")}:00:00`,
      completed_at: completedAt,
      assigned_user_id: assignUser,
      invoice_number: invoiceNumber,
      total_labor_cents: 12000 + i * 420,
      total_parts_cents: 800 + (i % 11) * 275,
      problem_reported:
        status === "open" || status === "scheduled" ?
          pick(
            [
              "Intermittent alarm during self-test",
              "Visual inspection requested after PM",
              "Performance drift noted by clinical staff",
            ],
            i,
          )
        : null,
      repair_log: {
        problemReported: "Clinical engineering service request — seeded demo dataset.",
        diagnosis: "Assessment and documentation per OEM service literature.",
        partsUsed: [],
        laborHours: 0,
        technicianNotes: "Demo seed entry.",
        photos: [],
        signatureDataUrl: "",
        signedBy: "",
        signedAt: "",
        tasks: [],
      },
      notes: `${profile.industry} demo work order.`,
      created_by: args.ownerUserId,
      is_sample: true,
    }
  })

  const { data: insertedWOs, error: woErr } = await args.supabase
    .from("work_orders")
    .insert(workOrderRows)
    .select("id, equipment_id, customer_id, status")
  if (woErr) throw new Error(woErr.message)

  const planRows = Array.from({ length: planTarget }, (_, i) => {
    const eqCode = `DEMO-E${String((i % equipmentTarget) + 1).padStart(3, "0")}`
    const eq = equipmentIndex.get(eqCode)!
    const plan = pick(profile.maintenancePlanExamples, i)
    const st = pick(["active", "active", "active", "paused", "expired"], i)
    const overdueActive = st === "active" && i % 11 === 0
    const nextDue =
      st === "expired" ? addDays(new Date(), -(400 + (i % 120)))
      : overdueActive ? addDays(new Date(), -(14 + (i % 60)))
      : addDays(new Date(), -7 + (i % 67))
    const lastSvc =
      st === "expired" ? addDays(new Date(nextDue), -(300 + (i % 40))) : addDays(new Date(nextDue), -(30 + (i % 40)))
    return {
      organization_id: args.organizationId,
      customer_id: eq.customer_id,
      equipment_id: eq.id,
      assigned_user_id: args.ownerUserId,
      name: plan.name,
      status: st,
      priority: pick(["normal", "normal", "high", "critical", "low"], i),
      interval_value: plan.intervalValue,
      interval_unit: plan.intervalUnit,
      last_service_date: lastSvc,
      next_due_date: nextDue,
      auto_create_work_order: i % 2 === 0,
      notes:
        overdueActive ?
          `${profile.industry} seeded plan — overdue window for dispatch QA screenshots.`
        : `${profile.industry} seeded maintenance plan.`,
      services: [
        { name: "Safety and operational checks", interval: "Recurring" },
        { name: "Documentation & labeling review", interval: "Recurring" },
      ],
      notification_rules: [{ id: `seed-email-${i}`, offsetDays: 14, channel: "email", target: "dispatch@demo.local" }],
      created_by: args.ownerUserId,
      is_sample: true,
    }
  })
  const { error: mpErr } = await args.supabase.from("maintenance_plans").insert(planRows)
  if (mpErr) throw new Error(mpErr.message)

  let calibrationTemplates = 0
  let calibrationRecords = 0
  const templateIds: string[] = []

  // Industry-aware starter templates: every industry gets at least a small,
  // representative checklist library so the workspace doesn't look empty.
  // Backed by `lib/demo-seeding/industry-templates.ts` mapping foundation.
  const industryTemplates = getStarterTemplatesForIndustry(args.industry)
  if (industryTemplates.length > 0) {
    const tRows = industryTemplates.map((t) => ({
      organization_id: args.organizationId,
      name: t.name,
      equipment_category_id: t.equipmentCategoryId,
      fields: t.fields,
      is_archived: false,
      is_sample: true,
    }))
    const { data: tIns, error: tErr } = await args.supabase.from("calibration_templates").insert(tRows).select("id")
    if (tErr) throw new Error(tErr.message)
    for (const t of tIns ?? []) templateIds.push((t as { id: string }).id)
    calibrationTemplates = templateIds.length
  }

  // Calibration records are only seeded for the rich (medical) demo where the
  // values payloads carry meaningful biomedical data. Other industries still
  // get the templates above so admins can author records themselves.
  if (rich && insertedWOs && insertedWOs.length > 0 && templateIds.length > 0) {
    const certCandidates = (insertedWOs as { id: string; equipment_id: string; status: string }[]).filter((w) =>
      ["completed", "completed_pending_signature", "invoiced"].includes(w.status),
    )
    const valuesA = { pf_g: "pass", pf_l: "pass", n_doc: "Within OEM acceptance limits; NIST-traceable references." }
    const valuesB = { pf_alarm: "pass", pf_flow: "pass", cb_cal: true }

    const recordRows = certCandidates.slice(0, certTarget).map((w, i) => ({
      organization_id: args.organizationId,
      work_order_id: w.id,
      equipment_id: w.equipment_id,
      template_id: pick(templateIds, i),
      values: i % 2 === 0 ? valuesA : valuesB,
      created_by: args.ownerUserId,
      is_sample: true,
    }))
    if (recordRows.length > 0) {
      const { error: calErr } = await args.supabase.from("calibration_records").insert(recordRows)
      if (calErr) throw new Error(calErr.message)
      calibrationRecords = recordRows.length
    }
  }

  let vendorsInserted = 0
  const vendorIdByIndex: string[] = []
  if (rich && vendorTarget > 0) {
    const vRows = BIOMED_VENDOR_NAMES.slice(0, vendorTarget).map((v, i) => ({
      organization_id: args.organizationId,
      name: v.name,
      email: v.email,
      phone: v.phone,
      contact_name: v.contact,
      billing_address: `${500 + i * 7} Commerce Blvd, Industry CA 91746`,
      shipping_address: `${500 + i * 7} Commerce Blvd, Industry CA 91746`,
      is_archived: false,
      is_sample: true,
    }))
    const { data: vIns, error: vErr } = await args.supabase.from("org_vendors").insert(vRows).select("id")
    if (vErr) throw new Error(vErr.message)
    for (const v of vIns ?? []) vendorIdByIndex.push((v as { id: string }).id)
    vendorsInserted = vendorIdByIndex.length
  }

  let catalogInserted = 0
  const catalogIds: string[] = []
  if (rich && catalogTarget > 0 && vendorIdByIndex.length > 0) {
    const catPartNames = [
      { n: "Sterilizer door gasket kit", t: "part" as const, cat: "Sterilization" },
      { n: "Infusion pump pole clamp assembly", t: "part" as const, cat: "Infusion" },
      { n: "Defibrillator battery pack (LiMnO2)", t: "part" as const, cat: "Emergency Care" },
      { n: "Patient monitor NBP hose & cuff set", t: "accessory" as const, cat: "Patient Monitoring" },
      { n: "Ultrasound probe lens assembly", t: "part" as const, cat: "Imaging" },
      { n: "Sterilizer BI test pack (spore)", t: "accessory" as const, cat: "Sterilization" },
      { n: "Annual electrical safety & performance (SEP)", t: "service" as const, cat: "Compliance" },
      { n: "Imaging QA phantom session", t: "service" as const, cat: "Imaging QA" },
      { n: "Centrifuge rotor bucket set", t: "part" as const, cat: "Laboratory" },
      { n: "Audiometer daily bioacoustic check kit", t: "accessory" as const, cat: "Diagnostics / Audiology" },
      { n: "Low-temp sterilizer sterilant cassette", t: "part" as const, cat: "Sterilization" },
      { n: "Infusion dedicated IV set (needle-free)", t: "part" as const, cat: "Infusion" },
      { n: "Patient monitor SpO₂ finger sensor", t: "accessory" as const, cat: "Patient Monitoring" },
      { n: "Portable X-ray DR detector tether cable", t: "part" as const, cat: "Imaging" },
      { n: "ECG acquisition module battery", t: "part" as const, cat: "Diagnostics" },
      { n: "SPD instrument tray seal gasket", t: "part" as const, cat: "Sterilization" },
      { n: "Quarterly infusion fleet PM bundle", t: "service" as const, cat: "Infusion" },
      { n: "Sterilizer chamber leak test service", t: "service" as const, cat: "Sterilization" },
    ]
    const catRows = Array.from({ length: catalogTarget }, (_, i) => {
      const part = pick(catPartNames, i)
      return {
        organization_id: args.organizationId,
        vendor_id: pick(vendorIdByIndex, i),
        manufacturer_name: pick(["STERIS", "BD", "Philips", "GE HealthCare", "ZOLL", "Mindray"], i),
        category: part.cat,
        item_type: part.t,
        part_number: `PBS-PART-${String(i + 1).padStart(4, "0")}`,
        sku: `PBS-SKU-${String(i + 1).padStart(4, "0")}`,
        name: part.n,
        description: "Precision Biomedical demo catalog line.",
        list_price: 120 + (i % 50) * 7,
        sale_price: 110 + (i % 50) * 6,
        unit: "ea",
        status: "active" as const,
        source_type: "manual" as const,
        is_sample: true,
      }
    })
    const { data: cIns, error: cErr } = await args.supabase.from("catalog_items").insert(catRows).select("id")
    if (cErr) throw new Error(cErr.message)
    for (const c of cIns ?? []) catalogIds.push((c as { id: string }).id)
    catalogInserted = catalogIds.length
  }

  let quotesInserted = 0
  if (rich && quoteTarget > 0 && insertedWOs && insertedWOs.length > 0) {
    const quoteStatuses = ["draft", "draft", "sent", "sent", "approved", "declined", "pending_approval", "expired"] as const
    const custIds = customerRows.map((c) => customerIndex.get(c.external_code)!)
    const qRows = Array.from({ length: quoteTarget }, (_, i) => {
      const cid = pick(custIds, i)
      const eid = equipmentIndex.get(`DEMO-E${String((i % equipmentTarget) + 1).padStart(3, "0")}`)!.id
      const woLink = i % 3 === 0 ? (insertedWOs as { id: string }[])[i % insertedWOs.length]!.id : null
      const amt = 35000 + i * 1200
      return {
        organization_id: args.organizationId,
        customer_id: cid,
        equipment_id: eid,
        work_order_id: woLink,
        seed_key: `demo-import-qt-${String(i + 1).padStart(5, "0")}`,
        quote_number: `Q-DEMO-${String(i + 1).padStart(4, "0")}`,
        title: pick(
          [
            "Sterilizer temperature uniformity study",
            "Infusion pump fleet PM",
            "Imaging QA & calibration visit",
            "Monitor alarm verification",
          ],
          i,
        ),
        amount_cents: amt,
        status: pick(quoteStatuses, i),
        expires_at: addDays(new Date(), 10 + (i % 40)),
        line_items: [
          { description: "Labor — clinical engineering", qty: 1, unit: amt / 100 / 2 },
          { description: "Parts / consumables", qty: 1, unit: amt / 100 / 2 },
        ],
        notes: "Hospital-approved scope — demo quote.",
        created_by: args.ownerUserId,
        is_sample: true,
      }
    })
    const { error: qErr } = await args.supabase.from("org_quotes").insert(qRows)
    if (qErr) throw new Error(qErr.message)
    quotesInserted = quoteTarget
  }

  let invoicesInserted = 0
  if (rich && invoiceTarget > 0 && insertedWOs && insertedWOs.length > 0) {
    const invStatuses = ["draft", "sent", "unpaid", "paid", "overdue", "paid", "sent", "overdue", "void"] as const
    const custIds = customerRows.map((c) => customerIndex.get(c.external_code)!)
    const invRows = Array.from({ length: invoiceTarget }, (_, i) => {
      const cid = pick(custIds, i)
      const eid = equipmentIndex.get(`DEMO-E${String((i % equipmentTarget) + 1).padStart(3, "0")}`)!.id
      const wo = pick(insertedWOs as { id: string }[], i + 3)
      const st = pick(invStatuses, i)
      let issued = addDays(new Date(), -(5 + (i % 120)))
      let due = addDays(new Date(issued), 30)
      if (st === "overdue") {
        issued = addDays(new Date(), -(55 + (i % 40)))
        due = addDays(new Date(), -(8 + (i % 14)))
      }
      const amt = 28000 + i * 900
      const paidAt =
        st === "paid" ? addDays(new Date(issued), 12)
        : st === "void" ? null
        : null
      return {
        organization_id: args.organizationId,
        customer_id: cid,
        equipment_id: eid,
        work_order_id: wo?.id ?? null,
        seed_key: `demo-import-inv-${String(i + 1).padStart(5, "0")}`,
        invoice_number: `I-DEMO-${String(i + 1).padStart(4, "0")}`,
        title: pick(["Field service invoice", "Preventive maintenance billing", "Calibration services"], i),
        amount_cents: amt,
        status: st,
        issued_at: issued,
        due_date: due,
        paid_at: paidAt,
        line_items: [{ description: "Biomedical field labor & travel", qty: 1, unit: amt / 100 }],
        notes: "Demo AR row — not a real bill.",
        created_by: args.ownerUserId,
        is_sample: true,
      }
    })
    const { error: iErr } = await args.supabase.from("org_invoices").insert(invRows)
    if (iErr) throw new Error(iErr.message)
    invoicesInserted = invoiceTarget
  }

  let posInserted = 0
  if (rich && poTarget > 0 && vendorIdByIndex.length > 0 && catalogIds.length > 0 && insertedWOs && insertedWOs.length > 0) {
    const poStatuses = ["draft", "sent", "approved", "ordered", "partially_received", "received", "closed"] as const
    const poRows = Array.from({ length: poTarget }, (_, i) => {
      const vid = pick(vendorIdByIndex, i)
      const vname = BIOMED_VENDOR_NAMES[i % BIOMED_VENDOR_NAMES.length]!.name
      const cid = pick(customerRows.map((c) => customerIndex.get(c.external_code)!), i)
      const eid = equipmentIndex.get(`DEMO-E${String((i % equipmentTarget) + 1).padStart(3, "0")}`)!.id
      const woid = (insertedWOs as { id: string }[])[i % insertedWOs.length]!.id
      const catId = pick(catalogIds, i)
      const total = 45000 + i * 800
      const u1 = Math.floor(total * 0.55)
      const u2 = Math.floor(total * 0.35)
      const u3 = total - u1 - u2
      const q1 = 2
      const q2 = 1
      const lt1 = q1 * u1
      const lt2 = q2 * u2
      const lt3 = u3
      return {
        organization_id: args.organizationId,
        vendor_id: vid,
        vendor: vname,
        vendor_email: `${vname.slice(0, 3).toLowerCase()}@vendor.demo`,
        status: pick(poStatuses, i),
        order_date: addDays(new Date(), -(i % 45)),
        expected_date: addDays(new Date(), 7 + (i % 14)),
        total_cents: total,
        line_items: [
          {
            description: "OEM spare / consumable",
            quantity: q1,
            unitCostCents: u1,
            lineTotalCents: lt1,
            catalog_item_id: catId,
          },
          {
            description: "Freight & handling",
            quantity: q2,
            unitCostCents: u2,
            lineTotalCents: lt2,
          },
          {
            description: "Misc supplies",
            quantity: 1,
            unitCostCents: u3,
            lineTotalCents: lt3,
          },
        ],
        notes: "Demo PO — SPD restock.",
        customer_id: cid,
        equipment_id: eid,
        work_order_id: woid,
        is_sample: true,
      }
    })
    const { error: poErr } = await args.supabase.from("org_purchase_orders").insert(poRows)
    if (poErr) throw new Error(poErr.message)
    posInserted = poTarget
  }

  try {
    const adminOrg = createServiceRoleSupabaseClient()
    const { error: orgMetaErr } = await adminOrg
      .from("organizations")
      .update({ demo_seed_industry: args.industry, updated_at: new Date().toISOString() })
      .eq("id", args.organizationId)
    if (orgMetaErr) throw new Error(orgMetaErr.message)
  } catch {
    const { error: orgMetaErr } = await args.supabase
      .from("organizations")
      .update({ demo_seed_industry: args.industry, updated_at: new Date().toISOString() })
      .eq("id", args.organizationId)
    if (orgMetaErr) throw new Error(orgMetaErr.message)
  }

  return {
    seeded: true,
    skipped: false,
    industry: args.industry,
    counts: {
      customers: customerTarget,
      equipment: equipmentTarget,
      workOrders: workOrderTarget,
      maintenancePlans: planTarget,
      technicians: rich ? 12 : 6,
      techniciansOperational: operationalN,
      vendors: vendorsInserted,
      catalogItems: catalogInserted,
      quotes: quotesInserted,
      invoices: invoicesInserted,
      purchaseOrders: posInserted,
      calibrationTemplates,
      calibrationRecords,
    },
    techniciansSeeded: techSeeded,
  }
}
