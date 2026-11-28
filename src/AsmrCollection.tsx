import videos from './roulette-videos.json'
import {db, ErrorLine, result, useList} from './core'

export const cover = (id:string) => 'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg'

export function Rarity({value}:{value:string}) {
  return <span className="asmrRarity" data-rarity={value}>{value}</span>
}

export function AsmrCollection({id}:{id:string}) {
  const discoveries = useList(async () => {
    const rows = await result<{video:string}[]|null>(db.rpc('asmr_discoveries',{target:id}))
    const ids = new Set((rows??[]).map(row => row.video))
    return videos.filter(video => ids.has(video.id))
  }, [id])
  return <details className="asmrCollection">
    <summary>Découvertes ASMR {discoveries.data && <small>({discoveries.data.length})</small>}</summary>
    <ErrorLine value={discoveries.error}/>
    {discoveries.error && <button onClick={discoveries.refresh}>Réessayer</button>}
    {!discoveries.data && !discoveries.error && <p>Chargement…</p>}
    {discoveries.data?.length===0 && <p>Aucune vidéo découverte pour le moment.</p>}
    {discoveries.data?.map(video => <a key={video.id} href={'https://www.youtube.com/watch?v='+video.id} target="_blank" rel="noopener noreferrer">
      <img src={cover(video.id)} alt="" loading="lazy"/>
      <span><Rarity value={video.rarity}/> <small>{video.language}</small><strong>{video.title}</strong></span>
    </a>)}
  </details>
}
