import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { db, Task } from './core'

type Status = { enabled:boolean; owner:boolean }
const Gate = createContext({enabled:false, owner:false, refresh:()=>{}})
export function MaintenanceControl() {
  const {enabled,owner,refresh} = useContext(Gate)
  return owner ? <section className="window">
    <h2>Maintenance</h2>
    <p>{enabled ? 'Le site est fermé au cercle. Ton compte garde accès à Yotei.' : 'Le site est ouvert aux membres du cercle.'}</p>
    <Task run={async()=>{
      const {error} = await db.rpc('set_maintenance',{requested:!enabled})
      if (error) throw new Error(error.message)
      refresh()
    }}>{enabled ? 'Rouvrir le site' : 'Activer la maintenance'}</Task>
  </section> : null
}
export function MaintenanceGate({signedIn,children}:{signedIn:boolean;children:ReactNode}) {
  const [status,setStatus] = useState<Status>()
  const [login,setLogin] = useState(false)
  const [failed,setFailed] = useState(false)
  const [revision,bump] = useState(0)
  const refresh = ()=>bump(v=>v+1)
  useEffect(()=>{
    let active=true
    let sequence=0
    const check=async()=>{
      const request=++sequence
      const {data,error}=await db.rpc('maintenance_status')
      if (!active || sequence!==request) return
      const valid=!error && typeof data?.enabled==='boolean' && typeof data?.owner==='boolean'
      setStatus(valid ? data : undefined)
      setFailed(!valid)
    }
    const visible=()=>{if(!document.hidden) void check()}
    void check()
    const timer=setInterval(visible,10000)
    document.addEventListener('visibilitychange',visible)
    window.addEventListener('online',visible)
    return ()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',visible)}
  },[revision])
  if (!status) return <main className="narrow"><h1>Yotei</h1><p role="status">{failed?'Impossible de vérifier l’accès.':'Ouverture de Yotei…'}</p>{failed && <button onClick={refresh}>Réessayer</button>}</main>
  if (status.enabled && !status.owner && (signedIn || !login)) return <main className="narrow"><section className="window">
    <div className="wordmark">Yotei.</div><h1>Maintenance en cours</h1><p>Le cercle rouvrira après la mise à jour.</p>
    {signedIn ? <Task run={async()=>{const {error}=await db.auth.signOut({scope:'local'});if(error) throw error}}>Se déconnecter</Task> :
      <button onClick={()=>setLogin(true)}>Connexion du propriétaire</button>}
  </section></main>
  return <Gate.Provider value={{...status,refresh}}>{children}</Gate.Provider>
}
