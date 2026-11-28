import {useCallback,useEffect,useRef,useState,type CSSProperties} from 'react'
import {CirclePlay,Heart,Dices,X} from 'lucide-react'
import {db,message} from './core'
import {Rarity,cover} from './AsmrCollection'
import videos from './roulette-videos.json'

import type {Gallery,GameSurface} from './Wallpaper'

export function Hearts({amount}:{amount:number}){
  return <span className="hearts" role="img" aria-label={amount+(amount===1?' cœur':' cœurs')}>{amount} <Heart aria-hidden="true" size={15} fill="currentColor"/></span>
}
type Wallet={gallery:Gallery;points:number;version:number;video:string|null;price:number}
type Video=typeof videos[number]
async function walletCall(action:string,request_id?:string,taps?:number){
  const {data,error}=await db.rpc('circle_game',{action,request_id,taps})
  if(error||!data)throw Error(error?.message||'Solde indisponible.')
  return data as Wallet
}
export function useCircleGame(userId:string){
  const prefix='yotei-taps-'+userId+'-'
  const [stream]=useState(()=>crypto.randomUUID())
  const total=useRef(0),timer=useRef(0),sending=useRef<Promise<void>|null>(null)
  const [wallet,setWallet]=useState<Wallet|null>(null),[error,setError]=useState(''),[uncredited,setUncredited]=useState(0)
  const credited=useRef(0)
  const receive=useCallback((value:Wallet)=>setWallet(old=>old&&old.version>value.version?old:value),[])
  const sync=useCallback(async()=>{
    if(sending.current)return sending.current
    const work=async()=>{
      const keys=new Set(Object.keys(localStorage).filter(key=>key.startsWith(prefix)))
      if(total.current>credited.current)keys.add(prefix+stream)
      for(const key of keys){
        const count=key===prefix+stream?total.current:Number(localStorage.getItem(key))
        if(!Number.isSafeInteger(count)||count<=0)continue
        const value=await walletCall('tap',key.slice(prefix.length),count)
        receive(value)
        if(key===prefix+stream){credited.current=count;setUncredited(total.current-count)}
        if(Number(localStorage.getItem(key))===count)localStorage.removeItem(key)
      }
    }
    sending.current=work()
    try{await sending.current}finally{sending.current=null}
  },[prefix,receive,stream])
  const refresh=useCallback(async()=>{
    try{await sync(); if(total.current>credited.current)await sync(); receive(await walletCall('read'));setError('')}catch(e){setError(message(e))}
  },[sync,receive])
  useEffect(()=>{
    void refresh()
    const visible=()=>{if(!document.hidden)void refresh()}
    window.addEventListener('online',visible);document.addEventListener('visibilitychange',visible)
    return ()=>{clearTimeout(timer.current);window.removeEventListener('online',visible);document.removeEventListener('visibilitychange',visible)}
  },[refresh])
  function tap(){
    const count=total.current+1
    try{localStorage.setItem(prefix+stream,String(count))}catch{setError('Enregistrement impossible sur cet appareil.');return false}
    total.current=count;setUncredited(count-credited.current)
    if(!timer.current)timer.current=window.setTimeout(()=>{timer.current=0;void refresh()},350)
    return true
  }
  async function spin(){
    await sync()
    if(total.current>credited.current)await sync()
    const key='yotei-spin-'+userId
    let request=sessionStorage.getItem(key)
    if(!request){request=crypto.randomUUID();sessionStorage.setItem(key,request)}
    const result=await walletCall('spin',request)
    sessionStorage.removeItem(key);receive(result);setError('')
    return result.video
  }
  async function chooseBackground(surface:GameSurface,motif:string,palette:number,purchase:boolean){
    await sync()
    if(total.current>credited.current)await sync()
    const {data,error}=await db.rpc('choose_companion_background',{surface,motif,palette,purchase})
    if(error||!data)throw Error(error?.message||'Enregistrement du fond impossible.')
    receive(data as Wallet)
  }
  return {chooseBackground,wallet,points:(wallet?.points??0)+uncredited,error,refresh,tap,spin}
}
export type Game=ReturnType<typeof useCircleGame>
function shuffle(){
  const cards=videos.filter(video=>!video.archived)
  for(let n=cards.length-1;n>0;n--){const i=Math.floor(Math.random()*(n+1));[cards[n],cards[i]]=[cards[i],cards[n]]}
  return cards
}
const previewSides = ['DG2DiSWjJyA','_k9T0PBwkpQ'].map(id => videos.find(video => video.id===id)!)
export function RouletteShortcut({points,open}:{points:number;open:()=>void}){
  function side(video:Video){
    return <span className="previewSide" data-rarity={video.rarity}>
      <img src={cover(video.id)} alt="" loading="lazy"/><Rarity value={video.rarity}/>
    </span>
  }
  return <button className="widgetLink rouletteTile" onClick={open}>
    <span className="rouletteHeading"><strong>Roulette ASMR</strong><Hearts amount={points}/></span>
    <span className="previewReel" aria-hidden="true">
      {side(previewSides[0])}
      <span className="previewMystery" data-rarity="Légendaire">
        <b>?</b><Rarity value="Légendaire"/><em>Mommy ASMR…</em>
      </span>
      {side(previewSides[1])}
    </span>
  </button>
}
export function Roulette({game,close}:{game:Game;close:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),lock=useRef(false),timer=useRef(0)
  const [cards,setCards]=useState(shuffle),[run,setRun]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const price=game.wallet?.price
  const winner=videos.find(v=>v.id===game.wallet?.video)
  useEffect(()=>{dialog.current?.showModal();return ()=>clearTimeout(timer.current)},[])
  async function draw(){
    if(lock.current)return
    lock.current=true;setBusy(true);setError('')
    try{
      const id=await game.spin(),won=videos.find(v=>v.id===id)
      if(!won)throw Error('Recharge Yotei pour afficher cette nouvelle vidéo.')
      setCards([...shuffle().slice(0,12),won,...shuffle().slice(0,2)]);setRun(n=>n+1)
      const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches
      timer.current=window.setTimeout(()=>{lock.current=false;setBusy(false)},reduced?0:2500)
    }catch(e){lock.current=false;setBusy(false);setError(message(e))}
  }
  function card(v:Video,i:number){return <div className="videoCard" key={i}><img src={cover(v.id)} alt=""/><small><Rarity value={v.rarity}/> · {v.language}</small><strong>{v.title}</strong></div>}
  return <dialog className="rouletteDialog" ref={dialog} onClose={close} aria-label="Roulette ASMR">
    <header><h2>Roulette ASMR</h2><button aria-label="Fermer la roulette" onClick={()=>dialog.current?.close()}><X/></button></header>
    <div className="reel"><div key={run} className={'reelTrack'+(run?' spinning':'')} style={{'--stop':'-2346px'} as CSSProperties}>{cards.map(card)}</div><i/></div>
    <details className="rarityGuide"><summary>Comment fonctionne la rareté ?</summary><p>Rare pour une scène du quotidien, Épique pour une séance qui combine plusieurs soins ou sons, Légendaire pour un univers fantastique ou un duo de voix. Chaque vidéo garde sa rareté.</p><p>Parmi les vidéos restantes, une carte Rare a six fois et une Épique trois fois le poids d’une Légendaire. Tu découvres toute la sélection avant de retrouver des doublons.</p></details>
    <div className="drawControls"><Hearts amount={game.points}/><button className="primary" disabled={price===undefined||busy||game.points<price} onClick={draw}><Dices size={18}/> {busy?'Tirage…':<>Tourner{price!==undefined&&<> · <Hearts amount={price}/></>}</>}</button></div>
    {price!==undefined&&game.points<price&&<p>Gagne encore <Hearts amount={price-game.points}/> dans le clicker.</p>}
    {(error||game.error)&&<p role="alert">{error||game.error} <button onClick={game.refresh}>Actualiser</button></p>}
    {!busy&&winner&&<div className="rouletteWin" aria-live="polite"><small>Ton tirage · {winner.language} · <Rarity value={winner.rarity}/></small><h3>{winner.title}</h3><a href={'https://www.youtube.com/watch?v='+winner.id} target="_blank" rel="noopener noreferrer"><CirclePlay size={18}/> Voir la vidéo</a></div>}
  </dialog>
}
