import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { GrowthVideoPublicPageView } from "@/components/growth/videos/growth-video-public-page-view"
import { resolveGrowthVideoPublicPageBySlug } from "@/lib/growth/videos/growth-video-public-page-service"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const admin = createServiceRoleClient()
  if (!admin) return { title: "Video" }

  const resolved = await resolveGrowthVideoPublicPageBySlug(admin, slug)
  if (!resolved.ok) return { title: "Video" }

  return {
    title: resolved.page.title,
    description: resolved.page.description ?? undefined,
    robots: { index: false, follow: false },
  }
}

export default async function GrowthVideoPublicSlugPage({ params }: PageProps) {
  const { slug } = await params
  const admin = createServiceRoleClient()
  if (!admin) notFound()

  const resolved = await resolveGrowthVideoPublicPageBySlug(admin, slug)
  if (!resolved.ok) notFound()

  return <GrowthVideoPublicPageView page={resolved.page} />
}
