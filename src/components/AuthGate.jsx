import { useState } from 'react'
import { Loader2, AlertTriangle, Mail, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import GradientBlobs from './GradientBlobs'
import logo from '../assets/zopper-logo.png'

export default function AuthGate({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <GradientBlobs />
        <Loader2 className="animate-spin text-zblue-500" size={28} />
      </div>
    )
  }

  if (!user) return <AuthScreen />

  return children
}

function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmationSent, setConfirmationSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn({ email, password })
      } else {
        const { needsEmailConfirmation } = await signUp({ email, password, fullName })
        if (needsEmailConfirmation) {
          setConfirmationSent(true)
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  if (confirmationSent) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <GradientBlobs />
        <div className="glass-card rounded-3xl shadow-soft p-8 max-w-sm w-full text-center">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 grid place-items-center mx-auto mb-4">
            <CheckCircle2 size={24} />
          </div>
          <p className="font-bold text-zink">Check your email</p>
          <p className="text-xs text-zink/50 mt-2 leading-relaxed">
            We sent a confirmation link to <span className="font-semibold text-zink/70">{email}</span>. Click it, then
            come back and sign in.
          </p>
          <button
            onClick={() => {
              setConfirmationSent(false)
              setMode('signin')
            }}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-znavy-600 to-zblue-600 text-white text-sm font-semibold py-2.5 shadow-soft hover:opacity-95 transition-opacity"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

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

        <div className="flex rounded-2xl bg-zink/5 p-1 mb-6">
          {['signin', 'signup'].map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setError(null)
              }}
              className={`flex-1 text-xs font-semibold py-2 rounded-xl transition-colors ${
                mode === m ? 'bg-white text-zink shadow-sm' : 'text-zink/45'
              }`}
            >
              {m === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <label className="block text-xs text-zink/55">
              Full name
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-zink/10 px-3 py-2 text-sm outline-none focus:border-zblue-400"
                placeholder="Ada Lovelace"
              />
            </label>
          )}
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
          {mode === 'signup' && (
            <label className="block text-xs text-zink/55">
              Confirm password
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-zink/10 px-3 py-2 text-sm outline-none focus:border-zblue-400"
                placeholder="••••••••"
              />
            </label>
          )}

          {error && (
            <p className="flex items-start gap-1.5 text-xs text-red-600">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-znavy-600 to-zblue-600 text-white text-sm font-semibold py-2.5 shadow-soft hover:opacity-95 transition-opacity disabled:opacity-60"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-[11px] text-zink/35 mt-5 text-center leading-relaxed">
          Access is limited to <span className="font-semibold text-zink/50">@zopper.com</span> email addresses.
        </p>
      </div>
    </div>
  )
}
