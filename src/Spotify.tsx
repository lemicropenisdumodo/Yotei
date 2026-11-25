import { useEffect, useRef, useState } from 'react'
import { Music2, Play, Pause, SkipBack, SkipForward, X } from 'lucide-react'
import { db, message, site } from './core'

type Track={title:string;artist:string;image:string;url:string}
type Player={progress?:number;duration?:number;received?:number;configured?:boolean;clientId?:string;connected?:boolean;sharing?:boolean;track?:Track|null;playing?:boolean;error?:string;retry?:number}
const redirect=new URL('spotify-callback.html',site).href
const pendingKey='yotei-spotify-authorization'
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')
async function call(body:Record<string,unknown>):Promise<Player>{
  const {data,error}=await db.functions.invoke('spotify',{body})
  if(error){
    const info=await error.context?.json?.().catch(()=>null)
    throw Error(info?.error||'Impossible de joindre Spotify. Réessaie dans un instant.')
  }
  return data||{}
}
async function authorize(id:string,clientId:string,share:boolean){
  const verifier=b64(crypto.getRandomValues(new Uint8Array(48)))
  const state=crypto.randomUUID()
  const challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))
  sessionStorage.setItem(pendingKey,JSON.stringify({verifier,state,id,share,time:Date.now()}))
  location.assign('https://accounts.spotify.com/authorize?'+new URLSearchParams({
    response_type:'code',client_id:clientId,redirect_uri:redirect,state,code_challenge_method:'S256',code_challenge:challenge,
    scope:'user-read-playback-state user-modify-playback-state',show_dialog:'true',
  }))
}
export function useSpotify(id:string,visible:boolean){
  const [player,setPlayer]=useState<Player>({}),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[revision,bump]=useState(0)
  const locked=useRef(false),retryAt=useRef(0)
  async function action(fn:()=>Promise<void>){
    if(locked.current)return
    locked.current=true;setBusy(true);setNotice('')
    try{await fn()}catch(e){setNotice(message(e))}
    finally{locked.current=false;setBusy(false);bump(n=>n+1)}
  }
  useEffect(()=>{
    const address=new URL(location.href)
    if(!address.searchParams.has('spotify_state')&&!address.searchParams.has('spotify_error'))return
    const params=new URLSearchParams(address.search)
    for(const key of ['spotify_state','spotify_code','spotify_error'])address.searchParams.delete(key)
    history.replaceState(history.state,'',address)
    void action(async()=>{
      const pending=JSON.parse(sessionStorage.getItem(pendingKey)||'null')
      sessionStorage.removeItem(pendingKey)
      if(params.get('spotify_error'))throw Error('Connexion Spotify annulée.')
      if(!pending||pending.id!==id||pending.state!==params.get('spotify_state')||Date.now()-pending.time>600000||!params.get('spotify_code'))throw Error('Connexion expirée. Recommence depuis ce widget.')
      const result=await call({action:'connect',code:params.get('spotify_code'),verifier:pending.verifier,share:pending.share})
      if(result.configured===false)throw Error('Configure d’abord l’application Spotify.')
    })
  },[id])
  useEffect(()=>{
    if(!visible || busy)return
    let active=true,timer:ReturnType<typeof setTimeout>,reading=false
    async function update(){
      if(document.hidden||!active||reading)return
      clearTimeout(timer)
      if(Date.now()<retryAt.current){timer=setTimeout(update,retryAt.current-Date.now());return}
      reading=true
      let again=true
      try{
        const data=await call({action:'read'})
        if(active){setPlayer({...data,received:Date.now()});again=data.connected!==false && data.configured!==false
          if(data.retry)retryAt.current=Date.now()+data.retry*1000}
      }catch(e){if(active)setPlayer({error:message(e)})}
      finally{reading=false;if(active&&again)timer=setTimeout(update,Math.max(15000,retryAt.current-Date.now()))}
    }
    void update();document.addEventListener('visibilitychange',update)
    return ()=>{active=false;clearTimeout(timer);document.removeEventListener('visibilitychange',update)}
  },[visible,busy,revision,id])
  function command(name:string,position?:number){
    return action(async()=>{
      if(Date.now()<retryAt.current)throw Error('Réessaie après la pause demandée par Spotify.')
      const data=await call({action:name,position})
      if(data.retry)retryAt.current=Date.now()+data.retry*1000
      if(data.error)throw Error(data.error)
      await new Promise(resolve=>setTimeout(resolve,400))
    })
  }
  function setSharing(share:boolean){
    return action(async()=>{
      const previous=player.sharing
      setPlayer(p=>({...p,sharing:share}))
      try{await call({action:'sharing',share})}
      catch(e){setPlayer(p=>({...p,sharing:previous}));throw e}
    })
  }
  return {player,notice,busy,action,command,setSharing,connect:(share:boolean)=>action(()=>authorize(id,player.clientId!,share))}
}
type Controls=ReturnType<typeof useSpotify>
function Buttons({control}:{control:Controls}){
  const {player,busy,command}=control
  return <div className="playButtons">
    <button disabled={busy} aria-label="Morceau précédent" onClick={()=>command('previous')}><SkipBack/></button>
    <button disabled={busy} aria-label={player.playing?'Pause':'Reprendre'} onClick={()=>command(player.playing?'pause':'play')}>{player.playing?<Pause/>:<Play/>}</button>
    <button disabled={busy} aria-label="Morceau suivant" onClick={()=>command('next')}><SkipForward/></button>
  </div>
}
export function SpotifyTile({control,open}:{control:Controls;open:()=>void}){
  const {player,notice}=control
  return <div className="liveMusic">{player.track?.image?<img alt="" src={player.track.image}/>:<div className="recordSleeve"><span className="vinyl"/><Music2/></div>}
    <button className="musicDetails" aria-label="Ouvrir Spotify" onClick={open}><small>Spotify ↗</small><strong>{player.track?.title||(player.connected?'Aucune lecture':'Connecter mon compte')}</strong>
    <small>{notice||player.error||player.track?.artist}</small></button>
    {player.connected && <Buttons control={control}/>}</div>
}
function Timeline({control}:{control:Controls}){
  const {player}=control
  const [now,setNow]=useState(Date.now),[draft,setDraft]=useState<number|null>(null)
  useEffect(()=>{
    if(!player.playing)return
    const timer=setInterval(()=>setNow(Date.now()),500)
    return ()=>clearInterval(timer)
  },[player.playing])
  const duration=player.duration||0
  if(!duration)return null
  const elapsed=player.playing&&player.received?Math.max(0,now-player.received):0
  const position=draft??Math.min(duration,(player.progress||0)+elapsed)
  const time=(ms:number)=>Math.floor(ms/60000)+':'+String(Math.floor(ms/1000)%60).padStart(2,'0')
  function commit(){if(draft!==null){void control.command('seek',Math.min(duration-1,draft));setDraft(null)}}
  return <div className="musicTimeline"><input type="range" aria-label="Position dans le morceau" aria-valuetext={time(position)} min={0} max={duration} step={1000} value={position}
    disabled={control.busy} onChange={e=>setDraft(Number(e.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} onPointerCancel={()=>setDraft(null)}/>
    <div><time>{time(position)}</time><time>{time(duration)}</time></div></div>
}
export function SpotifyPage({control,admin,close}:{control:Controls;admin:boolean;close:()=>void}){
  const {player,action,busy,notice}=control
  const dialog=useRef<HTMLDialogElement>(null)
  useEffect(()=>{const el=dialog.current;el?.showModal();return ()=>el?.close()},[])
  const track=player.track
  return <dialog ref={dialog} className="musicDialog" aria-label="Lecteur Spotify" onCancel={e=>{e.preventDefault();close()}}>
    {track?.image && <img className="musicGlow" src={track.image} alt=""/>}
    <div className="musicSheet"><header><button aria-label="Fermer et revenir à l’accueil" onClick={close}><X/></button></header>
    {!track && <h1>Spotify</h1>}
    {player.configured===false && (admin?<form onSubmit={e=>{
      e.preventDefault();const appId=new FormData(e.currentTarget).get('client')
      void action(async()=>{const {error}=await db.rpc('spotify_configure',{app_id:appId});if(error)throw Error('Impossible d’enregistrer cet identifiant.')})
    }}><h2>Activer Spotify pour le cercle</h2><ol><li>Ouvre le <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">tableau de bord Spotify</a> avec ton compte Premium. Choisis « Create app », nomme-la Yotei et coche « Web API ». Tu peux décrire Yotei comme « Écoute musicale entre amis ».</li>
    <li>Dans « Redirect URIs », colle cette adresse exacte.<input aria-label="Adresse de retour Spotify" readOnly onFocus={e=>e.target.select()} value={redirect}/></li>
    <li>Enregistre l’application. Dans « Settings », copie le « Client ID » dans le champ ci-dessous. Dans « User Management », ajoute le nom et l’adresse du compte Spotify de chaque ami.</li></ol>
    <label>Client ID public<input name="client" required pattern="[a-fA-F0-9]{32}" autoComplete="off"/></label><button disabled={busy}>Activer Spotify</button></form>:<p>L’administrateur doit d’abord activer Spotify pour le cercle.</p>)}
    {player.clientId&&!player.connected && <button disabled={busy} onClick={()=>control.connect(false)}>Connecter mon compte Spotify</button>}
    {player.connected && <>{track?<div className="musicHero">{track.image&&<a href={track.url} target="_blank" rel="noreferrer"><img alt={'Pochette de '+track.title} src={track.image}/></a>}
      <h2>{track.title}</h2><p>{track.artist}</p><Timeline key={track.url} control={control}/></div>:<p>Ouvre Spotify et lance un morceau sur ton appareil.</p>}
      <Buttons control={control}/></>}
    {(notice||player.error)&&<p role="status">{notice||player.error}</p>}
    {player.configured===undefined&&!player.error&&<p>Chargement de Spotify…</p>}
  </div></dialog>
}
export function SpotifySharing({control}:{control:Controls}){
  const {player,busy,notice,setSharing}=control
  if(!player.connected)return null
  return <section>{player.sharing&&player.playing&&player.track&&<><h3>Écoute en ce moment</h3><TrackLine track={player.track}/></>}
    <label className="inline"><input type="checkbox" disabled={busy} checked={!!player.sharing} onChange={e=>{
      void setSharing(e.target.checked)
    }}/> Afficher mon écoute sur mon profil</label>{notice&&<p role="status">{notice}</p>}</section>
}
export function SpotifyConnection({control,open}:{control:Controls;open:()=>void}){
  const {player,busy,notice,action}=control
  return <div><strong>Spotify</strong>{player.connected
    ? <button disabled={busy} onClick={()=>action(async()=>{await call({action:'disconnect'})})}>Déconnecter Spotify</button>
    : <button onClick={open}>Ouvrir Spotify</button>}{notice&&<p role="status">{notice}</p>}</div>
}
function TrackLine({track}:{track:Track}){
  return <a className="spotifyTrack" href={track.url} target="_blank" rel="noreferrer">{track.image&&<img src={track.image} alt=""/>}<span><small>Spotify</small><strong>{track.title}</strong>{track.artist}</span></a>
}
export function ProfileListening({id}:{id:string}){
  const [track,setTrack]=useState<Track|null>(null)
  useEffect(()=>{
    let active=true,timer:ReturnType<typeof setTimeout>
    async function poll(){
      let delay=20000
      if(!document.hidden)try{const data=await call({action:'read',target:id})
        if(active)setTrack(data.playing && data.sharing!==false?data.track||null:null)
        if(data.retry)delay=Math.max(delay,data.retry*1000)
      }catch{if(active)setTrack(null)}
      if(active)timer=setTimeout(poll,delay)
    }
    void poll();return ()=>{active=false;clearTimeout(timer)}
  },[id])
  return track?<div><h3>Écoute en ce moment</h3><TrackLine track={track}/></div>:null
}
