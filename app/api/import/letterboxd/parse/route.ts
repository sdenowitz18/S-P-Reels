import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import AdmZip from 'adm-zip'

export interface ParsedFilm {
  title: string
  year: number | null
  stars: number | null // null = watched but not rated
  date: string | null
}

function parseCSVRow(row: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current.trim())
  return cells
}

function parseRatingsCSV(csv: string): ParsedFilm[] {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean)
  // header: Date,Name,Year,Letterboxd URI,Rating
  return lines.slice(1).map(line => {
    const [date, name, year, , rating] = parseCSVRow(line)
    return {
      title: name ?? '',
      year: year ? parseInt(year) : null,
      stars: rating ? parseFloat(rating) : null,
      date: date ?? null,
    }
  }).filter(f => f.title)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  let ratingsCSV: string | null = null

  const filename = file.name.toLowerCase()

  if (filename.endsWith('.zip')) {
    try {
      const zip = new AdmZip(buffer)
      const entry = zip.getEntry('ratings.csv')
      if (!entry) return NextResponse.json({ error: 'ratings.csv not found in zip' }, { status: 400 })
      ratingsCSV = entry.getData().toString('utf8')
    } catch {
      return NextResponse.json({ error: 'failed to read zip' }, { status: 400 })
    }
  } else if (filename.endsWith('.csv')) {
    ratingsCSV = buffer.toString('utf8')
  } else {
    return NextResponse.json({ error: 'upload the Letterboxd zip or ratings.csv' }, { status: 400 })
  }

  const films = parseRatingsCSV(ratingsCSV)
  return NextResponse.json({ films, total: films.length })
}
