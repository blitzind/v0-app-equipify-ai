import { supabase } from "@/lib/supabase"

export default async function TestSupabasePage() {
  try {
    const { error } = await supabase.auth.getSession()

    if (error) {
      throw error
    }

    return <main>Supabase Connected</main>
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return <main>Supabase Error: {message}</main>
  }
}
