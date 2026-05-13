import type { ReactNode } from "react"

/**
 * Minimal shell for staff invoice print/PDF preview routes.
 * Intentionally excludes dashboard chrome (sidebar, header, AIden, mobile nav) so browser print is document-only.
 */
export default function InvoicePrintRouteLayout({ children }: { children: ReactNode }) {
  return children
}
