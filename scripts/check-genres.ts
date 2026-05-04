import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data } = await sb.from('films').select('tmdb_genres').not('tmdb_genres', 'is', null).limit(2000)
  const all = new Set<string>()
  for (const f of (data ?? [])) {
    for (const g of (f.tmdb_genres as string[] || [])) all.add(g)
  }
  console.log([...all].sort().join('\n'))
}
main().catch(console.error)
