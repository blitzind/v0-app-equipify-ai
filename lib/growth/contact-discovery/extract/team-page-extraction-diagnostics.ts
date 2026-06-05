/** Phase 7.PS-ID — Team page extraction audit diagnostics. Server-only. */

import "server-only"

import { fetchLeadWebsite } from "@/lib/growth/research-website-fetch"
import { extractContactCardContacts } from "@/lib/growth/contact-discovery/extract/extract-contact-card"
import { extractTeamPageContacts } from "@/lib/growth/contact-discovery/extract/extract-team-page"
import {
  extractCardBlocks,
  extractSectionBlocks,
  isPlausiblePersonName,
  isPlausibleTeamPagePersonName,
  readHeadingAndSubheading,
  stripHtmlTags,
} from "@/lib/growth/contact-discovery/extract/extract-shared"

export const GROWTH_TEAM_PAGE_EXTRACTION_DIAGNOSTICS_QA_MARKER =
  "growth-team-page-extraction-diagnostics-7-ps-id-v1" as const

export type TeamPageExtractionFailureCategory =
  | "parser_miss"
  | "dom_structure_issue"
  | "name_validation_too_strict"
  | "title_name_separation_issue"
  | "ocr_text_cleanup_issue"
  | "extraction_ordering_issue"
  | "no_team_page_url"
  | "fetch_failed"
  | "generic_contact_only"
  | "named_extracted"

function categorizeRejection(input: {
  name: string | null
  title: string | null
  block: string
}): TeamPageExtractionFailureCategory {
  const { name, title, block } = input
  if (!name) return "parser_miss"
  if (name.length < 3) return "ocr_text_cleanup_issue"
  if (isPlausiblePersonName(name)) return "parser_miss"
  if (isPlausibleTeamPagePersonName(name, block)) return "name_validation_too_strict"
  if (title && name && /\b(ceo|president|director|manager|owner)\b/i.test(name)) {
    return "title_name_separation_issue"
  }
  if (!/<h[1-6][^>]*>/i.test(block) && !/class="[^"]*name/i.test(block)) {
    return "dom_structure_issue"
  }
  return "name_validation_too_strict"
}

export type TeamPageExtractionAuditRow = {
  company_contact_id: string | null
  company_id: string
  company_name: string | null
  stored_full_name: string
  stored_title: string | null
  source_page_url: string | null
  fetch_status: string
  section_blocks: number
  card_blocks: number
  extracted_named: Array<{ full_name: string; title: string | null }>
  block_diagnostics: Array<{
    name: string | null
    title: string | null
    failure_category: TeamPageExtractionFailureCategory
    excerpt: string
  }>
  primary_failure_category: TeamPageExtractionFailureCategory
}

export async function auditTeamPageExtractionRecord(input: {
  company_contact_id?: string | null
  company_id: string
  company_name?: string | null
  stored_full_name: string
  stored_title?: string | null
  source_page_url?: string | null
  page_html?: string | null
}): Promise<TeamPageExtractionAuditRow> {
  const source_page_url = input.source_page_url?.trim() || null
  let page_html = input.page_html ?? null
  let fetch_status = page_html ? "provided" : "no_url"

  if (!page_html && source_page_url) {
    const fetched = await fetchLeadWebsite(source_page_url)
    fetch_status = fetched.status
    page_html = fetched.excerpt
  }

  const sections = page_html ? extractSectionBlocks(page_html) : []
  const cards = page_html ? extractCardBlocks(page_html) : []
  const blocks = [...sections, ...cards]
  const block_diagnostics = blocks.slice(0, 12).map((block) => {
    const { name, title } = readHeadingAndSubheading(block)
    return {
      name,
      title,
      failure_category: categorizeRejection({ name, title, block }),
      excerpt: stripHtmlTags(block).slice(0, 160),
    }
  })

  const extracted = page_html
    ? [
        ...extractTeamPageContacts(page_html, source_page_url ?? ""),
        ...extractContactCardContacts(page_html, source_page_url ?? ""),
      ]
    : []
  const extracted_named = extracted
    .filter((row) => row.full_name !== "Company contact")
    .map((row) => ({ full_name: row.full_name, title: row.title }))

  let primary_failure_category: TeamPageExtractionFailureCategory = "parser_miss"
  if (!source_page_url) primary_failure_category = "no_team_page_url"
  else if (fetch_status !== "ok" && fetch_status !== "provided") primary_failure_category = "fetch_failed"
  else if (extracted_named.length > 0) primary_failure_category = "named_extracted"
  else if (input.stored_full_name === "Company contact") primary_failure_category = "generic_contact_only"
  else if (block_diagnostics.length > 0) {
    primary_failure_category = block_diagnostics[0]!.failure_category
  }

  return {
    company_contact_id: input.company_contact_id ?? null,
    company_id: input.company_id,
    company_name: input.company_name ?? null,
    stored_full_name: input.stored_full_name,
    stored_title: input.stored_title ?? null,
    source_page_url,
    fetch_status,
    section_blocks: sections.length,
    card_blocks: cards.length,
    extracted_named,
    block_diagnostics,
    primary_failure_category,
  }
}
