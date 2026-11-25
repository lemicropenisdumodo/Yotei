// Render the production build in Chrome with a test session. All requests stay in the fixture.
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { resolve } from 'node:path'

const id = 'e3b7bc25-8b22-4777-8b8d-9ae04cca82e0'
const profile = { id, username: 'Membre du cercle', theme_color: '#198563' }
const peer = {
  ...profile,
  id: '6792ee8d-67dc-43bf-997b-842d84bf8663',
  username: 'Camille',
}
let companion
let posted
const browser = await chromium.launch({ channel: 'chrome', executablePath:process.env.CHROME_PATH, headless: true })
try {
  let spotifyConnected=false, playing=true, sharing=true
  const spotifyClient="1".repeat(32)
  let maintenance = {enabled:true,owner:true}
  const page = await browser.newPage({ isMobile: true, hasTouch: true })
  await page.routeWebSocket('**/*', () => {})
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === 'yotei.test') {
      const path = url.pathname.replace(/^\/Yotei\//, '') || 'index.html'
      return route.fulfill({ path: resolve('dist', path) })
    }
    if (url.hostname==='accounts.spotify.com' && url.pathname==='/authorize'){
      assert.equal(url.searchParams.get('code_challenge_method'),'S256')
      assert.ok(url.searchParams.get('code_challenge')?.length===43)
      const redirect=new URL(url.searchParams.get('redirect_uri'))
      redirect.searchParams.set('code','fixture-code')
      redirect.searchParams.set('state',url.searchParams.get('state'))
      return route.fulfill({contentType:'text/html',body:'<script>location.replace('+JSON.stringify(redirect.href)+')</script>'})
    }
    if(url.pathname.endsWith('/functions/v1/spotify')){
      const body=route.request().postDataJSON()
      if(body.action==='connect'){
        assert.equal(body.code,'fixture-code')
        assert.ok(body.verifier.length>=43)
        spotifyConnected=true
        return route.fulfill({json:{ok:true}})
      }
      if(body.action==='pause')playing=false
      if(body.action==='play')playing=true
      if(body.action==='sharing')sharing=body.share
      return route.fulfill({json:{configured:true,clientId:spotifyConnected?undefined:spotifyClient,connected:spotifyConnected,playing,sharing,
        track:spotifyConnected?{title:'Titre de test',artist:'Artiste de test',image:'',url:'https://open.spotify.com/track/test'}:null}})
    }
    if (url.hostname === 'geocoding-api.open-meteo.com')
      return route.fulfill({
        json: {
          results: [
            {
              id: 2996944,
              name: 'Lyon',
              country: 'France',
              timezone: 'Europe/Paris',
              latitude: 45.75,
              longitude: 4.85,
            },
          ],
        },
      })
    if (url.hostname === 'api.met.no')
      return route.fulfill({
        json: {
          properties: {
            timeseries: Array.from({ length: 13 }, (_, i) => ({
              time: new Date(Date.now() + i * 3600000).toISOString(),
              data: {
                instant: { details: { air_temperature: 12 } },
                next_1_hours: { summary: { symbol_code: 'cloudy' } },
              },
            })),
          },
        },
      })
    if (url.pathname.endsWith('/rpc/maintenance_status')) return route.fulfill({json:maintenance})
    if (url.pathname.endsWith('/rpc/companion_care')) {
      const {action,detail} = route.request().postDataJSON()
      if (action === 'adopt') companion = {model:detail,nickname:'',version:1,food:2,mood:2,asleep:false,days:[],today:'2026-11-25',streak:0,best:0,affection:0}
      if (action === 'feed') {
        companion.food--; companion.version++
        if (!companion.food) Object.assign(companion,{days:[companion.today],streak:1,best:1,affection:1})
      }
      if (action === 'rename') {companion.nickname=detail; companion.version++}
      return route.fulfill({contentType:'application/json',body:JSON.stringify(companion || null)})
    }
    if (url.pathname.endsWith('/recommendation-preview')) return route.fulfill({json:{title:'Morceau du cercle'}})
    if (url.pathname.endsWith('/posts') && route.request().method() === 'POST') {
      posted = {...route.request().postDataJSON(),id:'rec-test',created_at:new Date().toISOString(),likes:[]}
      return route.fulfill({status:201,body:''})
    }
    const rows = {
      profiles: [profile, peer],

      messages: [],
      members: [
        { id, admin: true, suspended: false },
        { id: peer.id, admin: false, suspended: false },
      ],
      notifications: [],
      friend_nicknames: [],
      posts: posted ? [posted] : [],
    }
    return route.fulfill({ json: rows[url.pathname.split('/').pop()] ?? null })
  })
  await page.addInitScript(
    ({ id }) => {
      localStorage.setItem(
        'sb-liutzcmwbtkrfgzhyycp-auth-token',
        JSON.stringify({
          access_token: 'fixture',
          refresh_token: 'fixture',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.ceil(Date.now() / 1000) + 3600,
          user: {
            id,
            aud: 'authenticated',
            role: 'authenticated',
            app_metadata: {},
            user_metadata: {},
          },
        }),
      )
    },
    { id },
  )
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [390, 844],
    [430, 932],
  ]) {
    await page.setViewportSize({ width, height })
    await page.goto('https://yotei.test/Yotei/')
    await page.getByRole('heading', { name: 'Salut, Membre du cercle !' }).waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.equal(await page.locator('.rail').count(), 0)
  }
  const home = page.locator('.widgetBoard')
  await home.getByRole('button',{name:'Ouvrir Spotify'}).click()
  await page.getByRole('button',{name:'Connecter mon compte Spotify'}).click()
  await page.getByRole('button',{name:'Déconnecter Spotify'}).waitFor()
  await page.getByRole('button',{name:'Fermer et revenir à l’accueil'}).click()
  await home.getByRole('button',{name:'Pause',exact:true}).click()
  await home.getByRole('button',{name:'Reprendre'}).click()
  await home.getByRole('button',{name:'Pause',exact:true}).waitFor()
  await home.getByRole('button',{name:'Mon personnage',exact:true}).click()
  const companionDialog = page.getByRole('dialog')
  await companionDialog.getByRole('button',{name:'Nonna',exact:true}).click()
  await companionDialog.getByRole('button',{name:'Donner une bouchée'}).click()
  await companionDialog.getByRole('button',{name:'Donner une bouchée'}).click()
  await companionDialog.getByRole('button',{name:'Rassasiée'}).waitFor()
  await companionDialog.getByRole('button',{name:'Fermer le personnage'}).click()
  assert.match(await home.locator('[data-widget="Jours ensemble"]').innerText(),/1 jour/)
  const close = () => page.getByRole('button', { name: 'Fermer et revenir à l’accueil' }).click()
  const widgets=home.locator('section')
  const rects=()=>widgets.evaluateAll(els=>Object.fromEntries(els.map(e=>[e.dataset.widget,[e.offsetWidth,e.offsetHeight]])))
  const normal=await rects()
  const order=()=>widgets.evaluateAll(els=>els.map(el=>el.dataset.widget))
  const initialOrder=await order()
  await page.getByRole('button',{name:'Paramètres',exact:true}).click()
  await page.getByRole('button',{name:'Personnalisation'}).click()
  await page.getByLabel('Thème de l’interface').selectOption('Boréal')
  await page.getByRole('button',{name:'Déplacer les widgets'}).click()
  await home.getByLabel('Sélectionner Courbe',{exact:true}).click()
  await page.getByLabel('Avancer Courbe').click()
  assert.notDeepEqual(await order(),initialOrder)
  assert.equal(await page.getByRole('button',{name:'Annuler la dernière action'}).count(),0)
  const reset=page.getByRole('button',{name:'Réinitialiser l’emplacement des widgets'})
  await reset.click()
  assert.deepEqual(await order(),initialOrder)
  assert.ok(await reset.isDisabled())
  assert.deepEqual(await rects(),normal)
  await page.getByRole('button',{name:'Terminer'}).click()
  await page.reload()
  await widgets.first().waitFor()
  assert.deepEqual(await order(),initialOrder)
  assert.equal(await page.locator('.widgetShell').getAttribute('data-theme'),'Boréal')
  await page.getByRole('button', { name: 'Configurer la météo' }).click()
  const weather = page.getByRole('dialog')
  await weather.getByLabel('Ville', { exact: true }).fill('Lyon')
  await weather.getByRole('button', { name: 'Rechercher' }).click()
  await weather.getByRole('button', { name: 'Lyon, France' }).click()
  await weather.getByRole('heading', { name: 'Prochaines heures' }).waitFor()
  await weather.getByRole('button', { name: 'Fermer la météo' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Météo à Lyon' }).waitFor()
  await page.setViewportSize({width:360,height:640})
  await page.getByRole('button',{name:'Ouvrir mon profil'}).click()
  await page.getByRole('button',{name:'Déconnexion'}).waitFor()
  await page.getByRole('heading',{name:'Écoute en ce moment'}).waitFor()
  await close()
  const rec=home.getByRole('button',{name:'Recommandations'})
  await rec.scrollIntoViewIfNeeded()
  const offset=await page.evaluate(()=>window.scrollY)
  await rec.click()
  await close()
  await rec.waitFor()
  assert.ok(Math.abs(await page.evaluate(()=>window.scrollY)-offset)<=2)
  await rec.click()
  await page.getByRole('button',{name:'Nouvelle recommandation'}).click()
  await page.getByRole('heading', { name: 'Nouvelle recommandation' }).waitFor()
  await page.getByLabel('Lien à recommander').fill('https://open.spotify.com/track/example')
  await page.waitForFunction(() => document.querySelector('input[maxlength="300"]')?.value === 'Morceau du cercle')
  await page.getByLabel('4 sur 5').click()
  await page.getByLabel('Un mot pour le cercle').fill('Publication de test')
  await page
    .locator('form')
    .getByRole('button', { name: 'Publier', exact: true })
    .click()
  await page.getByRole('heading', { name: 'Recommandations' }).waitFor()
  await close()
  await home.getByRole('button', { name: 'Amis', exact: true }).click()
  await page.getByRole('heading', { name: 'Amis', exact: true }).waitFor()
  await close()
  assert.equal(posted.category,'Musique')
  assert.equal(posted.rating,4)
  await rec.click()
  await page.getByRole('heading',{name:'Morceau du cercle'}).waitFor()
  assert.equal(await page.getByRole('link',{name:/Écouter/}).getAttribute('href'), posted.source_url)
  assert.equal(await page.getByRole('button',{name:'Messages',exact:true}).count(),0)
  maintenance = {enabled:true,owner:false}
  await page.reload()
  await page.getByRole('heading',{name:'Maintenance en cours'}).waitFor()
  assert.equal(await page.locator('.widgetBoard').count(),0)
} finally {
  await browser.close()
}
