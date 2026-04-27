import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  // Guarantee a public.users row exists — all other tables FK-reference it.
  await supabase.from('users').upsert(
    {
      id: user.id,
      email: user.email ?? '',
      name: user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'user',
    },
    { onConflict: 'id', ignoreDuplicates: true }
  )

  // Link any pending friend requests sent to this email before they signed up
  if (user.email) {
    const admin = createAdminClient()
    await admin
      .from('friend_requests')
      .update({ to_user_id: user.id })
      .eq('to_email', user.email)
      .is('to_user_id', null)
  }

  return <>{children}</>
}
