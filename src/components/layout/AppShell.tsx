'use client'
import { useAppStore } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'
import Topbar from './Topbar'
import NavBar from './NavBar'
import RegistroScreen from '@/components/transactions/RegistroScreen'
import CalendarioScreen from '@/components/calendar/CalendarioScreen'
import ResumoScreen from '@/components/transactions/ResumoScreen'
import ContasScreen from '@/components/accounts/ContasScreen'

export default function AppShell() {
  const { activeTab } = useAppStore()

  return (
    <div className="flex flex-col h-screen bg-[#0d1410] max-w-2xl mx-auto">
      <Topbar />
      <NavBar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {activeTab === 'registro'   && <RegistroScreen />}
        {activeTab === 'calendario' && <CalendarioScreen />}
        {activeTab === 'resumo'     && <ResumoScreen />}
        {activeTab === 'contas'     && <ContasScreen />}
      </main>
    </div>
  )
}
