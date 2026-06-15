import type { Metadata } from "next"
import PublicBookingPage from "@/components/growth/public-booking-page"

export const runtime = "nodejs"

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function BookSlugPage({ params }: PageProps) {
  const { slug } = await params
  return <PublicBookingPage slug={slug} />
}
