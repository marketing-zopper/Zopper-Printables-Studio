import {
  LayoutDashboard,
  UploadCloud,
  ListChecks,
  FileCog,
  Settings,
  UserCircle,
} from 'lucide-react'
import logo from '../assets/zopper-logo.png'

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'upload', label: 'Upload', icon: UploadCloud },
  { key: 'jobs', label: 'Job History', icon: ListChecks },
  { key: 'spec', label: 'Print Spec', icon: FileCog },
  { key: 'profile', label: 'Profile', icon: UserCircle },
  { key: 'settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ active, onNavigate }) {
  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 px-5 py-6">
      <div className="flex items-center gap-2.5 px-2 mb-10">
        <img src={logo} alt="Zopper" className="h-8 w-8 rounded-lg object-contain" />
        <div className="leading-tight">
          <p className="font-extrabold text-[15px] text-zink tracking-tight">Zopper</p>
          <p className="text-[11px] text-zink/50 -mt-0.5">Printables Studio</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1.5">
        {NAV.map((item) => {
          const Icon = item.icon
          const isActive = active === item.key
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-znavy-600 to-zblue-600 text-white shadow-soft'
                  : 'text-zink/55 hover:bg-white/70 hover:text-zink'
              }`}
            >
              <Icon
                size={18}
                strokeWidth={2.2}
                className={isActive ? 'text-zorange-400' : 'text-zink/40 group-hover:text-zblue-500'}
              />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto rounded-3xl bg-gradient-to-br from-znavy-600 to-zblue-600 p-5 text-white shadow-soft relative overflow-hidden">
        <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-zorange-400/40 blur-2xl" />
        <p className="text-sm font-semibold relative">Press-ready, every time</p>
        <p className="text-xs text-white/70 mt-1.5 relative leading-relaxed">
          Sharp vector artwork with bleed, marks & certified colour, to the Zopper print spec.
        </p>
      </div>
    </aside>
  )
}
