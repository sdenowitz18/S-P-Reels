import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WelcomeClient from './onboarding-client'

/**
 * Server component — runs the state check and routes accordingly:
 *
 *   in-progress session       → resume interview
 *   has library entries       → returning user, go home
 *   no entries, no sessions   → first-time user, show onboarding choice
 */
export default async function WelcomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  // Resume any in-progress session — cold_start goes to setup, letterboxd to interview
  const { data: session } = await supabase
    .from('taste_interview_sessions')
    .select('id, path, contradictions')
    .eq('user_id', user.id)
    .eq('status', 'in_progress')
    .limit(1)
    .maybeSingle()

  if (session) {
    // cold_start with no contradictions yet → calibration rating page
    // cold_start with contradictions computed → interview (rating is done)
    // letterboxd path → interview
    const needsRating = session.path === 'cold_start' &&
      (!session.contradictions || (session.contradictions as unknown[]).length === 0)
    const dest = needsRating
      ? `/onboarding/rate/${session.id}`
      : `/onboarding/interview/${session.id}`
    redirect(dest)
  }

  // Returning user — has library entries already
  const { count } = await supabase
    .from('library_entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (count && count > 0) redirect('/home')

  // First-time user — show the onboarding choice
  const name = (user.user_metadata?.name as string | undefined)
    ?? user.email?.split('@')[0]
    ?? 'there'

  return <WelcomeClient name={name} />
}
