'use client'
export const runtime = 'edge'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/useAppStore'
import AuthPage from './auth/page'
import AppShell from '@/components/layout/AppShell'

export default function Home() {
  const [loading, setLoading] = useState(true)
  const { userId, setUserId, loadAccounts, loadTransactions } = useAppStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id)
        loadAccounts()
        loadTransactions()
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id)
        loadAccounts()
        loadTransactions()
      } else {
        setUserId(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1410] flex items-center justify-center">
        <div className="text-[#6dd400] font-['Barlow_Condensed'] text-xl font-bold tracking-widest animate-pulse">
          NOOON CAIXA
        </div>
      </div>
    )
  }

  if (!userId) return <AuthPage />
  return <AppShell />
}
