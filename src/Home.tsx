import {
  Aperture,
  ArrowUpRight,
  AudioLines,
  CircleUserRound,
  Clapperboard,
  Gamepad2,
  LayoutGrid,
  MessagesSquare,
  Newspaper,
  Plus,
  Settings2,
  UsersRound,
} from 'lucide-react'
import { Media, type Directory } from './core'
export const navigation = {
  Accueil: LayoutGrid,
  Fil: Newspaper,
  Publier: Plus,
  Messages: MessagesSquare,
  Amis: UsersRound,
  Profil: CircleUserRound,
  Administration: Settings2,
}
export type Page = keyof typeof navigation
export const categories = {
  Cinéma: Clapperboard,
  Musique: AudioLines,
  'Jeux vidéo': Gamepad2,
}
export type Category = keyof typeof categories
export function Mark() {
  return (
    <span className="brandmark">
      <Aperture aria-hidden="true" size={30} strokeWidth={2.8} />
    </span>
  )
}
export function Avatar({ person }: { person: Directory['me'] }) {
  return (
    <span className="avatar" style={{ backgroundColor: person.theme_color }}>
      {person.username.slice(0, 1).toUpperCase()}
      <Media path={person.avatar_url} alt="" />
    </span>
  )
}
export function Home({
  d,
  unread,
  go,
  filter,
}: {
  d: Directory
  unread: number
  go: (p: Page) => void
  filter: (c: Category) => void
}) {
  const people = d.people.filter((p) => !p.suspended)
  const online = people.filter(
    (p) => p.last_seen && Date.now() - Date.parse(p.last_seen) < 90000,
  )
  return (
    <div className="bento">
      <button className="feature" onClick={() => go('Fil')}>
        <Media path={d.me.wallpaper_path} alt="" className="featureWallpaper" />
        <span className="featureTag">
          <Newspaper size={16} /> Fil d’actualité
        </span>
        <span className="heroTitle">
          Le fil
          <br />
          du cercle<span>.</span>
        </span>
        <span className="heroCta">
          Ouvrir le fil <ArrowUpRight size={17} />
        </span>
      </button>
      <div className="quickStack">
        <button className="quick mint" onClick={() => go('Messages')}>
          <span className="tileTop">
            <MessagesSquare />
            <ArrowUpRight />
          </span>
          <strong>Messages</strong>
          <small>
            {unread
              ? unread + ' non lu' + (unread > 1 ? 's' : '')
              : 'Aucun message non lu'}
          </small>
        </button>
        <button className="quick lilac" onClick={() => go('Amis')}>
          <span className="tileTop">
            <UsersRound />
            <ArrowUpRight />
          </span>
          <strong>Amis</strong>
          <small>
            {people.length} membre{people.length > 1 ? 's' : ''} ·{' '}
            {online.length} en ligne
          </small>
        </button>
      </div>
      <section className="categoryCard">
        <h2>Explorer le fil</h2>
        <div className="categoryLinks">
          {(Object.keys(categories) as Category[]).map((c) => {
            const Icon = categories[c]
            return (
              <button key={c} onClick={() => filter(c)}>
                <Icon />
                <span>{c}</span>
              </button>
            )
          })}
        </div>
      </section>
      <button className="profileShortcut" onClick={() => go('Profil')}>
        <span className="tileTop">
          <Avatar person={d.me} />
          <ArrowUpRight />
        </span>
        <strong>Mon profil</strong>
        <small>Personnaliser mon espace</small>
      </button>
    </div>
  )
}
