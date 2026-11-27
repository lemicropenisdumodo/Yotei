import {useState} from 'react'

const assets=[
  ['NASDAQ:AAPL','Apple'],['NASDAQ:MSFT','Microsoft'],['NASDAQ:NVDA','NVIDIA'],
  ['NASDAQ:GOOGL','Alphabet · Google'],['NASDAQ:AMZN','Amazon'],['NASDAQ:META','Meta Platforms'],
  ['NASDAQ:TSLA','Tesla'],['NASDAQ:NFLX','Netflix'],['NASDAQ:AMD','AMD'],['NASDAQ:INTC','Intel'],
  ['NASDAQ:QCOM','Qualcomm'],['NASDAQ:AVGO','Broadcom'],['NASDAQ:ADBE','Adobe'],['NASDAQ:CSCO','Cisco'],
  ['NASDAQ:PEP','PepsiCo'],['NYSE:KO','Coca-Cola'],['NYSE:DIS','Disney'],['NYSE:NKE','Nike'],
  ['NYSE:V','Visa'],['NYSE:MA','Mastercard'],['NYSE:JPM','JPMorgan Chase'],['NYSE:WMT','Walmart'],
  ['EURONEXT:MC','LVMH'],['EURONEXT:OR','L’Oréal'],['EURONEXT:AI','Air Liquide'],['EURONEXT:AIR','Airbus'],
  ['EURONEXT:TTE','TotalEnergies'],['EURONEXT:BNP','BNP Paribas'],['EURONEXT:RMS','Hermès'],['EURONEXT:SAN','Sanofi'],
  ['XETR:SAP','SAP'],['XETR:SIE','Siemens'],['TVC:CAC40','CAC 40'],['TVC:DJI','Dow Jones'],
  ['TVC:GOLD','Or'],['TVC:SILVER','Argent'],['FX:EURUSD','Euro / Dollar'],['COINBASE:BTCUSD','Bitcoin'],['COINBASE:ETHUSD','Ethereum']
]
export const defaults=assets.slice(0,3).map(([ticker])=>ticker)
export const symbolOf=(ticker:string)=>ticker.split(':')[1]
export const marketName=(ticker:string)=>assets.find(([v])=>v===ticker)?.[1]||symbolOf(ticker)
export type Watchlist={tickers:string[];chart:number}
export function validWatchlist(value?:Partial<Watchlist>):Watchlist{
  const tickers=value?.tickers
  return {tickers:Array.isArray(tickers)&&tickers.length===3&&new Set(tickers).size===3&&tickers.every(x=>assets.some(([v])=>v===x))?tickers:defaults,
    chart:[0,1,2].includes(value?.chart??-1)?value!.chart!:0}
}
export function MarketSettings({value,save}:{value:Watchlist;save:(v:Watchlist)=>void}){
  const [slot,setSlot]=useState(0),[search,setSearch]=useState('')
  const matches=assets.filter(x=>x.join(' ').toLowerCase().includes(search.trim().toLowerCase()))
  return <details><summary>Bourse</summary>
    <label>Ligne du widget<select value={slot} onChange={e=>setSlot(Number(e.target.value))}>{value.tickers.map((x,i)=><option key={i} value={i}>{i+1} · {marketName(x)}</option>)}</select></label>
    <label>Rechercher une valeur<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Entreprise, indice, or, symbole…"/></label>
    <label>Valeur à suivre<select value={matches.some(([id])=>id===value.tickers[slot])?value.tickers[slot]:''} onChange={e=>save({...value,tickers:value.tickers.map((x,i)=>i===slot?e.target.value:x)})}>
      <option disabled value="">{matches.length?'Choisir une valeur':'Aucun résultat'}</option>
      {matches.map(([id,name])=><option key={id} value={id} disabled={value.tickers.includes(id)&&value.tickers[slot]!==id}>{name} · {symbolOf(id)}</option>)}</select></label>
    <label>Courbe affichée<select value={value.chart} onChange={e=>save({...value,chart:Number(e.target.value)})}>{value.tickers.map((x,i)=><option key={x} value={i}>{marketName(x)}</option>)}</select></label>
  </details>
}
