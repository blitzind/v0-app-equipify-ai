import type { Metadata } from "next"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import {
  GrowthSharePageUnavailable,
  GrowthSharePageView,
} from "@/components/growth/share-pages/growth-share-page-view"
import {
  buildSharePageRenderModel,
  GROWTH_SHARE_PAGE_UNAVAILABLE_COPY,
  resolveSharePagePublicRoute,
} from "@/lib/growth/share-pages/share-page-public-service"

export const runtime = "nodejs"

type PageProps = {
  params: Promise<{ token: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Personalized page",
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function SharePagePublicRoute({ params }: PageProps) {
  const { token } = await params
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return (
      <GrowthSharePageUnavailable
        title="Page unavailable"
        message="This personalized page is temporarily unavailable. Please try again later."
      />
    )
  }

  const access = await resolveSharePagePublicRoute(admin, token)
  if (access.access !== "granted" || !access.page) {
    const copy = GROWTH_SHARE_PAGE_UNAVAILABLE_COPY[access.access === "granted" ? "not_found" : access.access]
    return <GrowthSharePageUnavailable title={copy.title} message={copy.message} />
  }

  const model = await buildSharePageRenderModel(admin, access.page, {
    previewMode: false,
    publicToken: token,
  })
  return <GrowthSharePageView model={model} />
}
