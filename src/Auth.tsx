import { useState } from 'react'
import { base, check, db, Form, result, site, val } from './core'
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
      <section className="postcard" aria-label="Le mont Yotei au lever du jour">
        <img
          src={base + 'yotei-dawn.png'}
          alt="Le mont Yotei en pixel art au-dessus d’un lac au lever du jour"
        />
        <div className="postmark">
          YŌTEI <span>北海道</span>
        </div>
        <div className="caption">
          <span>CARTE POSTALE</span>
          <strong>Mont Yōtei, Hokkaidō</strong>
        </div>
      </section>
      <section className="gate window">
        <div className="bar">
          <span>▣</span> {setup || invitation ? 'accès.exe' : 'connexion.exe'}
          <span className="grip" />
        </div>
        <div className="inside">
          <div className="eyebrow">LE REFUGE PRIVÉ</div>
          <h1>
            {setup
              ? 'Votre mot de passe'
              : invitation
                ? 'Bienvenue au refuge'
                : reset
                  ? 'Mot de passe oublié'
                  : 'Salut, les amis.'}
          </h1>
          <p>
            {setup
              ? 'Choisissez un mot de passe pour votre compte.'
              : invitation
                ? 'Ouvrez votre invitation pour rejoindre le cercle.'
                : reset
                  ? 'Recevez un lien de récupération par e-mail.'
                  : 'Connectez-vous pour retrouver votre petit coin d’Internet.'}
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
        <div className="statusline">◆ Accès sur invitation</div>
      </section>
    </main>
  )
}
