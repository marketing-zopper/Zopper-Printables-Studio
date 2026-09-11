import { useState } from 'react'
import { LogOut, Save, CheckCircle2, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function ProfilePanel() {
  const { user, profile, updateProfile, signOut } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      await updateProfile({ full_name: fullName })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const initials = (fullName || user?.email || '?')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="max-w-md space-y-6">
      <div className="glass-card rounded-3xl shadow-card p-7">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-znavy-600 to-zblue-600 text-white grid place-items-center font-bold text-lg shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-zink truncate">{profile?.full_name || 'Your profile'}</p>
            <p className="text-xs text-zink/45 truncate">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <label className="block text-xs text-zink/55">
            Full name
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-zink/10 px-3 py-2 text-sm outline-none focus:border-zblue-400"
              placeholder="Your name"
            />
          </label>
          <label className="block text-xs text-zink/55">
            Email
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="mt-1 block w-full rounded-xl border border-zink/10 px-3 py-2 text-sm outline-none bg-zink/5 text-zink/40"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-znavy-600 to-zblue-600 text-white text-sm font-semibold py-2.5 shadow-soft hover:opacity-95 transition-opacity disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
            {saved ? 'Saved' : 'Save changes'}
          </button>
        </form>
      </div>

      <div className="glass-card rounded-3xl shadow-card p-7">
        <p className="font-bold text-zink text-sm mb-1">Account</p>
        <p className="text-[11px] text-zink/45 mb-4 leading-relaxed">
          Signed in with a @zopper.com account. Job history is shared across everyone at Zopper — signing out only
          affects this device.
        </p>
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-red-50 text-red-600 text-sm font-semibold py-2.5 hover:bg-red-100 transition-colors"
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </div>
  )
}
