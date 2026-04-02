'use client'
import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'
import { fmtCurrency } from '@/lib/utils'

export default function Topbar() {
  const { accounts, currentAccountId, setCurrentAccount, transactions, userId } = useAppStore()
  const [showMenu, setShowMenu] = useState(false)
  const [showBalances, setShowBalances] = useState(false)

  // Exportar
  const [exporting, setExporting] = useState(false)

  // Apagar tudo
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const balance = accounts.reduce((s, a) => s + (a.current_balance ?? a.initial_balance ?? 0), 0)

  // ── Exportar CSV ──────────────────────────────────────────
  function handleExport() {
    setExporting(true)
    try {
      const headers = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Status', 'Valor', 'Conta', 'Grupo']
      const rows = transactions.map(t => [
        t.date,
        `"${t.description.replace(/"/g, '""')}"`,
        t.category,
        t.type === 'income' ? 'Entrada' : 'Saída',
        t.status,
        t.amount.toFixed(2).replace('.', ','),
        `"${(t.account as any)?.name ?? ''}"`,
        `"${t.group_ref ?? ''}"`,
      ])
      const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nooon-caixa-registros-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
      setShowMenu(false)
    }
  }

  // ── Apagar tudo ───────────────────────────────────────────
  async function handleDeleteAll() {
    setDeleteError('')
    if (!deletePassword) { setDeleteError('Digite sua senha.'); return }
    setDeleting(true)
    // Reautentica com email + senha para confirmar identidade
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) { setDeleteError('Usuário não identificado.'); setDeleting(false); return }

    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: deletePassword,
    })
    if (error) {
      setDeleteError('Senha incorreta. Tente novamente.')
      setDeleting(false)
      return
    }

    // Apaga transactions e installment_groups do usuário
    await supabase.from('transactions').delete().eq('user_id', userId!)
    await supabase.from('installment_groups').delete().eq('user_id', userId!)

    setDeleting(false)
    setShowDeleteConfirm(false)
    setDeletePassword('')
    setShowMenu(false)

    // Recarrega store
    window.location.reload()
  }

  function closeDeleteModal() {
    setShowDeleteConfirm(false)
    setDeletePassword('')
    setDeleteError('')
  }

  return (
    <>
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

        {/* Overlay */}
        {showMenu && (
          <div className="fixed inset-0 z-40" onClick={() => { setShowMenu(false); setShowBalances(false) }} />
        )}

        {/* Dropdown Ferramentas */}
        {showMenu && (
          <div className="absolute top-14 right-4 z-50 rounded-xl shadow-xl border"
            style={{ background: '#1c2a1f', borderColor: 'rgba(109,212,0,0.2)', minWidth: 220 }}>

            {/* (a) Saldo em Contas */}
            <div className="relative"
              onMouseEnter={() => setShowBalances(true)}
              onMouseLeave={() => setShowBalances(false)}>
              <div className="flex items-center justify-between px-4 py-2.5 cursor-default rounded-t-xl hover:bg-[#223026] transition-colors">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 13 }}>🏦</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#e8f5e2' }}>Saldo em Contas</span>
                </div>
                <span style={{ fontSize: 10, color: '#6a9060' }}>▸</span>
              </div>
              {showBalances && (
                <div className="absolute rounded-xl border shadow-xl p-2"
                  style={{ background: '#1c2a1f', borderColor: 'rgba(109,212,0,0.2)', minWidth: 230, zIndex: 60, right: '100%', top: 0, marginRight: 4 }}>
                  {accounts.map(a => (
                    <button key={a.id}
                      onClick={() => { setCurrentAccount(a.id); setShowMenu(false); setShowBalances(false) }}
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
                onClick={handleExport}
                disabled={exporting || transactions.length === 0}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors hover:bg-[#223026] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span style={{ fontSize: 12 }}>📤</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#6dd400' }}>
                  {exporting ? 'Exportando...' : 'Exportar Registros'}
                </span>
                <span style={{ fontSize: 9, color: '#6a9060', marginLeft: 'auto' }}>
                  CSV
                </span>
              </button>
              <button
                onClick={() => { setShowMenu(false); setShowDeleteConfirm(true) }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors hover:bg-[#223026]"
              >
                <span style={{ fontSize: 12 }}>🗑️</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#6dd400' }}>Apagar Registros</span>
              </button>
            </div>

            {/* Divisor */}
            <div style={{ borderTop: '1px solid rgba(109,212,0,0.1)', margin: '2px 0' }} />

            {/* (c) Sair */}
            <button
              onClick={async () => { await supabase.auth.signOut(); setShowMenu(false) }}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-b-xl transition-colors hover:bg-[#223026]">
              <span style={{ fontSize: 12 }}>🚪</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#6dd400' }}>Sair do NOOON Caixa</span>
            </button>
          </div>
        )}
      </header>

      {/* ── Modal Apagar Registros ── */}
      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" onClick={closeDeleteModal} />
          <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
            <div className="rounded-2xl border shadow-2xl p-6 w-full max-w-sm"
              style={{ background: '#1c2a1f', borderColor: 'rgba(255,87,87,0.3)' }}>

              <div className="text-center mb-5">
                <div className="text-3xl mb-2">⚠️</div>
                <div className="font-['Barlow_Condensed'] text-lg font-black text-[#e8f5e2]">Apagar todos os registros</div>
                <div className="text-xs text-[#6a9060] mt-1">
                  Esta ação é <strong className="text-[#ff6b6b]">irreversível</strong>. Todas as transações e parcelamentos serão excluídos permanentemente.
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-[10px] font-bold text-[#4a6644] uppercase tracking-widest mb-1.5">
                  Confirme sua senha para continuar
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={e => { setDeletePassword(e.target.value); setDeleteError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleDeleteAll()}
                  placeholder="••••••••"
                  className="w-full bg-[#0f1f12] border border-[rgba(255,87,87,0.2)] rounded-lg px-3 py-2.5 text-[#e8f5e2] text-sm outline-none focus:border-[#ff6b6b] transition-colors placeholder:text-[#3a5030]"
                />
                {deleteError && (
                  <div className="text-xs text-[#ff6b6b] mt-1.5">{deleteError}</div>
                )}
              </div>

              <button
                onClick={handleDeleteAll}
                disabled={deleting || !deletePassword}
                className="w-full py-3 rounded-xl font-['Barlow_Condensed'] font-black text-sm uppercase tracking-wider transition-opacity disabled:opacity-40"
                style={{ background: '#ff6b6b', color: '#0f1f12' }}>
                {deleting ? 'Apagando...' : '🗑 Confirmar — Apagar tudo'}
              </button>
              <button
                onClick={closeDeleteModal}
                className="w-full mt-2 py-2 text-[#4a6644] text-sm hover:text-[#8aab80] transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
