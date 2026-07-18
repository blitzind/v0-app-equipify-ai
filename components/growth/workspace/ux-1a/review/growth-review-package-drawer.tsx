"use client"

import { GrowthAvaCompletedOutreachPackageCard } from "@/components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type { GrowthAvaCompletedOutreachPackageCard } from "@/lib/growth/aios/approvals/ava-completed-work-projection"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  card: GrowthAvaCompletedOutreachPackageCard | null
  packageBody?: GrowthAutonomousOutreachApprovalPackage | null
  onDecided: () => void
}

export function GrowthReviewPackageDrawer({ open, onOpenChange, card, packageBody, onDecided }: Props) {
  if (!card) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-2xl"
        data-section="review-package-drawer"
        aria-describedby="review-package-drawer-description"
      >
        <SheetHeader>
          <SheetTitle>{card.company}</SheetTitle>
          <SheetDescription id="review-package-drawer-description">
            Review outreach assets before authorizing. Nothing will send until you approve the follow-up send.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <GrowthAvaCompletedOutreachPackageCard
            card={card}
            packageBody={packageBody ?? null}
            onDecided={() => {
              onDecided()
              onOpenChange(false)
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
