/**
 * Equipify Master Context Doc — narrative sections are maintained in
 * `master-context.manual.before.md` and `master-context.manual.after.md`.
 * Repository inventory is injected from `master-context.generated.ts` (see `pnpm update:master-context`).
 * TODO: Optionally automate deeper schema/route introspection; keep secrets out of this file.
 */
import {
  MASTER_CONTEXT_MANUAL_AFTER,
  MASTER_CONTEXT_MANUAL_BEFORE,
} from "./master-context.manual.generated"
import { MCG_SCAN_SECTION } from "./master-context.generated"

/** Updated by `scripts/update-master-context.ts` alongside generated scan output. */
export const MASTER_CONTEXT_LAST_UPDATED_ISO = "2026-06-11T13:41:37.109Z"

function formatUtc(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return `${d.toISOString().replace("T", " ").slice(0, 19)} UTC`
  } catch {
    return iso
  }
}

/**
 * Full Markdown document for ChatGPT / GPT project planning. No secrets or env values.
 */
export function getEquipifyMasterContext(): string {
  return `# Equipify Master Context Doc

## Last Updated
${formatUtc(MASTER_CONTEXT_LAST_UPDATED_ISO)}

${MASTER_CONTEXT_MANUAL_BEFORE}

${MCG_SCAN_SECTION}

${MASTER_CONTEXT_MANUAL_AFTER}
`
}
