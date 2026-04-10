import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CircleHelp, Eye, EyeOff, Lock } from 'lucide-react'
import { login, loginWithGoogle, type GoogleAuthMode } from '../../api/auth'
import { registerDonorAccount } from '../../api/registration'
import { SITE_DISPLAY_NAME } from '../../site'

const supporterTypeOptions = [
  { value: 'MonetaryDonor', label: 'Monetary donor' },
  { value: 'Volunteer', label: 'Volunteer' },
  { value: 'InKindDonor', label: 'In-kind donor' },
  { value: 'SkillsContributor', label: 'Skills contributor' },
  { value: 'SocialMediaAdvocate', label: 'Social media advocate' },
  { value: 'PartnerOrganization', label: 'Partner organization' },
] as const

const relationshipOptions = [
  { value: 'Local', label: 'Local supporter' },
  { value: 'International', label: 'International supporter' },
  { value: 'Diaspora', label: 'Diaspora' },
  { value: 'Corporate', label: 'Corporate / workplace' },
] as const

const acquisitionChannels = [
  'Website',
  'Social media',
  'Community event',
  'Referral or word of mouth',
  'Partner organization',
  'Email campaign',
  'Other',
] as const

const cardClass = 'rounded-2xl border border-border bg-background/80 p-5'
const inputClass =
  'mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
/** Vercel/env pastes sometimes include wrapping quotes — Google treats that as invalid_client. */
function normalizeGoogleClientId(raw: string | undefined): string {
  const s = raw?.trim() ?? ''
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
    return s.slice(1, -1).trim()
  }
  return s
}

const googleClientId = normalizeGoogleClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID)

type RelationshipValue = (typeof relationshipOptions)[number]['value']

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string
            callback: (response: { credential?: string }) => void
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | boolean>,
          ) => void
        }
      }
    }
  }
}

let googleScriptPromise: Promise<void> | null = null

function loadGoogleScript(): Promise<void> {
  if (googleScriptPromise) return googleScriptPromise
  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-gsi="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Google Sign-In failed to load.')), { once: true })
      if (window.google) resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleGsi = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Sign-In failed to load.'))
    document.head.appendChild(script)
  })
  return googleScriptPromise
}

function PasswordField(props: {
  id: string
  label: string
  autoComplete?: string
  value: string
  onChange: (value: string) => void
  hint?: string
  error?: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div>
      <label htmlFor={props.id} className="text-sm font-medium text-foreground">
        {props.label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={props.id}
          type={visible ? 'text' : 'password'}
          autoComplete={props.autoComplete}
          className={`${inputClass} mt-0 pr-12`}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          aria-invalid={!!props.error}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {props.hint && <p className="mt-1 text-xs text-muted-foreground">{props.hint}</p>}
      {props.error && <p className="mt-1 text-xs text-destructive">{props.error}</p>}
    </div>
  )
}

function FieldLabel({
  htmlFor,
  label,
  required = false,
  hint,
}: {
  htmlFor?: string
  label: string
  required?: boolean
  hint?: string
}) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-sm font-medium text-foreground">
      <span>
        {label}
        {required ? <span className="ml-1 font-semibold text-primary">*</span> : null}
      </span>
      {hint ? (
        <span title={hint} className="inline-flex text-muted-foreground">
          <CircleHelp className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </label>
  )
}

function GoogleAuthBlock(props: {
  mode: GoogleAuthMode
  disabled: boolean
  onError: (message: string) => void
  onCredential: (credential: string, mode: GoogleAuthMode) => Promise<void>
}) {
  const { mode, disabled, onError, onCredential } = props
  const buttonRef = useRef<HTMLDivElement | null>(null)
  const [buttonWidth, setButtonWidth] = useState(320)

  useEffect(() => {
    const updateWidth = () => {
      if (!buttonRef.current) return
      setButtonWidth(Math.max(260, Math.floor(buttonRef.current.clientWidth)))
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  useEffect(() => {
    if (!googleClientId || !buttonRef.current || disabled) return

    let cancelled = false
    void loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google || !buttonRef.current) return
        buttonRef.current.innerHTML = ''
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: ({ credential }) => {
            if (!credential) {
              onError('Google Sign-In did not return a credential.')
              return
            }
            void onCredential(credential, mode)
          },
        })
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          width: buttonWidth,
          text: mode === 'login' ? 'signin_with' : 'signup_with',
        })
      })
      .catch((error: unknown) => {
        onError(error instanceof Error ? error.message : 'Google Sign-In failed to load.')
      })

    return () => {
      cancelled = true
    }
  }, [mode, disabled, onCredential, onError, buttonWidth])

  if (!googleClientId) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        Google sign-{mode === 'login' ? 'in' : 'up'} can be enabled by setting `VITE_GOOGLE_CLIENT_ID` (Vercel /
        `.env`) to match `Authentication:Google:ClientId` on the API.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border/70 bg-background/70 px-2 py-2 shadow-sm">
      <div ref={buttonRef} className="flex min-h-[44px] w-full justify-center overflow-hidden rounded-lg" />
    </div>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/admin'

  const [tab, setTab] = useState<'login' | 'register'>('login')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ user?: string; pass?: string }>({})
  const [registerErrors, setRegisterErrors] = useState<{
    displayName?: string
    email?: string
    password?: string
    supporterType?: string
    country?: string
  }>({})

  const [rEmail, setREmail] = useState('')
  const [rPassword, setRPassword] = useState('')
  const [rSupporterType, setRSupporterType] = useState<string>('MonetaryDonor')
  const [rDisplayName, setRDisplayName] = useState('')
  const [rOrg, setROrg] = useState('')
  const [rFirst, setRFirst] = useState('')
  const [rLast, setRLast] = useState('')
  const [rRel, setRRel] = useState<RelationshipValue>('Local')
  const [rRegion, setRRegion] = useState('')
  const [rCountry, setRCountry] = useState('Ghana')
  const [rPhone, setRPhone] = useState('')
  const [rChannel, setRChannel] = useState('Website')

  async function postLoginRedirect() {
    navigate(from.startsWith('/login') ? '/admin' : from, { replace: true })
  }

  const completeGoogleAuth = useCallback(
    async (credential: string, mode: GoogleAuthMode) => {
      setSubmitting(true)
      setError(null)
      try {
        await loginWithGoogle(credential, mode)
        navigate(mode === 'register' ? '/donor-dashboard' : from.startsWith('/login') ? '/admin' : from, { replace: true })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Google authentication failed.')
      } finally {
        setSubmitting(false)
      }
    },
    [from, navigate],
  )

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const fe: { user?: string; pass?: string } = {}
    if (!username.trim()) fe.user = 'Username is required.'
    if (!password) fe.pass = 'Password is required.'
    setFieldErrors(fe)
    if (Object.keys(fe).length > 0) return

    setSubmitting(true)
    try {
      await login(username.trim(), password, remember)
      await postLoginRedirect()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setSubmitting(false)
    }
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const nextErrors: typeof registerErrors = {}
    if (!rDisplayName.trim()) nextErrors.displayName = 'Display name is required.'
    if (!rEmail.trim()) nextErrors.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rEmail.trim())) nextErrors.email = 'Enter a valid email address.'
    if (!rPassword) nextErrors.password = 'Password is required.'
    else if (rPassword.length < 14) nextErrors.password = 'Password must be at least 14 characters long.'
    if (!rSupporterType.trim()) nextErrors.supporterType = 'Supporter type is required.'
    if (!rCountry.trim()) nextErrors.country = 'Country is required.'
    setRegisterErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      await registerDonorAccount({
        email: rEmail.trim(),
        password: rPassword,
        supporterType: rSupporterType,
        displayName: rDisplayName.trim(),
        organizationName: rOrg,
        firstName: rFirst,
        lastName: rLast,
        relationshipType: rRel,
        region: rRegion,
        country: rCountry.trim(),
        phone: rPhone,
        acquisitionChannel: rChannel,
      })
      navigate('/donor-dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-background py-16 lg:py-24">
      <div className={`mx-auto px-6 ${tab === 'register' ? 'max-w-5xl' : 'max-w-md'}`}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[0_24px_60px_-42px_rgba(26,55,49,0.28)] sm:p-8"
        >
          <div className="mb-6 flex gap-2 rounded-xl bg-muted/60 p-1">
            <button
              type="button"
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                tab === 'login' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => {
                setTab('login')
                setError(null)
                setRegisterErrors({})
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                tab === 'register' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => {
                setTab('register')
                setError(null)
                setFieldErrors({})
              }}
            >
              Register
            </button>
          </div>

          <div className="mb-8">
            <div className={tab === 'register' ? '' : 'flex flex-col items-center text-center'}>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                <Lock className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="font-heading text-2xl font-bold text-foreground">
                {tab === 'login' ? 'Sign in' : 'Create donor account'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {tab === 'login'
                  ? `Access your ${SITE_DISPLAY_NAME} portal.`
                  : ''}
              </p>
            </div>
          </div>

          {error && (
            <div
              className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {error}
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="staff-user" className="text-sm font-medium text-foreground">
                  Username
                </label>
                <input
                  id="staff-user"
                  name="username"
                  autoComplete="username"
                  type="text"
                  className={inputClass}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  aria-invalid={!!fieldErrors.user}
                />
                {fieldErrors.user && <p className="mt-1 text-xs text-destructive">{fieldErrors.user}</p>}
              </div>
              <PasswordField
                id="staff-pass"
                label="Password"
                autoComplete="current-password"
                value={password}
                onChange={setPassword}
                error={fieldErrors.pass}
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-input"
                />
                Remember this device
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
              <GoogleAuthBlock
                mode="login"
                disabled={submitting}
                onError={setError}
                onCredential={completeGoogleAuth}
              />
            </form>
          ) : (
            <form onSubmit={onRegister} className="space-y-6" noValidate>
              <section className={`${cardClass} space-y-6`}>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Create your donor account in one form below. Start with the account details you will use to sign in, then add any profile information you want us to keep on file.
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Account access</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <FieldLabel
                        htmlFor="register-display-name"
                        label="Display name"
                        required
                        hint="This is the name that will appear in your donor account."
                      />
                      <input
                        id="register-display-name"
                        className={`${inputClass} ${registerErrors.displayName ? 'border-destructive' : ''}`}
                        value={rDisplayName}
                        onChange={(e) => setRDisplayName(e.target.value)}
                        aria-invalid={!!registerErrors.displayName}
                      />
                      {registerErrors.displayName && <p className="mt-1 text-xs text-destructive">{registerErrors.displayName}</p>}
                    </div>
                    <div>
                      <FieldLabel
                        htmlFor="register-email"
                        label="Email"
                        required
                        hint="We will use this for login, receipts, and account updates."
                      />
                      <input
                        id="register-email"
                        type="email"
                        className={`${inputClass} ${registerErrors.email ? 'border-destructive' : ''}`}
                        value={rEmail}
                        onChange={(e) => setREmail(e.target.value)}
                        aria-invalid={!!registerErrors.email}
                      />
                      {registerErrors.email && <p className="mt-1 text-xs text-destructive">{registerErrors.email}</p>}
                    </div>
                    <div className="text-sm">
                      <PasswordField
                        id="register-pass"
                        label="Password *"
                        autoComplete="new-password"
                        value={rPassword}
                        onChange={setRPassword}
                        hint="Use at least 14 characters for a stronger account."
                        error={registerErrors.password}
                      />
                    </div>
                    <div>
                      <FieldLabel
                        htmlFor="register-supporter-type"
                        label="Supporter type"
                        required
                        hint="Choose the support role that best matches you."
                      />
                      <select
                        id="register-supporter-type"
                        className={`${inputClass} ${registerErrors.supporterType ? 'border-destructive' : ''}`}
                        value={rSupporterType}
                        onChange={(e) => setRSupporterType(e.target.value)}
                        aria-invalid={!!registerErrors.supporterType}
                      >
                        {supporterTypeOptions.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      {registerErrors.supporterType && <p className="mt-1 text-xs text-destructive">{registerErrors.supporterType}</p>}
                    </div>
                    <div>
                      <FieldLabel
                        htmlFor="register-channel"
                        label="How did you hear about us?"
                        hint="This helps us understand which outreach channels are working."
                      />
                      <select
                        id="register-channel"
                        className={inputClass}
                        value={rChannel}
                        onChange={(e) => setRChannel(e.target.value)}
                      >
                        {acquisitionChannels.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Personal details</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Add any extra information you would like attached to your donor profile.
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel htmlFor="register-first" label="First name" hint="Optional preferred first name for greetings." />
                      <input id="register-first" className={inputClass} value={rFirst} onChange={(e) => setRFirst(e.target.value)} />
                    </div>
                    <div>
                      <FieldLabel htmlFor="register-last" label="Last name" hint="Optional surname or family name." />
                      <input id="register-last" className={inputClass} value={rLast} onChange={(e) => setRLast(e.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                      <FieldLabel htmlFor="register-org" label="Organization name" hint="Use this if you are giving on behalf of a group or company." />
                      <input id="register-org" className={inputClass} value={rOrg} onChange={(e) => setROrg(e.target.value)} />
                    </div>
                    <div>
                      <FieldLabel htmlFor="register-rel" label="Relationship to our work" hint="Tell us how you are connected to the mission." />
                      <select
                        id="register-rel"
                        className={inputClass}
                        value={rRel}
                        onChange={(e) => setRRel(e.target.value as RelationshipValue)}
                      >
                        {relationshipOptions.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <FieldLabel htmlFor="register-phone" label="Phone" hint="Optional number for follow-up contact." />
                      <input id="register-phone" className={inputClass} value={rPhone} onChange={(e) => setRPhone(e.target.value)} />
                    </div>
                    <div>
                      <FieldLabel htmlFor="register-region" label="Region" hint="Share the region you are based in, if relevant." />
                      <input id="register-region" className={inputClass} value={rRegion} onChange={(e) => setRRegion(e.target.value)} />
                    </div>
                    <div>
                      <FieldLabel
                        htmlFor="register-country"
                        label="Country"
                        required
                        hint="Country is required so we can complete your donor profile."
                      />
                      <input
                        id="register-country"
                        className={`${inputClass} ${registerErrors.country ? 'border-destructive' : ''}`}
                        value={rCountry}
                        onChange={(e) => setRCountry(e.target.value)}
                        aria-invalid={!!registerErrors.country}
                      />
                      {registerErrors.country && <p className="mt-1 text-xs text-destructive">{registerErrors.country}</p>}
                    </div>
                  </div>
                </div>
              </section>

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:opacity-50"
                >
                  {submitting ? 'Creating account…' : 'Create account'}
                </button>
                <GoogleAuthBlock
                  mode="register"
                  disabled={submitting}
                  onError={setError}
                  onCredential={completeGoogleAuth}
                />
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  )
}
