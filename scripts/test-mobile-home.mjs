// Render the production build in Chrome with a test session. All requests stay in the fixture.
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { resolve } from 'node:path'

const id = 'e3b7bc25-8b22-4777-8b8d-9ae04cca82e0'
const profile = { id, username: 'Membre du cercle', theme_color: '#198563', avatar_url:id+'/portrait.svg' }
const peer = {
  ...profile,
  id: '6792ee8d-67dc-43bf-997b-842d84bf8663',
  username: 'Camille',
}
let balance=555,gameVersion=0,latestVideo=null
const gallery={owned:[],prices:{stars:350,clouds:600,waves:1000,mesh:1500,blossoms:2200},character:'plain',clicker:'plain'}
const streams=new Map()
let companion
let posted
const browser = await chromium.launch({ channel: 'chrome', executablePath:process.env.CHROME_PATH, headless: true })
try {
  let seekPosition
  let spotifyConnected=false, playing=true, sharing=true
  const spotifyClient="1".repeat(32)
  let maintenance = {enabled:true,owner:true}
  const page = await browser.newPage({ isMobile: true, hasTouch: true })
  await page.routeWebSocket('**/*', () => {})
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith(profile.avatar_url))
      return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="16"/></svg>'})
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
        spotifyConnected=true;sharing=body.share
        return route.fulfill({json:{ok:true}})
      }
      if(body.action==='seek')seekPosition=body.position
      if(body.action==='pause')playing=false
      if(body.action==='play')playing=true
      if(body.action==='sharing')sharing=body.share
      return route.fulfill({json:{configured:true,clientId:spotifyConnected?undefined:spotifyClient,connected:spotifyConnected,playing,sharing,duration:361000,progress:seekPosition??157000,
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
    if(url.pathname.endsWith('/rpc/choose_companion_background')){
      const {surface,motif,palette,purchase}=route.request().postDataJSON()
      if(motif!=='plain'&&!gallery.owned.includes(motif)){
        assert.ok(purchase && balance>=gallery.prices[motif])
        gallery.owned.push(motif);balance-=gallery.prices[motif]
      }
      gallery[surface]=motif==='plain'?motif:motif+':'+palette
      return route.fulfill({json:{points:balance,version:++gameVersion,video:latestVideo,price:250,gallery}})
    }
    if(url.pathname.endsWith('/rpc/circle_game')){
      const {action,taps,request_id}=route.request().postDataJSON()
      if(action==='tap'){ balance+=taps-(streams.get(request_id)||0);streams.set(request_id,taps);gameVersion++ }
      if(action==='spin'){if(balance<250)return route.fulfill({status:400,json:{message:'Solde insuffisant'}})
        balance-=250;latestVideo='XCZlx9bt1G4';gameVersion++}
      return route.fulfill({json:{points:balance,version:gameVersion,video:latestVideo,price:250,gallery}})
    }
    if (url.pathname.endsWith('/rpc/companion_care')) {
      const {action,detail} = route.request().postDataJSON()
      if (action === 'adopt') companion = {model:detail,nickname:'',version:1,company:1,food:2,mood:2,asleep:false,days:[],today:'2026-11-25',streak:0,best:0,affection:0}
      if (action === 'feed') {
        companion.food--; companion.version++
        if (!companion.food) Object.assign(companion,{days:[companion.today],streak:1,best:1,affection:1})
      }
      if(action==='company'){companion.company=0;companion.version++}
      if(action==='pat'){companion.mood--;companion.version++}
      if (action === 'rename') {companion.nickname=detail; companion.version++}
      return route.fulfill({contentType:'application/json',body:JSON.stringify(companion || null)})
    }
    if (url.pathname.endsWith('/recommendation-preview')) return route.fulfill({json:{title:'Morceau du cercle'}})
    if(url.pathname.endsWith('/posts') && ['PATCH','DELETE'].includes(route.request().method())){
      const changedId=posted.id
      if(route.request().method()==='PATCH')Object.assign(posted,route.request().postDataJSON())
      else posted=null
      return route.fulfill({json:route.request().method()==='PATCH'?[{id:changedId}]:{id:changedId}})
    }
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
    const photo = await page.locator('[data-widget="Photo"]').boundingBox()
    const spotify = await page.locator('[data-widget="Spotify"]').boundingBox()
    const recommendation = await page.locator('[data-widget="Recommandations"]').boundingBox()
    assert.ok(Math.abs(photo.y - spotify.y) < 1)
    assert.ok(Math.abs(photo.height - spotify.height) < 1)
    const gap = recommendation.y - photo.y - photo.height
    assert.ok(gap > 0 && gap < 12)
  }
  const home = page.locator('.widgetBoard')
  const square=await home.locator('[data-widget="Spotify"]').boundingBox()
  assert.ok(Math.abs(square.width-square.height)<1)
  await home.getByRole('button',{name:'Ouvrir Spotify'}).click()
  await page.getByRole('button',{name:'Connecter mon compte Spotify'}).click()
  const playerDialog=page.getByRole('dialog',{name:'Lecteur Spotify'})
  await playerDialog.getByRole('heading',{name:'Titre de test'}).waitFor()
  await playerDialog.getByText('6:01',{exact:true}).waitFor()
  await playerDialog.getByRole('slider').press('Home')
  await page.waitForFunction(()=>!document.querySelector('dialog input[type=range]')?.disabled)
  assert.equal(seekPosition,0)
  assert.equal(await playerDialog.getByRole('button',{name:'Déconnecter Spotify'}).count(),0)
  await page.getByRole('button',{name:'Fermer et revenir à l’accueil'}).click()
  await home.getByRole('button',{name:'Pause',exact:true}).click()
  await home.getByRole('button',{name:'Reprendre'}).click()
  await home.getByRole('button',{name:'Pause',exact:true}).waitFor()
  await home.getByRole('button',{name:'Character',exact:true}).click()
  const companionDialog = page.getByRole('dialog')
  await companionDialog.getByRole('button',{name:'Paramètres du jeu'}).click()
  await companionDialog.getByLabel('Couleur des boutons').fill('#91d8b5')
  assert.equal(await companionDialog.evaluate(el=>el.style.getPropertyValue('--game-fill')),'#91d8b5')
  await companionDialog.getByRole('button',{name:'Paramètres du jeu'}).click()
  await companionDialog.getByRole('button',{name:'Tsunade',exact:true}).click()
  const clicker=companionDialog.getByRole('button',{name:'Clicker',exact:true})
  const character=companionDialog.getByRole('button',{name:'Character',exact:true})
  await character.waitFor()
  const originalViewport = page.viewportSize()
  for (const [width,height] of [[320,568],[393,765],[430,932]]) {
    await page.setViewportSize({width,height})
    const stage = await companionDialog.locator('.petStage').boundingBox()
    const figure = await companionDialog.locator('.petFigure').boundingBox()
    const panel = await companionDialog.locator('.roomPanel').boundingBox()
    assert.ok(Math.abs((figure.x + figure.width / 2) - width / 2) < 1)
    assert.ok(figure.y >= stage.y && figure.y+figure.height <= panel.y)
  }
  await companionDialog.getByRole('button',{name:'Love Meter',exact:true}).click()
  const love=page.getByRole('dialog',{name:'Love Meter',exact:true})
  await love.getByRole('button',{name:'Lecture'}).click()
  await love.getByText(/^Son\s*:\s*She’s Homeless/).waitFor()
  for(const pose of ['friendly','close','love']){
    await love.locator('img[data-visible="true"][src$="/'+pose+'.webp"]').waitFor({timeout:12000})
    assert.equal(await love.locator('.loveScene').innerText(),'')
  }
  await love.getByRole('button',{name:'Rejouer'}).click()
  await love.locator('img[data-visible="true"][src$="/shy.webp"]').waitFor()
  await love.getByRole('button',{name:'Pause',exact:true}).click()
  assert.ok(await love.locator('audio').evaluate(el=>el.paused))
  await love.getByRole('button',{name:'Fermer le Love Meter'}).click()
  await character.waitFor()
  const stageHeight=() => companionDialog.locator('.petStage').evaluate(el=>el.clientHeight)
  const openHeight=await stageHeight()
  await companionDialog.getByRole('button',{name:'Replier les soins'}).click()
  assert.ok(await stageHeight()>openHeight)
  await companionDialog.getByRole('button',{name:'Afficher les soins'}).click()
  await page.setViewportSize(originalViewport)
  await companionDialog.getByRole('button',{name:'Passer un moment ensemble'}).click()
  await companionDialog.locator('img.pose-company[src$="Tsunade-pat.webp"]').waitFor()
  await companionDialog.getByText('Tsunade te fait un clin d’œil.').waitFor()
  for(let n=0;n<2;n++)await companionDialog.getByRole('button',{name:'Caresser',exact:true}).click()
  await companionDialog.locator('img.pose-pat[src$="Tsunade-pat.webp"]').waitFor()
  await clicker.click()
  for(let n=0;n<45;n++)await companionDialog.getByRole('button',{name:'Gagner un cœur'}).click()
  await companionDialog.getByRole('img',{name:'600 cœurs',exact:true}).waitFor()
  const backgrounds=companionDialog.getByRole('button',{name:'Fonds',exact:true})
  await backgrounds.click()
  await companionDialog.getByRole('button',{name:'Étoiles · 350 cœurs'}).click()
  await companionDialog.getByRole('button',{name:/Débloquer/}).click()
  await companionDialog.locator('[data-motif="stars"]').waitFor()
  await companionDialog.getByRole('img',{name:'250 cœurs',exact:true}).waitFor()
  await character.click()
  await companionDialog.getByRole('button',{name:'Donner une bouchée'}).click()
  await companionDialog.getByRole('button',{name:'Donner une bouchée'}).click()
  await companionDialog.locator('img.pose-feed[src$="Tsunade-feed.webp"]').waitFor()
  await companionDialog.getByText('Rassasiée',{exact:true}).waitFor()
  await companionDialog.getByRole('button',{name:'Saluer le personnage'}).click()
  const jumping=companionDialog.locator('img.pose-hop')
  await jumping.waitFor()
  const fits=await jumping.evaluate(el=>{
    const animation=el.getAnimations()[0]
    if(animation){animation.pause();animation.currentTime=234}
    const frame=el.closest('.petStage').getBoundingClientRect(),sprite=el.getBoundingClientRect()
    return sprite.top>=frame.top && sprite.bottom<=frame.bottom && sprite.left>=frame.left && sprite.right<=frame.right
  })
  assert.ok(fits)
  await backgrounds.click()
  await companionDialog.getByRole('button',{name:'Étoiles · disponible'}).click()
  await companionDialog.getByRole('button',{name:'Lilas',exact:true}).click()
  await companionDialog.getByRole('button',{name:'Appliquer le fond'}).click()
  await companionDialog.locator('[data-motif="stars"]').waitFor()
  await companionDialog.getByRole('button',{name:'Fermer le personnage'}).click()
  assert.match(await home.locator('[data-widget="Jours ensemble"]').innerText(),/1 jour/)
  companion.asleep=true
  await page.reload()
  await home.getByRole('button',{name:'Character',exact:true}).click()
  await companionDialog.getByRole('img',{name:'Tsunade dort.'}).waitFor()
  assert.equal(await companionDialog.evaluate(el=>el.style.getPropertyValue('--game-fill')),'#91d8b5')
  assert.equal(await companionDialog.getByRole('button',{name:'Donner une bouchée'}).count(),0)
  await companionDialog.getByText('Réveil à 7 h').waitFor()
  assert.equal(await companionDialog.evaluate(el=>el.clientHeight),await page.evaluate(()=>innerHeight))
  await companionDialog.getByRole('button',{name:'Fermer le personnage'}).click()
  for(const model of ['Nonna','Rias']){
    companion.model=model
    await page.reload()
    await home.getByRole('button',{name:'Character',exact:true}).click()
    await companionDialog.getByRole('button',{name:'Love Meter',exact:true}).click()
    await love.getByText(model,{exact:true}).waitFor()
    await love.getByRole('button',{name:'Lecture',exact:true}).click()
    for(const [time,pose,x,y] of [[0,'shy',42,187],[2.4,'friendly',58,138],[4.3,'close',92,97],[6,'love',144,70]]){
      await love.locator('audio').evaluate((el,t)=>{el.currentTime=t},time)
      await love.locator(`img[data-visible="true"][src$="/${model}/${pose}.webp"]`).waitFor()
      const tip=await love.locator('.loveNeedle').evaluate(needle=>{
        const local=needle.ownerSVGElement.getScreenCTM().inverse().multiply(needle.getScreenCTM())
        const pt=new DOMPoint(-140,0).matrixTransform(local)
        return {x:pt.x,y:pt.y}
      })
      assert.ok(Math.hypot(tip.x-x,tip.y-y)<1.5,model+' · '+pose+' : '+JSON.stringify(tip))
    }
    await love.getByRole('button',{name:'Fermer le Love Meter'}).click()
    await companionDialog.getByRole('button',{name:'Fermer le personnage'}).click()
  }
  // Switching phases keeps the room plain and shows the sleeping character at night.
  companion.model='Rias'
  for (const [hour,phase] of [[12,'day'],[19,'dusk'],[23,'night']]) {
    companion.asleep=phase==='night'
    await page.reload()
    await page.evaluate(localHour => { Date.prototype.getHours = () => localHour }, hour)
    await home.getByRole('button',{name:'Character',exact:true}).click()
    await character.waitFor()
    assert.equal(await companionDialog.getAttribute('data-phase'),phase)
    assert.equal(await companionDialog.locator('.petStage').evaluate(el=>getComputedStyle(el).backgroundImage),'none')
    assert.equal(await companionDialog.getByRole('img',{name:'Rias dort.'}).count(),phase==='night'?1:0)
    await companionDialog.getByRole('button',{name:'Fermer le personnage'}).click()
  }
  await home.getByRole('button',{name:/Roulette ASMR/}).click()
  const roulette=page.getByRole('dialog',{name:'Roulette ASMR'})
  await roulette.getByRole('button',{name:/Tourner/}).click()
  await roulette.getByRole('link',{name:'Voir la vidéo'}).waitFor()
  assert.equal(balance,0)
  await roulette.getByRole('button',{name:'Fermer la roulette'}).click()
  const close = () => page.getByRole('button', { name: 'Fermer et revenir à l’accueil' }).click()
  const widgets=home.locator('section')
  const rects=()=>widgets.evaluateAll(els=>Object.fromEntries(els.map(e=>[e.dataset.widget,[e.offsetWidth,e.offsetHeight]])))
  const normal=await rects()
  const order=()=>widgets.evaluateAll(els=>els.map(el=>el.dataset.widget))
  const initialOrder=await order()
  await page.getByRole('button',{name:'Paramètres',exact:true}).click()
  await page.getByText('Connexion',{exact:true}).click()
  await page.getByRole('button',{name:'Déconnecter Spotify'}).waitFor()
  await page.getByRole('button',{name:'Personnalisation'}).click()
  const homeBackground=page.getByLabel('Fond de l’accueil')
  assert.deepEqual(await homeBackground.locator('option').allTextContents(),['Par défaut','Ardoise','Crépuscule','Forêt'])
  await homeBackground.selectOption('dusk')
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
  await page.locator('.homeBackdrop.dusk').waitFor()
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
  await page.getByLabel('Afficher mon écoute sur mon profil').check()
  await page.getByRole('heading',{name:'Écoute en ce moment'}).waitFor()
  assert.equal(await page.getByRole('heading',{name:'Publications',exact:true}).count(),0)
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
  await page.getByRole('button',{name:'Nouvelle recommandation'}).click()
  await page.getByLabel('Titre',{exact:true}).fill('Recommandation sans lien')
  await page.getByRole('button',{name:'Publier',exact:true}).click()
  await page.getByRole('heading',{name:'Recommandation sans lien'}).waitFor()
  assert.equal(posted.source_url,null)
  const post=page.locator('article.post').first()
  assert.equal(await post.locator('time').count(),0)
  assert.doesNotMatch(await post.innerText(),/J’aime|Commentaires/)
  await post.locator('header .avatar img').waitFor()
  const toggle = post.getByLabel('Actions sur la publication')
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({width,height:844})
    const name = post.locator('.postAuthorName')
    await toggle.scrollIntoViewIfNeeded()
    const before = await name.boundingBox()
    await toggle.click()
    const after = await name.boundingBox()
    assert.ok(after.width > 14 && Math.abs(before.x - after.x) < 1 && Math.abs(before.y - after.y) < 1, JSON.stringify({width,before,after}))
    const author = await post.locator('header .link').boundingBox()
    const pencil = await post.getByLabel('Actions sur la publication').boundingBox()
    for (const name of ['Modifier', 'Supprimer']) {
      const action = await post.getByRole('button',{name,exact:true}).boundingBox()
      assert.ok(action.x >= author.x + author.width && action.x + action.width <= pencil.x)
      assert.ok(Math.abs(action.y + action.height / 2 - pencil.y - pencil.height / 2) < 1)
    }
    const badge = await post.locator('.tag').boundingBox()
    const title = await post.getByRole('heading').boundingBox()
    assert.ok(title.y - badge.y - badge.height >= 12)
    await toggle.click()
  }
  await toggle.click()
  await post.getByRole('button',{name:'Modifier',exact:true}).click()
  await post.getByLabel('Message',{exact:true}).fill('Mon nouveau message')
  await post.getByRole('button',{name:'Enregistrer les modifications'}).click()
  await post.getByText('Mon nouveau message',{exact:true}).waitFor()
  await post.getByLabel('Actions sur la publication').click()
  page.once('dialog',dialog=>dialog.accept())
  await post.getByRole('button',{name:'Supprimer',exact:true}).click()
  await page.getByText('Aucune recommandation à afficher.').waitFor()
  maintenance = {enabled:true,owner:false}
  await page.reload()
  await page.getByRole('heading',{name:'Maintenance en cours'}).waitFor()
  assert.equal(await page.locator('.widgetBoard').count(),0)
} finally {
  await browser.close()
}
