import { useState } from 'react'
import {
  accept,
  date,
  db,
  discard,
  ErrorLine,
  Form,
  Media,
  result,
  Task,
  upload,
  useList,
  val,
  Window,
  type Directory,
  type Person,
} from './core'
export function ProfilePage({
  p,
  d,
  reload,
}: {
  p: Person
  d: Directory
  reload: () => void
}) {
  const [edit, setEdit] = useState(false),
    [limit, setLimit] = useState(30)
  const friends = useList(
    async () =>
      (await result(db.from('friend_requests').select('sender,recipient'))) ||
      [],
    [p.id],
  )
  const book = useList(
    async () =>
      (await result(
        db
          .from('guestbook')
          .select('id,user_id,content,created_at')
          .eq('recipient', p.id)
          .order('created_at', { ascending: false })
          .limit(limit),
      )) || [],
    [p.id, limit],
  )
  const follows = (from: string, to: string) =>
    friends.data?.some((r) => r.sender === from && r.recipient === to)
  const outgoing = follows(d.me.id, p.id),
    incoming = follows(p.id, d.me.id)
  const pals = d.people.filter(
    (u) => follows(u.id, p.id) && follows(p.id, u.id),
  )
  return (
    <>
      <Window title="profil.html">
        <div className="cover" style={{ backgroundColor: p.theme_color }}>
          <Media path={p.banner_url} alt="Bannière" />
        </div>
        <div className="identity">
          <div className="avatar">
            {p.username.slice(0, 1).toUpperCase()}
            <Media path={p.avatar_url} alt="Portrait" />
          </div>
          <h1>{p.username}</h1>
        </div>
        <p>{p.bio || 'Aucune biographie pour le moment.'}</p>
        {p.music && <p>♫ {p.music}</p>}
        {p.id === d.me.id ? (
          <button onClick={() => setEdit(!edit)}>
            {edit ? 'Fermer l’édition' : 'Personnaliser mon profil'}
          </button>
        ) : (
          friends.data && (
            <Task
              run={async () => {
                if (outgoing)
                  await result(
                    db
                      .from('friend_requests')
                      .delete()
                      .eq('sender', d.me.id)
                      .eq('recipient', p.id),
                  )
                else
                  await result(
                    db
                      .from('friend_requests')
                      .insert({ sender: d.me.id, recipient: p.id }),
                  )
                friends.refresh()
              }}
            >
              {outgoing
                ? incoming
                  ? 'Retirer de mes amis'
                  : 'Annuler la demande'
                : incoming
                  ? 'Accepter la demande'
                  : 'Demander en ami'}
            </Task>
          )
        )}
        {edit && p.id === d.me.id && (
          <Form
            action="Enregistrer mon profil"
            submit={async (f) => {
              const paths: (string | null)[] = []
              try {
                paths.push(await upload(f, 'avatar', p.id))
                paths.push(await upload(f, 'banner', p.id))
                await result(
                  db
                    .from('profiles')
                    .update({
                      username: val(f, 'username'),
                      bio: val(f, 'bio'),
                      music: val(f, 'music'),
                      theme_color: val(f, 'color'),
                      avatar_url: paths[0] || p.avatar_url,
                      banner_url: paths[1] || p.banner_url,
                    })
                    .eq('id', p.id),
                )
              } catch (e) {
                await discard(paths)
                throw e
              }
              await discard([
                paths[0] ? p.avatar_url : null,
                paths[1] ? p.banner_url : null,
              ])
              setEdit(false)
              reload()
            }}
          >
            <label>
              Pseudo
              <input
                required
                name="username"
                maxLength={40}
                defaultValue={p.username}
              />
            </label>
            <label>
              Biographie
              <textarea name="bio" maxLength={1500} defaultValue={p.bio} />
            </label>
            <label>
              Musique préférée
              <input name="music" maxLength={180} defaultValue={p.music} />
            </label>
            <label>
              Couleur du profil
              <input name="color" type="color" defaultValue={p.theme_color} />
            </label>
            <label>
              Photo de profil
              <input type="file" name="avatar" accept={accept} />
            </label>
            <label>
              Bannière
              <input type="file" name="banner" accept={accept} />
            </label>
          </Form>
        )}
      </Window>
      <Window title="amis.txt">
        <h2>Liste d’amis</h2>
        <ErrorLine value={friends.error} />
        {pals.map((u) => (
          <button key={u.id} onClick={() => d.open(u.id)}>
            {u.username}
          </button>
        ))}
        {friends.data && !pals.length && <p>Aucune amitié confirmée.</p>}
        {p.id === d.me.id &&
          d.people
            .filter((u) => follows(u.id, p.id) && !follows(p.id, u.id))
            .map((u) => (
              <p key={u.id}>
                Demande de{' '}
                <button onClick={() => d.open(u.id)}>{u.username}</button>
              </p>
            ))}
      </Window>
      <Window title="livre_d_or.txt">
        <h2>Livre d’or</h2>
        <Form
          action="Signer"
          submit={async (f) => {
            await result(
              db
                .from('guestbook')
                .insert({
                  recipient: p.id,
                  user_id: d.me.id,
                  content: val(f, 'text'),
                }),
            )
            book.refresh()
          }}
        >
          <label>
            Un mot pour {p.username}
            <textarea name="text" required maxLength={1500} />
          </label>
        </Form>
        <ErrorLine value={book.error} />
        {book.data?.map((x) => (
          <article key={x.id}>
            <strong>{d.name(x.user_id)}</strong>{' '}
            <small>{date(x.created_at)}</small>
            <p>{x.content}</p>
          </article>
        ))}
        {book.data?.length === limit && (
          <button onClick={() => setLimit((n) => n + 30)}>Voir la suite</button>
        )}
      </Window>
    </>
  )
}
