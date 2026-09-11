import { useRef, useState } from 'react'
import { UploadCloud, FileText } from 'lucide-react'

export default function UploadZone({ onFiles }) {
  const inputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)

  const handleFiles = (fileList) => {
    const pdfs = Array.from(fileList).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (pdfs.length) onFiles(pdfs)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragActive(true)
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragActive(false)
        handleFiles(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      className={`relative cursor-pointer rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-all ${
        dragActive
          ? 'border-zorange-400 bg-zorange-50/60 scale-[1.01]'
          : 'border-zblue-300/60 bg-white/50 hover:bg-white/70 hover:border-zblue-400'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-gradient-to-br from-zblue-500 to-znavy-600 grid place-items-center shadow-soft">
        <UploadCloud size={26} className="text-white" strokeWidth={2} />
      </div>
      <p className="font-semibold text-zink">Drop a PDF here, or click to browse</p>
      <p className="text-xs text-zink/45 mt-1.5 flex items-center justify-center gap-1.5">
        <FileText size={13} /> Sharp vector artwork, bleed & registration marks, certified CMYK, QR & ink checks — all in your browser
      </p>
    </div>
  )
}
