/**
 * Fetches top Reddit discussion threads for a film.
 * Uses Reddit's public JSON endpoint — no auth required for read-only search.
 * Targets r/TrueFilm and r/movies for quality discourse.
 */

const HEADERS = {
  'User-Agent': 'sp-reels/1.0 (film discussion app; contact@sp-reels.com)',
}

interface RedditPost {
  title: string
  selftext: string
  score: number
  num_comments: number
  permalink: string
  url: string
}

interface RedditComment {
  body: string
  score: number
}

async function searchSubreddit(
  subreddit: string,
  query: string
): Promise<RedditPost[]> {
  const params = new URLSearchParams({
    q: query,
    sort: 'top',
    t: 'all',
    limit: '5',
    restrict_sr: 'true',
  })
  const url = `https://www.reddit.com/r/${subreddit}/search.json?${params}`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) return []
  const json = await res.json()
  return (json.data?.children ?? []).map((c: { data: RedditPost }) => c.data)
}

async function fetchTopComments(permalink: string): Promise<RedditComment[]> {
  const url = `https://www.reddit.com${permalink}.json?sort=top&limit=10&depth=1`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) return []
  const json = await res.json()
  // Comments are in the second element of the response array
  const commentData = json[1]?.data?.children ?? []
  return commentData
    .filter((c: { kind: string; data: RedditComment }) => c.kind === 't1' && c.data.body && c.data.body !== '[deleted]')
    .map((c: { data: RedditComment }) => ({ body: c.data.body, score: c.data.score }))
    .sort((a: RedditComment, b: RedditComment) => b.score - a.score)
    .slice(0, 6)
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

export async function fetchRedditDiscourse(
  title: string,
  year?: number | null
): Promise<string | null> {
  const query = year ? `${title} ${year}` : title

  // Search both subs in parallel
  const [truefilm, movies] = await Promise.allSettled([
    searchSubreddit('TrueFilm', query),
    searchSubreddit('movies', query),
  ])

  const allPosts: RedditPost[] = [
    ...(truefilm.status === 'fulfilled' ? truefilm.value : []),
    ...(movies.status === 'fulfilled' ? movies.value : []),
  ]

  if (allPosts.length === 0) return null

  // Pick the most engaged post (by score × comment count) that's actually about this film
  const titleLower = title.toLowerCase()
  const relevant = allPosts
    .filter(p => p.title.toLowerCase().includes(titleLower.split(':')[0].toLowerCase()))
    .sort((a, b) => (b.score + b.num_comments * 2) - (a.score + a.num_comments * 2))

  const best = relevant[0] ?? allPosts[0]

  // Build output: post title + selftext (if any) + top comments
  const parts: string[] = []

  parts.push(`thread: "${best.title}"`)

  if (best.selftext && best.selftext.length > 50) {
    parts.push(`post: ${truncate(best.selftext, 600)}`)
  }

  // Fetch top comments from the best thread
  try {
    const comments = await fetchTopComments(best.permalink)
    if (comments.length > 0) {
      const commentText = comments
        .map(c => `- ${truncate(c.body, 300)}`)
        .join('\n')
      parts.push(`top comments:\n${commentText}`)
    }
  } catch {
    // skip comments if fetch fails
  }

  // Also grab the title from the second-best post if available
  if (relevant[1]) {
    parts.push(`also discussed: "${relevant[1].title}"`)
  }

  const result = parts.join('\n\n').slice(0, 2500)
  return result.length > 100 ? result : null
}
