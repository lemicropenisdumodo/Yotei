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
let posted
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ isMobile: true, hasTouch: true })
  await page.routeWebSocket('**/*', () => {})
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === 'yotei.test') {
      const path = url.pathname.replace(/^\/Yotei\//, '') || 'index.html'
      return route.fulfill({ path: resolve('dist', path) })
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
  const close = () => page.getByRole('button', { name: 'Fermer et revenir à l’accueil' }).click()
  const messages = home.locator('[data-widget="À découvrir"]')
  const size = () => messages.evaluate(el => [el.offsetWidth, el.offsetHeight])
  const normalSize = await size()
  assert.equal(await page.getByRole('button', {name:'Déconnexion'}).count(), 0)
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await messages.getByLabel('Personnaliser À découvrir').click()
  assert.deepEqual(await size(), normalSize)
  const panel = page.getByRole('complementary', {name:'Réglages de À découvrir'})
  await panel.getByLabel('Avancer À découvrir').click()
  await panel.getByLabel('Taille').selectOption('large')
  await panel.getByLabel('Sauge', {exact:true}).click()
  await panel.getByLabel('Spectre des couleurs').fill('#efffee')
  await panel.getByLabel('Image du raccourci').setInputFiles('public/icons/yotei-192.png')
  await messages.locator('.widgetPhoto').waitFor()
  const editedSize = await size()
  await panel.getByLabel('Fermer les réglages').click()
  await page.getByRole('button', {name:'Terminer'}).click()
  assert.deepEqual(await size(), editedSize)
  await page.reload()
  await messages.waitFor()
  assert.equal(await home.locator('section').first().getAttribute('data-widget'), 'À découvrir')
  assert.equal(await messages.getAttribute('data-wide'), 'true')
  assert.equal(await messages.getAttribute('data-tone'), '#efffee')
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
  const profileWidget = home.getByRole('button', {name:'Profil', exact:true})
  await profileWidget.scrollIntoViewIfNeeded()
  const offset = await page.evaluate(() => window.scrollY)
  assert.ok(offset > 0)
  await profileWidget.click()
  await page.getByRole('button', {name:'Déconnexion'}).waitFor()
  await page.getByText('Aucune publication pour le moment.').waitFor()
  await page.goBack()
  await profileWidget.waitFor()
  assert.ok(Math.abs(await page.evaluate(() => window.scrollY) - offset) <= 2)
  await home.getByRole('button', { name: 'Fil', exact: true }).click()
  assert.equal(await page.getByRole('textbox').count(), 0)
  await close()
  await home.getByRole('button', { name: 'Publier', exact: true }).click()
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
  await home.getByRole('button', {name:/recommande.*Morceau du cercle/}).click()
  await page.getByRole('heading',{name:'La recommandation'}).waitFor()
  assert.equal(await page.getByRole('link',{name:/Écouter/}).getAttribute('href'), posted.source_url)
  assert.equal(await page.getByRole('button',{name:'Messages',exact:true}).count(),0)
} finally {
  await browser.close()
}
