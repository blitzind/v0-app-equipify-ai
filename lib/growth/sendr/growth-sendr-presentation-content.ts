/** Client-safe helpers for interpreting section JSON content in presentation layer. */

export type PresentationTestimonialItem = {
  quote: string
  author?: string
  company?: string
  role?: string
}

export type PresentationResourceItem = {
  title: string
  description?: string
  href?: string
  actionLabel?: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function parsePresentationTestimonials(
  content: Record<string, unknown>,
): PresentationTestimonialItem[] {
  if (content.presentationKind === "testimonials" && Array.isArray(content.items)) {
    return content.items
      .map((item) => {
        const row = asRecord(item)
        if (!row) return null
        const quote = String(row.quote ?? row.text ?? row.body ?? "").trim()
        if (!quote) return null
        return {
          quote,
          author: row.author ? String(row.author) : row.name ? String(row.name) : undefined,
          company: row.company ? String(row.company) : undefined,
          role: row.role ? String(row.role) : undefined,
        }
      })
      .filter((item): item is PresentationTestimonialItem => item !== null)
  }

  if (!Array.isArray(content.items)) return []
  return content.items
    .map((item) => {
      const row = asRecord(item)
      if (!row || !("quote" in row)) return null
      const quote = String(row.quote ?? "").trim()
      if (!quote) return null
      return {
        quote,
        author: row.author ? String(row.author) : undefined,
        company: row.company ? String(row.company) : undefined,
        role: row.role ? String(row.role) : undefined,
      }
    })
    .filter((item): item is PresentationTestimonialItem => item !== null)
}

export function parsePresentationResources(content: Record<string, unknown>): PresentationResourceItem[] {
  if (
    (content.presentationKind === "resources" || content.presentationKind === "downloads") &&
    Array.isArray(content.items)
  ) {
    return content.items
      .map((item) => {
        const row = asRecord(item)
        if (!row) return null
        const title = String(row.title ?? row.name ?? "").trim()
        if (!title) return null
        return {
          title,
          description: row.description ? String(row.description) : undefined,
          href: row.href ? String(row.href) : row.url ? String(row.url) : undefined,
          actionLabel: row.actionLabel ? String(row.actionLabel) : row.label ? String(row.label) : undefined,
        }
      })
      .filter((item): item is PresentationResourceItem => item !== null)
  }

  if (!Array.isArray(content.items)) return []
  return content.items
    .map((item) => {
      const row = asRecord(item)
      if (!row || !("title" in row)) return null
      const title = String(row.title ?? "").trim()
      if (!title) return null
      return {
        title,
        description: row.description ? String(row.description) : undefined,
        href: row.href ? String(row.href) : undefined,
        actionLabel: row.actionLabel ? String(row.actionLabel) : undefined,
      }
    })
    .filter((item): item is PresentationResourceItem => item !== null)
}

export function isPresentationBenefitsSection(content: Record<string, unknown>): boolean {
  return content.presentationKind === "benefits" || content.presentationKind === "features"
}

export function formatWalkthroughDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds <= 0) return null
  const mins = Math.round(seconds / 60)
  if (mins <= 0) return "Short walkthrough"
  return mins === 1 ? "1 minute walkthrough" : `${mins} minute walkthrough`
}
