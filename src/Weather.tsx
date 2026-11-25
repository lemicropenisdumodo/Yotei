import {createPortal} from 'react-dom'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  X,
} from 'lucide-react'

type City = {
  id: number
  name: string
  latitude: number
  longitude: number
  country?: string
  admin1?: string
  timezone?: string
}
type Point = {
  time: string
  data: {
    instant: { details: { air_temperature: number } }
    next_1_hours?: { summary: { symbol_code: string } }
  }
}
type Forecast = { time: string; temperature: number; symbol: string }

function condition(symbol: string) {
  if (symbol.includes('thunder'))
    return { Icon: CloudLightning, label: 'Orage' }
  if (/snow|sleet/.test(symbol))
    return { Icon: CloudSnow, label: 'Neige ou grésil' }
  if (symbol.includes('rain')) return { Icon: CloudRain, label: 'Pluie' }
  if (symbol.includes('fog')) return { Icon: CloudFog, label: 'Brouillard' }
  if (symbol.includes('clearsky'))
    return { Icon: symbol.includes('night') ? Moon : Sun, label: 'Ciel dégagé' }
  if (/fair|partlycloudy/.test(symbol))
    return { Icon: CloudSun, label: 'Éclaircies' }
  return { Icon: Cloud, label: symbol === 'cloudy' ? 'Nuageux' : 'Prévision' }
}

function readCity(key: string): City | null {
  try {
    const c = JSON.parse(localStorage.getItem(key) || 'null')
    return typeof c?.name === 'string' &&
      Number.isFinite(c.latitude) &&
      Number.isFinite(c.longitude)
      ? c
      : null
  } catch {
    return null
  }
}

export function Weather({ userId,forecastHost }: { userId: string;forecastHost?:HTMLElement|null }) {
  const key = 'yotei-weather-' + userId
  const [city, setCity] = useState(() => readCity(key))
  const [forecast, setForecast] = useState<Forecast[]>([]),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0)
  const [editing, setEditing] = useState(!city),
    [matches, setMatches] = useState<City[]>([]),
    [searchStatus, setSearchStatus] = useState('')
  const dialog = useRef<HTMLDialogElement>(null),
    searchRequest = useRef<AbortController | null>(null)
  useEffect(() => () => searchRequest.current?.abort(), [])
  useEffect(() => {
    setForecast([])
    setError('')
    if (!city) return
    const controller = new AbortController()
    const coords =
      'lat=' + city.latitude.toFixed(3) + '&lon=' + city.longitude.toFixed(3)
    async function refresh() {
      try {
        const response = await fetch(
          'https://api.met.no/weatherapi/locationforecast/2.0/compact?' +
            coords,
          { signal: controller.signal },
        )
        if (!response.ok) throw Error()
        const body = await response.json()
        const cutoff = Date.now() - 3600_000
        const points: Forecast[] = body.properties.timeseries
          .filter(
            (p: Point) =>
              Date.parse(p.time) > cutoff &&
              Number.isFinite(p.data.instant.details.air_temperature),
          )
          .slice(0, 13)
          .map((p: Point) => ({
            time: p.time,
            temperature: Math.round(p.data.instant.details.air_temperature),
            symbol: p.data.next_1_hours?.summary.symbol_code || '',
          }))
        if (!points.length) throw Error()
        if (!controller.signal.aborted) {
          setForecast(points)
          setError('')
        }
      } catch {
        if (!controller.signal.aborted)
          setError('Météo indisponible pour le moment.')
      }
    }
    refresh()
    const timer = setInterval(refresh, 3600_000)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [city, retry])
  async function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const term = String(new FormData(e.currentTarget).get('city') || '').trim()
    searchRequest.current?.abort()
    setMatches([])
    if (term.length < 2) {
      setSearchStatus('Saisis au moins deux lettres.')
      return
    }
    const request = new AbortController()
    searchRequest.current = request
    setSearchStatus('Recherche…')
    try {
      const response = await fetch(
        'https://geocoding-api.open-meteo.com/v1/search?' +
          new URLSearchParams({ name: term, count: '5', language: 'fr' }),
        { signal: request.signal },
      )
      if (!response.ok) throw Error()
      const data = await response.json()
      if (request.signal.aborted) return
      setMatches(data.results || [])
      setSearchStatus(data.results?.length ? '' : 'Aucune ville trouvée.')
    } catch {
      if (!request.signal.aborted)
        setSearchStatus('Recherche indisponible. Réessaie dans un instant.')
    }
  }
  function choose(c: City | null) {
    try {
      if (c) localStorage.setItem(key, JSON.stringify(c))
      else localStorage.removeItem(key)
    } catch {
      /* Session-only preference when storage is unavailable. */
    }
    setForecast([])
    setCity(c)
    setEditing(!c)
    setMatches([])
    setSearchStatus('')
  }
  const now = forecast[0],
    { Icon, label } = condition(now?.symbol || '')
  return (
    <div className="weather">
      {forecastHost && createPortal(<div className="miniForecast">{now ? [0,3,6,9].filter(i=>forecast[i]).map(i=>{
        const hour=forecast[i], {Icon,label}=condition(hour.symbol)
        return <span key={hour.time}><small>{new Date(hour.time).toLocaleTimeString('fr',{hour:'2-digit',timeZone:city?.timezone})}</small><Icon size={15} aria-label={label}/><b>{hour.temperature}°</b></span>
      }) : <small>{city ? error || 'Prévisions en cours…' : 'Prévisions · choisis ta ville'}</small>}</div>,forecastHost)}
      <button
        className="weatherChip"
        aria-label={city ? 'Météo à ' + city.name : 'Configurer la météo'}
        onClick={() => {
          setEditing(!city)
          dialog.current?.showModal()
        }}
      >
        <span className="weatherPlace">{city?.name || 'Météo'}<small>{now ? label : city ? 'Prévisions' : 'Choisir une ville'}</small></span>
        <Icon size={20}/><b>{now ? now.temperature+'°' : '—'}</b>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="weather-title"
        onClose={() => {
          searchRequest.current?.abort()
          setMatches([])
          setSearchStatus('')
        }}
      >
        <header>
          <h2 id="weather-title">
            {editing ? 'Choisir une ville' : city?.name}
          </h2>
          <button
            aria-label="Fermer la météo"
            onClick={() => dialog.current?.close()}
          >
            <X size={18} />
          </button>
        </header>
        {editing ? (
          <>
            <form onSubmit={search}>
              <label>
                Ville
                <input
                  name="city"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Ex. Lyon"
                />
              </label>
              <button className="primary">Rechercher</button>
            </form>
            <p role="status">{searchStatus}</p>
            <div className="cityMatches">
              {matches.map((c) => (
                <button key={c.id} onClick={() => choose(c)}>
                  {[c.name, c.admin1, c.country].filter(Boolean).join(', ')}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {error && (
              <p role="alert">
                {error}{' '}
                <button onClick={() => setRetry((n) => n + 1)}>
                  Réessayer
                </button>
              </p>
            )}
            {!now && !error && <p role="status">Chargement des prévisions…</p>}
            {now && (
              <>
                <div className="weatherNow">
                  <Icon size={38} />
                  <strong>{now.temperature} °C</strong>
                  <span>{label}</span>
                </div>
                <h3>Prochaines heures</h3>
                <div className="hourly">
                  {[3, 6, 9, 12]
                    .map((i) => forecast[i])
                    .filter(Boolean)
                    .map((hour) => {
                      const { Icon, label } = condition(hour.symbol)
                      return (
                        <div key={hour.time}>
                          <time>
                            {new Intl.DateTimeFormat('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: city?.timezone || 'UTC',
                            }).format(new Date(hour.time))}
                          </time>
                          <Icon aria-label={label} size={20} />
                          <strong>{hour.temperature} °C</strong>
                        </div>
                      )
                    })}
                </div>
              </>
            )}
            <div className="actions">
              <button onClick={() => setEditing(true)}>Changer de ville</button>
              <button onClick={() => choose(null)}>Effacer ma ville</button>
            </div>
          </>
        )}
        <footer>
          <a href="https://www.met.no/en">Météo · MET Norway</a> ·{' '}
          <a href="https://open-meteo.com/en/docs/geocoding-api">
            Villes · Open-Meteo / GeoNames
          </a>
        </footer>
      </dialog>
    </div>
  )
}
