'use client'
import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'
import { fmtCurrency } from '@/lib/utils'

export default function Topbar() {
  const { accounts, currentAccountId, setCurrentAccount } = useAppStore()
  const [showPicker, setShowPicker] = useState(false)

  const current = accounts.find(a => a.id === currentAccountId)
  const balance = accounts.reduce((s, a) => s + (a.current_balance ?? a.initial_balance ?? 0), 0)

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-[#111a14] border-b border-[rgba(109,212,0,0.08)] flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <svg width="26" height="26" viewBox="0 0 100 100" fill="none">
          <path d="M50 5L93 27.5V72.5L50 95L7 72.5V27.5L50 5Z" fill="#1a5c2a" opacity="0.9"/>
          <rect x="28" y="32" width="44" height="36" rx="10" fill="none" stroke="#6dd400" strokeWidth="9"/>
        </svg>
        <div>
          <div className="font-['Barlow_Condensed'] text-lg font-black tracking-wide leading-none text-[#1a5c2a]">
            NO<span className="text-[#6dd400]">O</span>ON <span className="text-[#4a6644] text-xs font-semibold">CAIXA</span>
          </div>
          <div className="text-[9px] text-[#3a5030] tracking-widest uppercase leading-none">Gestão financeira</div>
        </div>
      </div>

      {/* Right: account picker + balance */}
      <div className="flex items-center gap-2">
        <button onClick={() => setShowPicker(!showPicker)}
          className="flex items-center gap-1.5 bg-[#172010] border border-[rgba(109,212,0,0.1)] rounded-lg px-2.5 py-1.5 transition-colors hover:border-[rgba(109,212,0,0.2)]">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: current?.color || '#6dd400' }} />
          <span className="text-[11px] font-semibold text-[#8aab80] max-w-[72px] truncate">{current?.name || '—'}</span>
          <span className="text-[10px] text-[#3a5030]">▾</span>
        </button>
        <div className="text-right">
          <div className="text-[9px] text-[#3a5030] uppercase tracking-wider">Saldo</div>
          <div className={`font-['JetBrains_Mono'] text-base font-semibold leading-tight ${balance < 0 ? 'text-[#ff5757]' : 'text-[#6dd400]'}`}>
            {fmtCurrency(balance)}
          </div>
        </div>
      </div>

      {/* Account picker dropdown */}
      {showPicker && (
        <div className="absolute top-14 right-4 z-50 bg-[#111a14] border border-[rgba(109,212,0,0.15)] rounded-xl p-2 min-w-[200px] shadow-xl">
          {accounts.map(a => (
            <button key={a.id} onClick={() => { setCurrentAccount(a.id); setShowPicker(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-[#1e2a18] ${a.id === currentAccountId ? 'bg-[rgba(109,212,0,0.06)]' : ''}`}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#e8f0e4] truncate">{a.name}</div>
                <div className="text-[10px] text-[#4a6644]">{a.type}</div>
              </div>
              <div className={`font-['JetBrains_Mono'] text-xs font-semibold ${(a.current_balance ?? 0) < 0 ? 'text-[#ff5757]' : 'text-[#6dd400]'}`}>
                {fmtCurrency(a.current_balance ?? a.initial_balance)}
              </div>
            </button>
          ))}
          <div className="border-t border-[rgba(109,212,0,0.08)] mt-1 pt-1">
            <button onClick={async () => { await supabase.auth.signOut(); setShowPicker(false) }}
              className="w-full text-center text-xs text-[#4a6644] py-2 hover:text-[#ff5757] transition-colors">
              Sair da conta
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
