"use client"

import { useMemo, useState } from "react"
import {
  DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT,
  parseSharePageTemplateCustomMergeField,
  type GrowthSharePageTemplatePreviewContext,
} from "@/lib/growth/share-pages/share-page-template-preview-context"

export function GrowthSharePageTemplatePreviewContextPanel({
  context,
  onChange,
}: {
  context: GrowthSharePageTemplatePreviewContext
  onChange: (next: GrowthSharePageTemplatePreviewContext) => void
}) {
  const [customFieldInput, setCustomFieldInput] = useState("")

  const customEntries = useMemo(
    () => Object.entries(context.customMergeValues).sort(([a], [b]) => a.localeCompare(b)),
    [context.customMergeValues],
  )

  function updateField<K extends keyof GrowthSharePageTemplatePreviewContext>(
    key: K,
    value: GrowthSharePageTemplatePreviewContext[K],
  ) {
    onChange({ ...context, [key]: value })
  }

  function addCustomField() {
    const parsed = parseSharePageTemplateCustomMergeField(customFieldInput)
    const [key] = Object.keys(parsed)
    if (!key) return
    onChange({
      ...context,
      customMergeValues: { ...context.customMergeValues, ...parsed },
    })
    setCustomFieldInput("")
  }

  function removeCustomField(key: string) {
    const next = { ...context.customMergeValues }
    delete next[key]
    onChange({ ...context, customMergeValues: next })
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-medium">Sample preview context</p>
        <p className="text-xs text-muted-foreground">
          Edits apply instantly to the preview only — nothing is saved.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Prospect name</span>
          <input
            className="h-10 w-full rounded-md border border-input bg-background px-3"
            value={context.prospectName}
            onChange={(e) => updateField("prospectName", e.target.value)}
            placeholder={DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT.prospectName}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Company name</span>
          <input
            className="h-10 w-full rounded-md border border-input bg-background px-3"
            value={context.companyName}
            onChange={(e) => updateField("companyName", e.target.value)}
            placeholder={DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT.companyName}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Sender name</span>
          <input
            className="h-10 w-full rounded-md border border-input bg-background px-3"
            value={context.senderName}
            onChange={(e) => updateField("senderName", e.target.value)}
            placeholder={DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT.senderName}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Sender company</span>
          <input
            className="h-10 w-full rounded-md border border-input bg-background px-3"
            value={context.senderCompany}
            onChange={(e) => updateField("senderCompany", e.target.value)}
            placeholder={DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT.senderCompany}
          />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="text-muted-foreground">Booking link override</span>
          <input
            className="h-10 w-full rounded-md border border-input bg-background px-3"
            value={context.bookingLinkOverride}
            onChange={(e) => updateField("bookingLinkOverride", e.target.value)}
            placeholder="https://example.com/book/demo"
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Custom merge values</p>
        <div className="flex flex-wrap gap-2">
          <input
            className="h-10 min-w-[220px] flex-1 rounded-md border border-input bg-background px-3 text-sm"
            value={customFieldInput}
            onChange={(e) => setCustomFieldInput(e.target.value)}
            placeholder="custom.field=Value"
          />
          <button
            type="button"
            className="h-10 rounded-md border border-input px-3 text-sm"
            onClick={addCustomField}
          >
            Add field
          </button>
        </div>
        {customEntries.length > 0 ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {customEntries.map(([key, value]) => (
              <li key={key} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1">
                <span>
                  <code>{key}</code> = {value}
                </span>
                <button type="button" className="text-destructive" onClick={() => removeCustomField(key)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Use key=value pairs such as account.tier=Enterprise.</p>
        )}
      </div>
    </div>
  )
}
