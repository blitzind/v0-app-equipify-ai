"use client"

import { Code2, BookOpen } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/**
 * Phase 57.2 — Replaced demo API keys / webhooks with an honest placeholder.
 * Phase 61.2 — Roadmap + architecture doc reference; still non-interactive (no key issuance).
 *
 * Dashboard routes use cookie sessions; integration OAuth (e.g. QuickBooks) is on Integrations.
 * Stripe’s **platform** webhook is separate from tenant outbound webhooks (see architecture doc).
 */
export default function ApiPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Alert>
        <Code2 className="h-4 w-4" />
        <AlertTitle>Developer API keys are not available yet</AlertTitle>
        <AlertDescription className="text-muted-foreground space-y-2">
          <p>
            This page is intentionally <span className="font-medium text-foreground">read-only</span>. There are no API
            keys, webhook registrations, or “try it” consoles here — earlier placeholder UIs were removed so we
            don&apos;t imply security we don&apos;t enforce.
          </p>
          <p>
            Today, automation happens inside the product:{" "}
            <span className="font-medium text-foreground">dashboard Route Handlers</span> (session + org membership),{" "}
            <span className="font-medium text-foreground">QuickBooks</span> under Integrations, and the{" "}
            <span className="font-medium text-foreground">customer portal</span>. Those are{" "}
            <span className="font-medium text-foreground">not</span> a third-party HTTP API with developer keys.
          </p>
        </AlertDescription>
      </Alert>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-start gap-3">
          <BookOpen className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Architecture (repository doc)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              A <span className="font-medium text-foreground">future</span> public API and outbound webhooks are
              specified in{" "}
              <code className="text-[11px] bg-secondary px-1 py-0.5 rounded">
                docs/PUBLIC_API_AND_WEBHOOKS_ARCHITECTURE.md
              </code>
              — key hashing, org scoping, signing, retries, plan gates, and platform-admin behavior. That document is
              for engineers and operators; it does <span className="font-medium text-foreground">not</span> mean those
              features are live.
            </p>
          </div>
        </div>
        <div className="px-6 py-5 text-sm text-muted-foreground space-y-3">
          <p>
            <span className="font-medium text-foreground">Planned gates:</span> issuing keys will likely require the{" "}
            <code className="text-[11px] bg-secondary px-1 py-0.5 rounded">canManageApiKeys</code> capability (this nav
            item) plus a <span className="font-medium text-foreground">Scale-level</span>{" "}
            <code className="text-[11px] bg-secondary px-1 py-0.5 rounded">api_access</code> entitlement — see{" "}
            <code className="text-[11px] bg-secondary px-1 py-0.5 rounded">docs/PLAN_ENTITLEMENT_ENFORCEMENT_AUDIT.md</code>
            .
          </p>
          <p>
            <span className="font-medium text-foreground">Usage &amp; limits:</span> billing may show an API monthly
            allowance; counters are <span className="font-medium text-foreground">not</span> fully driven by a public
            API yet — see{" "}
            <code className="text-[11px] bg-secondary px-1 py-0.5 rounded">docs/USAGE_METERING_ENFORCEMENT.md</code>.
          </p>
          <p>
            <span className="font-medium text-foreground">Settings matrix:</span>{" "}
            <code className="text-[11px] bg-secondary px-1 py-0.5 rounded">docs/SETTINGS_WIRING_AUDIT.md</code> lists this
            route as <span className="font-medium text-foreground">planned / honesty shell</span>.
          </p>
          <p className="text-xs border-t border-border pt-3">
            Event name scaffolding for future webhooks (unused at runtime):{" "}
            <code className="text-[11px] bg-secondary px-1 py-0.5 rounded">lib/api/future-webhook-event-types.ts</code>
          </p>
        </div>
      </div>
    </div>
  )
}
