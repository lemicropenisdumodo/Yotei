import { useEffect, useState } from 'react'
import { BatteryMedium } from 'lucide-react'

type Battery = EventTarget & { level:number }
export function ClockTiles({kind}:{kind:'Date'|'Heure'|'Batterie'}) {
  const [date,setDate]=useState(()=>new Date())
  const [battery,setBattery]=useState<number|null>(null)
  useEffect(()=>{
    if(kind!=='Batterie'){
      const t=setInterval(()=>setDate(new Date()),15000)
      return ()=>clearInterval(t)
    }
    let disposed=false, device:Battery|undefined
    const update=()=>{if(device)setBattery(Math.round(device.level*100))}
    const api=navigator as Navigator & {getBattery?:()=>Promise<Battery>}
    api.getBattery?.().then(b=>{if(disposed)return;device=b;update();b.addEventListener('levelchange',update)}).catch(()=>{})
    return ()=>{disposed=true;device?.removeEventListener('levelchange',update)}
  },[kind])
  if(kind==='Batterie')return <div className="stillTile" title={battery===null?'Batterie indisponible':'Batterie'}><BatteryMedium/><strong>{battery===null?'—':battery+' %'}</strong></div>
  return <time className="stillTile">{kind==='Date' && <small>{date.toLocaleDateString('fr',{weekday:'short'})}</small>}<strong>{kind==='Date'?date.toLocaleDateString('fr',{day:'numeric',month:'short'}):date.toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})}</strong></time>
}
export function Market({chart}:{chart:boolean}){
  const opts=chart?{symbol:'NASDAQ:AAPL',dateRange:'1M'}:{symbols:['NASDAQ:AAPL','NASDAQ:MSFT','NASDAQ:NVDA'].map(proName=>({proName,title:proName.split(':')[1]})),displayMode:'adaptive'}
  const url='https://s.tradingview.com/embed-widget/'+(chart?'mini-symbol-overview':'ticker-tape')+'/?locale=fr#'+encodeURIComponent(JSON.stringify({...opts,width:'100%',height:'100%',colorTheme:'dark',isTransparent:true}))
  return <iframe className="marketFrame" src={url} title={chart?'Évolution Apple':'Cours de bourse'} loading="lazy" tabIndex={-1} sandbox="allow-scripts allow-same-origin"/>
}
export function spotifyPath(link:string){
  return /^https:\/\/open\.spotify\.com\/(?:intl-[a-z]+\/)?((?:track|album|playlist|episode)\/[a-zA-Z0-9]{22})(?:[?#].*)?$/.exec(link.trim())?.[1]
}
export function SpotifyArt({link}:{link:string}){
  const [art,setArt]=useState('')
  useEffect(()=>{
    setArt('')
    if(!spotifyPath(link))return
    const c=new AbortController()
    fetch('https://open.spotify.com/oembed?url='+encodeURIComponent(link),{signal:c.signal}).then(r=>r.json()).then(data=>{if(!c.signal.aborted && data.thumbnail_url?.startsWith('https://'))setArt(data.thumbnail_url)}).catch(()=>{})
    return ()=>c.abort()
  },[link])
  return art?<img src={art} alt="" className="albumArt"/>:null
}
