'use client'
import { useAppStore } from '@/store/useAppStore'
import Topbar from './Topbar'
import NavBar from './NavBar'
import RegistroScreen from '@/components/transactions/RegistroScreen'
import CalendarioScreen from '@/components/calendar/CalendarioScreen'
import ResumoScreen from '@/components/transactions/ResumoScreen'
import ContasScreen from '@/components/accounts/ContasScreen'
import ArquivoScreen from '@/components/arquivo/ArquivoScreen'

export default function AppShell() {
  const { activeTab } = useAppStore()

  return (
    <div className="flex flex-col h-screen w-full bg-[#0d1410]">
      <Topbar />
      <NavBar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {activeTab === 'contas'     && <ContasScreen />}
        {activeTab === 'registro'   && <RegistroScreen />}
        {activeTab === 'arquivo'    && <ArquivoScreen />}
        {activeTab === 'calendario' && <CalendarioScreen />}
        {activeTab === 'resumo'     && <ResumoScreen />}
      </main>
    </div>
  )
}
