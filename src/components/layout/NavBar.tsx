'use client'
import { useAppStore } from '@/store/useAppStore'

const TABS = [
  { id: 'contas',    label: 'Contas',     icon: null },
  { id: 'registro',  label: 'Registro',   icon: null },
  { id: 'arquivo',   label: null,         icon: '🗂️' },
  { id: 'calendario',label: null,         icon: '📅' },
  { id: 'resumo',    label: null,         icon: '📊' },
] as const

export default function NavBar() {
  const { activeTab, setActiveTab } = useAppStore()

  return (
    <nav className="flex flex-shrink-0 border-b" style={{ background: '#1c2a1f', borderColor: 'rgba(109,212,0,0.15)' }}>
      {TABS.map(tab => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 py-2.5 flex flex-col items-center justify-center gap-0.5 border-b-2 transition-all"
            style={{
              borderBottomColor: isActive ? '#6dd400' : 'transparent',
            }}
          >
            {tab.icon ? (
              <>
                <span style={{ fontSize: 16, lineHeight: 1 }}>{tab.icon}</span>
                <span
                  className="font-['Barlow_Condensed'] font-bold uppercase tracking-wider"
                  style={{ fontSize: 8, color: isActive ? '#6dd400' : '#6a9060' }}
                >
                  {tab.id}
                </span>
              </>
            ) : (
              <span
                className="font-['Barlow_Condensed'] font-bold uppercase tracking-wider"
                style={{ fontSize: 13, color: isActive ? '#6dd400' : '#6a9060' }}
              >
                {tab.label}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
