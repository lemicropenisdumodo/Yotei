import {useState, type CSSProperties} from 'react'
import '@fontsource/pixelify-sans/latin-600.css'

const shapes = {
  close: ['##....##','###..###','.######.','..####..','..####..','.######.','###..###','##....##'],
  gear: ['...##...','.######.','###..###','##....##','##....##','###..###','.######.','...##...'],
  heart: ['.##..##.','########','########','.######.','..####..','...##...'],
  rice: ['...##...','..####..','.######.','.######.','########','###..###','.##..##.'],
}
export function GameIcon({name}:{name:keyof typeof shapes}){
  const pixels=shapes[name].flatMap((row,y)=>Array.from(row,(c,x)=>c==='#'?'M'+x+' '+y+'h1v1h-1z':'')).join('')
  return <svg viewBox="0 0 8 8" width="18" height="18" aria-hidden="true" shapeRendering="crispEdges"><path d={pixels} fill="currentColor"/></svg>
}
const ruby='#ba4053'
export function useGameColor(userId:string){
  const key='yotei-game-buttons-'+userId
  const [color,setColor]=useState(()=>{
    try{const saved=localStorage.getItem(key);if(saved && /^#[\da-f]{6}$/i.test(saved))return saved}catch{/* Use default. */}
    return ruby
  })
  const [temporary,setTemporary]=useState(false)
  function change(value:string){
    setColor(value)
    try{localStorage.setItem(key,value);setTemporary(false)}catch{setTemporary(true)}
  }
  const [r,g,b]=[1,3,5].map(i=>{
    const n=parseInt(color.slice(i,i+2),16)/255
    return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4
  })
  const ink=r*.2126+g*.7152+b*.0722>.179?'#000':'#fff'
  return {color,change,temporary,style:{'--game-fill':color,'--game-ink':ink} as CSSProperties}
}
