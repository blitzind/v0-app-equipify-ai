/**
 * GS-GROWTH-MAIL-7D — Operator-facing admin provider link cleanup certification.
 * Run: pnpm test:growth-operator-facing-admin-link-cleanup-7d
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_DELIVERY_SETTINGS_PATH } from "../lib/growth/navigation/growth-delivery-settings-navigation"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

const OPERATOR_SURFACES = [
  "components/growth/growth-outbound-operations-dashboard.tsx",
  "components/growth/growth-mailbox-connections-dashboard.tsx",
  "lib/growth/aiden/aiden-guided-workflows.ts",
  "lib/growth/aiden/aiden-ask-engine.ts",
  "lib/growth/aiden/aiden-priority-engine.ts",
  "lib/growth/operator-ux/operator-attention-strip.ts",
  "lib/growth/infrastructure/send-infrastructure-operator-types.ts",
  "lib/growth/notifications/notification-integrations.ts",
]

const ADMIN_SURFACES_PRESERVED = [
  "app/(admin)/admin/growth/providers/setup/page.tsx",
  "app/(admin)/admin/growth/providers/page.tsx",
]

function main(): void {
  for (const relativePath of OPERATOR_SURFACES) {
    const source = readSource(relativePath)
    assert.match(source, /\/growth\/settings\/delivery/, `${relativePath} should link to growth delivery setup`)
    assert.doesNotMatch(
      source,
      /\/admin\/growth\/providers\/setup/,
      `${relativePath} should not link operators to admin provider setup`,
    )
  }

  for (const relativePath of ADMIN_SURFACES_PRESERVED) {
    const source = readSource(relativePath)
    assert.match(source, /PlatformAdminPageShell|Provider Setup|Provider Connections/)
  }

  const adminSetup = readSource("app/(admin)/admin/growth/providers/setup/page.tsx")
  assert.match(adminSetup, /Provider Setup/)
  assert.match(adminSetup, /variant="admin"/)

  const deliveryPanel = readSource("components/growth/delivery/growth-delivery-setup-panel.tsx")
  assert.match(deliveryPanel, /Delivery Setup/)
  assert.doesNotMatch(deliveryPanel, /Provider Setup/)

  assert.equal(GROWTH_DELIVERY_SETTINGS_PATH, "/growth/settings/delivery")

  console.log("growth-operator-facing-admin-link-cleanup-7d: ok")
}

main()
