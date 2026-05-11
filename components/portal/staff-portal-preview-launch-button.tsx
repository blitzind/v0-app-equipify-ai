"use client"

import { useCallback, useRef, useState, type ComponentProps } from "react"
import type { VariantProps } from "class-variance-authority"
import { Eye } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  navigateStaffPortalPreviewSameTab,
  tryOpenStaffPortalPreviewInNewTab,
} from "@/lib/portal/staff-portal-preview-open-client"
import { cn } from "@/lib/utils"

type Props = {
  organizationId: string
  /** When set, the preview opens scoped to this customer (must be a UUID). */
  customerId?: string | null
  children?: React.ReactNode
} & Pick<VariantProps<typeof buttonVariants>, "variant" | "size"> &
  Pick<ComponentProps<"button">, "className" | "disabled">

/**
 * Starts staff portal preview from a direct click (keeps popup trust heuristics happy).
 * If the browser blocks a new tab, falls back to same-tab navigation — no internal URLs in UI.
 */
export function StaffPortalPreviewLaunchButton({
  organizationId,
  customerId,
  children,
  variant = "outline",
  size = "sm",
  className,
  disabled,
}: Props) {
  const [blockedOpen, setBlockedOpen] = useState(false)
  const fallbackUrlRef = useRef<string | null>(null)

  const onPreviewClick = useCallback(() => {
    const r = tryOpenStaffPortalPreviewInNewTab({ organizationId, customerId })
    if (r.ok) return
    if (r.url) {
      fallbackUrlRef.current = r.url
      setBlockedOpen(true)
    }
  }, [organizationId, customerId])

  const onContinueSameTab = useCallback(() => {
    const u = fallbackUrlRef.current
    fallbackUrlRef.current = null
    setBlockedOpen(false)
    if (u) navigateStaffPortalPreviewSameTab(u)
  }, [])

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn("gap-1.5 text-xs", className)}
        disabled={disabled}
        onClick={onPreviewClick}
      >
        <Eye size={13} aria-hidden />
        {children ?? "Preview portal"}
      </Button>
      <AlertDialog
        open={blockedOpen}
        onOpenChange={(open) => {
          setBlockedOpen(open)
          if (!open) fallbackUrlRef.current = null
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Your browser blocked the preview window.</AlertDialogTitle>
            <AlertDialogDescription>
              Click below to continue to the customer portal preview. This tab will leave the staff app until you use
              “Portal settings” or “Exit to main app” from the preview.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="button" onClick={onContinueSameTab}>
              Open customer portal preview
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
