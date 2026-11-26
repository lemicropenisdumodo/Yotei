import { Avatar, categories, type Category } from './Home'
import { Pencil, SquarePen, Star, Trash2 } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import {
  accept,
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
  const [limit, setLimit] = useState(20)
  const [menu,setMenu]=useState<string|null>(null)
  const [editing,setEditing]=useState<Recommendation|null>(null)
  const list = useList(async () => {
    let query = db
      .from('posts')
      .select(
        'id,user_id,content,image_url,category,rating,source_url,source_title,thumbnail_url',
      )
      .not('source_title','is',null)
      .order('created_at', { ascending: false })
      .order('id')
      .limit(limit)
    if (postId) query = query.eq('id',postId)
    if (filter) query = query.eq('category', filter)
    return ((await result(query)) || []) as Recommendation[]
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
        const own=p.user_id===d.me.id
        const author = own ? d.me : d.people.find(person => person.id === p.user_id)
        const authorName = d.name(p.user_id)
        return (
          <article className="post" key={p.id}>
            <header>
              <button className="link postAuthor" onClick={() => d.open(p.user_id)} aria-label={authorName}>
                {author ? <Avatar person={author}/> : <span className="avatar" aria-hidden="true">{authorName.slice(0,1)}</span>}
                <span className="postAuthorName">{authorName}</span>
              </button>
              {(own||d.me.admin) && <button className="postPencil" aria-label="Actions sur la publication" aria-expanded={menu===p.id}
                onClick={()=>setMenu(menu===p.id?null:p.id)}><Pencil size={17}/></button>}
              {menu===p.id && (own||d.me.admin) && <div className="postOptions">
                {own && <button onClick={()=>{setEditing(p);setMenu(null)}}><SquarePen size={17} aria-hidden="true"/><span>Modifier</span></button>}
                  <Task
                    run={async () => {
                      if (
                        !confirm(
                          'Supprimer cette publication ?',
                        )
                      )
                        return
                      await result(db.from('posts').delete().eq('id',p.id).select('id').single())
                      setMenu(null)
                      if (p.user_id === d.me.id) await discard([p.image_url])
                      list.refresh()
                    }}
                  >
                    <Trash2 size={17} aria-hidden="true"/><span>Supprimer</span>
                  </Task>
              </div>}
            </header>
            {editing?.id===p.id && own && <Form action="Enregistrer les modifications" submit={async f=>{
              const title=val(f,'title'), content=val(f,'message')||title
              if(!title)throw Error('Indique un titre.')
              const updated=await result(db.from('posts').update({source_title:title,content})
                .eq('id',p.id).eq('user_id',d.me.id).eq('source_title',editing.source_title).eq('content',editing.content).select('id').maybeSingle())
              if(!updated)throw Error('La publication a changé. Annule puis actualise le fil avant de réessayer.')
              setEditing(null);list.refresh()
            }}>
              <label>Titre<input name="title" required maxLength={300} defaultValue={editing.source_title}/></label>
              <label>Message<textarea name="message" maxLength={5000} defaultValue={editing.content===editing.source_title?'':editing.content}/></label>
              <button type="button" onClick={()=>setEditing(null)}>Annuler</button>
            </Form>}
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
