"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import type { GrowthHomeWorkSummaryCategory } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_EMPLOYEE_WORK_SUMMARY_TITLE } from "@/lib/workspace/ai-employee-experience"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

type Props = {
  categories: GrowthHomeWorkSummaryCategory[]
}

export function GrowthHomeWorkSummarySection({ categories }: Props) {
  const [open, setOpen] = useState(false)

  if (categories.length === 0) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen} id="ai-work-summary">
      <div data-qa-section="home-ai-work-summary" className="space-y-4">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="gap-2 px-0 text-foreground hover:text-foreground">
            <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
            {AI_EMPLOYEE_WORK_SUMMARY_TITLE}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-6">
          {categories.map((category) => (
            <div key={category.id}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{category.label}</h3>
              <ul className="mt-2 space-y-1.5">
                {category.items.map((item) => (
                  <li key={item} className="text-sm leading-relaxed text-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
