/**
 * Communications Center Phase 1 — main /communications route.
 *
 * Default surface is the new visibility-first feed UI (hero + KPI +
 * single-row toolbar + unified timeline + right-side drawer). The
 * legacy power-user view (templates editor, AI suggestions tab,
 * automations operational summaries, failed-deliveries retry queue)
 * stays mounted under the same route via `?view=tools` so we don't
 * strip any existing functionality — Phase 1 was explicitly an
 * additive visibility layer.
 *
 * `useSearchParams` and the feed page are client components, so we
 * wrap them in a Suspense boundary at the route shell so static
 * export keeps working.
 */

import { Suspense } from "react"
import { CommunicationsRouteShell } from "@/components/communications/communications-route-shell"

export default function CommunicationsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading communications…</div>}>
      <CommunicationsRouteShell />
    </Suspense>
  )
}
