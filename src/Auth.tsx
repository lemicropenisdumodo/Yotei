import { useState } from 'react'
import { Mark } from './Home'
import { LockKeyhole } from 'lucide-react'
import { check, db, Form, site, val } from './core'
export function Auth({
  setup,
  invitation,
  finish,
}: {
  setup: boolean
  invitation: string | null
  finish: () => void
}) {
  const [reset, setReset] = useState(false),
    [sent, setSent] = useState(false)
  return (
    <main className="welcome">
      <header className="authHead">
        <Mark />
        <span className="wordmark">
          Yotei<span>.</span>
        </span>
        <span className="private">
          <LockKeyhole size={14} /> Réseau privé
        </span>
      </header>
      <section className="authArt" aria-label="Yotei, votre réseau privé">
        <h2>
          Votre cercle<span>.</span>
        </h2>
      </section>
      <section className="gate window">
        <div className="inside">
          <h1>
            {setup
              ? 'Votre mot de passe'
              : invitation
                ? 'Votre invitation'
                : reset
                  ? 'Mot de passe oublié'
                  : 'Connexion'}
          </h1>
          <p>
            {setup
              ? 'Choisissez un mot de passe pour votre compte.'
              : invitation
                ? 'Ouvrez votre invitation pour rejoindre le cercle.'
                : reset
                  ? 'Recevez un lien de récupération par e-mail.'
                  : 'Retrouvez vos amis sur Yotei.'}
          </p>
          <Form
            key={String(setup) + reset + invitation}
            action={
              setup
                ? 'Enregistrer'
                : invitation
                  ? 'Accepter l’invitation'
                  : reset
                    ? 'Envoyer le lien'
                    : 'Se connecter'
            }
            submit={async (f) => {
              if (invitation) {
                await check(
                  db.auth.verifyOtp({ type: 'invite', token_hash: invitation }),
                )
                finish()
                return
              }
              if (setup) {
                await check(
                  db.auth.updateUser({ password: String(f.get('password')) }),
                )
                finish()
                return
              }
              if (reset) {
                await check(
                  db.auth.resetPasswordForEmail(val(f, 'email'), {
                    redirectTo: site,
                  }),
                )
                setSent(true)
                return
              }
              await check(
                db.auth.signInWithPassword({
                  email: val(f, 'email'),
                  password: String(f.get('password')),
                }),
              )
            }}
          >
            {!setup && !invitation && (
              <label>
                Adresse e-mail
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="vous@exemple.fr"
                  required
                />
              </label>
            )}
            {!invitation && (!reset || setup) && (
              <label>
                Mot de passe
                <input
                  type="password"
                  name="password"
                  autoComplete={setup ? 'new-password' : 'current-password'}
                  minLength={setup ? 10 : 1}
                  placeholder="••••••••"
                  required
                />
              </label>
            )}
          </Form>
          {sent && (
            <p role="status">
              Si ce compte existe, un lien a été demandé. Consultez votre
              messagerie.
            </p>
          )}
          {!setup && !invitation && (
            <button
              className="link"
              onClick={() => {
                setReset(!reset)
                setSent(false)
              }}
            >
              {reset ? 'Retour à la connexion' : 'Mot de passe oublié ?'}
            </button>
          )}
        </div>
        <div className="statusline">
          <LockKeyhole size={15} /> Accès sur invitation
        </div>
      </section>
    </main>
  )
}
