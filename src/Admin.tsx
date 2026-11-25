import { MaintenanceControl } from './Maintenance'
import { useState } from 'react'
import {
  db,
  ErrorLine,
  Form,
  result,
  Task,
  useList,
  val,
  Window,
  type Directory,
} from './core'
export function Admin({ d, refresh }: { d: Directory; refresh: () => void }) {
  const accounts = useList(
    async () =>
      (await result(db.rpc('member_accounts'))) as {
        member_id: string
        email: string
        pending: boolean
      }[],
    [d.people.length],
  )
  const [link, setLink] = useState('')
  return (
    <>
      <MaintenanceControl />
      <Window title="invitations.exe">
        <h1>Invitations</h1>
        <p>
          Créez un lien individuel, puis transmettez-le en privé à son
          destinataire.
        </p>
        <Form
          action="Créer l’invitation"
          submit={async (f) => {
            setLink('')
            const res = await db.functions.invoke('invitations', {
              body: { email: val(f, 'email') },
            })
            if (res.error || !res.data?.link)
              throw new Error(
                'Invitation impossible. Vérifiez l’adresse et si le compte existe déjà.',
              )
            setLink(res.data.link)
            accounts.refresh()
            refresh()
          }}
        >
          <label>
            Adresse e-mail
            <input name="email" type="email" required />
          </label>
        </Form>
        {link && (
          <label>
            Lien personnel à transmettre
            <input readOnly value={link} onFocus={(e) => e.target.select()} />
          </label>
        )}
      </Window>
      <Window title="membres.exe">
        <h2>Membres et accès</h2>
        <p>
          La suspension coupe l’accès au cercle, y compris pour une invitation
          en attente.
        </p>
        <ErrorLine value={accounts.error} />
        {d.people.map((p) => (
          <article key={p.id}>
            <strong>
              {accounts.data?.find((a) => a.member_id === p.id)?.email ||
                p.username}
            </strong>{' '}
            {accounts.data?.find((a) => a.member_id === p.id)?.pending && (
              <small>Invitation en attente</small>
            )}{' '}
            · {p.admin ? 'Administration' : p.suspended ? 'Suspendu' : 'Membre'}{' '}
            {!p.admin && (
              <Task
                run={async () => {
                  if (!confirm('Modifier l’accès de ' + p.username + ' ?'))
                    return
                  await result(
                    db.rpc('set_suspended', {
                      member_id: p.id,
                      value: !p.suspended,
                    }),
                  )
                  refresh()
                }}
              >
                {p.suspended ? 'Réactiver' : 'Suspendre'}
              </Task>
            )}
          </article>
        ))}
      </Window>
    </>
  )
}
