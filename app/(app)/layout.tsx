import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { DevResetButton } from '@/components/dev-reset-button'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  // Fire-and-forget: guarantee a public.users row exists and link pending friend requests.
  // These don't need to block the page render.
  supabase.from('users').upsert(
    {
      id: user.id,
      email: user.email ?? '',
      name: user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'user',
    },
    { onConflict: 'id', ignoreDuplicates: true }
  ).then(() => {
    if (user.email) {
      const admin = createAdminClient()
      admin.from('friend_requests')
        .update({ to_user_id: user.id })
        .eq('to_email', user.email)
        .is('to_user_id', null)
        .then(() => {})
    }
  })

  return (
    <>
      {children}
      {process.env.NODE_ENV !== 'production' && <DevResetButton />}
    </>
  )
}
