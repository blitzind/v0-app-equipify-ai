import { GrowthSendrPublicPageView } from "@/lib/growth/sendr/growth-sendr-public-page-view"
import { parseSendrVisitorRenderContext } from "@/lib/growth/sendr/growth-sendr-visitor-render-context"

export const runtime = "nodejs"

export default async function PersonalizedVideoPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const query = await searchParams
  const renderContext = parseSendrVisitorRenderContext(query)

  return <GrowthSendrPublicPageView slug={slug} renderContext={renderContext} />
}
