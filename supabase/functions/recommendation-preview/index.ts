import { createClient } from 'npm:@supabase/supabase-js@2.99.2'

const headers = {
  'Access-Control-Allow-Origin': 'https://lemicropenisdumodo.github.io',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Cache-Control': 'no-store',
}
function json(body: unknown, status = 200) {
  return Response.json(body, { headers, status })
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers })
  if (req.method !== 'POST') return json({}, 405)
  const token = req.headers.get('Authorization')
  if (!token) return json({}, 401)
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: token } },
  })
  const { data } = await client.auth.getUser(token.replace(/^Bearer /i,''))
  if (!data.user) return json({}, 401)
  const member = await client.from('members').select('id').eq('id',data.user.id).eq('suspended',false).maybeSingle()
  if (!member.data) return json({}, 403)
  try {
    const url = new URL((await req.json()).url)
    if (url.protocol !== 'https:' || url.href.length > 2048) return json({},400)
    const host = url.hostname.replace(/^www\./,'')
    let endpoint: URL
    if (['youtube.com','m.youtube.com','youtu.be','open.spotify.com'].includes(host)) {
      endpoint = new URL(host === 'open.spotify.com' ? 'https://open.spotify.com/oembed' : 'https://www.youtube.com/oembed')
      endpoint.searchParams.set('url',url.href)
      endpoint.searchParams.set('format','json')
    } else if (['fr.wikipedia.org','en.wikipedia.org'].includes(host) && url.pathname.startsWith('/wiki/')) {
      endpoint = new URL('https://'+host+'/api/rest_v1/page/summary/'+encodeURIComponent(decodeURIComponent(url.pathname.slice(6))))
    } else if (['themoviedb.org','imdb.com','allocine.fr'].includes(host)) {
      const path = url.pathname.match(host === 'imdb.com' ? /^\/title\/tt\d+\// : host === 'themoviedb.org' ? /^\/movie\/\d+[\w-]*/ : /^\/film\/fichefilm_gen_cfilm=\d+\.html/)
      if (!path) return json({})
      endpoint = new URL('https://www.'+host+path[0])
    } else return json({})
    const response = await fetch(endpoint,{redirect:'error',signal:AbortSignal.timeout(4500)})
    if (!response.ok) return json({})
    if (response.headers.get('content-type')?.includes('json')) {
      const meta = await response.json()
      return json({title:meta.title, image:meta.thumbnail_url || meta.thumbnail?.source})
    }
    const html = (await response.text()).slice(0,600000)
    function meta(name: string) {
      const tag = html.match(new RegExp('<meta\\b(?=[^>]*property=["\']og:'+name+'["\'])[^>]*>', 'i'))?.[0]
      return tag?.match(/content=["']([^"']*)["']/i)?.[1]?.replaceAll('&amp;','&').replaceAll('&#39;',"'").replaceAll('&quot;','"')
    }
    return json({ title: meta('title'), image: meta('image') })
  } catch { return json({}) }
})
