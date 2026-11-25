import { createRoot } from 'react-dom/client'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
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
import { LogOut, X } from 'lucide-react'
import '@fontsource-variable/manrope/index.css'
import '@fontsource-variable/space-grotesk/index.css'
import './style.css'

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
    window.scrollTo(0, page === 'Accueil' ? homeScroll.current : 0)
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
      .not('source_url','is',null).order('created_at',{ascending:false}).order('id').limit(1))
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
    window.scrollTo(0, 0)
  }
  return (
    <main
      className="desktop widgetShell"
      data-page={page}
      style={
        {
          '--accent': /^#[0-9a-f]{6}$/i.test(me.theme_color)
            ? me.theme_color
            : '#baa1ef',
        } as CSSProperties
      }
    >
      <Media path={me.wallpaper_path} alt="" className="wallpaper" />
      <div className="content">
        <header className="pageHead">
          <div className="wordmark">Yotei<span>.</span></div>
          {page === 'Accueil' ? (
            <button className="accountShortcut" onClick={() => navigate('Profil')} aria-label="Ouvrir mon profil">
              <Avatar person={me} /> {me.username}
            </button>
          ) : (
            <button className="exitPage" ref={closeButton} onClick={() => history.back()} aria-label="Fermer et revenir à l’accueil">
              <X size={19} /> Fermer
            </button>
          )}
        </header>
        <div hidden={page !== 'Accueil'}>
          <Home d={d} go={navigate} recent={latest.data} openPost={(post) => {setPostId(post); setCategory(''); go('Fil')}}
            filter={(c) => { setPostId(''); setCategory(c); go('Fil') }} />
        </div>
        {page === 'Fil' && (
          <Feed d={d} filter={category} postId={postId} setFilter={c => {setPostId(''); setCategory(c)}} />
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
            signout={signout}
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
                  <button onClick={() => open(p.id)}>{d.name(p.id)}</button>{' '}
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
