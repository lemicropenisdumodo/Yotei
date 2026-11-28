import {useCircleGame,Roulette,RouletteShortcut} from './CircleGame'
import type {Watchlist} from './MarketSettings'
import {CompanionDialog, CompanionTile, useCompanion, type PetTile} from './Companion'
import { webLink, type Recommendation } from './recommendation'
import {SpotifyTile, type useSpotify} from './Spotify'
import { ClockTiles, Market, useMarkets } from './Widgets'
import {
  Aperture,
  Grip, Check, ChevronLeft, ChevronRight, Music2, Image as Picture,
  AudioLines,
  CircleUserRound,
  Clapperboard,
  Video,
  LayoutGrid,

  Newspaper,
  Plus,
  Settings2,
  UsersRound,
} from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { Weather } from './Weather'
import { Media, type Directory } from './core'
export const navigation = {
  Accueil: LayoutGrid,
  Fil: Newspaper,
  Publier: Plus,

  Amis: UsersRound,
  Profil: CircleUserRound,
  Administration: Settings2, Paramètres: Settings2, Spotify: Music2,
}
export type Page = keyof typeof navigation
export const categories = {
  Cinéma: Clapperboard,
  Musique: AudioLines,
  Vidéo: Video,
}
export type Category = keyof typeof categories
export function Mark() {
  return (
    <span className="brandmark">
      <Aperture aria-hidden="true" size={30} strokeWidth={2.8} />
    </span>
  )
}
export function Avatar({ person }: { person: Directory['me'] }) {
  return (
    <span className="avatar" style={{ backgroundColor: person.theme_color }}>
      {person.username.slice(0, 1).toUpperCase()}
      <Media path={person.avatar_url} alt="" />
    </span>
  )
}
const widgets = ['Marchés','Courbe','Batterie','Date','Météo','Heure','Prévisions','Character','Amis','Jours ensemble','Décor','Photo','Spotify','Recommandations','Roulette'] as const
type Widget = typeof widgets[number]
function readLayout(key: string): Widget[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) || '[]')
    if (Array.isArray(saved)) return [...new Set<Widget>([...saved.map(id=>id==='Mon personnage'?'Character':id).filter(id=>widgets.includes(id)), ...widgets])]
  } catch { /* Default arrangement */ }
  return [...widgets]
}
export function Home({d, recent, openPost, go, editing, finish, photo, spotify,watch}: {
  watch:Watchlist
  d: Directory; recent?: Recommendation; openPost:(id:string)=>void; go: (p: Page) => void; editing:boolean; finish:()=>void; photo:string; spotify:ReturnType<typeof useSpotify>
}) {
  const key = 'yotei-board-v2-' + d.me.id
  const [layout, setLayout] = useState(() => readLayout(key))
  const [selected, select] = useState<Widget | null>(null)
  const [forecastHost,setForecastHost]=useState<HTMLDivElement|null>(null)
  const marketRows=useMarkets(watch.tickers)
  const game=useCircleGame(d.me.id)
  const [roulette,setRoulette]=useState(false)
  const companion = useCompanion(d.me.id)
  const [petPage, setPetPage] = useState<PetTile | null>(null)
  const [drag, setDrag] = useState<Widget | null>(null)
  const [target, setTarget] = useState<Widget | null>(null)
  const [storageError, setStorageError] = useState(false)
  const board = useRef<HTMLDivElement>(null)
  useLayoutEffect(()=>{
    const grid=board.current
    const tile=grid?.querySelector<HTMLElement>('[data-widget="Spotify"]')
    if(!grid||!tile)return
    const fit=()=>{
      if(!tile.offsetWidth)return
      const style=getComputedStyle(tile)
      const size=tile.getBoundingClientRect().width
      grid.style.setProperty('--photo-height',size+'px')
      const outer=size+parseFloat(style.marginTop)+parseFloat(style.marginBottom)
      const row=parseFloat(getComputedStyle(grid).gridAutoRows)
      const span='span '+Math.ceil(outer/row)
      tile.style.gridRowEnd=span
      const photoTile=grid.querySelector<HTMLElement>('[data-widget="Photo"]')
      if(photoTile)photoTile.style.gridRowEnd=span
    }
    fit()
    const observer=new ResizeObserver(fit)
    observer.observe(grid);observer.observe(tile)
    return ()=>observer.disconnect()
  },[])
  const positions = useRef(new Map<string, DOMRect>())
  const visible = layout
  const online = d.people.filter(p => !p.suspended && p.last_seen && Date.now() - Date.parse(p.last_seen) < 90000).length
  function save(next: Widget[]) {
    positions.current.clear()
    board.current?.querySelectorAll<HTMLElement>('[data-widget]').forEach(el =>
      positions.current.set(el.dataset.widget!, el.getBoundingClientRect()))
    setLayout(next)
    try { localStorage.setItem(key, JSON.stringify(next)); setStorageError(false) }
    catch { setStorageError(true) }
  }
  useLayoutEffect(() => {
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      board.current?.querySelectorAll<HTMLElement>('[data-widget]').forEach(el => {
        const before = positions.current.get(el.dataset.widget!)
        if (!before) return
        const after = el.getBoundingClientRect()
        if (before.top !== after.top || before.left !== after.left)
          el.animate([{transform: 'translate('+(before.left-after.left)+'px,'+(before.top-after.top)+'px)'}, {transform:'none'}], {duration:180,easing:'ease-out'})
      })
    }
    positions.current.clear()
  }, [layout])
  function move(id: Widget, to?: Widget) {
    if (!to || id === to) return
    const next = layout.slice()
    const index = next.indexOf(to)
    const [tile] = next.splice(next.indexOf(id), 1)
    next.splice(index, 0, tile)
    save(next)
  }
  function tileContent(id: Widget) {
    if (id === 'Character' || id === 'Jours ensemble') return <CompanionTile kind={id} state={companion} wide={false} open={()=>setPetPage('Character')}/>
    if (id==='Roulette') return <RouletteShortcut points={game.points} open={()=>setRoulette(true)}/>
    if (id === 'Recommandations') return <button className="widgetLink recWidget" aria-label="Recommandations" onClick={() => recent ? openPost(recent.id) : go('Fil')}>
      {recent && (recent.image_url ? <Media path={recent.image_url} className="recArt" alt="" /> :
        webLink(recent.thumbnail_url) && <img className="recArt" src={webLink(recent.thumbnail_url)} alt="" referrerPolicy="no-referrer" />)}
      <strong>Recommandation</strong><b>{recent?.source_title || 'La première reco du cercle'}</b>
      <small>{recent ? d.name(recent.user_id)+' · '+recent.category : 'Partager un film, une vidéo ou un son'}</small>
    </button>
    if (id === 'Prévisions') return <div className="forecastHost" ref={setForecastHost}/>
    if (id === 'Météo') return <Weather userId={d.me.id} forecastHost={forecastHost}/>
    if (id === 'Marchés' || id === 'Courbe') return <Market watch={watch} rows={marketRows} chart={id==='Courbe'}/>
    if (id === 'Date' || id === 'Heure' || id === 'Batterie') return <ClockTiles kind={id}/>
    if (id === 'Photo') return photo ? <img className="memoryPhoto" src={photo} alt="Ma photo"/> : <div className="stillTile"><Picture/><strong>Ma photo</strong></div>
    if (id === 'Décor') return <span className="bang" aria-hidden="true">!</span>
    if (id === 'Spotify') return <SpotifyTile control={spotify} open={()=>go('Spotify')}/>
    return <button className="widgetLink friendsTile" aria-label="Amis" title={'Amis · '+online+' en ligne'} onClick={()=>go('Amis')}><span>{d.people.filter(p=>!p.suspended).slice(0,3).map(p=><Avatar key={p.id} person={p}/>)}</span></button>
  }
  return <>
    <div className="boardHeading"><h1>Salut, {d.me.username} !</h1>
      {editing && <button onClick={()=>{select(null);finish()}}><Check/> Terminer</button>}
    </div>
    {editing && <p className="editHint">Glisse une poignée ou sélectionne un widget pour le déplacer avec les flèches.</p>}
    {editing && <div className="layoutActions">
      <button disabled={layout.every((id,index)=>id===widgets[index])} onClick={()=>save([...widgets])}>Réinitialiser l’emplacement des widgets</button>
    </div>}
    {storageError && <p role="status">La disposition sera conservée jusqu’à la fermeture de cette page.</p>}
    {editing && selected && <div className="orderTools"><strong>{selected}</strong>
      <button aria-label={'Avancer '+selected} disabled={layout.indexOf(selected)===0} onClick={()=>move(selected,layout[layout.indexOf(selected)-1])}><ChevronLeft/></button>
      <button aria-label={'Reculer '+selected} disabled={layout.indexOf(selected)===layout.length-1} onClick={()=>move(selected,layout[layout.indexOf(selected)+1])}><ChevronRight/></button></div>}
    <div className="widgetBoard fixedBoard" ref={board}>
      {visible.map(id => <section key={id} data-widget={id} data-selected={editing && selected===id}
        className={'homeTile' + (target === id ? ' dropTarget' : '')}>
        <div className="widgetBody" inert={editing}>{tileContent(id)}</div>
        {editing && <>
          <button className="pickWidget" aria-label={'Sélectionner '+id} onClick={()=>select(id)}/>
          <button className="dragGrip" aria-label={'Déplacer '+id}
            onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); select(id); setDrag(id) }}
            onPointerMove={e => {
              if (drag !== id) return
              if (e.clientY < 65) window.scrollBy(0,-18)
              if (e.clientY > innerHeight-65) window.scrollBy(0,18)
              const el = document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-widget]')
              setTarget(el?.dataset.widget as Widget || null)
            }}
            onPointerUp={e => {
              const el = document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-widget]')
              move(id, el?.dataset.widget as Widget)
              setDrag(null); setTarget(null)
            }}
            onPointerCancel={() => {setDrag(null); setTarget(null)}}><Grip size={20}/></button>
        </>}
      </section>)}
    </div>
    {roulette && <Roulette game={game} close={()=>setRoulette(false)}/>}
    {petPage && <CompanionDialog game={game} userId={d.me.id} kind={petPage} state={companion} close={()=>setPetPage(null)}/>}
  </>
}
