import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { GrowthVideoPublicPageView } from "@/components/growth/videos/growth-video-public-page-view"
import { buildGrowthVideoOgMetadata } from "@/lib/growth/videos/growth-video-og-image-service"
import {
  parseGrowthVideoPublicRenderContext,
  resolveGrowthVideoPublicPageBySlug,
} from "@/lib/growth/videos/growth-video-public-page-service"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const query = await searchParams
  const admin = createServiceRoleClient()
  if (!admin) return { title: "Video" }

  const renderContext = parseGrowthVideoPublicRenderContext(query)
  const resolved = await resolveGrowthVideoPublicPageBySlug(admin, slug, renderContext)
  if (!resolved.ok) return { title: "Video" }

  return {
    ...buildGrowthVideoOgMetadata({
      title: resolved.page.title,
      description: resolved.page.description,
      ogImageUrl: resolved.page.ogImageUrl,
    }),
    robots: { index: false, follow: false },
  }
}

export default async function GrowthVideoPublicSlugPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const query = await searchParams
  const admin = createServiceRoleClient()
  if (!admin) notFound()

  const renderContext = parseGrowthVideoPublicRenderContext(query)
  const resolved = await resolveGrowthVideoPublicPageBySlug(admin, slug, renderContext)
  if (!resolved.ok) notFound()

  return <GrowthVideoPublicPageView page={resolved.page} />
}
