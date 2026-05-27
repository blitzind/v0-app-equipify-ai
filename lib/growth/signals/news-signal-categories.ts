/** Client-safe news signal category taxonomy + deterministic classification (Milestone B). */

export const GROWTH_NEWS_SIGNAL_CATEGORIES = [
  "funding",
  "acquisition",
  "leadership",
  "expansion",
  "layoffs",
  "compliance",
  "product_launch",
  "partnership",
  "general",
] as const

export type GrowthNewsSignalCategory = (typeof GROWTH_NEWS_SIGNAL_CATEGORIES)[number]

const CATEGORY_KEYWORDS: Record<Exclude<GrowthNewsSignalCategory, "general">, readonly string[]> = {
  funding: ["funding", "raised", "series a", "series b", "series c", "investment", "venture", "capital round"],
  acquisition: ["acquire", "acquisition", "merger", "merged", "buyout", "purchased"],
  leadership: ["ceo", "cfo", "cto", "president", "chief", "appointed", "named", "leadership", "executive"],
  expansion: ["expand", "expansion", "new location", "opens", "opening", "regional", "hub", "facility"],
  layoffs: ["layoff", "layoffs", "workforce reduction", "job cuts", "restructuring"],
  compliance: ["compliance", "regulator", "regulatory", "fine", "violation", "sec ", "fda"],
  product_launch: ["launch", "launches", "introduces", "unveils", "new product", "release"],
  partnership: ["partner", "partnership", "collaborat", "alliance", "joint venture"],
}

export function classifyNewsSignalCategory(input: {
  headline?: string | null
  excerpt?: string | null
}): GrowthNewsSignalCategory {
  const haystack = [input.headline, input.excerpt].filter(Boolean).join(" ").toLowerCase()
  if (!haystack.trim()) return "general"

  for (const category of GROWTH_NEWS_SIGNAL_CATEGORIES) {
    if (category === "general") continue
    const keywords = CATEGORY_KEYWORDS[category]
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return category
    }
  }

  return "general"
}

export function formatNewsCategoryLabel(category: string | null | undefined): string {
  if (!category?.trim()) return "—"
  return category
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

/** Example queue payload for operator/manual News ingestion (see Milestone B docs). */
export const GROWTH_NEWS_MANUAL_QUEUE_SAMPLE_INPUT = [
  {
    headline: "Acme Field Services opens regional service hub",
    source_url: "https://example.com/news/acme-regional-hub",
    publisher: "Industry Weekly",
    published_at: "2026-05-20T12:00:00Z",
    company_name: "Acme Field Services",
    domain: "acmefield.com",
    excerpt: "Acme Field Services announced a new regional service hub to support expansion.",
  },
] as const

export const GROWTH_NEWS_MANUAL_QUEUE_SQL_EXAMPLE = `
-- Manual News ingestion (Milestone B): enqueue then run growth-signal-ingest cron/worker.
insert into growth.signal_ingestion_queue (provider_key, status, cursor, scheduled_for)
values (
  'news_manual',
  'pending',
  jsonb_build_object(
    'sample_input',
    jsonb_build_array(
      jsonb_build_object(
        'headline', 'Acme Field Services opens regional service hub',
        'source_url', 'https://example.com/news/acme-regional-hub',
        'publisher', 'Industry Weekly',
        'published_at', '2026-05-20T12:00:00Z',
        'company_name', 'Acme Field Services',
        'domain', 'acmefield.com',
        'excerpt', 'Acme Field Services announced a new regional service hub to support expansion.'
      )
    )
  ),
  now()
);
`.trim()
