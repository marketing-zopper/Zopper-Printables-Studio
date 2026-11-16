import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { apiFetch } from '../lib/api'

const AuthContext = createContext(null)

// Set when the user signs out (or an automatic Google redirect has been
// started) so we don't bounce them straight back to Google in a loop.
const NO_AUTO_KEY = 'zps_no_auto_google'
const ACCESS_RECHECK_MS = 60_000

export const PASSWORD_LOGIN_ENABLED = import.meta.env.VITE_ENABLE_PASSWORD_LOGIN !== 'false'

const storage = {
  get: (k) => { try { return sessionStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { sessionStorage.setItem(k, v) } catch { /* private mode */ } },
  remove: (k) => { try { sessionStorage.removeItem(k) } catch { /* private mode */ } },
}

export function canAutoStartGoogle() {
  const params = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  if (params.get('login') === 'manual') return false
  if (params.get('error') || params.get('error_description') || hash.get('error') || hash.get('error_description')) return false
  return !storage.get(NO_AUTO_KEY)
}

// Google/Supabase report a failed sign-in by redirecting back with an error in
// the URL. Read it once, then tidy the address bar.
function takeOAuthError() {
  const params = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const raw = params.get('error_description') || hash.get('error_description') || params.get('error') || hash.get('error')
  if (!raw) return null
  window.history.replaceState({}, document.title, window.location.pathname)
  if (/database error saving new user|zopper\.com/i.test(raw)) return 'Only @zopper.com Google accounts can sign in.'
  if (/access_denied/i.test(raw)) return 'Google sign-in was cancelled.'
  return raw.replace(/\+/g, ' ')
}

// Read once at load (not in render) so React StrictMode's double render can't
// swallow the message.
const initialOAuthError = takeOAuthError()

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [access, setAccess] = useState({ status: 'none' })
  const [signInError, setSignInError] = useState(initialOAuthError)
  const accessRef = useRef(access)
  accessRef.current = access

  const loadProfile = useCallback(async (userId) => {
    if (!userId) return setProfile(null)
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (!error) setProfile(data)
  }, [])

  // Ask the server who we are and what we may do. It verifies the session and
  // reads the central employee record — the browser can't grant itself a role.
  const refreshAccess = useCallback(async () => {
    try {
      const me = await apiFetch('/me')
      setAccess({ status: 'granted', ...me })
    } catch (err) {
      if (err.status === 401) {
        // Stop here rather than bouncing back to Google: if the server keeps
        // rejecting a fresh session, an automatic retry would loop forever.
        storage.set(NO_AUTO_KEY, '1')
        setSignInError('Your session could not be verified. Please sign in again.')
        await supabase.auth.signOut()
      } else if (err.status === 403) {
        setAccess({ status: 'denied', reason: err.code, message: err.message })
      } else if (accessRef.current.status !== 'granted') {
        // Can't verify: stay locked out (fail closed). If we were already in,
        // keep the screen up — every API call is still checked server-side.
        setAccess({ status: 'error', message: err.message })
      }
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      if (event === 'SIGNED_IN') storage.remove(NO_AUTO_KEY)
      if (!newSession) {
        setProfile(null)
        setAccess({ status: 'none' })
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) return undefined
    setAccess({ status: 'checking' })
    refreshAccess()
    const timer = setInterval(refreshAccess, ACCESS_RECHECK_MS)
    const onVisible = () => !document.hidden && refreshAccess()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, refreshAccess])

  useEffect(() => {
    if (userId && access.status === 'granted') loadProfile(userId)
  }, [userId, access.status, loadProfile])

  const signInWithGoogle = async () => {
    setSignInError(null)
    // Cleared again on SIGNED_IN; stops an auto-redirect loop if the user
    // backs out of Google's screen.
    storage.set(NO_AUTO_KEY, '1')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/',
        // A hint to Google's account chooser only; the real @zopper.com and
        // role checks happen server-side.
        queryParams: { hd: 'zopper.com' },
      },
    })
    if (error) {
      setSignInError(error.message)
      throw error
    }
  }

  // Legacy email + password sign-in, kept as a rollback path until Google
  // sign-in has been verified for everyone (see VITE_ENABLE_PASSWORD_LOGIN).
  const signIn = async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw error
  }

  const signOut = async () => {
    storage.set(NO_AUTO_KEY, '1')
    await supabase.auth.signOut()
  }

  const updateProfile = async (patch) => {
    if (!session?.user) throw new Error('Not signed in.')
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', session.user.id)
      .select()
      .single()
    if (error) throw error
    setProfile(data)
    return data
  }

  const can = (action) => access.status === 'granted' && Boolean(access.permissions?.[action])

  const value = {
    session,
    user: session?.user || null,
    profile,
    loading,
    access,
    role: access.status === 'granted' ? access.role : null,
    can,
    refreshAccess,
    signInError,
    signInWithGoogle,
    signIn,
    signOut,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
