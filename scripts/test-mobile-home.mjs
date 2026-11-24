// Render the production build in Chrome with a test session. All requests stay in the fixture.
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { resolve } from 'node:path'

const id = 'e3b7bc25-8b22-4777-8b8d-9ae04cca82e0'
const profile = { id, username: 'Membre du cercle', theme_color: '#198563' }
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
    const rows = {
      profiles: [profile],
      members: [{ id, admin: true, suspended: false }],
      notifications: [],
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
    await page.getByRole('heading', { name: 'Accueil', exact: true }).waitFor()
    await page.evaluate(() => document.fonts.ready)
    const layout = await page.evaluate(() => {
      const rail = document.querySelector('.rail').getBoundingClientRect()
      const content = document.querySelector('.content').getBoundingClientRect()
      return {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        railRight: rail.left >= content.right,
      }
    })
    assert.ok(
      layout.railRight && layout.width <= width && layout.height <= height,
      JSON.stringify({ width, height, layout }),
    )
    console.log('Accueil entièrement visible à ' + width + ' × ' + height)
  }
} finally {
  await browser.close()
}
