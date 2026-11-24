import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'

export const db = createClient(
  import.meta.env.VITE_SUPABASE_URL ||
    'https://liutzcmwbtkrfgzhyycp.supabase.co',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    'sb_publishable_gKUeb969F5U2m6lATGPq6Q_5UAH03cj',
)
export const base = import.meta.env.BASE_URL
export const site = new URL(base, location.origin).href
export const date = (v: string) =>
  new Date(v).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
export type Profile = {
  id: string
  username: string
  bio: string
  music: string
  avatar_url: string | null
  wallpaper_path: string | null
  banner_url: string | null
  theme_color: string
}
export type Member = {
  id: string
  admin: boolean
  suspended: boolean
  last_seen: string | null
}
export type Person = Profile & Member
export type Directory = {
  me: Person
  people: Person[]
  name: (id: string) => string
  open: (id: string) => void
}
export async function result<T>(
  query: PromiseLike<{ data: T; error: { message: string } | null }>,
) {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}
export async function check(
  query: PromiseLike<{ error: { message: string } | null }>,
) {
  const { error } = await query
  if (error) throw new Error(error.message)
}
export function message(e: unknown) {
  return e instanceof Error ? e.message : 'Opération impossible. Réessayez.'
}
export function useList<T>(query: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T>(),
    [error, setError] = useState(''),
    [revision, bump] = useState(0)
  const refresh = () => bump((n) => n + 1)
  useEffect(() => {
    let current = true
    setError('')
    query()
      .then((v) => {
        if (current) setData(v)
      })
      .catch((e) => {
        if (current) setError(message(e))
      })
    return () => {
      current = false
    }
  }, [...deps, revision])
  return { data, error, refresh }
}
export function ErrorLine({ value }: { value?: string }) {
  return value ? (
    <p role="alert" className="error">
      {value}
    </p>
  ) : null
}
export function Form({
  submit,
  children,
  action,
  className = '',
}: {
  submit: (f: FormData) => Promise<void>
  children?: ReactNode
  action: string
  className?: string
}) {
  const [busy, setBusy] = useState(false),
    [err, setErr] = useState('')
  async function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    const el = e.currentTarget
    setBusy(true)
    setErr('')
    try {
      await submit(new FormData(el))
      el.reset()
    } catch (e) {
      setErr(message(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={handle} className={className}>
      <fieldset disabled={busy}>
        {children}
        <ErrorLine value={err} />
        <button className="primary" type="submit">
          {busy ? 'Patientez…' : action}
        </button>
      </fieldset>
    </form>
  )
}
export function Task({
  run,
  children,
}: {
  run: () => Promise<void>
  children: ReactNode
}) {
  const [err, setErr] = useState(''),
    [busy, setBusy] = useState(false)
  return (
    <>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setErr('')
          try {
            await run()
          } catch (e) {
            setErr(message(e))
          } finally {
            setBusy(false)
          }
        }}
      >
        {children}
      </button>
      <ErrorLine value={err} />
    </>
  )
}
export function Window({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section
      className="window"
      aria-label={title.split('.')[0].replaceAll('_', ' ')}
    >
      <div className="inside">{children}</div>
    </section>
  )
}
export const val = (f: FormData, k: string) => String(f.get(k) || '').trim()
const bucket = db.storage.from('yotei-media')
export async function upload(f: FormData, k: string, id: string) {
  const file = f.get(k)
  if (!(file instanceof File) || !file.size) return null
  const ext: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  if (!ext[file.type] || file.size > 5242880)
    throw new Error(
      'Choisissez une image JPG, PNG, WebP ou GIF de 5 Mo maximum.',
    )
  const path = id + '/' + crypto.randomUUID() + '.' + ext[file.type]
  await result(bucket.upload(path, file, { contentType: file.type }))
  return path
}
export async function discard(paths: (string | null)[]) {
  const files = paths.filter((x): x is string => !!x)
  if (files.length) await bucket.remove(files)
}
export function Media({
  path,
  alt,
  className,
}: {
  path?: string | null
  alt: string
  className?: string
}) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let active = true,
      current = ''
    setUrl('')
    if (path)
      bucket.download(path).then(({ data }) => {
        if (data && active) {
          current = URL.createObjectURL(data)
          setUrl(current)
        }
      })
    return () => {
      active = false
      if (current) URL.revokeObjectURL(current)
    }
  }, [path])
  return url ? <img src={url} alt={alt} className={className} /> : null
}
export const accept = 'image/jpeg,image/png,image/webp,image/gif'
