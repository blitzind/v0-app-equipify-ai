"use client"

import { Code2, BookOpen } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/**
 * Phase 57.2 — Replaced demo API keys / webhooks with an honest placeholder.
 * Phase 61.2 — Roadmap messaging; still non-interactive (no key issuance).
 *
 * Dashboard actions use your signed-in session. Integration OAuth (e.g. QuickBooks)
 * is configured under Integrations. Stripe billing uses Checkout from the Billing page.
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
            Today, automation happens inside the product: signed-in staff workflows,{" "}
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
            <h3 className="text-sm font-semibold text-foreground">What we are building</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              A future <span className="font-medium text-foreground">public HTTP API</span> and{" "}
              <span className="font-medium text-foreground">outbound webhooks</span> are on the roadmap: org-scoped
              keys, signed deliveries, retries, and plan-based access. Those capabilities are{" "}
              <span className="font-medium text-foreground">not live</span> in the product today; this screen exists so
              expectations stay clear.
            </p>
          </div>
        </div>
        <div className="px-6 py-5 text-sm text-muted-foreground space-y-3">
          <p>
            <span className="font-medium text-foreground">Planned access:</span> issuing keys will likely require an
            explicit “manage API keys” permission plus a Scale-level plan add-on for HTTP access.
          </p>
          <p>
            <span className="font-medium text-foreground">Usage &amp; limits:</span> billing may show an API monthly
            allowance; live counters will appear once usage is recorded end-to-end.
          </p>
          <p>
            <span className="font-medium text-foreground">Settings coverage:</span> other Settings pages describe what
            is wired today versus preview-only.
          </p>
        </div>
      </div>
    </div>
  )
}
