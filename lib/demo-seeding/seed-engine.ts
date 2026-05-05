import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { DEMO_INDUSTRY_PROFILES, normalizeIndustryKey, type DemoIndustryKey } from "@/lib/demo-seeding/profiles"

type SeedArgs = {
  supabase: SupabaseClient
  organizationId: string
  ownerUserId: string
  industry: string | null | undefined
}

type SeedResult = {
  seeded: boolean
  skipped: boolean
  industry: DemoIndustryKey
  counts?: {
    customers: number
    equipment: number
    workOrders: number
    maintenancePlans: number
    technicians: number
  }
  techniciansSeeded?: boolean
}

function pick<T>(items: T[], idx: number) {
  return items[idx % items.length]!
}

export async function seedDemoForIndustry(args: SeedArgs): Promise<SeedResult> {
  const industry = normalizeIndustryKey(args.industry)
  const profile = DEMO_INDUSTRY_PROFILES[industry]

  const { count: existingCustomers, error: existingErr } = await args.supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", args.organizationId)
  if (existingErr) throw new Error(existingErr.message)
  if ((existingCustomers ?? 0) > 0) {
    return { seeded: false, skipped: true, industry }
  }

  const customerTarget = Math.max(profile.dashboardMetricTargets.customers, 20)
  const equipmentTarget = Math.max(profile.dashboardMetricTargets.equipment, 50)
  const workOrderTarget = Math.max(profile.dashboardMetricTargets.workOrders, 30)
  const planTarget = Math.max(profile.dashboardMetricTargets.maintenancePlans, 12)

  const customerRows = Array.from({ length: customerTarget }, (_, i) => ({
    organization_id: args.organizationId,
    external_code: `DEMO-C${String(i + 1).padStart(2, "0")}`,
    company_name:
      profile.customerTypes[i] ?? `${pick(profile.customerTypes, i)} ${Math.floor(i / profile.customerTypes.length) + 2}`,
    status: "active",
    joined_at: new Date(Date.now() - (i + 1) * 86400000 * 17).toISOString().slice(0, 10),
    created_by: args.ownerUserId,
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

  const locations = customerRows.map((c, i) => ({
    organization_id: args.organizationId,
    customer_id: customerIndex.get(c.external_code)!,
    name: "Primary Site",
    address_line1: `${100 + i * 7} Service Park Dr`,
    city: pick(["Fresno", "San Jose", "Sacramento", "Reno", "Long Beach"], i),
    state: pick(["CA", "CA", "CA", "NV", "CA"], i),
    postal_code: `${90000 + ((i * 37) % 8999)}`,
    is_default: true,
  }))
  await args.supabase.from("customer_locations").insert(locations)

  const contacts = customerRows.map((c, i) => ({
    organization_id: args.organizationId,
    customer_id: customerIndex.get(c.external_code)!,
    full_name: pick(
      ["Jordan Alvarez", "Priya Shah", "Elena Morales", "Noah Kim", "Taylor Brooks", "Morgan Patel"],
      i,
    ),
    role: "Operations Manager",
    email: `ops${i + 1}@${profile.industry}.demo`,
    phone: `(209) 555-${String(2100 + i).slice(-4)}`,
    is_primary: true,
  }))
  await args.supabase.from("customer_contacts").insert(contacts)

  const equipmentRows = Array.from({ length: equipmentTarget }, (_, i) => {
    const code = `DEMO-C${String((i % customerTarget) + 1).padStart(2, "0")}`
    const type = pick(profile.equipmentAssetTypes, i)
    return {
      organization_id: args.organizationId,
      customer_id: customerIndex.get(code)!,
      equipment_code: `DEMO-E${String(i + 1).padStart(3, "0")}`,
      name: type.name,
      manufacturer: type.manufacturer,
      category: type.category,
      serial_number: `SN-${profile.industry.toUpperCase()}-${2020 + (i % 6)}-${10000 + i}`,
      status: pick(["active", "active", "active", "needs_service", "in_repair"], i),
      install_date: new Date(Date.now() - (600 + i * 13) * 86400000).toISOString().slice(0, 10),
      warranty_expires_at: new Date(Date.now() + (120 + i * 11) * 86400000).toISOString().slice(0, 10),
      last_service_at: new Date(Date.now() - (20 + i * 2) * 86400000).toISOString().slice(0, 10),
      next_due_at: new Date(Date.now() + (5 + i) * 86400000).toISOString().slice(0, 10),
      location_label: pick(["Main Plant", "East Wing", "Service Bay", "Operations Floor"], i),
      notes: `${profile.demoCompanyName} seeded demo asset.`,
      created_by: args.ownerUserId,
    }
  })

  const { data: equipment, error: eqErr } = await args.supabase
    .from("equipment")
    .insert(equipmentRows)
    .select("id, equipment_code, customer_id")
  if (eqErr) throw new Error(eqErr.message)

  const equipmentIndex = new Map<string, { id: string; customer_id: string }>()
  for (const e of equipment ?? []) equipmentIndex.set(e.equipment_code, { id: e.id, customer_id: e.customer_id })

  const workOrderRows = Array.from({ length: workOrderTarget }, (_, i) => {
    const eqCode = `DEMO-E${String((i % equipmentTarget) + 1).padStart(3, "0")}`
    const eq = equipmentIndex.get(eqCode)!
    const status = pick(["open", "scheduled", "in_progress", "completed", "invoiced"], i) as
      | "open"
      | "scheduled"
      | "in_progress"
      | "completed"
      | "invoiced"
    return {
      organization_id: args.organizationId,
      customer_id: eq.customer_id,
      equipment_id: eq.id,
      title: pick(profile.workOrderTitleExamples, i),
      status,
      priority: pick(["low", "normal", "normal", "high", "critical"], i),
      type: pick(["repair", "pm", "inspection", "install", "emergency"], i),
      scheduled_on: new Date(Date.now() - 10 * 86400000 + i * 86400000).toISOString().slice(0, 10),
      scheduled_time: `${String(8 + (i % 8)).padStart(2, "0")}:00:00`,
      completed_at: status === "completed" || status === "invoiced" ? new Date().toISOString() : null,
      assigned_user_id: args.ownerUserId,
      total_labor_cents: 12000 + i * 550,
      total_parts_cents: 1000 + (i % 9) * 350,
      repair_log: {
        problemReported: "Customer service request created from seeded demo.",
        diagnosis: "Initial diagnostics completed and documented.",
        partsUsed: [],
        laborHours: 0,
        technicianNotes: "Seeded demo note.",
        photos: [],
        signatureDataUrl: "",
        signedBy: "",
        signedAt: "",
        tasks: [],
      },
      notes: `${profile.industry} demo work order.`,
      created_by: args.ownerUserId,
    }
  })
  const { error: woErr } = await args.supabase.from("work_orders").insert(workOrderRows)
  if (woErr) throw new Error(woErr.message)

  const planRows = Array.from({ length: planTarget }, (_, i) => {
    const eqCode = `DEMO-E${String((i % equipmentTarget) + 1).padStart(3, "0")}`
    const eq = equipmentIndex.get(eqCode)!
    const plan = pick(profile.maintenancePlanExamples, i)
    return {
      organization_id: args.organizationId,
      customer_id: eq.customer_id,
      equipment_id: eq.id,
      assigned_user_id: args.ownerUserId,
      name: plan.name,
      status: pick(["active", "active", "active", "paused"], i),
      priority: pick(["normal", "normal", "high", "low"], i),
      interval_value: plan.intervalValue,
      interval_unit: plan.intervalUnit,
      last_service_date: new Date(Date.now() - (80 + i * 2) * 86400000).toISOString().slice(0, 10),
      next_due_date: new Date(Date.now() + (5 + i) * 86400000).toISOString().slice(0, 10),
      auto_create_work_order: i % 2 === 0,
      notes: `${profile.industry} seeded maintenance plan.`,
      services: [
        { name: "Safety and operational checks", interval: "Recurring" },
        { name: "Performance verification", interval: "Recurring" },
      ],
      notification_rules: [
        { id: "seed-email-14", offsetDays: 14, channel: "email", target: "dispatch@equipify-demo.org" },
      ],
      created_by: args.ownerUserId,
    }
  })
  const { error: mpErr } = await args.supabase.from("maintenance_plans").insert(planRows)
  if (mpErr) throw new Error(mpErr.message)

  const technicianSeeded = await seedTechnicianMembers({
    organizationId: args.organizationId,
    ownerUserId: args.ownerUserId,
    industry,
    specialties: profile.technicianSpecialties,
  })

  return {
    seeded: true,
    skipped: false,
    industry,
    counts: {
      customers: customerTarget,
      equipment: equipmentTarget,
      workOrders: workOrderTarget,
      maintenancePlans: planTarget,
      technicians: technicianSeeded ? 6 : 1,
    },
    techniciansSeeded: technicianSeeded,
  }
}

async function seedTechnicianMembers(params: {
  organizationId: string
  ownerUserId: string
  industry: DemoIndustryKey
  specialties: string[]
}) {
  const admin = createServiceRoleClient()
  if (!admin) return false

  const names = ["Alex Rivera", "Linh Nguyen", "Sanjay Patel", "Casey Morrison", "Yasmin Hassan", "Jordan Kim"]
  for (let i = 0; i < names.length; i += 1) {
    const fullName = names[i]!
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
        role: "technician",
        status: "active",
        invited_by: params.ownerUserId,
        job_title: "Field Service Technician",
        region: pick(["Central", "North", "South", "East", "West"], i),
        skills: params.specialties,
        availability_status: "Available",
      },
      { onConflict: "organization_id,user_id" },
    )
  }
  return true
}
