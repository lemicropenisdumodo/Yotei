import { useEffect, useState } from 'react'
import {
  date,
  db,
  ErrorLine,
  Form,
  result,
  useList,
  val,
  Window,
  type Directory,
} from './core'
export function Chat({
  d,
  room,
  setRoom,
  revision,
  seen,
}: {
  d: Directory
  room: string
  setRoom: (id: string) => void
  revision: number
  seen: () => void
}) {
  const rooms = useList(
    async () =>
      (await result(
        db
          .from('rooms')
          .select('id,title,participants')
          .order('created_at', { ascending: false }),
      )) || [],
    [revision],
  )
  const [limit, setLimit] = useState(50),
    [tick, setTick] = useState(0)
  const messages = useList(
    async () =>
      room
        ? (
            (await result(
              db
                .from('messages')
                .select('id,user_id,content,created_at')
                .eq('room_id', room)
                .order('created_at', { ascending: false })
                .order('id')
                .limit(limit),
            )) || []
          ).reverse()
        : [],
    [room, revision, tick, limit],
  )
  useEffect(() => {
    if (!room) return
    const channel = db
      .channel('chat-' + room)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: 'room_id=eq.' + room,
        },
        () => setTick((n) => n + 1),
      )
      .subscribe((s) => {
        if (s === 'SUBSCRIBED') setTick((n) => n + 1)
      })
    return () => {
      void db.removeChannel(channel)
    }
  }, [room])
  useEffect(() => {
    if (room && messages.data?.length)
      db.from('notifications')
        .delete()
        .eq('recipient', d.me.id)
        .eq('room_id', room)
        .lte('created_at', messages.data[messages.data.length - 1].created_at)
        .then(({ error }) => {
          if (!error) seen()
        })
  }, [room, messages.data, d.me.id])
  const name = (r: { title: string; participants: string[] }) =>
    r.title ||
    r.participants
      .filter((id) => id !== d.me.id)
      .map(d.name)
      .join(', ')
  return (
    <>
      <Window title="messagerie.exe">
        <h1>Messagerie</h1>
        <details>
          <summary>Nouvelle conversation</summary>
          <Form
            action="Ouvrir la conversation"
            submit={async (f) => {
              const ids = [d.me.id, ...f.getAll('ids').map(String)]
              if (ids.length < 2)
                throw new Error('Sélectionnez au moins un ami.')
              const title = val(f, 'title')
              const old = rooms.data?.find(
                (r) =>
                  !title &&
                  !r.title &&
                  ids.length === 2 &&
                  r.participants.length === 2 &&
                  ids.every((i) => r.participants.includes(i)),
              )
              const id =
                old?.id ||
                (await result(
                  db
                    .from('rooms')
                    .insert({ participants: ids, title })
                    .select('id')
                    .single(),
                ))!.id
              rooms.refresh()
              setRoom(id)
            }}
          >
            <label>
              Nom du groupe <small>Facultatif</small>
              <input name="title" maxLength={80} />
            </label>
            <div className="checks">
              {d.people
                .filter((u) => u.id !== d.me.id && !u.suspended)
                .map((u) => (
                  <label key={u.id}>
                    <input type="checkbox" name="ids" value={u.id} />
                    {u.username}
                  </label>
                ))}
            </div>
          </Form>
        </details>
        <ErrorLine value={rooms.error} />
        {rooms.data?.map((r) => (
          <button
            className={room === r.id ? 'selected' : ''}
            key={r.id}
            onClick={() => setRoom(r.id)}
          >
            {name(r)}
          </button>
        ))}
        {rooms.data?.length === 0 && <p>Votre boîte de réception est vide.</p>}
      </Window>
      {room && (
        <Window title="conversation.txt">
          <h2>
            {rooms.data?.find((r) => r.id === room)
              ? name(rooms.data.find((r) => r.id === room)!)
              : 'Conversation'}
          </h2>
          <ErrorLine value={messages.error} />
          {messages.data?.length === limit && (
            <button onClick={() => setLimit((n) => n + 50)}>
              Messages précédents
            </button>
          )}
          {messages.data?.map((m) => (
            <article key={m.id}>
              <strong>{d.name(m.user_id)}</strong>{' '}
              <small>{date(m.created_at)}</small>
              <p>{m.content}</p>
            </article>
          ))}
          <Form
            action="Envoyer"
            submit={async (f) => {
              await result(
                db.from('messages').insert({
                  room_id: room,
                  user_id: d.me.id,
                  content: val(f, 'text'),
                }),
              )
              messages.refresh()
            }}
          >
            <label>
              Votre message
              <textarea name="text" maxLength={4000} required />
            </label>
          </Form>
        </Window>
      )}
    </>
  )
}
