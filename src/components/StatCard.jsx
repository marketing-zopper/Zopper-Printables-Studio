export default function StatCard({ label, value, icon: Icon, accent = 'blue' }) {
  const accents = {
    blue: 'bg-zblue-50 text-zblue-600',
    orange: 'bg-zorange-50 text-zorange-600',
    navy: 'bg-znavy-500/10 text-znavy-500',
  }
  return (
    <div className="glass-card rounded-3xl shadow-card px-6 py-5 flex items-center justify-between flex-1 min-w-[180px]">
      <div>
        <p className="text-2xl font-extrabold text-zink tracking-tight">{value}</p>
        <p className="text-xs text-zink/45 mt-1">{label}</p>
      </div>
      <div className={`h-11 w-11 rounded-2xl grid place-items-center ${accents[accent]}`}>
        <Icon size={20} strokeWidth={2.2} />
      </div>
    </div>
  )
}
