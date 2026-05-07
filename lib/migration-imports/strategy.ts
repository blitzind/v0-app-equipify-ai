import type { MigrationCommitOptions, MigrationImportStrategy } from "./types"

export const IMPORT_STRATEGIES: { value: MigrationImportStrategy; label: string; description: string }[] = [
  {
    value: "skip_duplicates",
    label: "Skip duplicates",
    description: "Do not change existing records when a duplicate is detected.",
  },
  {
    value: "update_empty_fields",
    label: "Update only empty fields",
    description: "For matches, fill blank fields only; never overwrite non-empty values.",
  },
  {
    value: "update_existing",
    label: "Update existing records",
    description: "For matches, apply mapped CSV values (use with care).",
  },
  {
    value: "create_new_only",
    label: "Only create new records",
    description: "Fail rows that would match an existing record.",
  },
]

/** Normalize API/body options to a single strategy (Phase 1 duplicateStrategy preserved). */
export function resolveImportStrategy(options?: MigrationCommitOptions | null): MigrationImportStrategy {
  const s = options?.strategy
  if (
    s === "skip_duplicates" ||
    s === "update_empty_fields" ||
    s === "update_existing" ||
    s === "create_new_only"
  ) {
    return s
  }
  if (options?.duplicateStrategy === "fail_on_duplicate") {
    return "create_new_only"
  }
  return "skip_duplicates"
}
