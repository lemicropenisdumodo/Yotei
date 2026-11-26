import {useState, type CSSProperties} from 'react'
export function useGameColor(userId:string){
  const key='yotei-game-buttons-'+userId
  const [color,setColor]=useState(()=>{
    try{const saved=localStorage.getItem(key);if(saved && /^#[\da-f]{6}$/i.test(saved))return saved}catch{/* Use default. */}
    return '#b9a0a1'
  })
  const [temporary,setTemporary]=useState(false)
  function change(value:string){
    setColor(value)
    try{localStorage.setItem(key,value);setTemporary(false)}catch{setTemporary(true)}
  }
  return {color,change,temporary,style:{'--game-fill':color} as CSSProperties}
}
