import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  importProgress,
  NICKNAME_RE,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN,
  passwordBytes,
  safeNext,
  useAuth,
  type AuthErrorCode,
} from '../lib/auth';
import { fmt, pageUrl, type AuthPageId, type Locale } from '../lib/pages';
import type { AuthPageCopy } from '../lib/schema';

type Props = { mode: AuthPageId; cityId: string; loc: Locale; a: AuthPageCopy };

type ErrorKey = keyof AuthPageCopy['errors'];
type Errors = { nickname?: ErrorKey; password?: ErrorKey; form?: ErrorKey };

/** Which field an API error belongs to; the rest are shown for the whole form. */
const FIELD_OF: Partial<Record<AuthErrorCode, 'nickname' | 'password'>> = {
  nickname_taken: 'nickname',
  invalid_nickname: 'nickname',
  weak_password: 'password',
};

/**
 * Log in or register (same form, `mode` decides). Nickname + password only (D6, D12).
 * The browser's password manager should recognise both forms: autocomplete attributes,
 * different ids/names, no confirm field, pasting allowed.
 */
export default function AuthForm({ mode, cityId, loc, a }: Props) {
  const auth = useAuth();
  const isRegister = mode === 'register';
  const home = pageUrl(loc, 'home');
  const other: AuthPageId = isRegister ? 'login' : 'register';

  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false); // succeeded, now redirecting
  const [errors, setErrors] = useState<Errors>({});
  // ?next= is read after hydration (the page itself is static).
  const [next, setNext] = useState<{ target: string; query: string }>({ target: home, query: '' });

  const busyRef = useRef(false);
  const nicknameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);
  const focusAfterRender = useRef<'nickname' | 'password' | 'form' | null>(null);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('next');
    const target = safeNext(raw, home);
    setNext({ target, query: target === home ? '' : `?next=${encodeURIComponent(target)}` });
  }, [home]);

  // Move focus to the first error once it is on screen.
  useEffect(() => {
    const where = focusAfterRender.current;
    focusAfterRender.current = null;
    if (where === 'nickname') nicknameRef.current?.focus();
    else if (where === 'password') passwordRef.current?.focus();
    else if (where === 'form') formErrorRef.current?.focus();
  }, [errors]);

  const id = (field: string) => `${mode}-${field}`;

  function check(): Errors {
    const e: Errors = {};
    const nick = nickname.trim();
    if (!nick) e.nickname = 'nicknameRequired';
    else if (isRegister && !NICKNAME_RE.test(nick)) e.nickname = 'invalid_nickname';
    if (!password) e.password = 'passwordRequired';
    else if (isRegister && password.length < PASSWORD_MIN) e.password = 'weak_password';
    else if (isRegister && passwordBytes(password) > PASSWORD_MAX_BYTES) e.password = 'passwordTooLong';
    return e;
  }

  function showErrors(e: Errors) {
    focusAfterRender.current = e.nickname ? 'nickname' : e.password ? 'password' : e.form ? 'form' : null;
    setErrors(e);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return; // no double submit

    const local = check();
    if (Object.keys(local).length) return showErrors(local);

    busyRef.current = true;
    setBusy(true);
    setErrors({});

    const nick = nickname.trim();
    let code: AuthErrorCode;
    try {
      const result = isRegister ? await auth.register(nick, password) : await auth.login(nick, password);
      if ('data' in result) {
        setDone(true);
        try {
          await importProgress(cityId);
        } catch {
          /* never blocks logging in */
        }
        window.location.assign(next.target);
        return; // stay busy while the next page loads
      }
      code = result.error.code;
    } catch {
      code = 'network';
    }

    busyRef.current = false;
    setBusy(false);
    // A password the server refused for the user's own reasons: show the over-72-bytes text if that is why.
    const key: ErrorKey =
      code === 'weak_password' && passwordBytes(password) > PASSWORD_MAX_BYTES ? 'passwordTooLong' : code;
    const field = FIELD_OF[code];
    showErrors(field ? { [field]: key } : { form: key });
  }

  const describedBy = (field: 'nickname' | 'password') =>
    [isRegister && id(`${field}-hint`), errors[field] && id(`${field}-error`)].filter(Boolean).join(' ') ||
    undefined;

  const loggedIn = auth.status === 'ready' && auth.user && !done;

  return (
    <>
      <section className="hero hero-compact">
        <div className="inner">
          <h1>{a.page.title}</h1>
          <p>{a.page.subtitle}</p>
        </div>
      </section>

      <main className="inner page auth">
        {loggedIn ? (
          <div className="auth-card">
            <p className="auth-done">{fmt(a.loggedIn, { nickname: auth.user!.nickname })}</p>
            <a className="btn btn-primary" href={next.target}>
              {a.continue}
            </a>
          </div>
        ) : (
          <form className="auth-card" noValidate onSubmit={onSubmit}>
            <div
              ref={formErrorRef}
              id={id('form-error')}
              className="form-error"
              role="alert"
              aria-live="assertive"
              tabIndex={-1}
            >
              {errors.form ? a.errors[errors.form] : ''}
            </div>

            <div className="field">
              <label htmlFor={id('nickname')}>{a.nickname}</label>
              <input
                ref={nicknameRef}
                id={id('nickname')}
                name={id('nickname')}
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={nickname}
                aria-invalid={errors.nickname ? true : undefined}
                aria-describedby={describedBy('nickname')}
                onChange={(e) => {
                  setNickname(e.target.value);
                  if (errors.nickname) setErrors({ ...errors, nickname: undefined });
                }}
              />
              {isRegister && (
                <p id={id('nickname-hint')} className="field-hint">
                  {a.nicknameHint}
                </p>
              )}
              {errors.nickname && (
                <p id={id('nickname-error')} className="field-error">
                  {a.errors[errors.nickname]}
                </p>
              )}
            </div>

            <div className="field">
              <div className="field-head">
                <label htmlFor={id('password')}>{a.password}</label>
                <button
                  type="button"
                  className="pw-toggle"
                  aria-controls={id('password')}
                  onClick={() => setShow((s) => !s)}
                >
                  {show ? a.hidePassword : a.showPassword}
                </button>
              </div>
              <input
                ref={passwordRef}
                id={id('password')}
                name={id('password')}
                type={show ? 'text' : 'password'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={password}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={describedBy('password')}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors({ ...errors, password: undefined });
                }}
              />
              {isRegister && (
                <p id={id('password-hint')} className="field-hint">
                  {a.passwordHint}
                </p>
              )}
              {errors.password && (
                <p id={id('password-error')} className="field-error">
                  {a.errors[errors.password]}
                </p>
              )}
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? a.page.busy : a.page.submit}
            </button>

            {a.page.forgot && <p className="auth-forgot">{a.page.forgot}</p>}

            <p className="auth-switch">
              {a.page.switchPrompt} <a href={pageUrl(loc, other) + next.query}>{a.page.switchLink}</a>
            </p>
          </form>
        )}
      </main>
    </>
  );
}
