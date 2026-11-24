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
} from './core'
type Post = {
  id: string
  user_id: string
  content: string
  image_url: string | null
  created_at: string
  likes: { user_id: string }[]
}
function Replies({ post, d }: { post: Post; d: Directory }) {
  const [limit, setLimit] = useState(30)
  const list = useList(
    async () =>
      (await result(
        db
          .from('comments')
          .select('id,user_id,content,created_at')
          .eq('post_id', post.id)
          .order('created_at')
          .order('id')
          .limit(limit),
      )) || [],
    [post.id, limit],
  )
  return (
    <div className="replies">
      <ErrorLine value={list.error} />
      {list.data?.map((c) => (
        <p key={c.id}>
          <button className="link" onClick={() => d.open(c.user_id)}>
            {d.name(c.user_id)}
          </button>{' '}
          {c.content}
        </p>
      ))}
      {list.data?.length === limit && (
        <button onClick={() => setLimit((n) => n + 30)}>
          Plus de commentaires
        </button>
      )}
      <Form
        action="Commenter"
        submit={async (f) => {
          await result(
            db
              .from('comments')
              .insert({
                user_id: d.me.id,
                post_id: post.id,
                content: val(f, 'text'),
              }),
          )
          list.refresh()
        }}
      >
        <label>
          Votre commentaire
          <input name="text" required maxLength={2000} />
        </label>
      </Form>
    </div>
  )
}
export function Feed({ d }: { d: Directory }) {
  const [limit, setLimit] = useState(20),
    [opened, setOpened] = useState<string[]>([])
  const list = useList(
    async () =>
      ((await result(
        db
          .from('posts')
          .select('id,user_id,content,image_url,created_at,likes(user_id)')
          .order('created_at', { ascending: false })
          .order('id')
          .limit(limit),
      )) as Post[]) || [],
    [limit],
  )
  return (
    <>
      <Window title="nouvelle_publication.exe">
        <h1>Quoi de neuf ?</h1>
        <Form
          action="Publier"
          submit={async (f) => {
            const content = val(f, 'text')
            const path = await upload(f, 'photo', d.me.id)
            if (!content && !path)
              throw new Error('Ajoutez un texte ou une photo.')
            try {
              await result(
                db
                  .from('posts')
                  .insert({
                    user_id: d.me.id,
                    content: content || '📷',
                    image_url: path,
                  }),
              )
            } catch (e) {
              await discard([path])
              throw e
            }
            list.refresh()
          }}
        >
          <label>
            Un mot pour le cercle
            <textarea
              placeholder="Racontez votre journée…"
              name="text"
              maxLength={5000}
            />
          </label>
          <label>
            Photo <small>Facultatif · 5 Mo max.</small>
            <input name="photo" type="file" accept={accept} />
          </label>
        </Form>
      </Window>
      <div className="sectionhead">
        <h2>Fil d’actualité</h2>
        <button onClick={list.refresh}>Actualiser</button>
      </div>
      <ErrorLine value={list.error} />
      {list.data?.length === 0 && (
        <p className="empty">
          Le fil est encore vide. Laissez le premier mot du cercle.
        </p>
      )}
      {list.data?.map((p) => {
        const liked = p.likes.some((l) => l.user_id === d.me.id)
        return (
          <article className="post" key={p.id}>
            <header>
              <button className="link" onClick={() => d.open(p.user_id)}>
                {d.name(p.user_id)}
              </button>
              <time>{date(p.created_at)}</time>
            </header>
            <p>{p.content}</p>
            <Media
              path={p.image_url}
              alt="Photo de la publication"
              className="photo"
            />
            <div className="actions">
              <Task
                run={async () => {
                  const query = liked
                    ? db
                        .from('likes')
                        .delete()
                        .eq('post_id', p.id)
                        .eq('user_id', d.me.id)
                    : db
                        .from('likes')
                        .insert({ post_id: p.id, user_id: d.me.id })
                  await result(query)
                  list.refresh()
                }}
              >
                {liked ? '♥' : '♡'} {p.likes.length} · J’aime
              </Task>
              <button
                onClick={() =>
                  setOpened(
                    opened.includes(p.id)
                      ? opened.filter((id) => id !== p.id)
                      : [...opened, p.id],
                  )
                }
              >
                Commentaires
              </button>
              {(p.user_id === d.me.id || d.me.admin) && (
                <Task
                  run={async () => {
                    if (
                      !confirm(
                        'Supprimer cette publication et ses commentaires ?',
                      )
                    )
                      return
                    await result(db.from('posts').delete().eq('id', p.id))
                    if (p.user_id === d.me.id) await discard([p.image_url])
                    list.refresh()
                  }}
                >
                  Supprimer
                </Task>
              )}
            </div>
            {opened.includes(p.id) && <Replies post={p} d={d} />}
          </article>
        )
      })}
      {list.data?.length === limit && (
        <button onClick={() => setLimit((n) => n + 20)}>
          Publications précédentes
        </button>
      )}
    </>
  )
}
