import "server-only"

import { NextResponse } from "next/server"
import { logBlitzpayServerFailure } from "@/lib/blitzpay/blitzpay-server-failure-log"

/** JSON body intentionally omits `message` so clients never surface raw DB/API errors. */
export function blitzpayStaffLoadFailedResponse(context: string, cause: unknown, status = 503) {
  logBlitzpayServerFailure(context, cause)
  return NextResponse.json({ error: "load_failed" }, { status })
}

/** Staff mutations: log detail server-side; response carries only a stable `error` code. */
export function blitzpayStaffOperationFailedResponse(
  context: string,
  cause: unknown,
  errorCode: string,
  status = 400,
) {
  logBlitzpayServerFailure(context, cause)
  return NextResponse.json({ error: errorCode }, { status })
}
