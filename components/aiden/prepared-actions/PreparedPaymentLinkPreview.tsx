"use client"

import { useState } from "react"
import { AlertTriangle, Building2, CheckCircle2, Copy, CreditCard, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import type { PaymentLinkPreparedPreviewPayload } from "@/components/aiden/prepared-actions/types"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

function fmtMoneyCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

export function PreparedPaymentLinkPreview({ preview }: { preview: PaymentLinkPreparedPreviewPayload }) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const cp = preview.checkoutPreview

  async function copyDisclosure() {
    if (!cp?.disclosureCopy) return
    try {
      await navigator.clipboard.writeText(cp.disclosureCopy)
      setCopied(true)
      toast({ title: "Copied", description: "Fee disclosure copied to clipboard." })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: "Copy failed", description: "Select the text manually.", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card/60 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Building2 className="size-3.5 shrink-0" aria-hidden />
            Customer
          </div>
          <p className="font-medium text-foreground">{preview.customer.companyName}</p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">ID {preview.customer.id}</p>
        </div>
        <div className="rounded-lg border border-border bg-card/60 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CreditCard className="size-3.5 shrink-0" aria-hidden />
            Invoice
          </div>
          <p className="font-medium text-foreground">{preview.invoice.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            #{preview.invoice.invoiceNumber} · {preview.invoice.statusUi}
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">ID {preview.invoice.id}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            preview.readiness === "ready" && "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100",
            preview.readiness === "degraded" && "bg-amber-500/15 text-amber-900 dark:text-amber-100",
            preview.readiness === "blocked" && "bg-destructive/15 text-destructive",
          )}
        >
          Payment link readiness: {preview.readiness}
        </span>
        {preview.blitzpayErrorCode ? (
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {preview.blitzpayErrorCode}
          </span>
        ) : null}
      </div>

      {preview.amountDueCents != null ? (
        <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
          <p className="text-[10px] font-medium uppercase text-muted-foreground">Amount due (hosted pay)</p>
          <p className="text-lg font-semibold tabular-nums">{fmtMoneyCents(preview.amountDueCents)}</p>
        </div>
      ) : null}

      {cp ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <Link2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            BlitzPay checkout preview
          </div>
          {cp.appliesToCustomer && cp.convenienceFeeCents > 0 ? (
            <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs">
              <p className="font-medium text-amber-950 dark:text-amber-50">Convenience / processing fees</p>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{cp.disclosureCopy}</p>
              <Button type="button" variant="ghost" size="sm" className="mt-2 h-7 gap-1 px-2 text-[11px]" onClick={() => void copyDisclosure()}>
                <Copy className="size-3" aria-hidden />
                {copied ? "Copied" : "Copy disclosure"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{cp.disclosureCopy}</p>
          )}
          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase text-muted-foreground">Payment methods</p>
            <ul className="space-y-2">
              {cp.availablePaymentMethods.map((m) => (
                <li key={m.type} className="rounded-md border border-border/80 bg-card/50 px-2 py-1.5 text-xs">
                  <span className="font-medium">{m.label}</span>
                  <span className="ml-2 tabular-nums text-muted-foreground">
                    Total if selected: {fmtMoneyCents(m.totalChargeCents)}
                    {m.convenienceFeeCents > 0 ? ` (incl. ${fmtMoneyCents(m.convenienceFeeCents)} fee)` : null}
                  </span>
                  {m.timelineCopy ? <p className="mt-1 text-[10px] text-muted-foreground">{m.timelineCopy}</p> : null}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
            <span>Connect charges: {cp.connectChargesEnabled ? "on" : "off"}</span>
            <span>·</span>
            <span>Payouts: {cp.connectPayoutsEnabled ? "on" : "off"}</span>
            {cp.savePaymentMethodEligible ? (
              <>
                <span>·</span>
                <span>Save payment method eligible (customer choice at checkout)</span>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {preview.warnings.length > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
          <ul className="list-inside list-disc space-y-1 text-amber-950 dark:text-amber-50">
            {preview.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Separator />

      <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-950 dark:text-sky-50">
        <strong>No automatic contact.</strong> Equipify does not email or text the customer, and does not charge saved
        cards. After you confirm, you get a checkout link to copy and send yourself.
      </p>

      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Draft a customer message separately:</span> ask AIden to use the
        “draft customer message” prepared action in a new step if you want copy that includes this link — it still will
        not send until you use your normal communications flow.
      </p>
    </div>
  )
}

export function PreparedPaymentLinkCompleted({
  checkoutUrl,
  invoiceLabel,
}: {
  checkoutUrl: string
  invoiceLabel: string
}) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(checkoutUrl)
      setCopied(true)
      toast({ title: "Link copied", description: "Share it with the customer when you are ready." })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: "Copy failed", description: "Select the URL and copy manually.", variant: "destructive" })
    }
  }

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-medium text-emerald-950 dark:text-emerald-50">Checkout link ready</p>
          <p className="text-xs text-muted-foreground">{invoiceLabel}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input readOnly value={checkoutUrl} className="font-mono text-[11px]" aria-label="Checkout URL" />
            <Button type="button" variant="secondary" size="sm" className="h-9 shrink-0 gap-1.5" onClick={() => void copyUrl()}>
              <Copy className="size-3.5" aria-hidden />
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
