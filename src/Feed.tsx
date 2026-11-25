import { categories, type Category } from './Home'
import { Star } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
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
import { webLink, linkInfo, type Recommendation } from './recommendation'
type Post = Recommendation & {
  id: string
  user_id: string
  content: string
  image_url: string | null
  created_at: string
  category: Category | null
  rating: number | null
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
            db.from('comments').insert({
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
export function Feed({
  d,
  filter,
  setFilter, postId,
}: {
  d: Directory
  postId: string
  filter: Category | ''
  setFilter: (c: Category | '') => void
}) {
  const [limit, setLimit] = useState(20),
    [opened, setOpened] = useState<string[]>([])
  const list = useList(async () => {
    let query = db
      .from('posts')
      .select(
        'id,user_id,content,image_url,category,rating,source_url,source_title,thumbnail_url,created_at,likes(user_id)',
      )
      .not('source_title','is',null)
      .order('created_at', { ascending: false })
      .order('id')
      .limit(limit)
    if (postId) query = query.eq('id',postId)
    if (filter) query = query.eq('category', filter)
    return ((await result(query)) || []) as Post[]
  }, [filter, limit, postId])
  return (
    <>
      <div className="sectionhead">
        <h1>{postId ? 'La recommandation' : 'Recommandations'}</h1>
      </div>
      <div className="filters" aria-label="Filtrer les publications">
        {(['', ...Object.keys(categories)] as (Category | '')[]).map((c) => (
          <button
            key={c}
            aria-pressed={filter === c}
            onClick={() => {
              setFilter(c)
              setLimit(20)
            }}
          >
            {c || 'Tout'}
          </button>
        ))}
      </div>

      <div className="sectionhead">
        <h2>{filter || (postId ? 'À découvrir' : 'Les recos du cercle')}</h2>
        <button onClick={list.refresh}>Actualiser</button>
      </div>
      <ErrorLine value={list.error} />
      {list.data?.length === 0 && (
        <p className="empty">Aucune recommandation à afficher.</p>
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
            {p.category && (
              <div className="tag">
                {p.category}
                {p.rating && (
                  <span aria-label={p.rating + ' sur 5'}>
                    {'★'.repeat(p.rating)}
                    {'☆'.repeat(5 - p.rating)}
                  </span>
                )}
              </div>
            )}
            <h2>{p.source_title}</h2>
            {p.content !== p.source_title && <p>{p.content}</p>}
            {!p.image_url && webLink(p.thumbnail_url) && <img className="photo recCover" loading="lazy" alt="" src={webLink(p.thumbnail_url)} referrerPolicy="no-referrer" />}
            {webLink(p.source_url) && <p><a className="sourceLink" href={webLink(p.source_url)} target="_blank" rel="noopener noreferrer">{p.category === 'Musique' ? 'Écouter' : 'Découvrir'} · {new URL(webLink(p.source_url)).hostname}</a></p>}
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

export function Composer({
  d,
  filter,
  onPublished,
}: {
  d: Directory
  filter: Category | ''
  onPublished: (c: Category | '') => void
}) {
  const [chosen, setChosen] = useState<Category>(filter || 'Vidéo')
  const [rating, setRating] = useState(0)
  const [link, setLink] = useState('')
  const [title, setTitle] = useState('')
  const manual = useRef(false)
  const [image, setImage] = useState('')
  const [status, setStatus] = useState('')
  useEffect(() => {
    const url = webLink(link.trim())
    if (!url) return
    let active = true
    const timer = setTimeout(async () => {
      const {data} = await db.functions.invoke('recommendation-preview',{body:{url}})
      if (!active) return
      if (typeof data?.title === 'string' && !manual.current) setTitle(data.title.slice(0,300))
      if (webLink(data?.image)) setImage(data.image)
      setStatus(data?.title ? '' : 'Complète le titre. Tu peux aussi choisir une image.')
    },350)
    return () => { active = false; clearTimeout(timer) }
  },[link])
  return (
    <Window title="nouvelle_publication.exe">
      <h1>Nouvelle recommandation</h1>
      <Form
        action="Publier"
        submit={async (f) => {
          const url = webLink(link.trim())
          if (link.trim() && !url) throw new Error('Utilise un lien HTTPS valide.')
          if (!title.trim()) throw new Error('Indique un titre.')
          const content = val(f, 'text')
          const path = await upload(f, 'photo', d.me.id)
          try {
            await result(
              db.from('posts').insert({
                user_id: d.me.id,
                content: content || title.trim(), source_title:title.trim(), source_url:url || null, thumbnail_url:image || null,
                image_url: path,
                category: chosen || null,
                rating: chosen && rating ? rating : null,
              }),
            )
          } catch (e) {
            await discard([path])
            throw e
          }
          onPublished(chosen)
        }}
      >
        <label>Lien à recommander · facultatif<input type="url" maxLength={2048} value={link} placeholder="https://…" onChange={e => {
          const value = e.target.value
          setLink(value); if(!manual.current)setTitle(''); setImage(''); setStatus('')
          const url = webLink(value.trim())
          if (url) { const info = linkInfo(url); setChosen(info.category); setImage(info.image); setStatus('Recherche de l’aperçu…') }
        }} /></label>
        <p role="status">{status}</p>
        <label>Titre<input value={title} required maxLength={300} onChange={e => {manual.current = true; setTitle(e.target.value)}} /></label>
        {image && <img className="photo recCover" src={image} alt="Aperçu du lien" referrerPolicy="no-referrer" />}
        <label>
          Un mot pour le cercle
          <textarea
            placeholder="Pourquoi le recommandes-tu ?"
            name="text"
            maxLength={5000}
          />
        </label>
        <label>
          Catégorie
          <select
            value={chosen}
            onChange={(e) => {
              setChosen(e.target.value as Category)
              setRating(0)
            }}
          >
            {Object.keys(categories).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        {chosen && (
          <div className="stars">
            <span>Votre note · facultatif</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                aria-label={n + ' sur 5'}
                aria-pressed={rating === n}
                onClick={() => setRating(rating === n ? 0 : n)}
              >
                <Star fill={n <= rating ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
        )}
        <label>
          Image ou affiche personnalisée <small>Facultatif · 5 Mo max.</small>
          <input name="photo" type="file" accept={accept} />
        </label>
      </Form>
    </Window>
  )
}
