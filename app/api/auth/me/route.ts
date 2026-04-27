import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('users')
    .select('id, name, email, accent_color')
    .eq('id', user.id)
    .single()

  return NextResponse.json(data ?? { id: user.id, email: user.email, name: user.user_metadata?.name ?? '' })
}
