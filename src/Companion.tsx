import { useEffect, useRef, useState } from 'react'
import { Cookie, Heart, Moon, X, Flame } from 'lucide-react'
import { base, db, message } from './core'
import './companion.css'

const models = ['Nonna', 'Rias', 'Tsunade'] as const
type Model = typeof models[number]
type Action = 'read' | 'adopt' | 'rename' | 'feed' | 'pat'
type Pet = {
  model: Model; nickname: string; food: number; mood: number; asleep: boolean
  streak: number; best: number; affection: number; today: string; days: string[]; version: number
}
type Pose = 'idle' | 'feed' | 'pat' | 'sleep'
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
  if (kind === 'Jours ensemble') return <button className="widgetLink petCounter" onClick={open}>
    <Flame/><small>Jours ensemble</small><strong>{p?.streak ?? 0} jour{(p?.streak ?? 0)>1?'s':''}</strong>
    <small>{p ? 'Record · '+p.best : 'Première série à venir'}</small>{wide && p && <Week pet={p}/>}
  </button>
  return <button className="widgetLink petShortcut" onClick={open} aria-label="Mon personnage">
    <small>Mon personnage</small><strong>{p ? p.nickname || p.model : 'Choisir'}</strong>
    {p && <><small>{label(p)}</small><img src={art(p.model,p.asleep?'sleep':'idle')} alt=""/></>}
  </button>
}
export function CompanionDialog({kind,state,close,wallpaper}:{kind:PetTile;state:State;close:()=>void;wallpaper?:string}) {
  const {pet:p,act,busy,error} = state
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
  return <dialog className="petDialog" ref={dialog} onClose={close} aria-label={kind}>
    <header><h2>{counter ? kind : p ? p.nickname || p.model : 'Choisis ton personnage'}</h2>
      <button onClick={()=>dialog.current?.close()} aria-label="Fermer le personnage"><X/></button></header>
    {error && <p role="alert">{error} <button onClick={()=>act()}>Réessayer</button></p>}
    {p === undefined ? <p>Ouverture…</p> : !p ? <><label>Surnom facultatif<input value={nickname} onChange={e=>setNickname(e.target.value)} maxLength={28}/></label><div className="petChoices">{models.map(model=>
      <button key={model} disabled={busy} onClick={async ()=>{if (await act('adopt',model) && nickname.trim()) await act('rename',nickname.trim())}}><img src={art(model)} alt=""/>{model}</button>
    )}</div></> : counter ? <section className="petStats"><Flame/><h3>{p.streak} jour{p.streak>1?'s':''} de suite</h3><Week pet={p}/>
      <p>{p.days.includes(p.today) ? 'Le soin du jour est terminé.' : 'Termine un repas ou une séance de caresses pour valider la journée.'}</p>
      <p>Record · {p.best}　 ♥ {p.affection}</p></section> : <>
      <div className="petStage" style={wallpaper?{backgroundImage:'url('+wallpaper+')'}:undefined}>
        <span className="petBadge">{label(p)}</span>
        <button className="petFigure" disabled={p.asleep || !p.mood || busy} aria-label="Caresser le personnage" onClick={()=>care('pat')}>
          <img key={motion.key+'-'+pose} className={'pose-'+pose} src={art(p.model,pose)} alt={p.model}/>
        </button>
        {pose==='pat' && <Heart key={motion.key} className="petEffect"/>}
        {p.asleep && <Moon className="petMoon"/>}
      </div>
      <div className="petNeeds">{(['feed','pat'] as const).map(action=>{
        const food=action==='feed', remaining=food?p.food:p.mood
        return <div key={action}><label>{food?'Repas':'Moral'}<progress max={5} value={5-remaining}/></label>
          <button disabled={busy || p.asleep || !remaining} onClick={()=>care(action)}>{food?<Cookie size={18}/>:<Heart size={18}/>}
          {remaining ? food?'Donner une bouchée':'Caresser' : food?'Rassasiée':'Contente'}</button></div>
      })}</div>
      <p className="petAffection">{p.asleep?'Réveil à 7 h · ':''}♥ {p.affection} · Affection</p>
      <details><summary>Surnom</summary><form onSubmit={async e=>{e.preventDefault(); await act('rename',nickname.trim())}}>
        <label>Surnom du personnage<input value={nickname} onChange={e=>setNickname(e.target.value)} maxLength={28} placeholder={p.model}/></label>
        <button disabled={busy}>Enregistrer</button></form></details>
    </>}
  </dialog>
}
