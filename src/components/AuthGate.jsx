import { useEffect, useState } from 'react'
import { Loader2, AlertTriangle, Mail, ShieldAlert, WifiOff, LogOut, RefreshCw } from 'lucide-react'
import { useAuth, canAutoStartGoogle, PASSWORD_LOGIN_ENABLED } from '../context/AuthContext'
import { DENIED_MESSAGES } from '../lib/permissions'
import GradientBlobs from './GradientBlobs'
import logo from '../assets/zopper-logo.png'

function Spinner() {
  return (
    <div className="min-h-screen grid place-items-center">
      <GradientBlobs />
      <Loader2 className="animate-spin text-zblue-500" size={28} />
    </div>
  )
}

export default function AuthGate({ children }) {
  const { user, loading, access, signInWithGoogle } = useAuth()
  const [autoStarting, setAutoStarting] = useState(false)

  // Not signed in: go straight to Google (reusing the browser's Google
  // session where there is one). Skipped after sign-out, after an error, or
  // with ?login=manual, so the sign-in screen is always reachable.
  useEffect(() => {
    if (loading || user || autoStarting || !canAutoStartGoogle()) return
    setAutoStarting(true)
    signInWithGoogle().catch(() => setAutoStarting(false))
  }, [loading, user, autoStarting, signInWithGoogle])

  if (loading || autoStarting) return <Spinner />
  if (!user) return <AuthScreen />

  if (access.status === 'granted') return children
  if (access.status === 'denied') return <AccessScreen kind="denied" access={access} />
  if (access.status === 'error') return <AccessScreen kind="error" access={access} />
  return <Spinner />
}

function Shell({ children }) {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <GradientBlobs />
      <div className="glass-card rounded-3xl shadow-soft p-8 max-w-sm w-full">
        <div className="flex items-center gap-2.5 mb-6 justify-center">
          <img src={logo} alt="Zopper" className="h-9 w-9 rounded-lg object-contain" />
          <div className="leading-tight text-center">
            <p className="font-extrabold text-[15px] text-zink tracking-tight">Zopper</p>
            <p className="text-[11px] text-zink/50 -mt-0.5">Printables Studio</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function AccessScreen({ kind, access }) {
  const { user, signOut, refreshAccess } = useAuth()
  const denied = kind === 'denied'
  const Icon = denied ? ShieldAlert : WifiOff
  return (
    <Shell>
      <div className="text-center">
        <div className={`h-12 w-12 rounded-2xl grid place-items-center mx-auto mb-4 ${denied ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
          <Icon size={24} />
        </div>
        <p className="font-bold text-zink">{denied ? 'Access not granted' : "Can't verify your access"}</p>
        <p className="text-xs text-zink/55 mt-2 leading-relaxed">
          {denied
            ? DENIED_MESSAGES[access.reason] || access.message
            : 'We could not check your permissions just now, so access is paused. Please try again in a moment.'}
        </p>
        {denied && (
          <p className="text-xs text-zink/45 mt-2 leading-relaxed">
            Ask your administrator to grant Printables Studio access to{' '}
            <span className="font-semibold text-zink/60">{user?.email}</span> in Zopper Marketing Studio, then check again.
          </p>
        )}
        <div className="mt-5 space-y-2">
          <button
            onClick={refreshAccess}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-znavy-600 to-zblue-600 text-white text-sm font-semibold py-2.5 shadow-soft hover:opacity-95 transition-opacity"
          >
            <RefreshCw size={15} /> {denied ? 'Check again' : 'Try again'}
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-zink/5 text-zink/60 text-sm font-semibold py-2.5 hover:bg-zink/10 transition-colors"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </div>
    </Shell>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.7l-7.5-5.8c-2.1 1.4-4.8 2.3-8 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}

function AuthScreen() {
  const { signIn, signInWithGoogle, signInError } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState(null)

  const handleGoogle = async () => {
    setError(null)
    setGoogleBusy(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err.message || 'Could not start Google sign-in.')
      setGoogleBusy(false)
    }
  }

  const handlePassword = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn({ email, password })
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const message = error || signInError

  return (
    <Shell>
      <button
        onClick={handleGoogle}
        disabled={googleBusy}
        className="w-full flex items-center justify-center gap-3 rounded-2xl bg-white border border-zink/10 text-zink text-sm font-semibold py-3 shadow-soft hover:bg-zink/[0.02] transition-colors disabled:opacity-60"
      >
        {googleBusy ? <Loader2 size={17} className="animate-spin" /> : <GoogleMark />}
        Continue with Google
      </button>

      {message && (
        <p className="flex items-start gap-1.5 text-xs text-red-600 mt-4">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {message}
        </p>
      )}

      {PASSWORD_LOGIN_ENABLED && (
        <div className="mt-5">
          {!showPassword ? (
            <button
              onClick={() => setShowPassword(true)}
              className="w-full text-[11px] text-zink/40 hover:text-zink/60 transition-colors"
            >
              Use email &amp; password instead
            </button>
          ) : (
            <form onSubmit={handlePassword} className="space-y-3.5 border-t border-zink/5 pt-5">
              <label className="block text-xs text-zink/55">
                Work email
                <div className="relative mt-1">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zink/30" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-xl border border-zink/10 pl-9 pr-3 py-2 text-sm outline-none focus:border-zblue-400"
                    placeholder="you@zopper.com"
                  />
                </div>
              </label>
              <label className="block text-xs text-zink/55">
                Password
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zink/10 px-3 py-2 text-sm outline-none focus:border-zblue-400"
                  placeholder="••••••••"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-znavy-600 to-zblue-600 text-white text-sm font-semibold py-2.5 shadow-soft hover:opacity-95 transition-opacity disabled:opacity-60"
              >
                {busy && <Loader2 size={15} className="animate-spin" />}
                Sign in
              </button>
            </form>
          )}
        </div>
      )}

      <p className="text-[11px] text-zink/35 mt-5 text-center leading-relaxed">
        Access is limited to <span className="font-semibold text-zink/50">@zopper.com</span> accounts with Printables
        Studio access.
      </p>
    </Shell>
  )
}
