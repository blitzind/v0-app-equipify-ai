import { notFound } from "next/navigation"
import { SendrPublicPageClient } from "@/components/sendr/sendr-public-page-client"
import { loadSendrPublicPageBySlug } from "@/lib/growth/sendr/growth-sendr-public-page-service"
import { parseSendrVisitorRenderContext } from "@/lib/growth/sendr/growth-sendr-visitor-render-context"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

export default async function SendrPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const query = await searchParams
  const renderContext = parseSendrVisitorRenderContext(query)
  const admin = createServiceRoleClient()
  if (!admin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
        Page temporarily unavailable.
      </div>
    )
  }

  const result = await loadSendrPublicPageBySlug(admin, slug, renderContext)
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
