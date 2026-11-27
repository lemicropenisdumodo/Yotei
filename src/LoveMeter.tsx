import {useEffect,useRef,useState} from 'react'
import {Heart,Pause,Play,Repeat2,RotateCcw,X} from 'lucide-react'
import {base} from './core'
import {loveCues,beatSeconds} from './loveMeterScore'
import './loveMeter.css'

const folder=base+'love-meter/'
const stops=[11,33,55,77]

export function LoveMeter({close}:{close:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null)
  const audio=useRef<HTMLAudioElement>(null)
  const stage=useRef<HTMLDivElement>(null)
  const [level,setLevel]=useState(0)
  const [ready,setReady]=useState(false)
  const [playing,setPlaying]=useState(false)
  const [ended,setEnded]=useState(false)
  const [loop,setLoop]=useState(false)
  const [error,setError]=useState('')

  useEffect(()=>{
    const player=audio.current!, scene=stage.current!, reduced=matchMedia('(prefers-reduced-motion: reduce)')
    let frame=0
    dialog.current?.showModal()
    let mounted=true
    const assets=[...loveCues.map(pose=>pose.image+'.webp'),'arc.png','heart.png','needle.png']
    Promise.all(assets.map(file=>{
      const image=new Image()
      image.src=folder+file
      return image.decode()
    })).then(()=>{if(mounted)setReady(true)}).catch(()=>{
      if(mounted)setError('Les images n’ont pas pu être chargées. Rouvre le Love Meter pour réessayer.')
    })
    function render(){
      const t=player.currentTime
      let n=0
      while(n+1<loveCues.length && t>=loveCues[n+1].at)n++
      setLevel(n)
      const age=t-loveCues[n].at
      const ease=n>0 && !reduced.matches && age<0.36
        ? 1-Math.exp(-15*age)*Math.cos(21*age) : 1
      const from=stops[Math.max(0,n-1)]
      scene.style.setProperty('--needle-angle',(from+(stops[n]-from)*ease)+'deg')
      const beat=reduced.matches||t===0||player.ended?0:Math.pow(1-(t%beatSeconds)/beatSeconds,3)
      scene.style.setProperty('--beat',String(beat))
      scene.style.setProperty('--progress',String(player.duration ? Math.min(1,t/player.duration):0))
    }
    function update(){render();if(!player.paused&&!player.ended)frame=requestAnimationFrame(update)}
    function start(){cancelAnimationFrame(frame);setPlaying(true);update()}
    function stop(){cancelAnimationFrame(frame);setPlaying(false);render()}
    function hide(){if(document.hidden)player.pause()}
    player.addEventListener('playing',start)
    player.addEventListener('pause',stop)
    player.addEventListener('timeupdate',render)
    player.addEventListener('seeked',render)
    document.addEventListener('visibilitychange',hide)
    render()
    return ()=>{
      mounted=false
      cancelAnimationFrame(frame)
      player.removeEventListener('playing',start);player.removeEventListener('pause',stop)
      player.removeEventListener('timeupdate',render);player.removeEventListener('seeked',render)
      document.removeEventListener('visibilitychange',hide);player.pause()
    }
  },[])
  async function play(restart=false){
    const player=audio.current
    if(!player)return
    setError('')
    if(restart||player.ended){player.currentTime=0;setLevel(0);setEnded(false)}
    try{await player.play()}catch(e){
      if(!(e instanceof DOMException && e.name==='AbortError'))setError('Lecture impossible. Réessaie de lancer l’extrait.')
    }
  }
  return <dialog ref={dialog} className="loveDialog" aria-labelledby="love-title" onClose={e=>{e.stopPropagation();close()}}>
    <div className="loveLayout">
      <header className="loveHeading"><div><small>Tsunade</small><h2 id="love-title">Love Meter</h2></div>
        <button type="button" autoFocus aria-label="Fermer le Love Meter" onClick={()=>dialog.current?.close()}><X/></button></header>
      <div ref={stage} className="loveScene" data-level={level} data-playing={playing}>
        <div className="lovePortraits">{loveCues.map((pose,i)=><img key={pose.image} src={folder+pose.image+'.webp'} alt={level===i?pose.description:''} data-visible={level===i}/>)}</div>
        <svg className="loveDial" viewBox="0 0 244 240" aria-hidden="true">
          <image href={folder+'arc.png'} x="12" y="37" width="169" height="182" preserveAspectRatio="none"/>
          <image className="loveCap" href={folder+'heart.png'} x="159" y="9" width="54" height="46"/>
          <g transform="translate(189 211)"><g className="loveNeedle"><image href={folder+'needle.png'} x="-141" y="-26" width="168" height="52.5" preserveAspectRatio="none"/></g></g>
        </svg>
        {level===3&&<div aria-hidden="true" className="loveSparkles">{[0,1,2,3,4].map(i=><Heart key={i} size={14+i*2} fill="currentColor"/>)}</div>}
        <div className="loveTrack" aria-hidden="true"/>
      </div>
      <footer className="loveFooter"><span>Son : She’s Homeless <small>Creep-P</small></span><div>
        {playing ? <button onClick={()=>audio.current?.pause()} aria-label="Pause"><Pause size={18}/></button>
        : <button disabled={!ready} onClick={()=>void play()}><Play size={17}/>{!ready?'Chargement…':ended?'Rejouer':'Lecture'}</button>}
        {!ended&&<button disabled={!ready} aria-label="Recommencer depuis le début" onClick={()=>void play(true)}><RotateCcw size={17}/></button>}
      </div></footer>
      <button type="button" className="loveLoop" aria-pressed={loop} onClick={()=>setLoop(value=>!value)}><Repeat2 size={17}/> En boucle</button>
      {error&&<p role="alert">{error}</p>}
      <audio ref={audio} loop={loop} src={folder+'shes-homeless.mp3'} preload="auto" onEnded={()=>{setEnded(true);setPlaying(false)}} onError={()=>setError('L’extrait audio n’a pas pu être chargé.')}/>
    </div>
  </dialog>
}
