/**
 * Fetches the critical reception section from Wikipedia for a film.
 * Uses the MediaWiki API — no auth, no cost, public domain content.
 */

const WIKI_API = 'https://en.wikipedia.org/w/api.php'

// Try a few title variants to find the right Wikipedia page
function titleVariants(title: string, year?: number | null): string[] {
  const base = title.trim()
  const variants = [base]
  if (year) variants.push(`${base} (${year} film)`, `${base} (film)`)
  else variants.push(`${base} (film)`)
  return variants
}

async function fetchSections(pageTitle: string): Promise<{ index: string; line: string }[] | null> {
  const params = new URLSearchParams({
    action: 'parse',
    page: pageTitle,
    prop: 'sections',
    format: 'json',
    origin: '*',
    redirects: '1',
  })
  const res = await fetch(`${WIKI_API}?${params}`, {
    headers: { 'User-Agent': 'sp-reels/1.0 (film discussion app; contact@sp-reels.com)' },
  })
  if (!res.ok) return null
  const json = await res.json()
  if (json.error) return null
  return json.parse?.sections ?? null
}

async function fetchSectionContent(pageTitle: string, sectionIndex: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: 'parse',
    page: pageTitle,
    prop: 'wikitext',
    section: sectionIndex,
    format: 'json',
    origin: '*',
    redirects: '1',
  })
  const res = await fetch(`${WIKI_API}?${params}`, {
    headers: { 'User-Agent': 'sp-reels/1.0 (film discussion app; contact@sp-reels.com)' },
  })
  if (!res.ok) return null
  const json = await res.json()
  if (json.error) return null
  const wikitext: string = json.parse?.wikitext?.['*'] ?? ''
  return cleanWikitext(wikitext)
}

// Strip wikitext markup down to readable plain text
function cleanWikitext(text: string): string {
  return text
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1') // [[link|label]] → label
    .replace(/\{\{[^}]*\}\}/g, '')                      // remove templates {{...}}
    .replace(/'{2,3}/g, '')                             // remove '' and '''
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')           // remove <ref> citations
    .replace(/<[^>]+>/g, '')                            // strip remaining HTML tags
    .replace(/==+[^=]+==+/g, '')                        // remove section headers
    .replace(/\n{3,}/g, '\n\n')                         // collapse blank lines
    .trim()
}

// Sections that contain critical reception content
const RECEPTION_KEYWORDS = ['reception', 'critical', 'response', 'review', 'accolades', 'acclaim']

export async function fetchWikipediaReception(
  title: string,
  year?: number | null
): Promise<string | null> {
  const variants = titleVariants(title, year)

  for (const pageTitle of variants) {
    try {
      const sections = await fetchSections(pageTitle)
      if (!sections) continue

      // Find all reception-related sections
      const receptionSections = sections.filter(s =>
        RECEPTION_KEYWORDS.some(kw => s.line.toLowerCase().includes(kw))
      )
      if (receptionSections.length === 0) continue

      // Fetch content from up to 2 reception sections
      const chunks: string[] = []
      for (const section of receptionSections.slice(0, 2)) {
        const content = await fetchSectionContent(pageTitle, section.index)
        if (content && content.length > 100) chunks.push(content)
      }

      if (chunks.length > 0) {
        // Cap at ~2000 chars so we don't blow up the brief prompt
        const combined = chunks.join('\n\n').slice(0, 2000)
        return combined
      }
    } catch {
      // try next variant
    }
  }

  return null
}
