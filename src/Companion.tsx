import {LoveMeter} from './LoveMeter'
import {Hearts,type Game} from './CircleGame'
import {GameBackdrop,BackgroundGallery} from './Wallpaper'
import { useEffect, useRef, useState } from 'react'
import { Heart, Settings2, X, Flame, Utensils, Sunrise, Hand, MousePointerClick, Images, ChevronDown, ChevronUp } from 'lucide-react'
import { base, db, message } from './core'
import {useGameColor} from './GameButtons'
import './companion.css'

const models = ['Nonna', 'Rias', 'Tsunade'] as const
export type Model = typeof models[number]
type Action = 'read' | 'adopt' | 'rename' | 'feed' | 'pat' | 'company'
type Pet = {
  model: Model; nickname: string; food: number; mood: number; company:number; asleep: boolean
  care_applied: boolean; care_wait_ms: number
  streak: number; best: number; affection: number; today: string; days: string[]; version: number
}
type Pose = 'idle' | 'feed' | 'pat' | 'sleep'
type Motion=Pose|'hop'|'company'
export type ArtStyle = 'pixel' | 'anime'
function art(model:Model, style:ArtStyle, pose:Motion='idle'){
  if(style==='anime')return base+'companions/anime/'+model+'/'+pose+'.webp'
  const original=pose==='company'?'pat':pose==='hop'?'idle':pose
  return base+'companions/'+model+(original==='idle'?'':'-'+original)+'.webp'
}

export function useCompanion(userId:string) {
  const styleKey='yotei-character-style-'+userId
  const [artStyle,setArtStyle]=useState<ArtStyle>(()=>{
    try{return localStorage.getItem(styleKey)==='anime'?'anime':'pixel'}catch{return 'pixel'}
  })
  const [temporaryStyle,setTemporaryStyle]=useState(false)
  function changeStyle(style:ArtStyle){
    setArtStyle(style)
    try{localStorage.setItem(styleKey,style);setTemporaryStyle(false)}catch{setTemporaryStyle(true)}
  }
  const [pet, setPet] = useState<Pet | null | undefined>()
  const [error, setError] = useState('')
  const [careReadyAt,setCareReadyAt]=useState(0)
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
      setCareReadyAt(updated?.care_wait_ms ? performance.now()+updated.care_wait_ms : 0)
      setPet(updated)
      setError('')
      if (action==='feed' || action==='pat' || action==='company') return updated?.care_applied===true
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
  return {pet,error,busy,act,careReadyAt,artStyle,changeStyle,temporaryStyle}
}
type State = ReturnType<typeof useCompanion>
export type PetTile = 'Character' | 'Jours ensemble'
function label(p:Pet) {
  if (p.asleep) return 'Endormie'
  if (p.food) return 'Un petit creux'
  return p.mood ? 'Une caresse ?' : p.company ? 'Un peu de compagnie ?' : 'Heureuse'
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
  return <button className="widgetLink petShortcut" data-art={state.artStyle} onClick={open} aria-label="Character">
    <strong>{p ? p.nickname || p.model : 'Character'}</strong>
    {p ? <><small className="petStatus">{label(p)}</small><small className="petLevel">Nv {1+Math.floor(p.affection/5)}</small>
      <span className="petReadings">{(['mood','food'] as const).map(need=><span key={need}
        style={{background:'conic-gradient(#fff '+((4-p[need])*25)+'%, #ffffff35 0)'}}
        aria-label={(need==='food'?'Nourriture':'Moral')+' : '+(4-p[need])+' sur 4'}>
        <i>{need==='mood'?<Heart fill="currentColor"/>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18C1 14 7 3 12 3s11 11 8 15c-2 3-14 3-16 0Z" fill="none" stroke="currentColor" strokeWidth="2.7"/><rect x="9" y="13" width="6" height="7" rx="1" fill="currentColor"/></svg>}</i></span>)}</span></>:<small>Choisir ↗</small>}
    <img src={art(p?.model||'Tsunade',state.artStyle,p?.asleep?'sleep':'idle')} alt=""/>
  </button>
}
export function CompanionDialog({kind,state,close,userId,game}:{game:Game;userId:string;kind:PetTile;state:State;close:()=>void}) {
  const palette=useGameColor(userId)
  const [settings,setSettings]=useState(false)
  const {pet:p,act,busy,error,artStyle,changeStyle} = state
  const [,tick]=useState(0)
  const wait=Math.max(0,Math.ceil((state.careReadyAt-performance.now())/1000))
  useEffect(()=>{
    if(state.careReadyAt<=performance.now()) return
    const timer=window.setInterval(()=>{
      tick(n=>n+1)
      if(performance.now()>=state.careReadyAt) window.clearInterval(timer)
    },150)
    return ()=>window.clearInterval(timer)
  },[state.careReadyAt])
  const careDisabled=busy || wait>0
  const countdown=wait ? ' · '+wait+' s' : ''
  const [loveOpen,setLoveOpen]=useState(false)
  const [clicker,setClicker]=useState(false)
  const [galleryOpen,setGalleryOpen]=useState(false),[collapsed,setCollapsed]=useState(false)
  const surface=clicker?'clicker':'character'
  const [tapCount,setTapCount]=useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  const [motion,setMotion] = useState<{pose:Motion; key:number}>({pose:'idle',key:0})
  const [nickname,setNickname] = useState(p?.nickname || '')
  useEffect(()=>{ dialog.current?.showModal() },[])
  const model=p?.model
  useEffect(()=>{
    if(!model)return
    for(const pose of ['feed','pat','company','hop'] as const){
      const image=new Image()
      image.src=art(model,artStyle,pose)
    }
  },[model,artStyle])
  useEffect(()=>{
    if (motion.pose === 'idle') return
    const timer=setTimeout(()=>setMotion(m=>({...m,pose:'idle'})),1300)
    return ()=>clearTimeout(timer)
  },[motion])
  async function care(action:'feed'|'pat'|'company') {
    if (!careDisabled && await act(action)) setMotion(m=>({pose:action,key:m.key+1}))
  }
  const pose = p?.asleep ? 'sleep' : motion.pose
  useEffect(()=>{
    if(!tapCount)return
    const timer=window.setTimeout(()=>setTapCount(0),520)
    return ()=>window.clearTimeout(timer)
  },[tapCount])
  const requestedCare = p?.mood ? 'pat' : p?.food ? 'feed' : p?.company ? 'company' : null
  const counter = kind === 'Jours ensemble' && p
  const room = !!p && !counter
  const hour=new Date().getHours()
  const phase=p?.asleep?'night':hour>=7 && hour<18?'day':'dusk'
  return <dialog style={palette.style} className={'petDialog'+(room?' roomDialog':'')} data-phase={room?phase:undefined} data-art={artStyle} data-model={p?.model} ref={dialog} onClose={close} aria-label={kind}>
    {room&&!galleryOpen&&<GameBackdrop value={game.wallet?.gallery?.[surface]}/>}
    <header><h2>{room && <small>{clicker?'Clicker':'Character'} · {phase==='day'?'Jour':phase==='dusk'?'Soir':'Nuit'}</small>}{counter ? kind : p ? p.nickname || p.model : 'Choisis ton personnage'}{room && p && <span className="roomStatus">{label(p)}</span>}</h2>
      <div className="gameHeaderActions"><button aria-label="Paramètres du jeu" title="Paramètres du jeu" aria-expanded={settings} onClick={()=>setSettings(!settings)}><Settings2 size={19}/></button>
      <button onClick={()=>dialog.current?.close()} aria-label="Fermer le personnage"><X size={20}/></button></div></header>
    {settings && <section className="gameSettings"><label>Style du personnage
        <select value={artStyle} onChange={e=>changeStyle(e.target.value==='anime'?'anime':'pixel')}>
          <option value="pixel">Pixel art</option><option value="anime">Anime</option>
        </select></label>
      {state.temporaryStyle&&<small>Style appliqué pour cette session.</small>}
      <label>Couleur des boutons<input type="color" value={palette.color} onChange={e=>palette.change(e.target.value)}/></label>
      {p && <form onSubmit={async e=>{e.preventDefault(); await act('rename',nickname.trim())}}>
        <label>Surnom du personnage<input value={nickname} onChange={e=>setNickname(e.target.value)} maxLength={28} placeholder={p.model}/></label>
        <button className="primary" type="submit" disabled={busy}>Enregistrer</button></form>}
      {palette.temporary&&<small>Couleur appliquée pour cette session.</small>}</section>}
    {error && <p role="alert">{error} <button onClick={()=>act()}>Réessayer</button></p>}
    {p === undefined ? <p>Ouverture…</p> : !p ? <><label>Surnom facultatif<input value={nickname} onChange={e=>setNickname(e.target.value)} maxLength={28}/></label><div className="petChoices">{models.map(model=>
      <button key={model} disabled={busy} onClick={async ()=>{if (await act('adopt',model) && nickname.trim()) await act('rename',nickname.trim())}}><img src={art(model,artStyle)} alt=""/>{model}</button>
    )}</div></> : counter ? <section className="petStats"><Flame/><h3>{p.streak} jour{p.streak>1?'s':''} de suite</h3><Week pet={p}/>
      <p>{p.days.includes(p.today) ? 'Le soin du jour est terminé.' : 'Termine un repas ou une séance de caresses pour valider la journée.'}</p>
      <p>Record · {p.best}　 ♥ {p.affection}</p></section> : <>
      <div className="roomPicker" role="group" aria-label="Activité">
        <button type="button" aria-pressed={!clicker&&!galleryOpen} onClick={()=>{setClicker(false);setGalleryOpen(false)}}><Heart size={16}/>Character</button>
        <button type="button" aria-pressed={clicker&&!galleryOpen} onClick={()=>{setClicker(true);setGalleryOpen(false)}}><MousePointerClick size={16}/>Clicker</button>
        <button type="button" aria-pressed={galleryOpen} onClick={()=>setGalleryOpen(!galleryOpen)}><Images size={16}/>Fonds</button>
      </div>
      {galleryOpen ? <BackgroundGallery key={surface} surface={surface} game={game} done={()=>setGalleryOpen(false)}/> : <>
      <div className={'petStage'+(clicker?' clickStage':'')}>
        {clicker && <><button className="petFigure" aria-label="Gagner un cœur" onClick={()=>{if(game.tap())setTapCount(n=>n+1)}}>
          <img key={tapCount} className={tapCount?'pose-hop':''} src={art(p.model,artStyle,tapCount?'hop':'idle')} alt={p.model}/>
        </button>{tapCount>0&&<b key={tapCount} className="tapPoint">+1 ♥</b>}</>}
        {!clicker && (p.asleep ? <img className="sleepingFigure pose-sleep" src={art(p.model,artStyle,'sleep')} alt={p.model+' dort.'}/> :
          <button className="petFigure" disabled={busy || (!!requestedCare && wait>0)} aria-label={requestedCare ? {pat:'Caresser le personnage',feed:'Nourrir le personnage',company:'Tenir compagnie au personnage'}[requestedCare] : 'Saluer le personnage'} onClick={()=>{
            if(requestedCare)void care(requestedCare);else setMotion(m=>({pose:'hop',key:m.key+1}))
          }}>
            <img key={motion.key+'-'+pose} className={'pose-'+pose} src={art(p.model,artStyle,pose)} alt={p.model}/>
          </button>)}
        {!clicker && pose==='feed' && <Utensils key={motion.key} className="petEffect"/>}
        {!clicker && (pose==='pat'||pose==='company') && <Heart key={motion.key} className="petEffect"/>}
      </div>
      <div className="roomPanel" data-collapsed={!clicker&&collapsed}>
        {clicker ? <><p className="clickScore"><Hearts amount={game.points}/></p>{game.error&&<p role="alert">{game.error} <button onClick={game.refresh}>Réessayer</button></p>}</> : <>
        <div className="careTools">
        <button className="loveEntry" onClick={()=>setLoveOpen(true)}><Heart size={16}/> Love Meter</button>
        <button className="careToggle" aria-expanded={!collapsed} aria-controls="careDetails" onClick={()=>setCollapsed(!collapsed)}>
          {collapsed?<ChevronUp size={18}/>:<ChevronDown size={18}/>} {collapsed?'Afficher les soins':'Replier les soins'}
        </button></div>
        <div id="careDetails" hidden={collapsed}><div className="petNeeds">{(['feed','pat'] as const).map(action=>{
        const food=action==='feed', remaining=food?p.food:p.mood
        const status = remaining ? (food?'A faim':'À réconforter') : (food?'Rassasiée':'Contente')
        const Icon=food?Utensils:Heart
        return <div key={action} className="needCard"><label><span className="needTitle"><Icon size={15}/>{food?'Repas':'Moral'}</span>
          <progress max={4} value={4-remaining}/></label>
          {p.asleep || !remaining ? <small>{status}</small> :
            <button disabled={careDisabled} onClick={()=>care(action)}>{food?'Donner une bouchée':'Caresser'}{countdown}</button>}</div>
      })}</div>
      {!p.asleep && !!p.company && <button disabled={careDisabled} onClick={()=>care('company')}><Hand size={16}/> Passer un moment ensemble{countdown}</button>}
      {pose==='company' && <p role="status">{{Nonna:'Nonna t’adresse un petit sourire.',Rias:'Rias se rapproche de toi.',Tsunade:'Tsunade te fait un clin d’œil.'}[p.model]}</p>}
      <div className="careFoot"><span><Heart size={13}/> Affection · {p.affection}</span>
        {p.asleep && <span><Sunrise size={15}/> Réveil à 7 h</span>}</div></div></>}
      </div></>}
    </>}
    {loveOpen && p && <LoveMeter key={p.model} model={p.model} artStyle={artStyle} close={()=>setLoveOpen(false)}/>}
  </dialog>
}
