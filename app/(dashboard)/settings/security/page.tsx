"use client"

import { Info, Shield } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/**
 * Phase 57.2 — Security settings previously showed local-only MFA, sessions,
 * and event lists that did not reflect live server state. Until real wiring
 * exists, this page is intentionally honest and non-interactive.
 */
export default function SecurityPage() {
  return (
    <div className="flex flex-col gap-6">
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Security controls are not connected yet</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          Two-factor authentication, session timeout, device lists, and security event feeds are planned. Nothing here reads or changes your live Equipify session today — use a strong password, protect your email account, and sign out on shared devices.
        </AlertDescription>
      </Alert>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Info size={16} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">What to expect next</h3>
            <ul className="text-xs text-muted-foreground mt-2 space-y-1.5 list-disc pl-4">
              <li>TOTP-based two-factor authentication with real enrollment and recovery.</li>
              <li>Session listing and revoke, when the product exposes device/session metadata safely.</li>
              <li>Optional inactivity timeout aligned with your org policy.</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-3">
              Operational audit history for your workspace lives under{" "}
              <span className="font-medium text-foreground">Settings → Audit Log</span> where that feature is wired.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
