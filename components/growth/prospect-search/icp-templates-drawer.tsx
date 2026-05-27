"use client"

import { Plus, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  PROSPECT_SEARCH_ICP_TEMPLATES,
  type ProspectSearchIcpTemplate,
} from "@/components/growth/prospect-search/prospect-search-ux-constants"
import { cn } from "@/lib/utils"

export function IcpTemplatesDrawer({
  open,
  onOpenChange,
  activeTemplateId,
  onSelectTemplate,
  onCreateCustom,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeTemplateId: string | null
  onSelectTemplate: (template: ProspectSearchIcpTemplate) => void
  onCreateCustom: () => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-600" />
            Starter ICP Templates
          </SheetTitle>
          <SheetDescription>
            Start with a proven ICP, then refine filters before searching.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
          <ul className="space-y-2">
            {PROSPECT_SEARCH_ICP_TEMPLATES.map((tpl) => (
              <li key={tpl.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectTemplate(tpl)
                    onOpenChange(false)
                  }}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                    activeTemplateId === tpl.id
                      ? "border-violet-300 bg-violet-50/80 shadow-sm"
                      : "border-border hover:border-violet-200 hover:bg-muted/40",
                  )}
                >
                  <p className="text-sm font-medium">{tpl.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{tpl.description}</p>
                </button>
              </li>
            ))}
          </ul>

          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed"
            onClick={() => {
              onCreateCustom()
              onOpenChange(false)
            }}
          >
            <Plus className="mr-2 size-4" />
            Create Custom ICP
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
