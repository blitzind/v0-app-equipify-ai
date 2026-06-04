/** Display-layer text normalization for inbox subjects and previews (UI only). */

const MOJIBAKE_MARKER = /[\u00C2\u00C3][\u0080-\u00BF]|â€|Â€/

const MOJIBAKE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Â€Â¢/g, "•"],
  [/â€¢/g, "•"],
  [/â€™/g, "'"],
  [/â€˜/g, "'"],
  [/â€œ/g, '"'],
  [/â€\u009d/g, '"'],
  [/â€"/g, "—"],
  [/â€“/g, "–"],
  [/Â /g, " "],
]

function latin1ToUtf8(text: string): string | null {
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i) & 0xff
  }
  const recovered = new TextDecoder("utf-8", { fatal: false }).decode(bytes)
  if (!recovered || recovered.includes("\uFFFD")) return null
  return recovered
}

/** Normalize common UTF-8 mojibake in inbox display strings without changing stored data. */
export function normalizeInboxDisplayText(value: string | null | undefined): string {
  if (value == null) return ""
  const trimmed = value.trim()
  if (!trimmed) return ""

  let result = trimmed
  if (MOJIBAKE_MARKER.test(result)) {
    const recovered = latin1ToUtf8(result)
    if (recovered && !MOJIBAKE_MARKER.test(recovered)) {
      result = recovered
    } else if (recovered) {
      result = recovered
    }
    for (const [pattern, replacement] of MOJIBAKE_REPLACEMENTS) {
      result = result.replace(pattern, replacement)
    }
  }

  return result.replace(/\s+/g, " ").trim()
}

export function displayInboxSubject(subject: string | null | undefined): string {
  const normalized = normalizeInboxDisplayText(subject)
  return normalized || "Untitled thread"
}
