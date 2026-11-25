export function webLink(value: string | null | undefined) {
  if (!value || value.length > 2048) return ''
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}
export function linkInfo(value: string) {
  const url = new URL(value)
  const host = url.hostname.replace(/^(www\.|m\.)/,'')
  const youtube = host === 'youtu.be' || host === 'youtube.com'
  const video = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/)?.[1]
  return {
    category: host === 'open.spotify.com' ? 'Musique' : youtube ? 'Vidéo' : 'Cinéma',
    image: youtube && video && /^[\w-]{11}$/.test(video) ? 'https://i.ytimg.com/vi/'+video+'/hqdefault.jpg' : '',
  } as const
}
export type Recommendation = {
  id: string; user_id: string; content: string; category: string; rating: number | null
  source_title: string; source_url: string; thumbnail_url: string | null; image_url: string | null
}
