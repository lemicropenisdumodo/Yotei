import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import type { CSSProperties } from 'react'

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
  if(kind==='Batterie')return <div className="chargeTile" aria-label={battery===null?'Batterie indisponible':'Batterie '+battery+' %'}>
    <span className="chargeRing" style={{'--charge':(battery||0)+'%'} as CSSProperties}><Zap size={12}/><b>{battery??'—'}</b></span></div>
  if(kind==='Heure'){
    const time=date.toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})
    return <time className="flipClock" aria-label={time}>{time.replace(':','').split('').map((n,i)=><b key={i}>{n}</b>)}</time>
  }
  return <time className="dateTile"><small>{date.toLocaleDateString('fr',{weekday:'long'})}</small><b>{date.toLocaleDateString('fr',{day:'numeric',month:'short'})}</b></time>
}
import {marketName,symbolOf,type Watchlist} from './MarketSettings'
type Quote={symbol:string;close:number;change:number;history:number[]}
export function useMarkets(symbols:string[]){
  const [rows,setRows]=useState<Quote[]>([])
  useEffect(()=>{
    const controller=new AbortController()
    async function update(){
      const quotes=await Promise.all(symbols.map(async symbol=>{
        const fields=['close','change',...Array.from({length:14},(_,i)=>'close['+(i+1)+']')]
        try{
          const response=await fetch('https://scanner.tradingview.com/symbol?'+new URLSearchParams({symbol,fields:fields.join(',')}),{signal:controller.signal})
          if(!response.ok)return null
          const values=await response.json()
          if(!Number.isFinite(values.close)||!Number.isFinite(values.change))return null
          return {symbol,close:values.close,change:values.change,history:[...fields.slice(2).reverse(),'close'].map(k=>values[k]).filter(Number.isFinite)}
        }catch{return null}
      }))
      if(!controller.signal.aborted)setRows(old=>symbols.flatMap((symbol,i)=>quotes[i]||old.find(q=>q.symbol===symbol)||[]))
    }
    void update()
    const timer=setInterval(update,300000)
    return ()=>{controller.abort();clearInterval(timer)}
  },[symbols])
  return rows
}
const price=(n:number)=>n.toLocaleString('fr',{minimumFractionDigits:2,maximumFractionDigits:2})
export function Market({chart,rows,watch}:{chart:boolean;rows:Quote[];watch:Watchlist}){
  const ticker=watch.tickers[watch.chart]
  const quote=rows.find(q=>q.symbol===ticker)
  if(chart){
    const data=quote?.history||[], min=Math.min(...data), range=Math.max(...data)-min
    const points=data.map((n,i)=>(i*100/(data.length-1))+','+(24-(n-min)/(range||1)*22)).join(' ')
    return <div className="marketChart"><header><b>{symbolOf(ticker)}</b><strong>{quote?price(quote.close):'—'}</strong></header>
      {data.length>1?<svg viewBox="0 0 100 26" preserveAspectRatio="none" role="img" aria-label={'Évolution des clôtures · '+marketName(ticker)}><polyline points={points}/></svg>:<small>Cours indisponible</small>}</div>
  }
  return <div className="marketRows" aria-label="Cours des valeurs suivies">{watch.tickers.map(symbol=>{
    const q=rows.find(item=>item.symbol===symbol)
    return <div key={symbol}><b>{symbolOf(symbol)}</b><span>{q?price(q.close):'—'}</span><em data-up={(q?.change??0)>=0}>{q?(q.change>0?'+':'')+price(q.change)+' %':'—'}</em></div>
  })}</div>
}
