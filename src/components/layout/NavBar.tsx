'use client'
import { useAppStore } from '@/store/useAppStore'

const TABS = [
  { id: 'registro',   label: 'Registro' },
  { id: 'calendario', label: 'Calendário' },
  { id: 'resumo',     label: 'Resumo' },
  { id: 'contas',     label: 'Contas' },
] as const

export default function NavBar() {
  const { activeTab, setActiveTab } = useAppStore()

  return (
    <nav className="flex flex-shrink-0 border-b" style={{ background: '#1c2a1f', borderColor: 'rgba(109,212,0,0.15)' }}>
      {TABS.map(tab => (
        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
          className="flex-1 py-2.5 font-['Barlow_Condensed'] font-bold uppercase tracking-wider border-b-2 transition-all"
          style={{
            fontSize: 13,
            color: activeTab === tab.id ? '#6dd400' : '#6a9060',
            borderBottomColor: activeTab === tab.id ? '#6dd400' : 'transparent',
          }}>
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
