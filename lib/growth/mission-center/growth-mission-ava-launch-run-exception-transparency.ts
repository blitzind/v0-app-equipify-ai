/** GE-AVA-LAUNCH-ROOTCAUSE-1 — Launch run exception transparency (client-safe). */

export const GROWTH_AVA_LAUNCH_ROOTCAUSE_1_QA_MARKER = "ge-ava-launch-rootcause-1-v1" as const

export const GE_AVA_LAUNCH_ROOTCAUSE_1_TEST_THROW_ENV = "GE_AVA_LAUNCH_ROOTCAUSE_1_TEST_THROW" as const

export type AvaLaunchSerializedException = {
  name: string
  message: string
  stack?: string
  cause?: unknown
  value?: unknown
}

export type AvaLaunchRunFailureWithException = {
  ok: false
  error: string
  status: number
  runId?: string | null
  exception?: AvaLaunchSerializedException
}

function safeInspectUnknown(error: unknown): unknown {
  if (error === null || typeof error !== "object") return error
  try {
    return JSON.parse(JSON.stringify(error))
  } catch {
    return { inspected: String(error) }
  }
}

export function serializeAvaLaunchRunException(error: unknown): AvaLaunchSerializedException {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    }
  }
  if (error && typeof error === "object") {
    return {
      name: "Object",
      message: "Non-Error thrown value",
      value: safeInspectUnknown(error),
    }
  }
  return {
    name: "Unknown",
    message: typeof error === "string" ? error : String(error),
    value: error,
  }
}

export function buildAvaLaunchUnexpectedExceptionFailure(
  error: unknown,
  input?: { status?: number; runId?: string | null },
): AvaLaunchRunFailureWithException {
  return {
    ok: false,
    error: "validation_failed",
    status: input?.status ?? 500,
    runId: input?.runId ?? null,
    exception: serializeAvaLaunchRunException(error),
  }
}

export function shouldThrowAvaLaunchRootCauseTestException(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[GE_AVA_LAUNCH_ROOTCAUSE_1_TEST_THROW_ENV] === "1"
}

export function buildAvaLaunchRootCauseTestException(): Error {
  return new Error("TEST_EXCEPTION")
}
