import {
  Aperture,
  Grip, ChevronUp, ChevronDown, Pencil, Check,
  AudioLines,
  CircleUserRound,
  Clapperboard,
  Gamepad2,
  LayoutGrid,
  MessagesSquare,
  Newspaper,
  Plus,
  Settings2,
  UsersRound,
} from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Weather } from './Weather'
import { Media, type Directory } from './core'
export const navigation = {
  Accueil: LayoutGrid,
  Fil: Newspaper,
  Publier: Plus,
  Messages: MessagesSquare,
  Amis: UsersRound,
  Profil: CircleUserRound,
  Administration: Settings2,
}
export type Page = keyof typeof navigation
export const categories = {
  Cinéma: Clapperboard,
  Musique: AudioLines,
  'Jeux vidéo': Gamepad2,
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
const widgets = ['Fil', 'Messages', 'Amis', 'Explorer', 'Météo', 'Publier', 'Profil', 'Administration'] as const
type Widget = typeof widgets[number]
type Tile = { id: Widget; wide: boolean; tone: string }
const tones = ['Original', 'Graphite', 'Sauge', 'Lavande']
function readLayout(key: string): Tile[] {
  let saved: Partial<Tile>[] = []
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    if (Array.isArray(value)) saved = value.filter(item => item && widgets.includes(item.id))
  } catch { /* The default layout also works without storage. */ }
  const order = new Set([...saved.map(item => item.id!), ...widgets])
  return Array.from(order, id => {
    const item = saved.find(tile => tile.id === id)
    return {
      id, wide: typeof item?.wide === 'boolean' ? item.wide : ['Fil','Explorer'].includes(id),
      tone: tones.includes(item?.tone || '') ? item!.tone! : tones[0],
    }
  })
}

export function Home({d, unread, go, filter, signout}: {
  d: Directory; unread: number; go: (p: Page) => void
  filter: (c: Category) => void; signout: ReactNode
}) {
  const key = 'yotei-widgets-v1-' + d.me.id
  const [layout, setLayout] = useState(() => readLayout(key))
  const [editing, setEditing] = useState(false)
  const [drag, setDrag] = useState<Widget | null>(null)
  const [target, setTarget] = useState<Widget | null>(null)
  const [storageError, setStorageError] = useState(false)
  const board = useRef<HTMLDivElement>(null)
  const positions = useRef(new Map<string, DOMRect>())
  const visible = layout.filter(tile => tile.id !== 'Administration' || d.me.admin)
  const online = d.people.filter(p => !p.suspended && p.last_seen && Date.now() - Date.parse(p.last_seen) < 90000).length
  function save(next: Tile[]) {
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
    const index = next.findIndex(tile => tile.id === to)
    const [tile] = next.splice(next.findIndex(tile => tile.id === id), 1)
    next.splice(index, 0, tile)
    save(next)
  }
  function tileContent(id: Widget) {
    if (id === 'Météo') return <Weather userId={d.me.id} />
    if (id === 'Explorer') return <div className="explore">
      <h2>Explorer le fil</h2><div>{(Object.keys(categories) as Category[]).map(c => {
        const Icon = categories[c]
        return <button key={c} onClick={() => filter(c)}><Icon />{c}</button>
      })}</div>
    </div>
    const Icon = navigation[id]
    return <button className="widgetLink" onClick={() => go(id)} aria-label={id}>
      {id === 'Fil' && <Media path={d.me.wallpaper_path} alt="" className="tileWallpaper" />}
      <Icon aria-hidden="true" /><strong>{id === 'Fil' ? 'Le fil du cercle.' : id === 'Profil' ? 'Mon profil' : id}</strong>
      {id === 'Messages' && <small>{unread ? unread + (unread > 1 ? ' non lus' : ' non lu') : 'Tout lu'}</small>}
      {id === 'Amis' && <small>{online} en ligne</small>}
    </button>
  }
  return <>
    <div className="boardHeading"><h1>Salut, {d.me.username} !</h1>
      <button aria-pressed={editing} onClick={() => setEditing(!editing)}>
        {editing ? <Check size={17}/> : <Pencil size={17}/>} {editing ? 'Terminer' : 'Modifier'}
      </button>
    </div>
    {editing && <p className="editHint">Glisse une poignée pour déplacer un raccourci, ou utilise les flèches.</p>}
    {storageError && <p role="status">La disposition sera conservée jusqu’à la fermeture de cette page.</p>}
    <div className="widgetBoard" ref={board}>
      {visible.map((tile, index) => <section key={tile.id} data-widget={tile.id} data-wide={tile.wide} data-tone={tile.tone}
        className={'homeTile' + (target === tile.id ? ' dropTarget' : '')}>
        {editing ? <div className="tileEditor">
          <div className="editTitle"><strong>{tile.id}</strong><button className="dragGrip" aria-label={'Déplacer '+tile.id}
            onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setDrag(tile.id) }}
            onPointerMove={e => {
              if (drag !== tile.id) return
              if (e.clientY < 65) window.scrollBy(0,-18)
              if (e.clientY > innerHeight-65) window.scrollBy(0,18)
              const el = document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-widget]')
              setTarget(el?.dataset.widget as Widget || null)
            }}
            onPointerUp={e => {
              const el = document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-widget]')
              move(tile.id, el?.dataset.widget as Widget)
              setDrag(null); setTarget(null)
            }}
            onPointerCancel={() => {setDrag(null); setTarget(null)}}><Grip size={20}/></button></div>
          <div className="moveButtons"><button aria-label={'Avancer '+tile.id} disabled={!index} onClick={() => move(tile.id, visible[index-1]?.id)}><ChevronUp/></button>
            <button aria-label={'Reculer '+tile.id} disabled={index === visible.length-1} onClick={() => move(tile.id, visible[index+1]?.id)}><ChevronDown/></button></div>
          <label>Taille<select value={tile.wide ? 'large' : 'compact'} onChange={e => save(layout.map(t => t.id === tile.id ? {...t, wide:e.target.value === 'large'} : t))}>
            <option value="compact">Compacte</option><option value="large">Large</option></select></label>
          <label>Couleur<select value={tile.tone} onChange={e => save(layout.map(t => t.id === tile.id ? {...t,tone:e.target.value} : t))}>
            {tones.map(t => <option key={t}>{t}</option>)}</select></label>
        </div> : tileContent(tile.id)}
      </section>)}
    </div>
    <div className="boardFooter">{signout}</div>
  </>
}
