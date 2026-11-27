import { useRef, useState } from 'react'
import { Check, LockKeyhole } from 'lucide-react'
import { Hearts,type Game } from './CircleGame'
import {message} from './core'
import './wallpaper.css'

const motifs = {
  clouds: { name:'Nuages', palettes:[['Noir et perle','#878483'],['Rose poudré','#e5a1b7'],['Bleu nuit','#7398c4'],['Lavande','#b8a2d9']] },
  blossoms: { name:'Fleurs de cerisier', palettes:[['Vermillon','#b32931'],['Sauge','#78936f'],['Prune','#653850'],['Marine','#243e62']] },
  stars: { name:'Étoiles', palettes:[['Rose','#ff8fb8'],['Pêche','#f2ab80'],['Lilas','#b597de'],['Ciel','#82b5df']] },
  waves: { name:'Vagues', palettes:[['Anthracite','#333238'],['Encre','#416586'],['Forêt','#446a57'],['Bordeaux','#77404e']] },
  mesh: { name:'Grille ondulée', palettes:[['Argent','#a7a5ad'],['Cyan','#6de2e3'],['Violet','#c998f4'],['Rose','#f59fc2']] },
} as const

type Motif = keyof typeof motifs
export type GameSurface = 'character' | 'clicker'
export type Gallery = {owned:string[];prices:Record<string,number>;character:string;clicker:string}
type Background = { motif:Motif|'plain';palette:number }

function decode(value?:string):Background {
  const [motif,raw]=value?.split(':')??[]
  const palette=Number(raw)
  if(motif && Object.hasOwn(motifs,motif) && Number.isInteger(palette) && palette>=0 && palette<4)return {motif:motif as Motif,palette}
  return {motif:'plain',palette:0}
}
function texture({motif,palette}:Background){
  return motif==='plain'?{}:{backgroundImage:'url("'+import.meta.env.BASE_URL+'wallpapers/'+motif+'-'+palette+'.webp")'}
}
export function GameBackdrop({value}:{value?:string}){
  const background=decode(value)
  return background.motif!=='plain' && <div aria-hidden="true" className="motifLayer" data-motif={background.motif} style={texture(background)}/>
}
export const homeBackgrounds={
  default:'Par défaut',
  slate:'Ardoise',
  dusk:'Crépuscule',
  forest:'Forêt'
}
export function BackgroundGallery({surface,game,done}:{surface:GameSurface;game:Game;done:()=>void}){
  const gallery=game.wallet?.gallery
  const [draft,setChoice]=useState<Background|null>(null)
  const choice=draft??decode(gallery?.[surface])
  const lock=useRef(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
  if(!gallery)return <section className="gallery"><p role="status">{game.error||'Chargement des fonds…'}</p><button onClick={game.refresh}>Actualiser</button></section>
  const owned=(motif:string)=>motif==='plain'||gallery.owned.includes(motif)
  const buying=!owned(choice.motif)
  const price=gallery.prices[choice.motif]??0
  async function apply(){
    if(lock.current)return
    lock.current=true;setBusy(true);setError('')
    try{await game.chooseBackground(surface,choice.motif,choice.palette,buying);done()}
    catch(e){setError(message(e))}finally{lock.current=false;setBusy(false)}
  }
  return <section className="gallery motifSettings" aria-label="Galerie de fonds">
    <header><h3>Fonds du {surface==='character'?'personnage':'clicker'}</h3><Hearts amount={game.points}/></header>
    <div className="motifGrid">{(['plain',...Object.keys(motifs)] as const).map(id=>{
      const motif=id as Background['motif']
      const name=motif==='plain'?'Fond uni':motifs[motif].name
      const locked=!owned(motif)
      return <button key={id} type="button" disabled={busy} className="galleryCard" aria-pressed={choice.motif===motif}
        aria-label={name+(locked?' · '+gallery.prices[id]+' cœurs':' · disponible')}
        onClick={()=>{setChoice({motif,palette:0});setError('')}}>
        <span className="galleryPreview">
          <span className={'motifTile'+(locked?' locked':'')} style={texture({motif,palette:choice.motif===motif?choice.palette:0})}/>
          {locked ? <span className="galleryPrice"><LockKeyhole size={14}/><Hearts amount={gallery.prices[id]}/></span>
          : <Check className="ownedMark" size={15}/>}
        </span>
        <span>{name}</span>
      </button>
    })}</div>
    {choice.motif!=='plain' && <div className="motifPalettes" role="group" aria-label="Couleur du motif">{motifs[choice.motif].palettes.map(([name,color],i)=>
      <button key={name} disabled={busy} aria-pressed={choice.palette===i} onClick={()=>setChoice({...choice,palette:i})}><i style={{backgroundColor:color}}/>{name}</button>)}</div>}
    {buying&&<small>Le motif et ses quatre couleurs seront disponibles sur les deux écrans.</small>}
    <button className="primary" disabled={busy || (buying&&game.points<price)} onClick={apply}>{buying?<>Débloquer et appliquer · <Hearts amount={price}/></>:'Appliquer le fond'}</button>
    {buying&&game.points<price&&<small>Encore <Hearts amount={price-game.points}/> à gagner au clicker.</small>}
    {error&&<p role="alert">{error}</p>}
  </section>
}
