"use client"

import type { ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AVA_DATAMOON_AUDIENCE_TYPES,
  AVA_DATAMOON_COMPANY_SIZES,
  AVA_DATAMOON_INTENT_LEVELS,
  AVA_DATAMOON_JOB_TITLE_PRESETS,
  AVA_DATAMOON_LOOKBACK_DAYS,
  AVA_DATAMOON_TOPIC_PRESETS,
  type AvaDatamoonAudienceDraft,
} from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"

function toggleListValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

type Props = {
  draft: AvaDatamoonAudienceDraft
  onChange: (draft: AvaDatamoonAudienceDraft) => void
  layout?: "compact" | "grouped"
}

function FormSection({
  title,
  children,
  grouped,
}: {
  title: string
  children: ReactNode
  grouped: boolean
}) {
  if (!grouped) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">{title}</p>
        {children}
      </div>
    )
  }
  return (
    <Card className="gap-4 py-4 shadow-none">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4">{children}</CardContent>
    </Card>
  )
}

export function DatamoonSourcingWorkbenchForm({ draft, onChange, layout = "grouped" }: Props) {
  const grouped = layout === "grouped"

  function patch(partial: Partial<AvaDatamoonAudienceDraft>) {
    onChange({ ...draft, ...partial })
  }

  const wrapperClass = grouped ? "space-y-5" : "space-y-4"

  return (
    <div className={wrapperClass}>
      <FormSection title="Audience" grouped={grouped}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dm-audience-name">Audience name</Label>
            <Input
              id="dm-audience-name"
              value={draft.audienceName}
              onChange={(e) => patch({ audienceName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dm-audience-type">Audience type</Label>
            <select
              id="dm-audience-type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={draft.audienceType}
              onChange={(e) => patch({ audienceType: e.target.value as AvaDatamoonAudienceDraft["audienceType"] })}
            >
              {AVA_DATAMOON_AUDIENCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="dm-record-limit">Record limit</Label>
            <Input
              id="dm-record-limit"
              inputMode="numeric"
              value={String(draft.recordLimit)}
              onChange={(e) => patch({ recordLimit: Number(e.target.value) || 100 })}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Intent" grouped={grouped}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dm-lookback">Lookback window</Label>
            <select
              id="dm-lookback"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={String(draft.lookbackDays)}
              onChange={(e) =>
                patch({ lookbackDays: Number(e.target.value) as AvaDatamoonAudienceDraft["lookbackDays"] })
              }
            >
              {AVA_DATAMOON_LOOKBACK_DAYS.map((days) => (
                <option key={days} value={days}>
                  {days} days
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Intent levels</Label>
          <div className="flex flex-wrap gap-2">
            {AVA_DATAMOON_INTENT_LEVELS.map((level) => (
              <label key={level} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={draft.intentLevels.includes(level)}
                  onChange={() => patch({ intentLevels: toggleListValue(draft.intentLevels, level) })}
                />
                {level}
              </label>
            ))}
          </div>
        </div>
      </FormSection>

      <FormSection title="Company Profile" grouped={grouped}>
        <div className="space-y-2">
          <Label>Industries</Label>
          <div className="flex flex-wrap gap-2">
            {AVA_DATAMOON_TOPIC_PRESETS.map((topic) => (
              <label key={topic} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={draft.topics.includes(topic)}
                  onChange={() => patch({ topics: toggleListValue(draft.topics, topic) })}
                />
                {topic}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dm-custom-topic">Topics & keywords</Label>
          <Input
            id="dm-custom-topic"
            placeholder="Additional topics or keywords (comma-separated)"
            value={draft.customTopic ?? ""}
            onChange={(e) => patch({ customTopic: e.target.value || null })}
          />
        </div>
      </FormSection>

      <FormSection title="Decision Makers" grouped={grouped}>
        <div className="space-y-2">
          <Label>Job titles</Label>
          <div className="flex flex-wrap gap-2">
            {AVA_DATAMOON_JOB_TITLE_PRESETS.map((title) => (
              <label key={title} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={draft.jobTitles.includes(title)}
                  onChange={() => patch({ jobTitles: toggleListValue(draft.jobTitles, title) })}
                />
                {title}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dm-custom-job-title">Buyer personas</Label>
          <Input
            id="dm-custom-job-title"
            placeholder="Custom job title or persona"
            value={draft.customJobTitle ?? ""}
            onChange={(e) => patch({ customJobTitle: e.target.value || null })}
          />
        </div>
      </FormSection>

      <FormSection title="Company Filters" grouped={grouped}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dm-company-size">Company size</Label>
            <select
              id="dm-company-size"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={draft.companySize}
              onChange={(e) => patch({ companySize: e.target.value as AvaDatamoonAudienceDraft["companySize"] })}
            >
              {AVA_DATAMOON_COMPANY_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size === "smb" ? "SMB (default)" : size}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dm-revenue-range">Revenue</Label>
            <Input
              id="dm-revenue-range"
              placeholder="e.g. $1M–$10M"
              value={draft.revenueRange ?? ""}
              onChange={(e) => patch({ revenueRange: e.target.value || null })}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Geography" grouped={grouped}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="dm-country">Country</Label>
            <Input
              id="dm-country"
              value={draft.geography.country}
              onChange={(e) => patch({ geography: { ...draft.geography, country: e.target.value } })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dm-state">State</Label>
            <Input
              id="dm-state"
              value={draft.geography.state ?? ""}
              onChange={(e) => patch({ geography: { ...draft.geography, state: e.target.value || null } })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dm-city">City</Label>
            <Input
              id="dm-city"
              value={draft.geography.city ?? ""}
              onChange={(e) => patch({ geography: { ...draft.geography, city: e.target.value || null } })}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Contact Requirements" grouped={grouped}>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["includeBusinessEmail", "Include business email"],
              ["includePhone", "Phone"],
              ["includeLinkedIn", "LinkedIn"],
              ["excludeDuplicates", "Exclude duplicates"],
              ["onlyNewSinceLastRefresh", "Only new records"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft[key]}
                onChange={() => patch({ [key]: !draft[key] })}
              />
              {label}
            </label>
          ))}
        </div>
      </FormSection>
    </div>
  )
}
