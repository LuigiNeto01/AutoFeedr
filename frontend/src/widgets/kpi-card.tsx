import { motion } from 'framer-motion'

import { Card, CardDescription, CardTitle } from '@/shared/ui/card'

interface KpiCardProps {
  label: string
  value: number
  hint?: string
}

export function KpiCard({ label, value, hint }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <Card className="h-full">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="mt-2 font-mono text-3xl">{value}</CardTitle>
        {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
      </Card>
    </motion.div>
  )
}
