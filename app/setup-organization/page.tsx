import { redirect } from "next/navigation"

import { createServerSupabaseClient } from "@/lib/supabase/server"

async function createEquipifyOrganizationAction() {
  "use server"

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { error } = await supabase.rpc("create_organization_with_owner", {
    org_name: "Equipify",
    org_slug: "equipify",
  })

  if (error) {
    redirect(`/setup-organization?status=error&message=${encodeURIComponent(error.message)}`)
  }

  redirect("/setup-organization?status=success")
}

type SetupPageProps = {
  searchParams: Promise<{
    status?: string
    message?: string
  }>
}

export default async function SetupOrganizationPage({ searchParams }: SetupPageProps) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const params = await searchParams
  const isSuccess = params.status === "success"
  const isError = params.status === "error"
  const errorMessage = params.message ?? "Unable to create organization."

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md border rounded-lg p-6 space-y-4 bg-white">
        <h1 className="text-xl font-semibold">Organization Setup</h1>
        <p className="text-sm text-gray-600">
          Temporary setup tool for creating the initial Equipify organization.
        </p>

        <form action={createEquipifyOrganizationAction}>
          <button
            type="submit"
            className="w-full h-10 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Create Equipify Organization
          </button>
        </form>

        {isSuccess && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
            Organization created successfully.
          </p>
        )}

        {isError && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            Error: {errorMessage}
          </p>
        )}
      </div>
    </main>
  )
}
