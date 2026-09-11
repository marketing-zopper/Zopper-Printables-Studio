import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'

const TIPS = [
  'Never trust a first-pass conversion by eye — diff the render against the source.',
  'Decode every QR twice: once from source, once from the finished press-resolution file.',
  'Ask rather than guess on ambiguous physical size — pixel-as-point exports are common.',
  'Measure ink coverage on the artwork only — registration marks read 400% by design.',
  'Re-verify every re-upload from scratch, even under a filename seen before.',
]

export default function GuidelinesCard({ onOpenFull }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % TIPS.length), 4500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="rounded-3xl bg-gradient-to-br from-znavy-600 via-znavy-500 to-zblue-600 p-6 text-white shadow-soft relative overflow-hidden h-full flex flex-col">
      <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-zorange-400/30 blur-3xl" />
      <div className="h-10 w-10 rounded-2xl bg-white/15 grid place-items-center mb-4">
        <ShieldCheck size={18} />
      </div>
      <p className="font-bold text-sm relative">Working rule of the day</p>
      <p className="text-xs text-white/75 mt-2 leading-relaxed relative min-h-[3.5rem]">{TIPS[i]}</p>
      <button
        onClick={onOpenFull}
        className="mt-auto relative rounded-2xl bg-white text-znavy-600 text-sm font-semibold py-2.5 hover:bg-white/90 transition-colors"
      >
        View full spec & defect log
      </button>
    </div>
  )
}
