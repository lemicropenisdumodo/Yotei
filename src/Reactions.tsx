import {useRef,useState} from 'react'
import {db,check,message,type Directory} from './core'

export type Reaction = {user_id:string;emoji:string}
const emojis=['❤️','🔥','👀']
export function Reactions({postId,d,rows,refresh}:{postId:string;d:Directory;rows:Reaction[];refresh:()=>void}){
  const lock=useRef(false)
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const [local,setLocal]=useState<{from:Reaction[];emoji:string}|null>(null)
  const mine=rows.find(r=>r.user_id===d.me.id)?.emoji||''
  const selected=local?.from===rows?local.emoji:mine
  async function choose(emoji:string){
    if(lock.current)return
    lock.current=true;setBusy(true);setError('')
    const next=selected===emoji?'':emoji
    try{
      const table=db.from('post_reactions')
      if(!next)await check(table.delete().eq('post_id',postId).eq('user_id',d.me.id))
      else if(selected)await check(table.update({emoji:next}).eq('post_id',postId).eq('user_id',d.me.id))
      else await check(table.insert({post_id:postId,user_id:d.me.id,emoji:next}))
      setLocal({from:rows,emoji:next});refresh()
    }catch(e){setError(message(e));refresh()}finally{lock.current=false;setBusy(false)}
  }
  return <div className="reactionBar" aria-label="Réactions">{emojis.map(emoji=>{
    const names=rows.filter(r=>r.emoji===emoji && r.user_id!==d.me.id).map(r=>d.name(r.user_id))
    if(selected===emoji)names.push('Toi')
    return <button key={emoji} disabled={busy} aria-pressed={selected===emoji} onClick={()=>choose(emoji)} title={names.join(', ')} aria-label={emoji+' · '+(names.join(', ')||'Réagir')}>{emoji}{names.length>0 && <small>{names.join(', ')}</small>}</button>
  })}{error&&<small role="alert">{error}</small>}</div>
}
