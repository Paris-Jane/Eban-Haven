import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { login } from '../api/auth'
import { registerDonorAccount } from '../api/registration'
import { SITE_DISPLAY_NAME } from '../site'

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

type RelationshipValue = (typeof relationshipOptions)[number]['value']

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
    if (!rEmail.trim() || !rPassword || !rDisplayName.trim()) {
      setError('Email, password, and display name are required.')
      return
    }
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
        country: rCountry,
        phone: rPhone,
        acquisitionChannel: rChannel,
      })
      try {
        setError('Supporter created. Staff login is separate; please sign in with your staff username/password.')
        setTab('login')
        setUsername(rEmail.trim())
      } catch {
        setError('Account created. If email confirmation is required, verify your inbox and then sign in.')
        setTab('login')
        setUsername(rEmail.trim())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-muted/30 py-16 lg:py-24">
      <div className={`mx-auto px-6 ${tab === 'register' ? 'max-w-4xl' : 'max-w-md'}`}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-8 shadow-sm"
        >
          <div className="mb-6 flex gap-2 rounded-lg bg-muted/50 p-1">
            <button
              type="button"
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                tab === 'login' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => {
                setTab('login')
                setError(null)
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                tab === 'register' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => {
                setTab('register')
                setError(null)
              }}
            >
              Register
            </button>
          </div>

          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Lock className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              {tab === 'login' ? 'Sign in' : 'Create donor account'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {tab === 'login'
                ? `Access your ${SITE_DISPLAY_NAME} portal.`
                : ' '}
              {tab === 'login' && (
                <span className="mt-2 block">Use your username and password.</span>
              )}
            </p>
          </div>

          {tab === 'login' ? (
            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              {error && (
                <div
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                  role="alert"
                >
                  {error}
                </div>
              )}
              <div>
                <label htmlFor="staff-user" className="text-sm font-medium text-foreground">
                  Username
                </label>
                <input
                  id="staff-user"
                  name="username"
                  autoComplete="username"
                  type="text"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  aria-invalid={!!fieldErrors.user}
                />
                {fieldErrors.user && <p className="mt-1 text-xs text-destructive">{fieldErrors.user}</p>}
              </div>
              <div>
                <label htmlFor="staff-pass" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <input
                  id="staff-pass"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {fieldErrors.pass && <p className="mt-1 text-xs text-destructive">{fieldErrors.pass}</p>}
              </div>
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
            </form>
          ) : (
            <form onSubmit={onRegister} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-sm">
                  <span className="text-muted-foreground">Email *</span>
                  <input
                    type="email"
                    required
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={rEmail}
                    onChange={(e) => setREmail(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">Password *</span>
                  <input
                    type="password"
                    required
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={rPassword}
                    onChange={(e) => setRPassword(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">Supporter type *</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={rSupporterType}
                    onChange={(e) => setRSupporterType(e.target.value)}
                  >
                    {supporterTypeOptions.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm lg:col-span-2">
                  <span className="text-muted-foreground">Display name *</span>
                  <input
                    required
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={rDisplayName}
                    onChange={(e) => setRDisplayName(e.target.value)}
                  />
                </label>
                <label className="text-sm lg:col-span-3">
                  <span className="text-muted-foreground">Organization name</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={rOrg}
                    onChange={(e) => setROrg(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">First name</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={rFirst}
                    onChange={(e) => setRFirst(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">Last name</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={rLast}
                    onChange={(e) => setRLast(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">Relationship to our work</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={rRel}
                    onChange={(e) => setRRel(e.target.value as RelationshipValue)}
                  >
                    {relationshipOptions.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">Region</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={rRegion}
                    onChange={(e) => setRRegion(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">Country</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={rCountry}
                    onChange={(e) => setRCountry(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">Phone</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={rPhone}
                    onChange={(e) => setRPhone(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">How did you hear about us?</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={rChannel}
                    onChange={(e) => setRChannel(e.target.value)}
                  >
                    {acquisitionChannels.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  )
}
