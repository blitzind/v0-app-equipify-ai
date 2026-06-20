import { notFound } from "next/navigation"
import { SendrPublicPageClient } from "@/components/sendr/sendr-public-page-client"
import { loadSendrPublicPageBySlug } from "@/lib/growth/sendr/growth-sendr-public-page-service"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

export default async function SendrPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const admin = createServiceRoleClient()
  if (!admin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
        Page temporarily unavailable.
      </div>
    )
  }

  const result = await loadSendrPublicPageBySlug(admin, slug)
  if (!result.ok) {
    if (result.status === 503) {
      return (
        <div className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
          Personalized pages are not available yet.
        </div>
      )
    }
    notFound()
  }

  return <SendrPublicPageClient slug={result.slug} page={result.payload} />
}
