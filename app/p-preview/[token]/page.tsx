import type { Metadata } from "next"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import {
  GrowthSharePageUnavailable,
  GrowthSharePageView,
} from "@/components/growth/share-pages/growth-share-page-view"
import {
  buildSharePageRenderModel,
  GROWTH_SHARE_PAGE_UNAVAILABLE_COPY,
  resolveSharePagePreviewRoute,
} from "@/lib/growth/share-pages/share-page-public-service"

export const runtime = "nodejs"

type PageProps = {
  params: Promise<{ token: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Share page preview",
    robots: {
      index: false,
      follow: false,
      nocache: true,
      noarchive: true,
      nosnippet: true,
      noimageindex: true,
    },
  }
}

export default async function SharePagePreviewRoute({ params }: PageProps) {
  const { token } = await params
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return (
      <GrowthSharePageUnavailable
        title="Preview unavailable"
        message="Preview mode is temporarily unavailable. Please try again later."
      />
    )
  }

  const access = await resolveSharePagePreviewRoute(admin, token)
  if (access.access !== "granted" || !access.page) {
    const copy = GROWTH_SHARE_PAGE_UNAVAILABLE_COPY[access.access === "granted" ? "not_found" : access.access]
    return <GrowthSharePageUnavailable title={copy.title} message={copy.message} />
  }

  const model = await buildSharePageRenderModel(admin, access.page, { previewMode: true })
  return <GrowthSharePageView model={model} />
}
