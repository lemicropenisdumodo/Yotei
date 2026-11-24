import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  base,
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
import { Chat } from './Chat'
import { Feed } from './Feed'
import { ProfilePage } from './Profiles'
import './style.css'

const params = new URLSearchParams(location.hash.slice(1))
const invite = params.get('invitation')
const setupKey = 'yotei-choisir-mot-de-passe'
if (['invite', 'recovery'].includes(params.get('type') || ''))
  sessionStorage.setItem(setupKey, '1')
function Network({ session }: { session: Session }) {
  const id = session.user.id,
    [page, go] = useState('Fil'),
    [profile, setProfile] = useState(id),
    [room, setRoom] = useState(''),
    [revision, bump] = useState(0)
  const members = useList(async () => {
    const [profiles, members] = await Promise.all([
      result(db.from('profiles').select('*').order('username')),
      result(db.from('members').select('*')),
    ])
    return (profiles as Profile[]).flatMap((p) => {
      const m = (members as Member[]).find((x) => x.id === p.id)
      return m ? [{ ...p, ...m }] : []
    })
  }, [id, revision])
  const notes = useList(
    async () =>
      (await result(
        db
          .from('notifications')
          .select('id,room_id')
          .eq('recipient', id)
          .order('created_at', { ascending: false }),
      )) || [],
    [id, revision],
  )
  useEffect(() => {
    const refresh = () => bump((n) => n + 1)
    const pulse = () => {
      if (!document.hidden) db.rpc('heartbeat').then(refresh)
    }
    pulse()
    const timer = setInterval(pulse, 30000)
    document.addEventListener('visibilitychange', pulse)
    const ch = db
      .channel('alerts-' + id)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: 'recipient=eq.' + id,
        },
        refresh,
      )
      .subscribe()
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', pulse)
      void db.removeChannel(ch)
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
      Déconnexion
    </Task>
  )
  if (members.error || !me || me.suspended)
    return (
      <main className="narrow">
        <Window title="accès.exe">
          <h1>
            {members.data ? 'Accès membre requis' : 'Ouverture du refuge'}
          </h1>
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
    name: (key: string) =>
      people.find((p) => p.id === key)?.username || 'Membre',
    open,
  }
  const activeProfile: Person = people.find((p) => p.id === profile) || me
  const tabs = [
    'Fil',
    'Profil',
    'Annuaire',
    'Messages',
    ...(me.admin ? ['Administration'] : []),
  ]
  return (
    <main className="desktop">
      <aside>
        <Window title="navigation.sys">
          <strong className="sidebrand">Mon refuge</strong>
          <nav>
            {tabs.map((tab, i) => (
              <button
                key={tab}
                aria-current={page === tab ? 'page' : undefined}
                onClick={() => {
                  if (tab === 'Profil') setProfile(id)
                  go(tab)
                }}
              >
                <span aria-hidden="true">
                  {['▤', '▣', '☷', '✉', '⚙'][i]}
                </span>{' '}
                {tab}
                {tab === 'Messages' &&
                  !!notes.data?.length &&
                  ' (' + notes.data.length + ')'}
              </button>
            ))}
          </nav>
          {signout}
        </Window>
      </aside>
      <div className="content">
        {page === 'Fil' && <Feed d={d} />}
        {page === 'Profil' && (
          <ProfilePage
            key={activeProfile.id}
            d={d}
            p={activeProfile}
            reload={members.refresh}
          />
        )}
        {page === 'Annuaire' && (
          <Window title="annuaire.txt">
            <h1>Le cercle</h1>
            {people
              .filter((p) => !p.suspended)
              .map((p) => (
                <article key={p.id}>
                  <button onClick={() => open(p.id)}>{p.username}</button>{' '}
                  <small>
                    {p.last_seen && Date.now() - Date.parse(p.last_seen) < 90000
                      ? '● En ligne'
                      : 'Hors ligne'}
                  </small>
                </article>
              ))}
          </Window>
        )}
        {page === 'Messages' && (
          <>
            {!!notes.data?.length && (
              <div className="notifications">
                {[...new Set(notes.data.map((n) => n.room_id))].map((r) => (
                  <button key={r} onClick={() => setRoom(r)}>
                    ✉ {notes.data!.filter((n) => n.room_id === r).length}{' '}
                    message(s) non lu(s) · {r.slice(0, 4)}
                  </button>
                ))}
              </div>
            )}
            <Chat
              key={room}
              d={d}
              room={room}
              setRoom={setRoom}
              revision={revision}
              seen={notes.refresh}
            />
          </>
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
      <header className="top">
        <div className="mast">
          <img src={base + 'favicon.png'} width="42" height="42" alt="" />
          <b>
            Yotei<span>.</span>
          </b>
        </div>
        <span className="mastnote">Réseau privé</span>
      </header>
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
        <main className="narrow">Ouverture du refuge…</main>
      )}
      <footer>
        <span>Yotei · Réseau privé</span>
        <span lang="ja">羊蹄山</span>
      </footer>
    </div>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
