import "server-only"

import { decodeBasicHtmlEntities } from "@/lib/growth/research-website-url"

export function stripHtmlToPlainText(html: string): string {
  let text = html
  text = text.replace(/<!--[\s\S]*?-->/g, " ")
  text = text.replace(/<script[\s\S]*?<\/script>/gi, " ")
  text = text.replace(/<style[\s\S]*?<\/style>/gi, " ")
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
  text = text.replace(/<svg[\s\S]*?<\/svg>/gi, " ")
  text = text.replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")

  const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch?.[1] ? decodeBasicHtmlEntities(titleMatch[1].replace(/\s+/g, " ").trim()) : null

  text = text.replace(/<(br|hr)\b[^>]*>/gi, "\n")
  text = text.replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|section|article|header|footer|table|ul|ol)>/gi, "\n")
  text = text.replace(/<[^>]+>/g, " ")
  text = decodeBasicHtmlEntities(text)
  text = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")

  if (title && !text.toLowerCase().startsWith(title.toLowerCase())) {
    return `${title}\n${text}`.trim()
  }

  return text.trim()
}

export function isLikelyTextContent(contentType: string | null, body: string): boolean {
  if (!contentType) {
    return /<\/?[a-z][\s\S]*>/i.test(body) || body.trim().length > 0
  }

  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? ""
  if (
    normalized === "text/html" ||
    normalized === "text/plain" ||
    normalized === "application/xhtml+xml"
  ) {
    return true
  }

  if (normalized.startsWith("image/") || normalized.startsWith("application/pdf")) {
    return false
  }

  return false
}
