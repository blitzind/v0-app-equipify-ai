import type { MigrationCommitOptions, MigrationImportStrategy } from "./types"

export const IMPORT_STRATEGIES: { value: MigrationImportStrategy; label: string; description: string }[] = [
  {
    value: "skip_duplicates",
    label: "Skip duplicates",
    description: "Create new customers only and skip likely matches.",
  },
  {
    value: "update_empty_fields",
    label: "Fill missing fields",
    description: "Update existing customers only where mapped fields are currently blank.",
  },
  {
    value: "update_existing",
    label: "Update existing records",
    description: "Replace mapped fields on matching customers. Use with care.",
  },
  {
    value: "create_new_only",
    label: "Create new only",
    description: "Never update existing customers; matching rows fail for review.",
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
