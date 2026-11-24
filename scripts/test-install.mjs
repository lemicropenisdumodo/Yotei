// Exercise Chrome's own installability checks against the built Pages subdirectory.
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import assert from 'node:assert/strict'
const server = await preview({
  configFile: false,
  base: '/Yotei/',
  preview: { host: '127.0.0.1', port: 4173 },
  logLevel: 'error',
})
const browser = await chromium.launch({ channel: 'chrome' })
try {
  const page = await browser.newPage()
  await page.goto('http://127.0.0.1:'+server.httpServer.address().port+'/Yotei/')
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active, null, {timeout:20000})
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
  await new Promise(resolve => server.httpServer.close(resolve))
}
