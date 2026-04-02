'use client'
import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'
import { fmtCurrency } from '@/lib/utils'

export default function Topbar() {
  const { accounts, currentAccountId, setCurrentAccount } = useAppStore()
  const [showMenu, setShowMenu] = useState(false)
  const [showBalances, setShowBalances] = useState(false)

  const balance = accounts.reduce((s, a) => s + (a.current_balance ?? a.initial_balance ?? 0), 0)

  return (
    <header style={{ background: '#1c2a1f' }} className="flex items-center justify-between px-4 py-3 border-b border-[rgba(109,212,0,0.15)] flex-shrink-0 relative">
      {/* Logo */}
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

      {/* Saldo Total + Botão Ferramentas */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setShowMenu(!showMenu); setShowBalances(false) }}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border transition-colors"
          style={{ background: '#223026', borderColor: 'rgba(109,212,0,0.2)' }}>
          <span style={{ fontSize: 12, color: '#6dd400' }}>⚙</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#a8c8a0' }}>Ferramentas</span>
          <span style={{ fontSize: 10, color: '#6a9060' }}>{showMenu ? '▴' : '▾'}</span>
        </button>

        <div className="text-right">
          <div style={{ fontSize: 9, color: '#6a9060', textTransform: 'uppercase', letterSpacing: 1 }}>Saldo total</div>
          <div className="font-['JetBrains_Mono'] font-semibold" style={{ fontSize: 16, color: balance < 0 ? '#ff6b6b' : '#6dd400', lineHeight: 1.2 }}>
            {fmtCurrency(balance)}
          </div>
        </div>
      </div>

      {/* Overlay para fechar — z-40, mas NÃO cobre o dropdown (z-50) */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setShowMenu(false); setShowBalances(false) }}
        />
      )}

      {/* Dropdown Ferramentas — sem overflow-hidden */}
      {showMenu && (
        <div
          className="absolute top-14 right-4 z-50 rounded-xl shadow-xl border"
          style={{ background: '#1c2a1f', borderColor: 'rgba(109,212,0,0.2)', minWidth: 220 }}
        >
          {/* (a) Saldo em Contas */}
          <div
            className="relative"
            onMouseEnter={() => setShowBalances(true)}
            onMouseLeave={() => setShowBalances(false)}
          >
            <div className="flex items-center justify-between px-4 py-2.5 cursor-default rounded-t-xl hover:bg-[#223026] transition-colors">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 13 }}>🏦</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#e8f5e2' }}>Saldo em Contas</span>
              </div>
              <span style={{ fontSize: 10, color: '#6a9060' }}>▸</span>
            </div>

            {/* Submenu de contas — controlado por estado React */}
            {showBalances && (
              <div
                className="absolute rounded-xl border shadow-xl p-2"
                style={{
                  background: '#1c2a1f',
                  borderColor: 'rgba(109,212,0,0.2)',
                  minWidth: 230,
                  zIndex: 60,
                  // Posiciona à esquerda do dropdown principal
                  right: '100%',
                  top: 0,
                  marginRight: 4,
                }}
              >
                {accounts.map(a => (
                  <button
                    key={a.id}
                    onClick={() => { setCurrentAccount(a.id); setShowMenu(false); setShowBalances(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-[#223026]"
                    style={{ background: a.id === currentAccountId ? 'rgba(109,212,0,0.08)' : 'transparent' }}
                  >
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
              </div>
            )}
          </div>

          {/* Divisor */}
          <div style={{ borderTop: '1px solid rgba(109,212,0,0.1)', margin: '2px 0' }} />

          {/* (b) Gerenciar Registros */}
          <div className="px-4 py-2">
            <div style={{ fontSize: 10, color: '#6a9060', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Gerenciar Registros
            </div>
            <button
              disabled
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left opacity-60 cursor-not-allowed"
              title="Em breve"
            >
              <span style={{ fontSize: 12 }}>📤</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#ff6b6b' }}>Exportar Registros</span>
              <span style={{ fontSize: 9, color: '#ff6b6b', marginLeft: 'auto', border: '1px solid rgba(255,107,107,0.4)', borderRadius: 4, padding: '1px 4px' }}>em breve</span>
            </button>
            <button
              disabled
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left opacity-60 cursor-not-allowed"
              title="Em breve"
            >
              <span style={{ fontSize: 12 }}>🗑️</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#ff6b6b' }}>Apagar Registros</span>
              <span style={{ fontSize: 9, color: '#ff6b6b', marginLeft: 'auto', border: '1px solid rgba(255,107,107,0.4)', borderRadius: 4, padding: '1px 4px' }}>em breve</span>
            </button>
          </div>

          {/* Divisor */}
          <div style={{ borderTop: '1px solid rgba(109,212,0,0.1)', margin: '2px 0' }} />

          {/* (c) Sair */}
          <button
            onClick={async () => { await supabase.auth.signOut(); setShowMenu(false) }}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-b-xl transition-colors hover:bg-[#223026]"
          >
            <span style={{ fontSize: 12 }}>🚪</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#6dd400' }}>Sair do NOOON Caixa</span>
          </button>
        </div>
      )}
    </header>
  )
}
