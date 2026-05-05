"use client"

import { toast } from "@/components/ui/use-toast"
import type { RecordEligibility } from "@/lib/billing/record-eligibility"

/** Shows toast and returns true when creation should be aborted. */
export function toastRecordEligibilityBlocked(eligibility: RecordEligibility): boolean {
  if (eligibility.ok) return false
  toast({
    variant: "destructive",
    title: "Cannot create",
    description: eligibility.message,
  })
  return true
}
