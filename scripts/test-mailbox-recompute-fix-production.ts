import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { isMailboxTokenExpired } from "../lib/growth/mailboxes/mailbox-health"

async function main(): Promise<void> {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: [".env.vercel.production", ".vercel/.env.production.local", ".env.production.local", ".env.local.rebuild"],
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })
  if (!boot) throw new Error("no boot")
  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const before = await admin
    .schema("growth")
    .from("mailbox_connections")
    .select("status,token_expires_at,health_reason")
    .eq("id", "237b9dcc-4e2a-4df2-a618-c6aeed7beda2")
    .maybeSingle()
  console.log(
    "before",
    JSON.stringify({
      ...before.data,
      token_expired: isMailboxTokenExpired(before.data?.token_expires_at),
      now: new Date().toISOString(),
    }),
  )
  const { getMailboxConnectionBySender } = await import("../lib/growth/mailboxes/mailbox-repository")
  const m = await getMailboxConnectionBySender(admin, "46d733bd-554e-4fe4-89b0-8509a74004e9")
  const after = await admin
    .schema("growth")
    .from("mailbox_connections")
    .select("status,token_expires_at,health_reason,connection_health")
    .eq("id", "237b9dcc-4e2a-4df2-a618-c6aeed7beda2")
    .maybeSingle()
  console.log("after_recompute", JSON.stringify({ mapped: m?.status, db: after.data }))
}

main()
