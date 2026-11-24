import { createClient } from 'npm:@supabase/supabase-js@2.99.2'

const site = 'https://lemicropenisdumodo.github.io/Yotei/'
const headers = {
  'Access-Control-Allow-Origin': new URL(site).origin,
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}
const json = (body: object, status = 200) =>
  Response.json(body, { status, headers })
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers })
  if (req.method !== 'POST') return json({ error: 'Méthode refusée' }, 405)
  try {
    const { email, bootstrap } = await req.json()
    if (
      typeof email !== 'string' ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    )
      return json({ error: 'Adresse invalide' }, 400)
    const url = Deno.env.get('SUPABASE_URL')!
    const server = createClient(
      url,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    if (bootstrap === true) {
      const { data, error } = await server.rpc('can_bootstrap', {
        target_email: email,
      })
      if (error || !data)
        return json({ error: 'Initialisation indisponible' }, 403)
      const invite = await server.auth.admin.inviteUserByEmail(email, {
        redirectTo: site,
      })
      if (invite.error)
        return json({ error: 'Envoi du courriel impossible' }, 502)
      return json({ sent: true })
    }
    const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '')
    if (!token) return json({ error: 'Connexion requise' }, 401)
    const {
      data: { user },
      error,
    } = await server.auth.getUser(token)
    if (error || !user) return json({ error: 'Session expirée' }, 401)
    const member = await server
      .from('members')
      .select('admin,suspended')
      .eq('id', user.id)
      .single()
    if (!member.data?.admin || member.data.suspended)
      return json({ error: 'Accès refusé' }, 403)
    const invite = await server.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: site },
    })
    if (invite.error)
      return json(
        { error: 'Invitation impossible. Vérifiez si ce membre existe déjà.' },
        400,
      )
    return json({
      link:
        site +
        '#invitation=' +
        encodeURIComponent(invite.data.properties.hashed_token),
    })
  } catch {
    return json({ error: 'Demande invalide' }, 400)
  }
})
