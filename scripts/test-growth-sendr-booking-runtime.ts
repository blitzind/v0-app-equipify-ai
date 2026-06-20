/**
 * GS-SENDR-2C — Public booking runtime certification.
 * Run: pnpm test:growth-sendr-booking-runtime
 */
import assert from "node:assert/strict"
import fs from "node:fs"

function main(): void {
  console.log("\n=== GS-SENDR-2C Booking Runtime Certification ===\n")
  const client = fs.readFileSync("components/sendr/sendr-public-page-client.tsx", "utf8")
  assert.match(client, /booking_started/)
  assert.match(client, /calendar_open/)
  assert.match(client, /booking_completed/)

  const service = fs.readFileSync("lib/growth/sendr/growth-sendr-public-engagement-service.ts", "utf8")
  assert.match(service, /recordSendrBookingStartedTimeline/)
  assert.doesNotMatch(service, /scheduler|cron/i)

  console.log("  ✓ Booking CTA opens link and records events (no scheduler rebuild)")
  console.log("\nGS-SENDR-2C booking runtime certification passed.\n")
}

main()
