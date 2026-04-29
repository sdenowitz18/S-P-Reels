'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { LibraryEntry, ReflectionResult, posterUrl } from '@/lib/types'

interface FriendEntry {
  user_id: string
  list: string
  my_stars: number | null
  my_line: string | null
  user: { id: string; name: string }
}

interface Friend { id: string; name: string; email: string }

type PanelList = 'watched' | 'now_playing' | 'watchlist'

interface Props {
  entry: LibraryEntry
  list: PanelList
  reflection?: ReflectionResult | null
  onClose: () => void
  onRemove?: () => void
  onMove?: (toList: PanelList) => void
  onUpdate?: (updated: LibraryEntry) => void
}

// ── Static star display ────────────────────────────────────────────────────────
function StarDisplay({ stars }: { stars: number | null }) {
  if (!stars) return null
  const full = Math.floor(stars)
  const half = stars % 1 >= 0.5
  const empty = 5 - full - (half ? 1 : 0)
  return (
    <span style={{ letterSpacing: '0.05em', fontSize: 15 }}>
      <span style={{ color: 'var(--s-ink)' }}>{'★'.repeat(full)}{half ? '½' : ''}</span>
      <span style={{ color: 'var(--ink-4)' }}>{'★'.repeat(empty)}</span>
    </span>
  )
}

// ── Inline half-star rating input ──────────────────────────────────────────────
function StarRatingInput({
  value,
  onChange,
}: {
  value: number | null
  onChange: (stars: number) => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value ?? 0

  return (
    <div
      style={{ display: 'flex', gap: 2, alignItems: 'center' }}
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map(n => {
        const full = display >= n
        const half = !full && display >= n - 0.5

        return (
          <div
            key={n}
            style={{ position: 'relative', width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseMove={e => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
              const isLeft = e.clientX - rect.left < rect.width / 2
              setHover(isLeft ? n - 0.5 : n)
            }}
            onClick={e => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
              const isLeft = e.clientX - rect.left < rect.width / 2
              onChange(isLeft ? n - 0.5 : n)
            }}
          >
            <span style={{
              fontSize: 22,
              color: full ? 'var(--s-ink)' : half ? 'var(--s-ink)' : 'var(--ink-4)',
              lineHeight: 1,
              userSelect: 'none',
              transition: 'color 80ms',
            }}>
              {half ? '½' : '★'}
            </span>
          </div>
        )
      })}
      {display > 0 && (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginLeft: 6, letterSpacing: '0.05em' }}>
          {display}
        </span>
      )}
    </div>
  )
}

const LIST_LABEL: Record<string, string> = {
  watched: 'watched',
  now_playing: 'watching',
  watchlist: 'wants to watch',
}

export function FilmDetailPanel({ entry, list, reflection, onClose, onRemove, onMove, onUpdate }: Props) {
  const film = entry.film
  const poster = film ? posterUrl(film.poster_path, 'w342') : null

  const [friendEntries, setFriendEntries] = useState<FriendEntry[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [showRecommend, setShowRecommend] = useState(false)
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [moving, setMoving] = useState(false)

  // rating state
  const [draftStars, setDraftStars] = useState<number | null>(entry.my_stars ?? null)
  const [isEditingRating, setIsEditingRating] = useState(!entry.my_stars)
  const [savingRating, setSavingRating] = useState(false)
  const [ratingSaved, setRatingSaved] = useState(false)

  useEffect(() => {
    if (!film?.id) return
    fetch(`/api/films/${film.id}/friends`)
      .then(r => r.json())
      .then(d => setFriendEntries(d.friends ?? []))
      .catch(() => {})
    fetch('/api/friends')
      .then(r => r.json())
      .then(d => setFriends(d.friends ?? []))
      .catch(() => {})
  }, [film?.id])

  const toggleFriend = (id: string) => {
    setSelectedFriends(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const sendRec = async () => {
    if (!selectedFriends.size || sending || !film) return
    setSending(true)
    await Promise.all(
      Array.from(selectedFriends).map(toUserId =>
        fetch('/api/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toUserId, filmId: film.id, note: note.trim() || null }),
        })
      )
    )
    setSent(true)
    setSending(false)
    setTimeout(() => { setSent(false); setShowRecommend(false); setSelectedFriends(new Set()); setNote('') }, 2000)
  }

  const handleRemove = async () => {
    setRemoving(true)
    await fetch(`/api/library/${entry.id}`, { method: 'DELETE' })
    onRemove?.()
    onClose()
  }

  const handleMove = async (toList: PanelList) => {
    setMoving(true)
    await fetch(`/api/library/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list: toList, ...(toList === 'now_playing' ? { started_at: new Date().toISOString() } : {}) }),
    })
    onMove?.(toList)
    onClose()
  }

  const saveRating = async () => {
    if (!draftStars || savingRating) return
    setSavingRating(true)
    const res = await fetch(`/api/library/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ my_stars: draftStars }),
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdate?.({ ...entry, my_stars: draftStars, ...updated })
      setIsEditingRating(false)
      setRatingSaved(true)
      setTimeout(() => setRatingSaved(false), 1800)
    }
    setSavingRating(false)
  }

  // show rating section for both watched and watchlist (user may have seen it)
  const showRating = list === 'watched' || list === 'watchlist'

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(24,22,18,0.65)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 480, minHeight: '100vh', maxHeight: '100vh', overflowY: 'auto', background: 'var(--paper)', borderLeft: '0.5px solid var(--paper-edge)', padding: '32px 36px 80px', display: 'flex', flexDirection: 'column', gap: 0 }}
      >
        {/* Close */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>close ×</button>
        </div>

        {/* Poster + title */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 22 }}>
          {poster && (
            <div style={{ width: 88, height: 132, borderRadius: 5, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
              <Image src={poster} alt={film?.title ?? ''} fill style={{ objectFit: 'cover' }} />
            </div>
          )}
          <div style={{ flex: 1, paddingTop: 4 }}>
            <div style={{ fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 500, lineHeight: 1.15 }}>{film?.title}</div>
            <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', marginTop: 5, fontFamily: 'var(--serif-italic)', lineHeight: 1.5 }}>
              {[film?.director, film?.year, film?.runtime_minutes ? `${film.runtime_minutes} min` : null].filter(Boolean).join(' · ')}
            </div>
            {/* Rating display / edit toggle */}
            {showRating && !isEditingRating && entry.my_stars && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <StarDisplay stars={draftStars ?? entry.my_stars} />
                <button
                  onClick={() => setIsEditingRating(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)', padding: 0 }}
                >
                  edit
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Inline rating section */}
        {showRating && (isEditingRating || !entry.my_stars) && (
          <div style={{ marginBottom: 22, padding: '16px 18px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 12 }}>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 12 }}>
              {entry.my_stars ? 'EDIT YOUR RATING' : 'RATE THIS FILM'}
            </div>
            <StarRatingInput value={draftStars} onChange={setDraftStars} />
            <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={saveRating}
                disabled={!draftStars || savingRating}
                className="btn"
                style={{ padding: '8px 18px', fontSize: 12, borderRadius: 999, opacity: !draftStars || savingRating ? 0.4 : 1 }}
              >
                {savingRating ? 'saving…' : 'save rating →'}
              </button>
              {entry.my_stars && (
                <button
                  onClick={() => { setIsEditingRating(false); setDraftStars(entry.my_stars ?? null) }}
                  className="btn btn-soft"
                  style={{ padding: '8px 14px', fontSize: 12, borderRadius: 999 }}
                >
                  cancel
                </button>
              )}
              {ratingSaved && (
                <span style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>✓ saved</span>
              )}
            </div>
          </div>
        )}

        {/* My line */}
        {entry.my_line && (
          <div style={{ padding: '12px 16px', background: 'var(--bone)', borderRadius: 10, border: '0.5px solid var(--paper-edge)', marginBottom: 20 }}>
            <p style={{ margin: 0, fontStyle: 'italic', fontSize: 13, lineHeight: 1.6, fontFamily: 'var(--serif-italic)', color: 'var(--ink-2)' }}>"{entry.my_line}"</p>
          </div>
        )}

        {/* Actions */}
        <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Recommend */}
          {!showRecommend && !sent && (
            <button
              onClick={() => setShowRecommend(true)}
              className="btn"
              style={{ padding: '9px 16px', fontSize: 13, borderRadius: 999, textAlign: 'left' }}
            >
              recommend to a friend →
            </button>
          )}

          {sent && (
            <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
              ✓ recommendation sent
            </div>
          )}

          {showRecommend && !sent && (
            <div style={{ padding: '16px 18px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 12 }}>
              <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 12 }}>★ RECOMMEND TO</div>
              {friends.length === 0 ? (
                <p style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>no friends yet</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {friends.map(f => {
                    const on = selectedFriends.has(f.id)
                    return (
                      <button key={f.id} onClick={() => toggleFriend(f.id)} style={{
                        padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
                        fontFamily: 'var(--serif-body)', fontSize: 13,
                        border: `1.5px solid ${on ? 'var(--ink)' : 'var(--paper-edge)'}`,
                        background: on ? 'var(--ink)' : 'var(--paper)',
                        color: on ? 'var(--paper)' : 'var(--ink)',
                        transition: 'all 150ms',
                      }}>{f.name}</button>
                    )
                  })}
                </div>
              )}
              {selectedFriends.size > 0 && (
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="add a note… (optional)"
                  rows={2}
                  style={{ width: '100%', padding: '10px 12px', marginBottom: 12, background: 'var(--paper)', border: '0.5px solid var(--paper-edge)', borderRadius: 8, fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink)', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                />
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                {selectedFriends.size > 0 && (
                  <button onClick={sendRec} disabled={sending} className="btn" style={{ padding: '8px 16px', fontSize: 12, borderRadius: 999, opacity: sending ? 0.5 : 1 }}>
                    {sending ? 'sending…' : `send →`}
                  </button>
                )}
                <button onClick={() => { setShowRecommend(false); setSelectedFriends(new Set()); setNote('') }} className="btn btn-soft" style={{ padding: '8px 14px', fontSize: 12, borderRadius: 999 }}>cancel</button>
              </div>
            </div>
          )}

          {/* List-specific actions */}
          {list === 'now_playing' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => handleMove('watchlist')} disabled={moving} className="btn btn-soft" style={{ padding: '8px 14px', fontSize: 12, borderRadius: 999 }}>
                move to watchlist
              </button>
              {!confirmRemove
                ? <button onClick={() => setConfirmRemove(true)} className="btn btn-soft" style={{ padding: '8px 14px', fontSize: 12, borderRadius: 999, color: 'var(--ink-3)' }}>remove ×</button>
                : <>
                    <button onClick={handleRemove} disabled={removing} className="btn btn-soft" style={{ padding: '8px 14px', fontSize: 12, borderRadius: 999, color: '#c0392b', borderColor: '#c0392b', opacity: removing ? 0.5 : 1 }}>yes, remove</button>
                    <button onClick={() => setConfirmRemove(false)} className="btn btn-soft" style={{ padding: '8px 14px', fontSize: 12, borderRadius: 999 }}>cancel</button>
                  </>
              }
            </div>
          )}

          {list === 'watchlist' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => handleMove('now_playing')} disabled={moving} className="btn btn-soft" style={{ padding: '8px 14px', fontSize: 12, borderRadius: 999 }}>
                put it on →
              </button>
              {!confirmRemove
                ? <button onClick={() => setConfirmRemove(true)} className="btn btn-soft" style={{ padding: '8px 14px', fontSize: 12, borderRadius: 999, color: 'var(--ink-3)' }}>remove ×</button>
                : <>
                    <button onClick={handleRemove} disabled={removing} className="btn btn-soft" style={{ padding: '8px 14px', fontSize: 12, borderRadius: 999, color: '#c0392b', borderColor: '#c0392b', opacity: removing ? 0.5 : 1 }}>yes, remove</button>
                    <button onClick={() => setConfirmRemove(false)} className="btn btn-soft" style={{ padding: '8px 14px', fontSize: 12, borderRadius: 999 }}>cancel</button>
                  </>
              }
            </div>
          )}

          {list === 'watched' && onRemove && (
            !confirmRemove
              ? <button onClick={() => setConfirmRemove(true)} className="btn btn-soft" style={{ padding: '8px 14px', fontSize: 12, borderRadius: 999, color: 'var(--ink-3)', alignSelf: 'flex-start' }}>remove from watched ×</button>
              : <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleRemove} disabled={removing} className="btn btn-soft" style={{ padding: '8px 14px', fontSize: 12, borderRadius: 999, color: '#c0392b', borderColor: '#c0392b', opacity: removing ? 0.5 : 1 }}>yes, remove</button>
                  <button onClick={() => setConfirmRemove(false)} className="btn btn-soft" style={{ padding: '8px 14px', fontSize: 12, borderRadius: 999 }}>cancel</button>
                </div>
          )}
        </div>

        {/* Friends who have this film */}
        {friendEntries.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 12 }}>★ YOUR FRIENDS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {friendEntries.map((fe, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--p-tint)', border: '0.5px solid var(--p-ink)40', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif-display)', fontSize: 12, fontWeight: 600, color: 'var(--p-ink)', flexShrink: 0 }}>
                    {fe.user?.name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: 'var(--serif-body)', fontSize: 13, fontWeight: 500 }}>{fe.user?.name}</span>
                    <span style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', marginLeft: 6 }}>{LIST_LABEL[fe.list] ?? fe.list}</span>
                  </div>
                  {fe.my_stars != null && (
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--s-ink)', letterSpacing: '0.04em', flexShrink: 0 }}>
                      {fe.my_stars.toFixed(1)}★
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mood tags */}
        {entry.moods && entry.moods.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 10 }}>WHAT IT WAS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {entry.moods.map(m => (
                <span key={m} style={{ padding: '5px 10px', borderRadius: 999, background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{m}</span>
              ))}
            </div>
          </div>
        )}

        {/* Synopsis */}
        {film?.synopsis && (
          <div style={{ marginBottom: 20 }}>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 10 }}>SYNOPSIS</div>
            <p style={{ margin: 0, fontStyle: 'italic', fontSize: 13, lineHeight: 1.65, fontFamily: 'var(--serif-italic)', color: 'var(--ink-2)' }}>{film.synopsis}</p>
          </div>
        )}

        {/* Reflection */}
        {reflection?.taste_note && (
          <div style={{ marginBottom: 20 }}>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 12 }}>★ WHAT THIS SAYS ABOUT YOUR TASTE</div>
            <p style={{ margin: 0, fontFamily: 'var(--serif-display)', fontSize: 17, lineHeight: 1.45, fontWeight: 400 }}>{reflection.taste_note}</p>
          </div>
        )}

        {reflection?.taste_tags && reflection.taste_tags.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 10 }}>TASTE TAGS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {reflection.taste_tags.map(t => (
                <span key={t} style={{ padding: '5px 11px', borderRadius: 999, background: 'var(--s-tint)', border: '0.5px solid var(--s-ink)40', fontFamily: 'var(--serif-body)', fontSize: 12, color: 'var(--s-ink)' }}>
                  {t.replace(/-/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {reflection?.shifts && (
          <div style={{ marginBottom: 20 }}>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 10 }}>HOW IT FITS</div>
            <p style={{ margin: 0, fontStyle: 'italic', fontSize: 13, lineHeight: 1.6, fontFamily: 'var(--serif-italic)', color: 'var(--ink-2)' }}>{reflection.shifts}</p>
          </div>
        )}

        {/* Cast */}
        {film?.cast_json && film.cast_json.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 10 }}>CAST</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
              {film.cast_json.slice(0, 6).map((c, i) => (
                <span key={i} style={{ fontFamily: 'var(--serif-body)', fontSize: 12, color: 'var(--ink-2)' }}>
                  {c.name} <span style={{ fontStyle: 'italic', color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>as {c.character}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
