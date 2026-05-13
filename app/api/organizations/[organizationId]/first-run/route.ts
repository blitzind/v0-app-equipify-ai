import { NextResponse } from "next/server"
import { requireOrgMemberSession } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isLaunchpadStepApplicable } from "@/lib/first-run/launchpad-eligibility"
import {
  FIRST_RUN_LAUNCHPAD_HIDDEN_ORG_IDS,
  FIRST_RUN_WELCOME_ACK_ORG_IDS,
  parseOrgIdList,
  withOrgIdAppended,
  withOrgIdRemoved,
} from "@/lib/first-run/user-metadata"
import { industryLabelForLaunchpad } from "@/lib/first-run/launchpad-copy"
import { resolveOnboardingIndustryBundle } from "@/lib/onboarding-industry/resolve-onboarding-industry-bundle"
import type { FirstRunStepId } from "@/lib/first-run/types"

export type { FirstRunStepId } from "@/lib/first-run/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireOrgMemberSession(organizationId)
  if ("error" in gate) return gate.error

  const { supabase, permissions } = gate

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  const userMeta = (authUser?.user_metadata ?? {}) as Record<string, unknown>
  const welcomeAckedForOrg = parseOrgIdList(userMeta, FIRST_RUN_WELCOME_ACK_ORG_IDS).includes(organizationId)
  const launchpadHiddenForOrg = parseOrgIdList(userMeta, FIRST_RUN_LAUNCHPAD_HIDDEN_ORG_IDS).includes(
    organizationId,
  )

  const [
    orgRes,
    blitzpaySettingsRes,
    custReal,
    custSample,
    eqReal,
    woReal,
    quoteReal,
    invSent,
    members,
    invites,
    qbRow,
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "industry, demo_seed_status, stripe_connect_account_id, stripe_connect_onboarding_complete, stripe_connect_status",
      )
      .eq("id", organizationId)
      .maybeSingle(),
    supabase
      .from("blitzpay_org_settings")
      .select("blitzpay_invoice_pay_enabled")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_sample", false),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_sample", true),
    supabase
      .from("equipment")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_sample", false),
    supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_sample", false),
    supabase
      .from("org_quotes")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_sample", false),
    supabase
      .from("org_invoices")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_sample", false)
      .neq("status", "draft"),
    supabase
      .from("organization_members")
      .select("user_id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "active"),
    supabase
      .from("organization_invites")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString()),
    supabase
      .from("organization_integrations")
      .select("connection_status")
      .eq("organization_id", organizationId)
      .eq("provider", "quickbooks_online")
      .maybeSingle(),
  ])

  if (orgRes.error) {
    return NextResponse.json({ error: "query_failed", message: orgRes.error.message }, { status: 500 })
  }

  const org = orgRes.data as {
    industry?: string | null
    demo_seed_status?: string | null
    stripe_connect_account_id?: string | null
    stripe_connect_onboarding_complete?: boolean | null
    stripe_connect_status?: string | null
  } | null
  const demoSeedSucceeded = org?.demo_seed_status === "succeeded"

  const blitzpayPayEnabled = Boolean(
    !blitzpaySettingsRes.error &&
      (blitzpaySettingsRes.data as { blitzpay_invoice_pay_enabled?: boolean } | null)?.blitzpay_invoice_pay_enabled,
  )
  const connectAcct = String(org?.stripe_connect_account_id ?? "").trim()
  const connectOnboardingDone =
    Boolean(org?.stripe_connect_onboarding_complete) ||
    String(org?.stripe_connect_status ?? "").toLowerCase() === "ready"
  const blitzpaySetupDone = blitzpayPayEnabled || (connectAcct.length > 0 && connectOnboardingDone)
  const sampleCustomers = custSample.count ?? 0
  const hasSampleWorkspace = demoSeedSucceeded || sampleCustomers > 0

  const nCustReal = custReal.count ?? 0
  const nEqReal = eqReal.count ?? 0
  const nWoReal = woReal.count ?? 0
  const nQuoteReal = quoteReal.count ?? 0
  const nInvSent = invSent.count ?? 0
  const nMembers = members.count ?? 0
  const nInvites = invites.count ?? 0
  const teamExpanded = nMembers >= 2 || nInvites > 0

  const qb = qbRow.data as { connection_status?: string | null } | null
  const quickbooksConnected = qb?.connection_status === "connected"

  const stepRows: Array<{
    id: FirstRunStepId
    label: string
    description: string
    done: boolean
    href: string
  }> = [
    {
      id: "customer",
      label: "Add your first customer",
      description: "Create a real customer record (separate from any demo customers).",
      done: nCustReal >= 1,
      href: "/customers",
    },
    {
      id: "equipment",
      label: "Add your first equipment or asset",
      description: "Attach equipment to a customer so work history stays organized.",
      done: nEqReal >= 1,
      href: "/equipment",
    },
    {
      id: "work_order",
      label: "Create your first work order",
      description: "Schedule or log work against your own equipment.",
      done: nWoReal >= 1,
      href: "/work-orders",
    },
    {
      id: "quote",
      label: "Create your first quote",
      description: "Send a quote when you are ready to price work formally.",
      done: nQuoteReal >= 1,
      href: "/quotes",
    },
    {
      id: "invoice_sent",
      label: "Send your first invoice",
      description: "Move an invoice beyond draft when you are ready to bill.",
      done: nInvSent >= 1,
      href: "/invoices",
    },
    {
      id: "blitzpay",
      label: "Set up BlitzPay",
      description: "Accept online invoice payments and optionally pass processing fees to customers.",
      done: blitzpaySetupDone,
      href: "/settings/payments",
    },
    {
      id: "team_invite",
      label: "Invite a teammate",
      description: "Add dispatch, billing, or field roles under Team.",
      done: teamExpanded,
      href: "/settings/team",
    },
    {
      id: "quickbooks",
      label: "Connect QuickBooks",
      description: "Optional — sync customers, items, and invoices when your books are ready.",
      done: quickbooksConnected,
      href: "/settings/integrations/quickbooks",
    },
  ]

  const industry = org?.industry ?? null
  const industryLabel = industryLabelForLaunchpad(industry)
  const onboardingBundle = resolveOnboardingIndustryBundle(industry, industryLabel)

  const steps = stepRows.map((s) => {
    const o = onboardingBundle.launchpadStepCopy[s.id]
    return {
      ...s,
      label: o?.label ?? s.label,
      description: o?.description ?? s.description,
      applicable: isLaunchpadStepApplicable(s.id, permissions),
    }
  })

  const resourceLinks: { label: string; href: string }[] = []
  if (permissions.canManageWorkspaceSettings) {
    resourceLinks.push({ label: "Sample data & demo bundles", href: "/settings/sample-data" })
    resourceLinks.push({ label: "Workspace profile", href: "/settings/workspace" })
  }
  if (permissions.canManagePortalSettings || permissions.canManageWorkspaceSettings) {
    resourceLinks.push({ label: "Customer portal", href: "/settings/portal" })
  }
  if (permissions.canViewInsights) {
    resourceLinks.push({ label: "AI Operations", href: "/ai-ops" })
  }
  if (permissions.canManageHistoricalImports || permissions.canManageWorkspaceSettings) {
    resourceLinks.push({ label: "Import center", href: "/settings/imports" })
  }

  return NextResponse.json({
    industry,
    industryLabel,
    industryHint: onboardingBundle.operationalHint,
    welcomeCopy: onboardingBundle.welcomeCopy,
    launchpadSecondaryNote: onboardingBundle.launchpadSecondaryNote,
    exampleWorkflows: onboardingBundle.exampleWorkflows,
    demoWalkthroughHints: onboardingBundle.demoWalkthroughHints,
    quickActions: onboardingBundle.quickActions,
    statCardPriority: onboardingBundle.statCardPriority,
    aidenSectorFraming: onboardingBundle.aidenSectorFraming,
    terminology: onboardingBundle.terminology,
    dashboardEmptyCopy: onboardingBundle.dashboardEmptyCopy,
    signupExampleWorkflows: onboardingBundle.signupExampleWorkflows,
    hasSampleWorkspace,
    demoSeedSucceeded,
    welcomeAckedForOrg,
    launchpadHiddenForOrg,
    counts: {
      customersNonSample: nCustReal,
      equipmentNonSample: nEqReal,
      workOrdersNonSample: nWoReal,
      quotesNonSample: nQuoteReal,
      invoicesNonDraftNonSample: nInvSent,
      activeMembers: nMembers,
      pendingInvites: nInvites,
    },
    steps,
    resourceLinks,
  })
}

type FirstRunPatchBody = {
  action?: string
}

/**
 * Updates per-user, per-org first-run UI flags in Supabase Auth `user_metadata` (no org table writes).
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireOrgMemberSession(organizationId)
  if ("error" in gate) return gate.error

  let body: FirstRunPatchBody
  try {
    body = (await request.json()) as FirstRunPatchBody
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid request body." }, { status: 400 })
  }

  const action = typeof body.action === "string" ? body.action.trim() : ""
  if (action !== "ack_welcome" && action !== "hide_launchpad" && action !== "show_launchpad") {
    return NextResponse.json({ error: "bad_request", message: "Unknown action." }, { status: 400 })
  }

  let svc
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "service_unavailable", message: "Server configuration error." }, { status: 503 })
  }

  const { data: existing, error: loadErr } = await svc.auth.admin.getUserById(gate.userId)
  if (loadErr || !existing.user) {
    return NextResponse.json(
      { error: "load_failed", message: loadErr?.message ?? "Could not load user." },
      { status: 500 },
    )
  }

  const meta = (existing.user.user_metadata ?? {}) as Record<string, unknown>
  const ack = parseOrgIdList(meta, FIRST_RUN_WELCOME_ACK_ORG_IDS)
  const hidden = parseOrgIdList(meta, FIRST_RUN_LAUNCHPAD_HIDDEN_ORG_IDS)

  let nextAck = ack
  let nextHidden = hidden
  if (action === "ack_welcome") {
    nextAck = withOrgIdAppended(ack, organizationId)
  }
  if (action === "hide_launchpad") {
    nextHidden = withOrgIdAppended(hidden, organizationId)
  }
  if (action === "show_launchpad") {
    nextHidden = withOrgIdRemoved(hidden, organizationId)
  }

  const { error: upErr } = await svc.auth.admin.updateUserById(gate.userId, {
    user_metadata: {
      ...meta,
      [FIRST_RUN_WELCOME_ACK_ORG_IDS]: nextAck,
      [FIRST_RUN_LAUNCHPAD_HIDDEN_ORG_IDS]: nextHidden,
    },
  })

  if (upErr) {
    return NextResponse.json({ error: "update_failed", message: upErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    welcomeAckedForOrg: nextAck.includes(organizationId),
    launchpadHiddenForOrg: nextHidden.includes(organizationId),
  })
}
