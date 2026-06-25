"use client"

import { useMemo, useRef, type ReactNode } from "react"
import { Loader2, Search, Sparkles, Target, Users, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { DiscoveryModeToggle } from "@/components/growth/prospect-search/discovery-mode-toggle"
import { SearchRecommendations } from "@/components/growth/prospect-search/search-recommendations"
import {
  EQUIPIFY_DEFAULT_AI_ICP_PROFILE,
  GROWTH_PROSPECT_SEARCH_AI_ICP_QA_MARKER,
  PROSPECT_SEARCH_AI_FIRST_HERO,
  PROSPECT_SEARCH_AI_SEARCH_SUGGESTIONS,
  PROSPECT_SEARCH_EXTERNAL_DISCOVERY_COPY,
  PROSPECT_SEARCH_INTERNAL_DISCOVERY_COPY,
  PROSPECT_SEARCH_ICP_SETUP_PLACEHOLDER_STORAGE_KEY,
  type ProspectSearchAiIcpProfile,
  type ProspectSearchAiSearchSuggestion,
} from "@/lib/growth/prospect-search/prospect-search-ai-icp-config"
import type { GrowthProspectSearchDiscoveryMode } from "@/lib/growth/prospect-search/prospect-search-types"
import { cn } from "@/lib/utils"

type ProspectSearchAiFirstWorkspaceProps = {
  discoveryMode: GrowthProspectSearchDiscoveryMode
  onDiscoveryModeChange: (mode: GrowthProspectSearchDiscoveryMode) => void
  query: string
  onQueryChange: (value: string) => void
  heroPlaceholder: string
  heroFocused: boolean
  onHeroFocusChange: (focused: boolean) => void
  savedSearchNames: string[]
  searchButtonDisabled: boolean
  searchLoading: boolean
  searchLoadingLabel: string
  heroSearchButtonLabel: string
  onRunSearch: () => void
  onRecommendNextSearch: () => void
  onSearchManually: () => void
  onUseAiSuggestion: (suggestion: ProspectSearchAiSearchSuggestion) => void
  onSetIcp: () => void
  onRefineIcp: () => void
  onUseSavedIcp: () => void
  icpProfile?: ProspectSearchAiIcpProfile
  highlightedSuggestionId?: string | null
}

function readStoredIcpDraft(): ProspectSearchAiIcpProfile | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(PROSPECT_SEARCH_ICP_SETUP_PLACEHOLDER_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ProspectSearchAiIcpProfile
  } catch {
    return null
  }
}

export function ProspectSearchAiFirstWorkspace({
  discoveryMode,
  onDiscoveryModeChange,
  query,
  onQueryChange,
  heroPlaceholder,
  heroFocused,
  onHeroFocusChange,
  savedSearchNames,
  searchButtonDisabled,
  searchLoading,
  searchLoadingLabel,
  heroSearchButtonLabel,
  onRunSearch,
  onRecommendNextSearch,
  onSearchManually,
  onUseAiSuggestion,
  onSetIcp,
  onRefineIcp,
  onUseSavedIcp,
  icpProfile,
  highlightedSuggestionId,
}: ProspectSearchAiFirstWorkspaceProps) {
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const profile = useMemo(() => icpProfile ?? readStoredIcpDraft() ?? EQUIPIFY_DEFAULT_AI_ICP_PROFILE, [icpProfile])

  return (
    <div
      className="flex flex-col gap-5"
      data-qa-marker={GROWTH_PROSPECT_SEARCH_AI_ICP_QA_MARKER}
      data-prospect-search-ai-first="true"
    >
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-violet-50/80 via-card to-cyan-50/50 p-6 shadow-sm dark:from-violet-950/30 dark:to-cyan-950/20">
        <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{PROSPECT_SEARCH_AI_FIRST_HERO.headline}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {PROSPECT_SEARCH_AI_FIRST_HERO.supportingCopy}
        </p>
        <p className="mt-2 max-w-3xl text-xs text-muted-foreground">
          {discoveryMode === "internal"
            ? PROSPECT_SEARCH_INTERNAL_DISCOVERY_COPY
            : PROSPECT_SEARCH_EXTERNAL_DISCOVERY_COPY}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <DiscoveryModeToggle mode={discoveryMode} onChange={onDiscoveryModeChange} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onRecommendNextSearch}>
              <Sparkles className="mr-1.5 size-3.5" />
              {PROSPECT_SEARCH_AI_FIRST_HERO.recommendCta}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onSearchManually}>
              {PROSPECT_SEARCH_AI_FIRST_HERO.manualCta}
            </Button>
          </div>
        </div>

        <div className="mt-5">
          <div className="relative flex flex-col gap-2 sm:block">
            <Search className="pointer-events-none absolute left-4 top-1/2 hidden size-5 -translate-y-1/2 text-muted-foreground sm:block" />
            <input
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onFocus={() => onHeroFocusChange(true)}
              onBlur={() => setTimeout(() => onHeroFocusChange(false), 180)}
              onKeyDown={(e) => e.key === "Enter" && !searchButtonDisabled && onRunSearch()}
              placeholder={heroPlaceholder}
              className="h-14 w-full rounded-xl border border-border bg-background/90 pl-4 pr-4 text-base shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 sm:pl-12 sm:pr-36"
            />
            <Button
              className="w-full sm:absolute sm:right-2 sm:top-1/2 sm:w-auto sm:-translate-y-1/2"
              size="lg"
              onClick={onRunSearch}
              disabled={searchButtonDisabled}
              aria-label={discoveryMode === "discover_external" ? "Search companies" : "Search"}
            >
              {searchLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {searchLoadingLabel}
                </>
              ) : (
                heroSearchButtonLabel
              )}
            </Button>
            <SearchRecommendations
              query={query}
              savedSearchNames={savedSearchNames}
              visible={heroFocused}
              onSelect={(value) => {
                onQueryChange(value)
              }}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <GrowthEngineCard title="Growth Engine ICP" icon={<Target className="size-4 text-violet-600" />}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {profile.companyLabel || "Your company"}
          </p>
          {profile.whatWeSell ? (
            <p className="mt-2 text-sm text-muted-foreground">{profile.whatWeSell}</p>
          ) : null}

          <div className="mt-4 space-y-4">
            <IcpListSection title="Best-fit customer types" items={profile.customerTypes} />
            <IcpListSection title="Industries" items={profile.industries} />
            <IcpListSection title="Service workflows" items={profile.workflows} icon={<Wrench className="size-3.5" />} />
            <IcpListSection
              title="Target decision-makers"
              items={profile.decisionMakers}
              icon={<Users className="size-3.5" />}
            />
            <IcpListSection title="Buying signals" items={profile.buyingSignals} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-border/70 pt-4">
            <Button type="button" size="sm" variant="outline" onClick={onSetIcp}>
              Set ICP
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onRefineIcp}>
              Refine ICP
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onUseSavedIcp}>
              Use saved ICP
            </Button>
          </div>
        </GrowthEngineCard>

        <div ref={suggestionsRef} className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Recommended searches</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              AI suggestions based on your ICP — review, then run when ready.
            </p>
          </div>

          <div className="grid gap-3">
            {PROSPECT_SEARCH_AI_SEARCH_SUGGESTIONS.map((suggestion) => (
              <article
                key={suggestion.id}
                className={cn(
                  "rounded-2xl border bg-card p-4 shadow-sm transition-colors",
                  highlightedSuggestionId === suggestion.id
                    ? "border-violet-300 ring-2 ring-violet-200/80"
                    : "border-border/80",
                )}
                data-ai-search-suggestion={suggestion.id}
              >
                <h4 className="text-sm font-semibold text-foreground">{suggestion.title}</h4>
                <dl className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <div>
                    <dt className="font-medium text-foreground/80">Why it fits</dt>
                    <dd className="mt-0.5 leading-relaxed">{suggestion.whyItFits}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground/80">Expected buyer pain</dt>
                    <dd className="mt-0.5 leading-relaxed">{suggestion.buyerPain}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground/80">Suggested decision makers</dt>
                    <dd className="mt-0.5 leading-relaxed">{suggestion.decisionMakers}</dd>
                  </div>
                </dl>
                <Button
                  type="button"
                  size="sm"
                  className="mt-4"
                  onClick={() => onUseAiSuggestion(suggestion)}
                >
                  Use this search
                </Button>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function IcpListSection({
  title,
  items,
  icon,
}: {
  title: string
  items: string[]
  icon?: React.ReactNode
}) {
  if (items.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-foreground/90">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-violet-400" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
