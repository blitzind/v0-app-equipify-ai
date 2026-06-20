import { createHash } from "node:crypto"

/** Deterministic slug from title + page id suffix — unique, no redirect chains. */
export function buildSendrPublishedSlug(title: string, pageId: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "page"
  const suffix = createHash("sha256").update(pageId).digest("hex").slice(0, 8)
  return `${base}-${suffix}`
}

export function normalizeSendrSlugInput(slug: string): string {
  return slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "")
}

export function isValidSendrPublicSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{2,79}[a-z0-9]$/.test(slug)
}

export function buildSendrPagePublicLink(
  slug: string,
  origin = "https://app.equipify.ai",
): string {
  return `${origin.replace(/\/$/, "")}/sendr/${slug}`
}
