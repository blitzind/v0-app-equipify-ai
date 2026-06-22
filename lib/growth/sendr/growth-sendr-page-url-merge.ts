/** Sequence/content merge token replacement for Personalized Video page URLs (client-safe). */

import {
  GROWTH_SENDR_PAGE_URL_MERGE_TOKEN,
  GROWTH_SENDR_PAGE_URL_VARIABLE_KEY,
  GROWTH_VIDEO_PAGE_URL_MERGE_TOKEN,
  GROWTH_VIDEO_PAGE_URL_VARIABLE_KEY,
} from "@/lib/growth/sendr/growth-sendr-config"

export function applySendrPageUrlMergeFields(text: string, url: string): string {
  return text
    .replaceAll(GROWTH_VIDEO_PAGE_URL_MERGE_TOKEN, url)
    .replaceAll(`{{${GROWTH_VIDEO_PAGE_URL_VARIABLE_KEY}}}`, url)
    .replaceAll(GROWTH_SENDR_PAGE_URL_MERGE_TOKEN, url)
    .replaceAll(`{{${GROWTH_SENDR_PAGE_URL_VARIABLE_KEY}}}`, url)
}
