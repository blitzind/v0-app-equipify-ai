"use client"

import { useRouter, usePathname } from "next/navigation"
import { ChevronDown } from "lucide-react"
import type { StaffPortalPreviewCustomerOption } from "@/lib/portal/staff-portal-preview-data"
import { cn } from "@/lib/utils"

export function StaffPortalPreviewCustomerPicker({
  organizationId,
  selectedCustomerId,
  options,
}: {
  organizationId: string
  selectedCustomerId: string | null
  options: StaffPortalPreviewCustomerOption[]
}) {
  const router = useRouter()
  const pathname = usePathname()

  if (options.length === 0) return null

  function pushSelection(customerId: string) {
    const q = new URLSearchParams()
    q.set("organizationId", organizationId)
    if (customerId) q.set("customerId", customerId)
    router.replace(`${pathname}?${q.toString()}`)
  }

  return (
    <label
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-1 sm:max-w-[min(100%,22rem)] sm:flex-none",
        "rounded-md border px-2 py-1.5",
      )}
      style={{ borderColor: "var(--portal-border)", background: "var(--portal-surface-2)" }}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--portal-nav-text)" }}>
        Preview as customer
      </span>
      <div className="relative min-w-0">
        <select
          value={selectedCustomerId ?? ""}
          onChange={(e) => pushSelection(e.target.value)}
          className="h-9 w-full min-w-0 cursor-pointer appearance-none rounded-md border bg-transparent py-1 pl-2 pr-8 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)]"
          style={{
            borderColor: "var(--portal-border)",
            color: "var(--portal-foreground)",
          }}
          aria-label="Select customer account for portal preview"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.companyName}
              {o.source === "sample" ? " (sample)" : ""}
              {o.recordStatus === "inactive" ? " — inactive" : ""}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
          style={{ color: "var(--portal-nav-icon)" }}
          aria-hidden
        />
      </div>
    </label>
  )
}
