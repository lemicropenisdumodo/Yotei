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
const room = {
  id: '731b10ce-595f-45bb-a66f-ffad0a6cf059',
  title: '',
  participants: [id, peer.id],
}
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
    const rows = {
      profiles: [profile, peer],
      rooms: [room],
      messages: [],
      members: [
        { id, admin: true, suspended: false },
        { id: peer.id, admin: false, suspended: false },
      ],
      notifications: [],
      friend_nicknames: [],
      posts: [],
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
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  const messages = home.locator('[data-widget="Messages"]')
  await messages.getByLabel('Avancer Messages').click()
  await messages.getByLabel('Taille').selectOption('large')
  await messages.getByLabel('Couleur').selectOption('Sauge')
  await page.reload()
  await messages.waitFor()
  assert.equal(await home.locator('section').first().getAttribute('data-widget'), 'Messages')
  assert.equal(await messages.getAttribute('data-wide'), 'true')
  assert.equal(await messages.getAttribute('data-tone'), 'Sauge')
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
  await page.getByText('Aucune publication pour le moment.').waitFor()
  await page.goBack()
  await profileWidget.waitFor()
  assert.ok(Math.abs(await page.evaluate(() => window.scrollY) - offset) <= 2)
  await home.getByRole('button', { name: 'Fil', exact: true }).click()
  assert.equal(await page.getByRole('textbox').count(), 0)
  await close()
  await home.getByRole('button', { name: 'Publier', exact: true }).click()
  await page.getByRole('heading', { name: 'Nouvelle publication' }).waitFor()
  await page.getByLabel('Un mot pour le cercle').fill('Publication de test')
  await page
    .locator('form')
    .getByRole('button', { name: 'Publier', exact: true })
    .click()
  await page.getByRole('heading', { name: 'Fil d’actualité' }).waitFor()
  await close()
  await home.getByRole('button', { name: 'Amis', exact: true }).click()
  await page.getByRole('heading', { name: 'Amis', exact: true }).waitFor()
  await close()
  await home.getByRole('button', { name: 'Messages', exact: true }).click()
  await page
    .getByRole('region', { name: 'Écrire à un membre' })
    .getByRole('button', { name: 'Camille' })
    .click()
  await page.getByRole('textbox', { name: 'Votre message' }).waitFor()
  await page.getByRole('button', { name: 'Choisir un destinataire' }).click()
  await page.getByRole('heading', { name: 'Écrire à…' }).waitFor()
} finally {
  await browser.close()
}
