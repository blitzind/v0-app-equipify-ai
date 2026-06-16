"use client"

import type { ReactNode } from "react"
import { useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  extractContentMergeFields,
  isBlockedContentVariable,
} from "@/lib/growth/content/merge-field-validator"
import { createTestimonialEntry } from "@/lib/growth/share-pages/share-page-template-editor-utils"
import type { GrowthSharePageTemplateBlock } from "@/lib/growth/share-pages/share-page-template-block-types"
import type { GrowthBookingPageListItem } from "@/lib/growth/booking/booking-page-types"
import { GROWTH_SHARE_PAGE_PUBLIC_THEME_MODES } from "@/lib/growth/share-pages/share-page-types"

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function MergeFieldHints({ text }: { text: string }) {
  const fields = useMemo(() => extractContentMergeFields(text), [text])
  const blocked = fields.filter(isBlockedContentVariable)
  if (fields.length === 0) return null
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
      <p className="font-medium">Merge fields detected</p>
      <p className="mt-1 text-muted-foreground">{fields.join(", ")}</p>
      {blocked.length > 0 ? (
        <p className="mt-2 text-rose-600">Blocked variables: {blocked.join(", ")}</p>
      ) : null}
    </div>
  )
}

export function GrowthSharePageTemplateSectionEditor({
  block,
  blocks,
  bookingPages,
  onChange,
  disabled,
}: {
  block: GrowthSharePageTemplateBlock
  blocks: GrowthSharePageTemplateBlock[]
  bookingPages: GrowthBookingPageListItem[]
  onChange: (block: GrowthSharePageTemplateBlock) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-4">
      <Field label="Section label (optional)">
        <Input
          value={block.label ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...block, label: e.target.value })}
          placeholder="Internal label for operators"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={block.enabled !== false}
          disabled={disabled}
          onChange={(e) => onChange({ ...block, enabled: e.target.checked })}
        />
        Section enabled
      </label>

      {block.type === "hero" ? (
        <>
          <Field label="Headline">
            <Input value={block.headline} disabled={disabled} onChange={(e) => onChange({ ...block, headline: e.target.value })} />
          </Field>
          <Field label="Subheadline">
            <Input
              value={block.subheadline ?? ""}
              disabled={disabled}
              onChange={(e) => onChange({ ...block, subheadline: e.target.value || null })}
            />
          </Field>
          <Field label="Hero message">
            <Textarea
              value={block.heroMessage}
              disabled={disabled}
              onChange={(e) => onChange({ ...block, heroMessage: e.target.value })}
              rows={4}
            />
            <MergeFieldHints text={block.heroMessage} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.showLogo !== false}
              disabled={disabled}
              onChange={(e) => onChange({ ...block, showLogo: e.target.checked })}
            />
            Show logo from theme
          </label>
          <Field label="Hero image URL">
            <Input
              value={block.heroMediaUrl ?? ""}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  ...block,
                  heroMediaType: e.target.value ? "image" : "none",
                  heroMediaUrl: e.target.value || null,
                })
              }
              placeholder="https://..."
            />
          </Field>
        </>
      ) : null}

      {block.type === "text" ? (
        <>
          <Field label="Title">
            <Input
              value={block.heading ?? ""}
              disabled={disabled}
              onChange={(e) => onChange({ ...block, heading: e.target.value || null })}
            />
          </Field>
          <Field label="Body">
            <Textarea value={block.body} disabled={disabled} onChange={(e) => onChange({ ...block, body: e.target.value })} rows={5} />
            <MergeFieldHints text={`${block.heading ?? ""} ${block.body}`} />
          </Field>
        </>
      ) : null}

      {block.type === "image" ? (
        <>
          <Field label="Image URL">
            <Input value={block.imageUrl ?? ""} disabled={disabled} onChange={(e) => onChange({ ...block, imageUrl: e.target.value || null })} />
          </Field>
          <Field label="Alt text">
            <Input value={block.altText} disabled={disabled} onChange={(e) => onChange({ ...block, altText: e.target.value })} />
          </Field>
          <Field label="Caption">
            <Input
              value={block.caption ?? ""}
              disabled={disabled}
              onChange={(e) => onChange({ ...block, caption: e.target.value || null })}
            />
          </Field>
        </>
      ) : null}

      {block.type === "cta" ? (
        <>
          <Field label="Label">
            <Input value={block.label} disabled={disabled} onChange={(e) => onChange({ ...block, label: e.target.value })} />
          </Field>
          <Field label="Kind">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={block.kind}
              disabled={disabled}
              onChange={(e) => onChange({ ...block, kind: e.target.value as typeof block.kind })}
            >
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="link">Link</option>
            </select>
          </Field>
          <Field label="Action">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={block.action}
              disabled={disabled}
              onChange={(e) => onChange({ ...block, action: e.target.value as typeof block.action })}
            >
              <option value="book_meeting">Book meeting</option>
              <option value="open_url">Open URL</option>
              <option value="download_resource">Download resource</option>
              <option value="reply_email">Reply email</option>
            </select>
          </Field>
          <Field label="Destination URL">
            <Input
              value={block.destinationUrl ?? ""}
              disabled={disabled}
              onChange={(e) => onChange({ ...block, destinationUrl: e.target.value || null })}
            />
          </Field>
          <Field label="Tracking key">
            <Input
              value={block.trackingKey}
              disabled={disabled}
              onChange={(e) => onChange({ ...block, trackingKey: e.target.value })}
            />
          </Field>
        </>
      ) : null}

      {block.type === "calendar" ? (
        <>
          <Field label="Section title">
            <Input
              value={block.heading ?? ""}
              disabled={disabled}
              onChange={(e) => onChange({ ...block, heading: e.target.value || null })}
            />
          </Field>
          <Field label="Booking page">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={block.bookingPageId ?? ""}
              disabled={disabled}
              onChange={(e) => onChange({ ...block, bookingPageId: e.target.value || null })}
            >
              <option value="">Select booking page</option>
              {bookingPages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.name} ({page.slug})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Embed mode">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={block.embedMode ?? "inline"}
              disabled={disabled}
              onChange={(e) => onChange({ ...block, embedMode: e.target.value as "inline" | "button" })}
            >
              <option value="inline">Inline embed</option>
              <option value="button">Button only</option>
            </select>
          </Field>
        </>
      ) : null}

      {block.type === "testimonials" ? (
        <>
          <Field label="Section heading">
            <Input
              value={block.heading ?? ""}
              disabled={disabled}
              onChange={(e) => onChange({ ...block, heading: e.target.value || null })}
            />
          </Field>
          <div className="space-y-3">
            {block.items.map((item, index) => (
              <div key={item.id} className="rounded-lg border border-border p-3 space-y-2">
                <Field label={`Quote ${index + 1}`}>
                  <Textarea
                    value={item.quote}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange({
                        ...block,
                        items: block.items.map((entry) =>
                          entry.id === item.id ? { ...entry, quote: e.target.value } : entry,
                        ),
                      })
                    }
                    rows={3}
                  />
                </Field>
                <div className="grid gap-2 md:grid-cols-3">
                  <Field label="Author">
                    <Input
                      value={item.authorName}
                      disabled={disabled}
                      onChange={(e) =>
                        onChange({
                          ...block,
                          items: block.items.map((entry) =>
                            entry.id === item.id ? { ...entry, authorName: e.target.value } : entry,
                          ),
                        })
                      }
                    />
                  </Field>
                  <Field label="Title">
                    <Input
                      value={item.authorTitle ?? ""}
                      disabled={disabled}
                      onChange={(e) =>
                        onChange({
                          ...block,
                          items: block.items.map((entry) =>
                            entry.id === item.id ? { ...entry, authorTitle: e.target.value || null } : entry,
                          ),
                        })
                      }
                    />
                  </Field>
                  <Field label="Company">
                    <Input
                      value={item.companyName ?? ""}
                      disabled={disabled}
                      onChange={(e) =>
                        onChange({
                          ...block,
                          items: block.items.map((entry) =>
                            entry.id === item.id ? { ...entry, companyName: e.target.value || null } : entry,
                          ),
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="text-sm text-primary"
              disabled={disabled}
              onClick={() => onChange({ ...block, items: [...block.items, createTestimonialEntry()] })}
            >
              Add testimonial
            </button>
          </div>
        </>
      ) : null}

      {block.type === "custom" ? (
        <Field label="Markdown / HTML placeholder" hint="Stored as operator-safe text only. No runtime renderer changes in S1-C.">
          <Textarea
            value={block.htmlSafeText}
            disabled={disabled}
            onChange={(e) => onChange({ ...block, htmlSafeText: e.target.value })}
            rows={6}
          />
        </Field>
      ) : null}

      {block.type === "video_placeholder" ? (
        <>
          <Field label="Heading">
            <Input value={block.heading ?? ""} disabled={disabled} onChange={(e) => onChange({ ...block, heading: e.target.value || null })} />
          </Field>
          <Field label="Label">
            <Input value={block.placeholderLabel} disabled={disabled} onChange={(e) => onChange({ ...block, placeholderLabel: e.target.value })} />
          </Field>
          <Field label="Layout">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={block.layout ?? "wide"}
              disabled={disabled}
              onChange={(e) => onChange({ ...block, layout: e.target.value as "wide" | "compact" })}
            >
              <option value="wide">Wide</option>
              <option value="compact">Compact</option>
            </select>
          </Field>
        </>
      ) : null}

      {block.type === "voice_placeholder" ? (
        <>
          <Field label="Heading">
            <Input value={block.heading ?? ""} disabled={disabled} onChange={(e) => onChange({ ...block, heading: e.target.value || null })} />
          </Field>
          <Field label="Label">
            <Input value={block.placeholderLabel} disabled={disabled} onChange={(e) => onChange({ ...block, placeholderLabel: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.showTranscript !== false}
              disabled={disabled}
              onChange={(e) => onChange({ ...block, showTranscript: e.target.checked })}
            />
            Show transcript placeholder
          </label>
        </>
      ) : null}

      {block.type === "media_cta_placeholder" ? (
        <>
          <Field label="Heading">
            <Input value={block.heading ?? ""} disabled={disabled} onChange={(e) => onChange({ ...block, heading: e.target.value || null })} />
          </Field>
          <Field label="Placeholder label">
            <Input value={block.placeholderLabel} disabled={disabled} onChange={(e) => onChange({ ...block, placeholderLabel: e.target.value })} />
          </Field>
          <Field label="CTA label">
            <Input value={block.ctaLabel} disabled={disabled} onChange={(e) => onChange({ ...block, ctaLabel: e.target.value })} />
          </Field>
          <Field label="Linked block">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={block.linkedBlockId ?? ""}
              disabled={disabled}
              onChange={(e) => onChange({ ...block, linkedBlockId: e.target.value || null })}
            >
              <option value="">None</option>
              {blocks
                .filter((entry) => entry.id !== block.id)
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label ?? entry.type} ({entry.type})
                  </option>
                ))}
            </select>
          </Field>
        </>
      ) : null}

      {block.type === "hero" || block.type === "text" ? null : (
        <p className="text-[11px] text-muted-foreground">
          Theme preview mode uses {GROWTH_SHARE_PAGE_PUBLIC_THEME_MODES.join(", ")} from the metadata panel.
        </p>
      )}
    </div>
  )
}
