import { MaintenanceGate } from './Maintenance'
import { createRoot } from 'react-dom/client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Media,
  check,
  db,
  ErrorLine,
  result,
  Task,
  useList,
  Window,
  type Member,
  type Person,
  type Profile,
} from './core'
import { Auth } from './Auth'
import { Admin } from './Admin'
import type { Recommendation } from './recommendation'
import { Composer, Feed } from './Feed'
import { ProfilePage } from './Profiles'
import {
  Home,
  Avatar,
  type Page,
  type Category,
} from './Home'
import {thumbnail} from './TileSettings'
import {useSpotify,SpotifyPage,SpotifyConnection} from './Spotify'
import { Settings, LogOut, X } from 'lucide-react'
import '@fontsource-variable/manrope/index.css'
import '@fontsource-variable/space-grotesk/index.css'
import './style.css'
import './dashboard.css'

const params = new URLSearchParams(location.hash.slice(1))
const invite = params.get('invitation')
const setupKey = 'yotei-choisir-mot-de-passe'
if (['invite', 'recovery'].includes(params.get('type') || ''))
  sessionStorage.setItem(setupKey, '1')
function Network({ session }: { session: Session }) {
  const id = session.user.id,
    [page, setPage] = useState<Page>('Accueil'),
    [category, setCategory] = useState<Category | ''>(''),
    [profile, setProfile] = useState(id),
    [postId, setPostId] = useState(''),
    [revision, bump] = useState(0)
  const prefKey = 'yotei-dashboard-'+id
  const [prefs,setPrefs] = useState<{theme:string;photo:string}>(()=>{
    try { const saved=JSON.parse(localStorage.getItem(prefKey)||'{}');return {theme:saved.theme||'Graphite',photo:saved.photo||''} }
    catch {return {theme:'Graphite',photo:''}}
  })
  const [editing,setEditing]=useState(false)
  const [custom,setCustom]=useState(false)
  const [notice,setNotice]=useState('')
  function preference(patch:Partial<typeof prefs>){
    const next={...prefs,...patch}
    try {localStorage.setItem(prefKey,JSON.stringify(next));setPrefs(next);setNotice('')}
    catch {setNotice('Impossible d’enregistrer sur cet appareil.')}
  }
  const spotifyReturn=useRef(new URLSearchParams(location.search).has('spotify_state'))
  const spotify=useSpotify(id,['Accueil','Spotify','Profil','Paramètres'].includes(page))
  const homeScroll = useRef(0)
  const lastWidget = useRef<HTMLElement | null>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const go = (next: Page) => {
    if (page === 'Accueil') {
      homeScroll.current = window.scrollY
      lastWidget.current = document.activeElement as HTMLElement
      history.pushState({ yotei: id, page: next }, '')
    } else {
      history.replaceState({ yotei: id, page: next }, '')
    }
    setPage(next)
  }
  useEffect(() => {
    const previous = history.scrollRestoration
    history.scrollRestoration = 'manual'
    history.replaceState({ yotei: id, page: 'Accueil' }, '')
    if(spotifyReturn.current){spotifyReturn.current=false;go('Spotify')}
    const back = () => {
      const state = history.state
      setPage(state?.yotei === id ? state.page : 'Accueil')
    }
    window.addEventListener('popstate', back)
    return () => {
      history.scrollRestoration = previous
      window.removeEventListener('popstate', back)
    }
  }, [id])
  useLayoutEffect(() => {
    if(page!=='Spotify')window.scrollTo(0, page === 'Accueil' ? homeScroll.current : 0)
    if (page === 'Accueil') lastWidget.current?.focus({ preventScroll: true })
    else closeButton.current?.focus({ preventScroll: true })
  }, [page])
  const members = useList(async () => {
    const [profiles, members, nicknames] = await Promise.all([
      result(db.from('profiles').select('*').order('username')),
      result(db.from('members').select('*')),
      result(
        db
          .from('friend_nicknames')
          .select('friend_id,nickname')
          .eq('owner_id', id),
      ),
    ])
    return (profiles as Profile[]).flatMap((p) => {
      const m = (members as Member[]).find((x) => x.id === p.id)
      return m
        ? [
            {
              ...p,
              ...m,
              nickname: nicknames?.find((n) => n.friend_id === p.id)?.nickname,
            },
          ]
        : []
    })
  }, [id, revision])
  const latest = useList(async () => {
    const rows = await result(db.from('posts')
      .select('id,user_id,content,category,rating,source_title,source_url,thumbnail_url,image_url')
      .not('source_title','is',null).order('created_at',{ascending:false}).order('id').limit(1))
    return rows?.[0] as Recommendation | undefined
  }, [id, revision, page])
  useEffect(() => {
    const refresh = () => bump((n) => n + 1)
    const pulse = () => {
      if (!document.hidden) db.rpc('heartbeat').then(refresh)
    }
    pulse()
    const timer = setInterval(pulse, 30000)
    document.addEventListener('visibilitychange', pulse)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', pulse)
    }
  }, [id])
  const people = members.data || [],
    me = people.find((p) => p.id === id)
  const open = (pid: string) => {
    setProfile(pid)
    go('Profil')
  }
  const signout = (
    <Task
      run={async () => {
        await check(db.auth.signOut({ scope: 'local' }))
      }}
    >
      <LogOut size={19} /> Déconnexion
    </Task>
  )
  if (members.error || !me || me.suspended)
    return (
      <main className="narrow">
        <Window title="accès.exe">
          <h1>{members.data ? 'Accès membre requis' : 'Ouverture de Yotei'}</h1>
          <ErrorLine value={members.error} />
          {members.data && (
            <p>
              Votre compte doit être invité et actif. Contactez l’administrateur
              du cercle.
            </p>
          )}
          <button onClick={members.refresh}>Actualiser</button> {signout}
        </Window>
      </main>
    )
  const d = {
    me,
    people,
    name: (key: string) => {
      const person = people.find((p) => p.id === key)
      return person?.nickname || person?.username || 'Membre'
    },
    open,
  }
  const activeProfile: Person = people.find((p) => p.id === profile) || me
  const navigate = (tab: Page) => {
    if (tab === 'Profil') setProfile(id)
    if (tab === 'Fil') { setCategory(''); setPostId('') }
    go(tab)
    if(tab!=='Spotify')window.scrollTo(0, 0)
  }
  return (
    <main
      className="desktop widgetShell"
      data-page={page==='Spotify'?'Accueil':page}
      data-theme={prefs.theme}
    >
      <Media path={me.wallpaper_path} alt="" className="wallpaper" />
      <div className="content">
        <header className="pageHead">
          <div className="wordmark">Yotei<span>.</span></div>
          {(page === 'Accueil'||page==='Spotify') ? (
            <div className="headActions"><button aria-label="Paramètres" onClick={()=>{setCustom(false);navigate('Paramètres')}}><Settings size={20}/></button>
            <button className="accountShortcut" onClick={() => navigate('Profil')} aria-label="Ouvrir mon profil">
              <Avatar person={me} /> {me.username}
            </button></div>
          ) : (
            <button className="exitPage" ref={closeButton} onClick={() => history.back()} aria-label="Fermer et revenir à l’accueil">
              <X size={19} /> Fermer
            </button>
          )}
        </header>
        <div hidden={page !== 'Accueil' && page !== 'Spotify'}>
          <Home key={id} d={d} go={navigate} openPost={post=>{setPostId(post);setCategory('');go('Fil')}} recent={latest.data} editing={editing} finish={()=>setEditing(false)} photo={prefs.photo} spotify={spotify}/>
        </div>
        {page === 'Paramètres' && <Window title="Paramètres"><h1>Paramètres</h1>
          <details className="connectionSettings"><summary>Connexion</summary><SpotifyConnection control={spotify} open={()=>navigate('Spotify')}/></details>
          <button onClick={()=>setCustom(!custom)} aria-expanded={custom}>Personnalisation</button>
          {me.admin && <button onClick={()=>navigate('Administration')}>Administration</button>}
          {custom && <div className="settingsStack"><label>Thème de l’interface<select value={prefs.theme} onChange={e=>preference({theme:e.target.value})}>
            {['Graphite','Boréal','Prune','Minuit'].map(t=><option key={t}>{t}</option>)}</select></label>
            <button onClick={()=>{setEditing(true);history.back()}}>Déplacer les widgets</button>
            <label>Photo du cadre<input type="file" accept="image/jpeg,image/png,image/webp" onChange={async e=>{
              const file=e.target.files?.[0];if(!file)return
              try{preference({photo:await thumbnail(file)})}catch{setNotice('Photo illisible.')}
            }}/></label>{prefs.photo && <button onClick={()=>preference({photo:''})}>Retirer la photo</button>}
          </div>}
          {notice && <p role="status">{notice}</p>}</Window>}
        {page === 'Spotify' && <SpotifyPage control={spotify} admin={me.admin} close={()=>history.back()}/>}
        {page === 'Fil' && (<><button className="newRec" onClick={()=>navigate('Publier')}>Nouvelle recommandation</button>
          <Feed d={d} filter={category} postId={postId} setFilter={c => {setPostId(''); setCategory(c)}} /></>
        )}
        {page === 'Publier' && (
          <Composer
            d={d}
            filter={category}
            onPublished={(c) => {
              setPostId('')
              setCategory(c)
              go('Fil')
              window.scrollTo(0, 0)
            }}
          />
        )}
        {page === 'Profil' && (
          <ProfilePage
            key={activeProfile.id}
            d={d}
            p={activeProfile}
            signout={signout} spotify={spotify}
            reload={members.refresh}
          />
        )}
        {page === 'Amis' && (
          <Window title="Amis">
            <h1>Amis</h1>
            {people
              .filter((p) => !p.suspended)
              .map((p) => (
                <article key={p.id}>
                  <button className="friendEntry" onClick={() => open(p.id)}><Avatar person={p}/><span><strong>{p.nickname || p.username}</strong>{p.nickname && <small>Pseudo · {p.username}</small>}</span></button>{' '}
                  <small>
                    {p.last_seen && Date.now() - Date.parse(p.last_seen) < 90000
                      ? '● En ligne'
                      : 'Hors ligne'}
                  </small>
                </article>
              ))}
          </Window>
        )}
        {page === 'Administration' && me.admin && (
          <Admin d={d} refresh={members.refresh} />
        )}
      </div>
    </main>
  )
}
function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined),
    [invitation, setInvite] = useState(invite),
    [setup, setSetup] = useState(!!sessionStorage.getItem(setupKey))
  const [authError, setError] = useState(params.get('error_description') || '')
  useEffect(() => {
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') {
        sessionStorage.setItem(setupKey, '1')
        setSetup(true)
      }
      setSession(s)
    })
    db.auth.getSession().then((r) => {
      if (r.error) setError(r.error.message)
    })
    return () => subscription.unsubscribe()
  }, [])
  return (
    <div className="shell">
      <ErrorLine value={authError} />
      {session === undefined ? <main className="narrow">Ouverture de Yotei…</main> : <MaintenanceGate key={session?.user.id || 'anonymous'} signedIn={!!session}>
      {invitation || session === null || (session && setup) ? (
        <Auth
          invitation={invitation}
          setup={!!session && setup}
          finish={() => {
            if (invitation) {
              sessionStorage.setItem(setupKey, '1')
              setSetup(true)
              setInvite(null)
            } else {
              sessionStorage.removeItem(setupKey)
              setSetup(false)
            }
            history.replaceState(null, '', location.pathname)
          }}
        />
      ) : session ? (
        <Network key={session.user.id} session={session} />
      ) : (
        <main className="narrow">Ouverture de Yotei…</main>
      )}
    </MaintenanceGate>}
    </div>
  )
}
createRoot(document.getElementById('root')!).render(<App />)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .register(import.meta.env.BASE_URL + 'sw.js')
    .catch((error) => {
      console.warn('Installation de Yotei indisponible.', error)
    })
}
