import { GROWTH_CONTENT_MERGE_FIELD_RE } from "@/lib/growth/content/merge-field-validator"
import {
  buildVariableExampleMap,
  buildVariableFallbackMap,
} from "@/lib/growth/content/variable-registry"
import type { GrowthContentVariable } from "@/lib/growth/content/content-types"
import {
  extractContentMergeFields,
  validateContentMergeFields,
} from "@/lib/growth/content/merge-field-validator"

const COMPLIANCE_FOOTER_HTML =
  '<p style="font-size:12px;color:#666;margin-top:24px;">{{unsubscribe.link}} — Reply STOP to unsubscribe.</p>'

export type ContentRenderInput = {
  subject?: string
  body: string
  variables: GrowthContentVariable[]
  values?: Record<string, string>
  complianceFooterRequired?: boolean
  useExampleValues?: boolean
}

export type ContentRenderOutput = {
  subject: string
  body: string
  html: string
  warnings: string[]
  blockedVariables: string[]
  missingVariables: string[]
  usedVariables: string[]
  complianceFooterVisible: boolean
}

function renderMergeText(
  text: string,
  map: Record<string, string>,
  fallbacks: Record<string, string>,
): { rendered: string; missing: string[] } {
  const missing: string[] = []
  const rendered = text.replace(GROWTH_CONTENT_MERGE_FIELD_RE, (_, raw: string) => {
    const key = raw.trim().toLowerCase()
    if (Object.prototype.hasOwnProperty.call(map, key)) return map[key]!
    if (Object.prototype.hasOwnProperty.call(fallbacks, key)) {
      missing.push(key)
      return fallbacks[key]!
    }
    missing.push(key)
    return `[${key}]`
  })
  return { rendered, missing }
}

export function renderContentTemplate(input: ContentRenderInput): ContentRenderOutput {
  const allowedKeys = new Set(input.variables.filter((v) => v.allowed).map((v) => v.variableKey.toLowerCase()))
  const subjectText = input.subject ?? ""
  const bodyText = input.body ?? ""

  const subjectValidation = validateContentMergeFields({ text: subjectText, allowedKeys })
  const bodyValidation = validateContentMergeFields({ text: bodyText, allowedKeys })

  const exampleMap = buildVariableExampleMap(input.variables)
  const fallbackMap = buildVariableFallbackMap(input.variables)
  const valueMap: Record<string, string> = {}
  for (const [key, value] of Object.entries(input.values ?? {})) {
    valueMap[key.toLowerCase()] = value
  }
  const mergeMap = input.useExampleValues !== false ? { ...exampleMap, ...valueMap } : { ...valueMap }

  const renderedSubject = renderMergeText(subjectText, mergeMap, fallbackMap)
  const renderedBody = renderMergeText(bodyText, mergeMap, fallbackMap)

  const warnings: string[] = []
  if (subjectValidation.blockedVariables.length > 0) {
    warnings.push(`Blocked variables in subject: ${subjectValidation.blockedVariables.join(", ")}`)
  }
  if (bodyValidation.blockedVariables.length > 0) {
    warnings.push(`Blocked variables in body: ${bodyValidation.blockedVariables.join(", ")}`)
  }
  if (subjectValidation.unknownVariables.length > 0) {
    warnings.push(`Unknown variables in subject: ${subjectValidation.unknownVariables.join(", ")}`)
  }
  if (bodyValidation.unknownVariables.length > 0) {
    warnings.push(`Unknown variables in body: ${bodyValidation.unknownVariables.join(", ")}`)
  }

  const complianceFooterRequired = input.complianceFooterRequired !== false
  const hasUnsubscribe = extractContentMergeFields(bodyText).includes("unsubscribe.link")
  const complianceFooterVisible = complianceFooterRequired && hasUnsubscribe

  let html = `<div>${renderedBody.rendered.replace(/\n/g, "<br/>")}</div>`
  if (complianceFooterRequired && !hasUnsubscribe) {
    html += COMPLIANCE_FOOTER_HTML
    warnings.push("Compliance footer appended — unsubscribe.link merge field included.")
  } else if (complianceFooterVisible) {
    html += COMPLIANCE_FOOTER_HTML.replace("{{unsubscribe.link}}", mergeMap["unsubscribe.link"] ?? fallbackMap["unsubscribe.link"] ?? "[unsubscribe link]")
  }

  const missingVariables = [...new Set([...renderedSubject.missing, ...renderedBody.missing])]
  if (missingVariables.length > 0) {
    warnings.push(`Missing variables used safe fallbacks: ${missingVariables.join(", ")}`)
  }

  return {
    subject: renderedSubject.rendered,
    body: renderedBody.rendered,
    html,
    warnings,
    blockedVariables: [...new Set([...subjectValidation.blockedVariables, ...bodyValidation.blockedVariables])],
    missingVariables,
    usedVariables: [...new Set([...subjectValidation.usedVariables, ...bodyValidation.usedVariables])],
    complianceFooterVisible: complianceFooterRequired,
  }
}

export function insertSnippetsIntoBody(body: string, snippets: Array<{ content: string }>): string {
  if (snippets.length === 0) return body
  const inserted = snippets.map((snippet) => snippet.content.trim()).filter(Boolean).join("\n\n")
  return `${body.trim()}\n\n${inserted}`.trim()
}
