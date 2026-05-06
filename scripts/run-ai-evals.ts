import { runAiEvals } from "@/lib/ai/evals/run-eval"

async function main() {
  const { results, mockMode } = await runAiEvals()
  const hasFailures = results.some((r) => !r.pass)
  if (hasFailures) {
    process.exitCode = 1
  }
  if (mockMode) {
    console.log("[ai-evals] completed in mock mode.")
  }
}

void main().catch((err) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err)
  console.error("[ai-evals] fatal:", msg)
  process.exit(1)
})
