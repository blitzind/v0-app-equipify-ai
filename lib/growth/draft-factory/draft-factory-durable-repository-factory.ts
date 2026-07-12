/**
 * SV1-5A — Repository factory (server-only for Postgres path).
 * Production → Postgres only. Certification/test may inject memory/disk.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  AiOsDraftFactoryRuntimeMode,
  DraftFactoryDurableRepository,
  ResolveDraftFactoryDurableRepositoryInput,
} from "@/lib/growth/draft-factory/draft-factory-durable-repository-contract"
import { resolveDraftFactoryDurableRepositoryKind } from "@/lib/growth/draft-factory/draft-factory-durable-repository-contract"
import { createMemoryDraftFactoryRepository } from "@/lib/growth/draft-factory/draft-factory-durable-memory-repository"
import { createPostgresDraftFactoryRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository"

export type { DraftFactoryDurableRepository, AiOsDraftFactoryRuntimeMode }
export { resolveDraftFactoryDurableRepositoryKind }

export async function resolveDraftFactoryDurableRepository(
  input: ResolveDraftFactoryDurableRepositoryInput & {
    admin?: SupabaseClient | null
  },
): Promise<{
  repository: DraftFactoryDurableRepository
  kind: ReturnType<typeof resolveDraftFactoryDurableRepositoryKind>
  runtime: AiOsDraftFactoryRuntimeMode
}> {
  const kind = resolveDraftFactoryDurableRepositoryKind(input)

  if (input.runtime === "production") {
    if (!input.admin) {
      throw new Error("SV1-5A: Production requires Supabase admin — fail closed (no memory fallback).")
    }
    const repository = createPostgresDraftFactoryRepository(input.admin)
    const available = await repository.assertAvailable?.()
    if (available && !available.ok) {
      throw new Error(`SV1-5A: ${available.reason}`)
    }
    return { repository, kind: "postgres", runtime: "production" }
  }

  if (input.injectedRepository) {
    return {
      repository: input.injectedRepository,
      kind: input.injectedRepository.kind,
      runtime: input.runtime,
    }
  }

  if (input.admin && input.runtime === "certification") {
    const repository = createPostgresDraftFactoryRepository(input.admin)
    return { repository, kind: "postgres", runtime: "certification" }
  }

  return {
    repository: createMemoryDraftFactoryRepository("memory"),
    kind: "memory",
    runtime: input.runtime,
  }
}
