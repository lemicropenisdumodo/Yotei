import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { Heart, Settings2, X, Flame, Utensils, Sunrise, Sofa, BedDouble } from 'lucide-react'
import { base, db, message } from './core'
import {useGameColor} from './GameButtons'
import './companion.css'

const models = ['Nonna', 'Rias', 'Tsunade'] as const
type Model = typeof models[number]
type Action = 'read' | 'adopt' | 'rename' | 'feed' | 'pat'
type Pet = {
  model: Model; nickname: string; food: number; mood: number; asleep: boolean
  streak: number; best: number; affection: number; today: string; days: string[]; version: number
}
type Pose = 'idle' | 'feed' | 'pat' | 'sleep'
type Room = 'Salon' | 'Chambre'
type Phase = 'day' | 'dusk' | 'night'

function roomArt(model: Model, room: Room, phase: Phase) {
  if (room === 'Salon') return 'salon/'+(phase === 'day' ? 'day' : 'night')
  if (model === 'Nonna') return 'nonna/'+(phase === 'night' ? 'night' : 'day')
  if (model === 'Rias' && phase === 'night') return 'rias/night'
  return 'tsunade/'+(phase === 'night' ? 'night' : 'day')
}

const art = (model: Model, pose: Pose = 'idle') =>
  base+'companions/'+model+(pose === 'idle' ? '' : '-'+pose)+'.webp'

export function useCompanion() {
  const [pet, setPet] = useState<Pet | null | undefined>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const version = useRef<number | null>(null)
  const act = async (action: Action = 'read', detail = '') => {
    if (lock.current) return false
    lock.current = true
    setBusy(true)
    try {
      const {data, error} = await db.rpc('companion_care',{
        action, detail, expected:version.current, zone_name:Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      })
      if (error) throw new Error(error.message)
      const updated = data as Pet | null
      const changed = updated?.version !== version.current
      version.current = updated?.version ?? null
      setPet(updated)
      setError('')
      return changed
    } catch (e) { setError(message(e)); return false }
    finally { lock.current = false; setBusy(false) }
  }
  useEffect(() => {
    const refresh = () => { if (!document.hidden) void act() }
    refresh()
    const timer = window.setInterval(refresh,30000)
    document.addEventListener('visibilitychange',refresh)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange',refresh) }
  },[])
  return {pet,error,busy,act}
}
type State = ReturnType<typeof useCompanion>
export type PetTile = 'Mon personnage' | 'Jours ensemble'
function label(p:Pet) {
  if (p.asleep) return 'Endormie'
  if (p.food) return 'Un petit creux'
  return p.mood ? 'Une caresse ?' : 'Heureuse'
}
function Week({pet}:{pet:Pet}) {
  return <div className="petWeek">{Array.from({length:7},(_,i)=>{
    const day = new Date(pet.today+'T12:00:00Z')
    day.setUTCDate(day.getUTCDate()+i-6)
    const done = pet.days.includes(day.toISOString().slice(0,10))
    return <span key={i} title={day.toLocaleDateString('fr-FR',{timeZone:'UTC'})}>
      <Heart size={15} fill={done?'currentColor':'none'} aria-label={done?'Soin terminé':'Aucun soin'}/>
      {day.toLocaleDateString('fr-FR',{weekday:'narrow',timeZone:'UTC'})}
    </span>
  })}</div>
}
export function CompanionTile({kind,state,open,wide}:{kind:PetTile;state:State;open:()=>void;wide:boolean}) {
  const p = state.pet
  if (kind === 'Jours ensemble') return <div className="widgetLink petCounter">
    <Flame className="streakFlame"/><strong>{p?.streak ?? 0} jour{(p?.streak ?? 0)>1?'s':''}</strong>
    <small>de suite</small>{wide && p && <Week pet={p}/>}
  </div>
  return <button className="widgetLink petShortcut" onClick={open} aria-label="Mon personnage">
    <strong>{p ? p.nickname || p.model : 'Mon personnage'}</strong>
    {p ? <><small className="petStatus">{label(p)}</small><small className="petLevel">Nv {1+Math.floor(p.affection/5)}</small>
      <span className="petReadings">{(['mood','food'] as const).map(need=><span key={need}
        style={{background:'conic-gradient(#fff '+((4-p[need])*25)+'%, #ffffff35 0)'}}
        aria-label={(need==='food'?'Nourriture':'Moral')+' : '+(4-p[need])+' sur 4'}>
        <i>{need==='mood'?<Heart fill="currentColor"/>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18C1 14 7 3 12 3s11 11 8 15c-2 3-14 3-16 0Z" fill="none" stroke="currentColor" strokeWidth="2.7"/><rect x="9" y="13" width="6" height="7" rx="1" fill="currentColor"/></svg>}</i></span>)}</span></>:<small>Choisir ↗</small>}
    <img src={art(p?.model||'Tsunade',p?.asleep?'sleep':'idle')} alt=""/>
  </button>
}
export function CompanionDialog({kind,state,close,userId}:{userId:string;kind:PetTile;state:State;close:()=>void}) {
  const palette=useGameColor(userId)
  const [settings,setSettings]=useState(false)
  const {pet:p,act,busy,error} = state
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  useEffect(() => setSelectedRoom(null), [p?.asleep, p?.model])
  const dialog = useRef<HTMLDialogElement>(null)
  const [motion,setMotion] = useState<{pose:Pose; key:number}>({pose:'idle',key:0})
  const [nickname,setNickname] = useState(p?.nickname || '')
  useEffect(()=>{ dialog.current?.showModal() },[])
  useEffect(()=>{
    if (motion.pose === 'idle') return
    const timer=setTimeout(()=>setMotion(m=>({...m,pose:'idle'})),1300)
    return ()=>clearTimeout(timer)
  },[motion])
  async function care(action:'feed'|'pat') {
    if (await act(action)) setMotion(m=>({pose:action,key:m.key+1}))
  }
  const pose = p?.asleep ? 'sleep' : motion.pose
  const counter = kind === 'Jours ensemble' && p
  const room = !!p && !counter
  const homeRoom: Room = p?.asleep ? 'Chambre' : 'Salon'
  const currentRoom = selectedRoom ?? homeRoom
  const present = currentRoom === homeRoom
  const inBedroom = currentRoom === 'Chambre'
  const sleepingHere = !!p?.asleep && inBedroom
  const hour=new Date().getHours()
  const phase=p?.asleep?'night':hour>=7 && hour<18?'day':'dusk'
  const scene = p ? roomArt(p.model,currentRoom,phase) : ''
  const sceneryStyle = {'--scene': 'url('+base+'companions/room/'+scene+'.webp)'} as CSSProperties
  return <dialog style={palette.style} className={'petDialog'+(room?' roomDialog':'')} data-phase={room?phase:undefined} data-room={room?currentRoom:undefined} ref={dialog} onClose={close} aria-label={kind}>
    {room && <div className="roomScenery" style={sceneryStyle} data-model={p.model} aria-hidden={!sleepingHere} role={sleepingHere?'img':undefined} aria-label={sleepingHere?p.model+' dort de dos sous la couverture.':undefined}>
      {inBedroom && <div className="roomCanvas">
        {inBedroom && p.asleep && <><i className="lanternGlow"/><i className="quiltBreath"/></>}
      </div>}</div>}
    <header><h2>{room && <small>{currentRoom} · {phase==='day'?'Jour':phase==='dusk'?'Soir':'Nuit'}</small>}{counter ? kind : p ? p.nickname || p.model : 'Choisis ton personnage'}{room && p && <span className="roomStatus">{label(p)}</span>}</h2>
      <div className="gameHeaderActions"><button aria-label="Paramètres du jeu" title="Paramètres du jeu" aria-expanded={settings} onClick={()=>setSettings(!settings)}><Settings2 size={19}/></button>
      <button onClick={()=>dialog.current?.close()} aria-label="Fermer le personnage"><X size={20}/></button></div></header>
    {settings && <section className="gameSettings"><label>Couleur des boutons<input type="color" value={palette.color} onChange={e=>palette.change(e.target.value)}/></label>
      {p && <form onSubmit={async e=>{e.preventDefault(); await act('rename',nickname.trim())}}>
        <label>Surnom du personnage<input value={nickname} onChange={e=>setNickname(e.target.value)} maxLength={28} placeholder={p.model}/></label>
        <button className="primary" type="submit" disabled={busy}>Enregistrer</button></form>}
      {palette.temporary&&<small>Couleur appliquée pour cette session.</small>}</section>}
    {error && <p role="alert">{error} <button onClick={()=>act()}>Réessayer</button></p>}
    {p === undefined ? <p>Ouverture…</p> : !p ? <><label>Surnom facultatif<input value={nickname} onChange={e=>setNickname(e.target.value)} maxLength={28}/></label><div className="petChoices">{models.map(model=>
      <button key={model} disabled={busy} onClick={async ()=>{if (await act('adopt',model) && nickname.trim()) await act('rename',nickname.trim())}}><img src={art(model)} alt=""/>{model}</button>
    )}</div></> : counter ? <section className="petStats"><Flame/><h3>{p.streak} jour{p.streak>1?'s':''} de suite</h3><Week pet={p}/>
      <p>{p.days.includes(p.today) ? 'Le soin du jour est terminé.' : 'Termine un repas ou une séance de caresses pour valider la journée.'}</p>
      <p>Record · {p.best}　 ♥ {p.affection}</p></section> : <>
      <div className="petStage">
        {!inBedroom && <div className="salonScene" style={sceneryStyle}>
        {present && !p.asleep && <button className="petFigure" disabled={p.asleep || !p.mood || busy} aria-label="Caresser le personnage" onClick={()=>care('pat')}>
          <img key={motion.key+'-'+pose} className={'pose-'+pose} src={base+'companions/room/salon/'+p.model+(pose==='idle'?'':'-'+pose)+'.png'} alt={p.model}/>
        </button>}
        {present && pose==='pat' && <Heart key={motion.key} className="petEffect"/>}
        </div>}
      </div>
      <div className="roomPanel">
        <div role="group" aria-label="Pièces de la maison" className="roomPicker">
          {(['Salon','Chambre'] as const).map(name => <button key={name} type="button"
            aria-pressed={name === currentRoom} onClick={() => setSelectedRoom(name)}>
            {name === 'Salon' ? <Sofa size={16}/> : <BedDouble size={16}/>} {name}
          </button>)}
        </div>
        {present ? <div className="petNeeds">{(['feed','pat'] as const).map(action=>{
        const food=action==='feed', remaining=food?p.food:p.mood
        const status = remaining ? (food?'A faim':'À réconforter') : (food?'Rassasiée':'Contente')
        const Icon=food?Utensils:Heart
        return <div key={action} className="needCard"><label><span className="needTitle"><Icon size={15}/>{food?'Repas':'Moral'}</span>
          <progress max={4} value={4-remaining}/></label>
          {p.asleep || !remaining ? <small>{status}</small> :
            <button disabled={busy} onClick={()=>care(action)}>{food?'Donner une bouchée':'Caresser'}</button>}</div>
      })}</div> : <p className="roomLocation">{p.nickname || p.model} {p.asleep ? 'dort dans la chambre.' : 'est au salon.'}</p>}
      <div className="careFoot"><span><Heart size={13}/> Affection · {p.affection}</span>
        {p.asleep && <span><Sunrise size={15}/> Réveil à 7 h</span>}</div>
      </div>
    </>}
  </dialog>
}
