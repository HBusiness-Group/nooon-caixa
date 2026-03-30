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
    <nav className="flex bg-[#111a14] border-b border-[rgba(109,212,0,0.08)] flex-shrink-0">
      {TABS.map(tab => (
        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
          className={`flex-1 py-2.5 font-['Barlow_Condensed'] text-[13px] font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === tab.id
              ? 'text-[#6dd400] border-[#6dd400]'
              : 'text-[#3a5030] border-transparent hover:text-[#8aab80]'
          }`}>
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
