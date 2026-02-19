import { useState } from 'react'

import LeetCodeDashboard from './LeetCodeDashboard'
import LinkedinDashboard from './LinkedinDashboard'

const MODES = [
  { key: 'linkedin', label: 'Pipeline LinkedIn' },
  { key: 'leetcode', label: 'Pipeline LeetCode -> GitHub' },
]

export default function App() {
  const [mode, setMode] = useState('linkedin')

  return (
    <div>
      <header className="mode-switch">
        {MODES.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className={`mode-btn ${mode === entry.key ? 'active' : ''}`}
            onClick={() => setMode(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </header>
      {mode === 'linkedin' ? <LinkedinDashboard /> : <LeetCodeDashboard />}
    </div>
  )
}
