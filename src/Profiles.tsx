import { Music2, Palette } from 'lucide-react'
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
  const [edit, setEdit] = useState(false)
  const [postLimit, setPostLimit] = useState(3)
  const posts = useList(
    async () =>
      (await result(
        db
          .from('posts')
          .select('id,content,image_url,category,rating,created_at')
          .eq('user_id', p.id)
          .order('created_at', { ascending: false })
          .order('id')
          .limit(postLimit + 1),
      )) || [],
    [p.id, postLimit],
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
          <div>
            <small>
              {p.id === d.me.id ? 'Mon profil' : 'Profil du cercle'}
            </small>
            <h1>{d.name(p.id)}</h1>
            {p.nickname && <small>Pseudo du cercle · {p.username}</small>}
          </div>
        </div>
        <p>{p.bio || 'Aucune biographie pour le moment.'}</p>
        {p.music && (
          <p className="musicLine">
            <Music2 size={18} /> {p.music}
          </p>
        )}
        {p.id === d.me.id && (
          <button onClick={() => setEdit(!edit)}>
            {edit ? 'Fermer l’édition' : 'Personnaliser mon profil'}
          </button>
        )}
        {p.id !== d.me.id && !p.suspended && (
          <details key={p.nickname || ''}>
            <summary>Surnom privé</summary>
            <Form
              action="Enregistrer le surnom"
              submit={async (f) => {
                const nickname = val(f, 'nickname')
                if (nickname)
                  await result(
                    db
                      .from('friend_nicknames')
                      .upsert(
                        { owner_id: d.me.id, friend_id: p.id, nickname },
                        { onConflict: 'owner_id,friend_id' },
                      ),
                  )
                else
                  await result(
                    db
                      .from('friend_nicknames')
                      .delete()
                      .eq('owner_id', d.me.id)
                      .eq('friend_id', p.id),
                  )
                reload()
              }}
            >
              <label>
                Visible uniquement par vous
                <input
                  name="nickname"
                  maxLength={40}
                  defaultValue={p.nickname || ''}
                  placeholder={p.username}
                />
              </label>
              <small>
                Effacez le surnom pour retrouver le pseudo du cercle.
              </small>
            </Form>
          </details>
        )}
        {edit && p.id === d.me.id && (
          <Form
            action="Enregistrer mon profil"
            submit={async (f) => {
              const paths: (string | null)[] = []
              try {
                paths.push(await upload(f, 'avatar', p.id))
                paths.push(await upload(f, 'banner', p.id))
                paths.push(await upload(f, 'wallpaper', p.id))
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
                      wallpaper_path:
                        paths[2] ||
                        (f.has('removeWallpaper') ? null : p.wallpaper_path),
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
                paths[2] || f.has('removeWallpaper') ? p.wallpaper_path : null,
              ])
              setEdit(false)
              reload()
            }}
          >
            <h2>
              <Palette size={20} /> Personnalisation
            </h2>
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
              Couleur du profil et des motifs
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
            <label>
              Fond d’écran de mon espace <small>5 Mo maximum</small>
              <input type="file" name="wallpaper" accept={accept} />
            </label>
            {p.wallpaper_path && (
              <label className="inline">
                <input type="checkbox" name="removeWallpaper" /> Rétablir le
                fond par défaut
              </label>
            )}
          </Form>
        )}
      </Window>
      <Window title="Publications du profil">
        <h2>Publications</h2>
        <ErrorLine value={posts.error} />
        {posts.data?.length === 0 && <p>Aucune publication pour le moment.</p>}
        {posts.data?.slice(0, postLimit).map((post) => (
          <article key={post.id}>
            <time>{date(post.created_at)}</time>
            {post.category && (
              <span className="tag">
                {post.category}
                {post.rating && <span>{post.rating} / 5 ★</span>}
              </span>
            )}
            <p>{post.content}</p>
            <Media
              path={post.image_url}
              className="photo"
              alt="Photo de la publication"
            />
          </article>
        ))}
        {posts.data && posts.data.length > postLimit && (
          <button onClick={() => setPostLimit((n) => n + 6)}>Voir plus</button>
        )}
      </Window>
    </>
  )
}
