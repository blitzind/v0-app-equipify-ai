import "server-only"

import { NextResponse } from "next/server"
import {
  getGrowthOutboundMode,
  isGrowthOutboundAdapterMode,
  isGrowthOutboundStandaloneMode,
} from "@/lib/growth/runtime/outbound-mode"
import {
  ADAPTER_OUTBOUND_CUTOVER_DISABLED_CODE,
  GROWTH_NATIVE_OUTBOUND_CUTOVER_QA_MARKER,
  parseGrowthAllowAdapterOutbound,
  GROWTH_ALLOW_ADAPTER_OUTBOUND_ENV,
} from "@/lib/growth/runtime/outbound-cutover-types"

export {
  ADAPTER_OUTBOUND_CUTOVER_DISABLED_CODE,
  GROWTH_ALLOW_ADAPTER_OUTBOUND_ENV,
  GROWTH_NATIVE_OUTBOUND_CUTOVER_QA_MARKER,
  parseGrowthAllowAdapterOutbound,
} from "@/lib/growth/runtime/outbound-cutover-types"

export class AdapterOutboundCutoverDisabledError extends Error {
  readonly code = ADAPTER_OUTBOUND_CUTOVER_DISABLED_CODE

  constructor(detail?: string) {
    super(
      detail ??
        "Adapter outreach queue execution is disabled. Use Sequence Execution (native Gmail transport). Set GROWTH_ALLOW_ADAPTER_OUTBOUND=true only for rollback.",
    )
    this.name = "AdapterOutboundCutoverDisabledError"
  }
}

/** Explicit rollback flag — required with GROWTH_OUTBOUND_MODE=adapter to use Lemlist/outreach_queue. */
export function isGrowthAllowAdapterOutboundEnabled(): boolean {
  return parseGrowthAllowAdapterOutbound(process.env[GROWTH_ALLOW_ADAPTER_OUTBOUND_ENV])
}

/**
 * Adapter/Lemlist execution plane is enabled only when mode is adapter AND rollback env is set.
 * Default cutover: standalone scheduling + no new outreach_queue writes.
 */
export function isAdapterOutboundExecutionEnabled(): boolean {
  return isGrowthOutboundAdapterMode() && isGrowthAllowAdapterOutboundEnabled()
}

export function assertAdapterOutboundExecutionAllowed(context?: string): void {
  if (isAdapterOutboundExecutionEnabled()) return
  throw new AdapterOutboundCutoverDisabledError(
    context
      ? `${context}: adapter outbound is disabled (native cutover active).`
      : undefined,
  )
}

/** Returns 410 when adapter outreach mutations are disabled; null when rollback env allows adapter. */
export function growthAdapterOutboundCutoverHttpResponse(
  context?: string,
  status = 410,
): NextResponse | null {
  if (isAdapterOutboundExecutionEnabled()) return null
  return NextResponse.json(adapterOutboundCutoverBlockPayload(context), { status })
}

export function adapterOutboundCutoverBlockPayload(context?: string): {
  error: typeof ADAPTER_OUTBOUND_CUTOVER_DISABLED_CODE
  message: string
  outbound_mode: ReturnType<typeof getGrowthOutboundMode>
  native_cutover_active: boolean
  rollback_env: typeof GROWTH_ALLOW_ADAPTER_OUTBOUND_ENV
  sequence_execution_href: string
} {
  return {
    error: ADAPTER_OUTBOUND_CUTOVER_DISABLED_CODE,
    message:
      context ??
      "Outreach queue / Lemlist execution is disabled. Approve sends via Sequence Execution (native transport).",
    outbound_mode: getGrowthOutboundMode(),
    native_cutover_active: !isAdapterOutboundExecutionEnabled(),
    rollback_env: GROWTH_ALLOW_ADAPTER_OUTBOUND_ENV,
    sequence_execution_href: "/admin/growth/sequences/execution",
  }
}

/** growth-outreach-execute cron removed from vercel.json; route stays for manual rollback invocations. */
export function isGrowthOutreachExecuteCronEnabled(): boolean {
  return isAdapterOutboundExecutionEnabled()
}

export function describeGrowthNativeOutboundCutoverStatus(): {
  qa_marker: typeof GROWTH_NATIVE_OUTBOUND_CUTOVER_QA_MARKER
  outbound_mode: ReturnType<typeof getGrowthOutboundMode>
  standalone_mode: boolean
  adapter_execution_enabled: boolean
  allow_adapter_outbound_env: boolean
  outreach_execute_cron_enabled: boolean
  scheduling_plane: "sequence_execution_jobs" | "outreach_queue"
} {
  const adapterEnabled = isAdapterOutboundExecutionEnabled()
  return {
    qa_marker: GROWTH_NATIVE_OUTBOUND_CUTOVER_QA_MARKER,
    outbound_mode: getGrowthOutboundMode(),
    standalone_mode: isGrowthOutboundStandaloneMode(),
    adapter_execution_enabled: adapterEnabled,
    allow_adapter_outbound_env: isGrowthAllowAdapterOutboundEnabled(),
    outreach_execute_cron_enabled: isGrowthOutreachExecuteCronEnabled(),
    scheduling_plane: adapterEnabled ? "outreach_queue" : "sequence_execution_jobs",
  }
}
