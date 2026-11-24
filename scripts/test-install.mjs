// Exercise Chrome's own installability checks against the built Pages subdirectory.
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({
  root: 'dist',
  configFile: false,
  base: '/Yotei/',
  server: { host: '127.0.0.1', port: 0 },
  logLevel: 'error',
})
await server.listen()
const browser = await chromium.launch({ channel: 'chrome' })
try {
  const page = await browser.newPage()
  await page.goto(server.resolvedUrls.local[0])
  await page.evaluate(() => navigator.serviceWorker.ready)
  const session = await page.context().newCDPSession(page)
  const { errors, data } = await session.send('Page.getAppManifest')
  assert.deepEqual(errors, [])
  assert.equal(JSON.parse(data).display, 'standalone')
  const { installabilityErrors } = await session.send(
    'Page.getInstallabilityErrors',
  )
  assert.deepEqual(installabilityErrors, [])
} finally {
  await browser.close()
  await server.close()
}
