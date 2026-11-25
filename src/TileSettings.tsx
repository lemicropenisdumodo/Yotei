import { useState } from 'react'
import { ChevronUp, ChevronDown, X } from 'lucide-react'

export const palette: Record<string, string> = {
  Graphite: '#34363e', Sauge: '#b4cfb0', Lavande: '#cbb9df',
  Ciel: '#a5ccea', Corail: '#edaa9a', Miel: '#e9ca83',
}
export function isColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}
export function ink(color: string) {
  const linear = [1, 3, 5].map(i => {
    const c = parseInt(color.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2] > .179 ? '#000000' : '#ffffff'
}
async function thumbnail(file: File) {
  const image = new Image()
  const url = URL.createObjectURL(file)
  try {
    image.src = url
    await image.decode()
    const scale = Math.min(1, 720 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw Error()
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/webp', .72)
  } finally { URL.revokeObjectURL(url) }
}
export type Appearance = { tone: string; wide: boolean; image?: string }
export function TileSettings({ tile, change, earlier, later, close }: {
  tile: Appearance & { id: string }; change: (patch: Partial<Appearance>) => void
  earlier?: () => void; later?: () => void; close: () => void
}) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return <aside className="widgetSettings" aria-label={'Réglages de ' + tile.id}>
    <header><strong>{tile.id}</strong><button onClick={close} aria-label="Fermer les réglages"><X size={18}/></button></header>
    <div className="settingRow"><label>Taille
      <select value={tile.wide ? 'large' : 'compact'} onChange={e => change({ wide: e.target.value === 'large' })}>
        <option value="compact">Compacte</option><option value="large">Large</option>
      </select></label>
      <div><span>Position</span><div><button aria-label={'Avancer '+tile.id} disabled={!earlier} onClick={earlier}><ChevronUp/></button>
      <button aria-label={'Reculer '+tile.id} disabled={!later} onClick={later}><ChevronDown/></button></div></div>
    </div>
    <div className="swatches" aria-label="Palette">
      <button onClick={() => change({ tone:'Original' })} aria-pressed={tile.tone === 'Original'}>Original</button>
      {Object.entries(palette).map(([name, color]) => <button key={name} aria-label={name} title={name} aria-pressed={tile.tone === name}
        onClick={() => change({tone:name})} style={{background:color,color:ink(color)}}>{tile.tone === name ? '✓' : ''}</button>)}
    </div>
    <label className="customColor">Spectre des couleurs<input type="color" value={palette[tile.tone] || (isColor(tile.tone) ? tile.tone : '#41434c')} onChange={e => change({tone:e.target.value})}/></label>
    <label>Image du raccourci<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async e => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      setError('')
      setBusy(true)
      try { change({image: await thumbnail(file)}) }
      catch { setError('Impossible de lire cette image. Essaie une photo JPEG, PNG ou WebP.') }
      finally { setBusy(false) }
    }}/></label>
    {tile.image && <button onClick={() => change({image:undefined})}>Retirer l’image</button>}
    {error && <small role="alert">{error}</small>}
  </aside>
}
