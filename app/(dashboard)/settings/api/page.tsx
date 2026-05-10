"use client"

import { Code2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/**
 * Phase 57.2 — Replaced demo API keys / webhooks with an honest placeholder.
 * Dashboard routes use cookie sessions; integration OAuth (e.g. QuickBooks) is
 * configured on Integrations, not via generic API keys here.
 */
export default function ApiPage() {
  return (
    <div className="flex flex-col gap-6">
      <Alert>
        <Code2 className="h-4 w-4" />
        <AlertTitle>Public API keys are not available in the app yet</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          Earlier versions of this page showed sample keys and webhooks that were not stored or enforced on the server. Scoped API keys, rotation, and outbound webhooks are planned; today, use org-scoped features inside the product (dashboard APIs, QuickBooks connector, portal) rather than a standalone developer key.
        </AlertDescription>
      </Alert>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Documentation</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            A wiring matrix for Settings (including this page) lives in{" "}
            <code className="text-[11px] bg-secondary px-1 py-0.5 rounded">docs/SETTINGS_WIRING_AUDIT.md</code>{" "}
            in the repository.
          </p>
        </div>
        <div className="px-6 py-5 text-sm text-muted-foreground space-y-2">
          <p>
            When API keys ship, they will require explicit{" "}
            <span className="font-medium text-foreground">canManageApiKeys</span> permission, audit logging, and
            server-side enforcement — not client-only state.
          </p>
        </div>
      </div>
    </div>
  )
}
