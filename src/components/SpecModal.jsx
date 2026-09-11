import { X } from 'lucide-react'
import SpecContent from './SpecContent'

export default function SpecModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-znavy-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl bg-white shadow-2xl p-7"
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-extrabold text-zink">Print pipeline — spec & defect log</h2>
          <button onClick={onClose} className="text-zink/40 hover:text-zink">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-zink/45 mb-6">What every job is built to, and the real defects this pipeline has been hardened against.</p>
        <SpecContent />
      </div>
    </div>
  )
}
