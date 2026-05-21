"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function PaymentReturnRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const status = searchParams.get("status")
    const invoiceId = searchParams.get("invoiceId") ?? ""
    const safeStatus = status === "success" || status === "cancel" ? status : "cancel"

    if (UUID_RE.test(invoiceId)) {
      try {
        sessionStorage.setItem(
          "blitzpay_staff_checkout_return",
          JSON.stringify({ status: safeStatus, invoiceId, at: Date.now() }),
        )
      } catch {
        /* ignore storage failures */
      }
      router.replace(`/invoices?open=${encodeURIComponent(invoiceId)}`)
      return
    }

    router.replace("/invoices")
  }, [router, searchParams])

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">Returning from payment…</p>
    </div>
  )
}

export default function PaymentReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <PaymentReturnRedirect />
    </Suspense>
  )
}
