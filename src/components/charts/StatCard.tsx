interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  accent?: boolean
}

export function StatCard({ title, value, subtitle, accent }: StatCardProps) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-5">
      <p className="text-on-surface-variant text-xs font-medium mb-1">{title}</p>
      <p className={`font-display text-2xl font-bold ${accent ? 'text-primary' : 'text-on-surface'}`}>
        {value}
      </p>
      {subtitle && (
        <p className="text-on-surface-variant text-xs mt-0.5">{subtitle}</p>
      )}
    </div>
  )
}
