import { Search, Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const TITLES = {
  dashboard: 'Dashboard',
  upload: 'New Print Job',
  jobs: 'Job History',
  spec: 'Print Spec',
  profile: 'Profile',
  settings: 'Settings',
}

export default function Topbar({ active, query, onQuery, onNavigate }) {
  const { user, profile } = useAuth()
  const initials = (profile?.full_name || user?.email || '?')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <header className="flex items-center justify-between gap-4 px-6 lg:px-8 py-6">
      <div>
        <h1 className="text-2xl font-extrabold text-zink tracking-tight flex items-center gap-2">
          {TITLES[active] || 'Dashboard'}
          <span className="text-lg">🖨️</span>
        </h1>
        <p className="text-xs text-zink/45 mt-0.5">Turn any PDF into a press-ready file</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 rounded-full glass-card shadow-card px-4 py-2.5 w-72">
          <Search size={16} className="text-zink/35" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search job history…"
            className="bg-transparent outline-none text-sm w-full placeholder:text-zink/35"
          />
        </div>
        <button className="grid place-items-center h-10 w-10 rounded-full glass-card shadow-card text-zink/60 hover:text-zorange-500 transition-colors">
          <Bell size={17} />
        </button>
        <button
          onClick={() => onNavigate?.('profile')}
          title={profile?.full_name || user?.email}
          className="h-10 w-10 rounded-full bg-gradient-to-br from-znavy-600 to-zblue-600 text-white grid place-items-center font-bold text-xs shadow-card shrink-0"
        >
          {initials}
        </button>
      </div>
    </header>
  )
}
