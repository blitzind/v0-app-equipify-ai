"use client"

import { GROWTH_SHARE_PAGE_QUICK_TEMPLATES, getSharePageQuickTemplate } from "@/lib/growth/share-pages/share-page-types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

type Props = {
  value: string
  disabled?: boolean
  onChange: (templateId: string) => void
  onApply: (templateId: string) => void
}

export function GrowthSharePageQuickTemplatePicker({ value, disabled, onChange, onApply }: Props) {
  const selected = getSharePageQuickTemplate(value)

  return (
    <div className="space-y-3 rounded-xl border border-dashed p-4">
      <div>
        <Label>Quick-start template (no AI required)</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Seeds headline, intro, benefits, and CTA — edit before publishing.
        </p>
      </div>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Choose a template" />
        </SelectTrigger>
        <SelectContent>
          {GROWTH_SHARE_PAGE_QUICK_TEMPLATES.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              {template.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected ? <p className="text-xs text-muted-foreground">{selected.description}</p> : null}
      <Button type="button" size="sm" variant="outline" disabled={disabled || !value} onClick={() => onApply(value)}>
        Apply quick-start template
      </Button>
    </div>
  )
}
