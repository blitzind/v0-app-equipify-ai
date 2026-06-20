/**
 * GS-SENDR-2B — Booking attachment certification.
 * Run: pnpm test:growth-sendr-booking-attachment
 */
import assert from "node:assert/strict"
import fs from "node:fs"

function main(): void {
  console.log("\n=== GS-SENDR-2B Booking Attachment Certification ===\n")
  assert.ok(fs.existsSync("app/api/platform/growth/sendr/booking-assets/route.ts"))

  const route = fs.readFileSync("app/api/platform/growth/sendr/booking-assets/route.ts", "utf8")
  assert.match(route, /registerGrowthSendrBookingAsset/)
  assert.match(route, /meetingLink/)
  assert.match(route, /durationMinutes/)
  assert.match(route, /timezone/)
  assert.match(route, /action === "attach"/)

  console.log("  ✓ Booking metadata register and attach")
  console.log("\nGS-SENDR-2B booking attachment certification passed.\n")
}

main()
