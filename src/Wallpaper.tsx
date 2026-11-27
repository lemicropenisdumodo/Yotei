import { useEffect, useState, type CSSProperties } from 'react'
import './wallpaper.css'

const motifs = {
  clouds: { name:'Nuages', palettes:[['Noir et perle','#878483'],['Rose poudré','#e5a1b7'],['Bleu nuit','#7398c4'],['Lavande','#b8a2d9']] },
  blossoms: { name:'Fleurs de cerisier', palettes:[['Vermillon','#b32931'],['Sauge','#78936f'],['Prune','#653850'],['Marine','#243e62']] },
  stars: { name:'Étoiles', palettes:[['Rose','#ff8fb8'],['Pêche','#f2ab80'],['Lilas','#b597de'],['Ciel','#82b5df']] },
  waves: { name:'Vagues', palettes:[['Anthracite','#333238'],['Encre','#416586'],['Forêt','#446a57'],['Bordeaux','#77404e']] },
  mesh: { name:'Grille ondulée', palettes:[['Argent','#a7a5ad'],['Cyan','#6de2e3'],['Violet','#c998f4'],['Rose','#f59fc2']] },
} as const

type Motif = keyof typeof motifs
type Surface = 'home' | 'clicker'
export type Wallpaper = { motif: Motif | 'plain'; palette: number } | null
const plain = { motif:'plain', palette:0 } as const

function readWallpaper(key: string): Wallpaper {
  try {
    const stored = localStorage.getItem(key)
    if (stored === 'plain') return plain
    if (stored) {
      const [motif, index] = stored.split(':')
      const palette = Number(index)
      if (Object.hasOwn(motifs,motif) && Number.isInteger(palette) && palette >= 0 && palette < motifs[motif as Motif].palettes.length)
        return {motif:motif as Motif, palette}
    }
  } catch { /* Storage is optional. */ }
  return null
}

export function useWallpapers(userId: string) {
  const prefix = 'yotei-wallpaper-'+userId+'-'
  const load = () => ({home:readWallpaper(prefix+'home'), clicker:readWallpaper(prefix+'clicker')})
  const [choices,setChoices] = useState(load)
  useEffect(() => {
    const reload = () => setChoices({home:readWallpaper(prefix+'home'), clicker:readWallpaper(prefix+'clicker')})
    const sync = (event:StorageEvent) => {
      if (!event.key || event.key.startsWith(prefix)) reload()
    }
    reload()
    window.addEventListener('storage',sync)
    window.addEventListener('yotei-wallpaper-change',reload)
    return () => {
      window.removeEventListener('storage',sync)
      window.removeEventListener('yotei-wallpaper-change',reload)
    }
  },[prefix])
  function save(surface:Surface, choice:NonNullable<Wallpaper>) {
    try {
      localStorage.setItem(prefix+surface,choice.motif==='plain'?'plain':choice.motif+':'+choice.palette)
      window.dispatchEvent(new Event('yotei-wallpaper-change'))
      return true
    } catch {
      return false
    }
  }
  return {...choices,save}
}

function textureStyle(wallpaper:NonNullable<Wallpaper>):CSSProperties {
  if (wallpaper.motif === 'plain') return {}
  return {backgroundImage:'url("'+import.meta.env.BASE_URL+'wallpapers/'+wallpaper.motif+'-'+wallpaper.palette+'.webp")'}
}

export function WallpaperLayer({wallpaper}:{wallpaper:Wallpaper}) {
  return wallpaper && <div aria-hidden="true" className="motifLayer" data-motif={wallpaper.motif} style={textureStyle(wallpaper)}/>
}

export function WallpaperSettings({wallpapers}:{wallpapers:ReturnType<typeof useWallpapers>}) {
  const [surface,setSurface] = useState<Surface>('home')
  const [draft,setDraft] = useState<NonNullable<Wallpaper>>(wallpapers.home ?? plain)
  const [notice,setNotice] = useState('')
  function selectSurface(value:Surface) {
    setSurface(value)
    setDraft(wallpapers[value] ?? plain)
    setNotice('')
  }
  function preview(choice:NonNullable<Wallpaper>) {
    setDraft(choice)
    setNotice('')
  }
  return <section className="motifSettings" aria-label="Fonds personnalisés">
    <h3>Fonds personnalisés</h3>
    <div className="motifTabs" role="group" aria-label="Écran à personnaliser">
      {(['home','clicker'] as const).map(value =>
        <button type="button" key={value} aria-pressed={value===surface} onClick={()=>selectSurface(value)}>
          {value==='home'?'Accueil':'Clicker'}
        </button>
      )}
    </div>
    <div className="motifGrid" role="group" aria-label="Motif du fond">
      {(['plain',...Object.keys(motifs)] as (Motif|'plain')[]).map(motif=>
        <button key={motif} type="button" aria-pressed={draft.motif===motif} onClick={()=>preview({motif,palette:0})}>
          <span className="motifTile" style={textureStyle({motif,palette:draft.motif===motif?draft.palette:0})}/>
          {motif==='plain'?'Fond uni':motifs[motif].name}
        </button>
      )}
    </div>
    {draft.motif!=='plain' && <div className="motifPalettes" role="group" aria-label="Couleur du motif">
      {motifs[draft.motif].palettes.map(([name,color],index)=>
        <button type="button" key={name} aria-pressed={draft.palette===index} onClick={()=>preview({...draft,palette:index})}>
          <i aria-hidden="true" style={{backgroundColor:color}}/>{name}
        </button>
      )}
    </div>}
    <button className="primary" type="button" onClick={()=>setNotice(
      wallpapers.save(surface,draft)?'Fond enregistré.':'Impossible d’enregistrer ce fond sur cet appareil.'
    )}>Enregistrer le fond</button>
    {notice && <p role="status">{notice}</p>}
  </section>
}
