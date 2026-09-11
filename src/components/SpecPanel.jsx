import { Droplet, Scissors, Crosshair, Ruler } from 'lucide-react'

const ROWS = [
  { icon: Droplet, label: 'Colour target', value: 'FOGRA39L Coated · DeviceCMYK · rel. colorimetric + BPC' },
  { icon: Ruler, label: 'Bleed', value: '3mm synthesised by edge-pixel extrusion' },
  { icon: Scissors, label: 'Marks', value: 'Trim + 4 registration targets + 22-patch bar + caption' },
  { icon: Crosshair, label: 'Ink ceiling', value: '330% TAC (coated), measured on artwork only' },
]

export default function SpecPanel({ onOpenFull }) {
  return (
    <div className="glass-card rounded-3xl shadow-card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <p className="font-bold text-zink text-sm">Standard build spec</p>
        <span className="text-[10px] text-zink/35 uppercase tracking-wide">Applied to every job</span>
      </div>
      <div className="space-y-3.5 flex-1">
        {ROWS.map((r) => {
          const Icon = r.icon
          return (
            <div key={r.label} className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-xl bg-zblue-50 text-zblue-600 grid place-items-center shrink-0">
                <Icon size={14} />
              </div>
              <div>
                <p className="text-xs font-semibold text-zink/80">{r.label}</p>
                <p className="text-[11px] text-zink/45 leading-snug">{r.value}</p>
              </div>
            </div>
          )
        })}
      </div>
      <button
        onClick={onOpenFull}
        className="mt-4 text-xs font-semibold text-zblue-600 hover:text-zblue-700 text-left"
      >
        View full spec & defect log →
      </button>
    </div>
  )
}
