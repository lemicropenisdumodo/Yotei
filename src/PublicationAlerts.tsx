import {useEffect,useState} from 'react'
import {db,message} from './core'
const supported=()=> 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
async function invoke(body:unknown){
  const {data,error}=await db.functions.invoke('publication-alerts',{body:body as Record<string,unknown>})
  if(error)throw Error('Connexion aux notifications impossible. Réessaie dans quelques instants.')
  return data
}
const ownerKey='yotei-push-owner'
export async function disablePush(id:string){
  if(!supported()||localStorage.getItem(ownerKey)!==id)return
  const reg=await navigator.serviceWorker.getRegistration(),sub=await reg?.pushManager.getSubscription()
  if(sub){
    try{await invoke({action:'remove',subscription:{endpoint:sub.endpoint}})}
    finally{await sub.unsubscribe();localStorage.removeItem(ownerKey)}
  }else localStorage.removeItem(ownerKey)
}
export function PublicationAlerts({userId}:{userId:string}){
  const [active,setActive]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
  useEffect(()=>{
    if(supported())navigator.serviceWorker.getRegistration().then(r=>r?.pushManager.getSubscription()).then(s=>setActive(!!s&&localStorage.getItem(ownerKey)===userId)).catch(()=>{})
  },[userId])
  async function toggle(){
    setBusy(true);setError('')
    try{
      if(active){await disablePush(userId);setActive(false);return}
      if(await Notification.requestPermission()!=='granted')throw Error('Autorise les notifications de Yotei dans les réglages de ton navigateur.')
      const reg=await navigator.serviceWorker.ready, {publicKey}=await invoke({action:'key'})
      const key=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')),s=>s.charCodeAt(0))
      const sub=(await reg.pushManager.getSubscription())||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key})
      await invoke({action:'subscribe',subscription:sub.toJSON()})
      localStorage.setItem(ownerKey,userId);setActive(true)
    }catch(e){setError(message(e))}finally{setBusy(false)}
  }
  return <details><summary>Notifications</summary><p>Une alerte quand un ami publie une recommandation.</p>
    {supported()?<button disabled={busy} aria-pressed={active} onClick={toggle}>{active?'Désactiver':'Activer'} sur cet appareil</button>:<p>Sur iPhone, ouvre Yotei depuis l’écran d’accueil. Sur Android, utilise un navigateur compatible avec les notifications.</p>}
    {error&&<p role="alert">{error}</p>}</details>
}
