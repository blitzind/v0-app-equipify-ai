/**
 * Client-side Growth workspace search — parallel providers via existing APIs.
 */

import type { GlobalSearchGroup } from "@/lib/global-search/run-global-search"
import { runGrowthWorkspaceSearchProviders } from "@/lib/workspace/growth-workspace-search-providers"

export async function runGrowthWorkspaceSearchClient(
  query: string,
  signal?: AbortSignal,
): Promise<GlobalSearchGroup[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []
  return runGrowthWorkspaceSearchProviders(trimmed, signal ?? new AbortController().signal)
}
