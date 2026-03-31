'use client'
import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'
import { fmtCurrency } from '@/lib/utils'

export default function Topbar() {
  const { accounts, currentAccountId, setCurrentAccount } = useAppStore()
  const [showPicker, setShowPicker] = useState(false)

  const balance = accounts.reduce((s, a) => s + (a.current_balance ?? a.initial_balance ?? 0), 0)

  return (
    <header style={{ background: '#1c2a1f' }} className="flex items-center justify-between px-4 py-3 border-b border-[rgba(109,212,0,0.15)] flex-shrink-0 relative">
      <div className="flex items-center gap-2">
        <svg width="26" height="26" viewBox="0 0 100 100" fill="none">
          <path d="M50 5L93 27.5V72.5L50 95L7 72.5V27.5L50 5Z" fill="#1a5c2a" opacity="0.9"/>
          <rect x="28" y="32" width="44" height="36" rx="10" fill="none" stroke="#6dd400" strokeWidth="9"/>
        </svg>
        <div>
          <div className="font-['Barlow_Condensed'] text-lg font-black tracking-wide leading-none" style={{ color: '#2a9a40' }}>
            NO<span style={{ color: '#6dd400' }}>O</span>ON <span style={{ color: '#6a9060', fontSize: 11, fontWeight: 600 }}>CAIXA</span>
          </div>
          <div style={{ fontSize: 9, color: '#6a9060', letterSpacing: 2, textTransform: 'uppercase', lineHeight: 1 }}>Gestão financeira</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setShowPicker(!showPicker)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border transition-colors"
          style={{ background: '#223026', borderColor: 'rgba(109,212,0,0.2)' }}>
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: accounts.find(a => a.id === currentAccountId)?.color || '#6dd400' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#a8c8a0', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {accounts.find(a => a.id === currentAccountId)?.name || '—'}
          </span>
          <span style={{ fontSize: 10, color: '#6a9060' }}>▾</span>
        </button>
        <div className="text-right">
          <div style={{ fontSize: 9, color: '#6a9060', textTransform: 'uppercase', letterSpacing: 1 }}>Saldo total</div>
          <div className="font-['JetBrains_Mono'] font-semibold" style={{ fontSize: 16, color: balance < 0 ? '#ff6b6b' : '#6dd400', lineHeight: 1.2 }}>
            {fmtCurrency(balance)}
          </div>
        </div>
      </div>

      {showPicker && (
        <div className="absolute top-14 right-4 z-50 rounded-xl p-2 min-w-[200px] shadow-xl border" style={{ background: '#1c2a1f', borderColor: 'rgba(109,212,0,0.2)' }}>
          {accounts.map(a => (
            <button key={a.id} onClick={() => { setCurrentAccount(a.id); setShowPicker(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-[#223026]"
              style={{ background: a.id === currentAccountId ? 'rgba(109,212,0,0.08)' : 'transparent' }}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e8f5e2' }} className="truncate">{a.name}</div>
                <div style={{ fontSize: 10, color: '#6a9060' }}>{a.type}</div>
              </div>
              <div className="font-['JetBrains_Mono'] font-semibold" style={{ fontSize: 12, color: (a.current_balance ?? 0) < 0 ? '#ff6b6b' : '#6dd400' }}>
                {fmtCurrency(a.current_balance ?? a.initial_balance)}
              </div>
            </button>
          ))}
          <div className="border-t mt-1 pt-1" style={{ borderColor: 'rgba(109,212,0,0.1)' }}>
            <button onClick={async () => { await supabase.auth.signOut(); setShowPicker(false) }}
              className="w-full text-center py-2 transition-colors hover:text-[#ff6b6b]" style={{ fontSize: 12, color: '#6a9060' }}>
              Sair da conta
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
