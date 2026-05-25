import PublicBookingPage from "@/components/growth/public-booking-page"

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function BookSlugPage({ params }: PageProps) {
  const { slug } = await params
  return <PublicBookingPage slug={slug} />
}
