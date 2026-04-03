'use client'
import { useState, useEffect, useRef } from 'react'
import { useAppStore, SYSTEM_CATEGORIES } from '@/store/useAppStore'
import type { CustomCategory } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'
import { fmtCurrency } from '@/lib/utils'

// Paleta de cores para novas categorias
const COLOR_OPTIONS = [
  '#6dd400','#ffb340','#ff5757','#40b4ff','#c084fc',
  '#fb7185','#94a3b8','#f59e0b','#10b981','#ef4444',
]
const ICON_OPTIONS = ['📁','🎯','💡','🏷','🔖','⚡','🌟','🛡','🔑','💎','📊','🚀']

export default function Topbar() {
  const {
    accounts, transactions, userId,
    customCategories, loadCustomCategories, addCustomCategory, deleteCustomCategory, allCategories,
  } = useAppStore()

  const [showMenu, setShowMenu]               = useState(false)
  const [showBalances, setShowBalances]       = useState(false)
  const [showCategories, setShowCategories]   = useState(false)
  const [exporting, setExporting]             = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePassword, setDeletePassword]   = useState('')
  const [deleteError, setDeleteError]         = useState('')
  const [deleting, setDeleting]               = useState(false)

  // Nova categoria
  const [newCatLabel, setNewCatLabel]   = useState('')
  const [newCatIcon, setNewCatIcon]     = useState('📁')
  const [newCatColor, setNewCatColor]   = useState('#6dd400')
  const [catError, setCatError]         = useState('')

  useEffect(() => { loadCustomCategories() }, [])

  const balance = accounts.reduce(
    (s, a) => s + (a.current_balance ?? a.initial_balance ?? 0), 0)

  // Quais categorias estão em uso nos registros
  const usedKeys = new Set(transactions.map(t => t.category))

  function catInUse(key: string) { return usedKeys.has(key) }

  function handleExport() {
    setExporting(true)
    try {
      const headers = ['Data','Descricao','Categoria','Tipo','Status','Valor','Conta','Grupo']
      const rows = transactions.map(t => [
        t.date,
        '"' + t.description.replace(/"/g, '""') + '"',
        t.category,
        t.type === 'income' ? 'Entrada' : 'Saida',
        t.status,
        t.amount.toFixed(2).replace('.', ','),
        '"' + ((t.account as any)?.name ?? '') + '"',
        '"' + (t.group_ref ?? '') + '"',
      ])
      const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'nooon-caixa-registros-' + new Date().toISOString().split('T')[0] + '.csv'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
      setShowMenu(false)
    }
  }

  async function handleDeleteAll() {
    setDeleteError('')
    if (!deletePassword) { setDeleteError('Digite sua senha.'); return }
    setDeleting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) { setDeleteError('Usuário não identificado.'); setDeleting(false); return }
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: deletePassword })
    if (error) { setDeleteError('Senha incorreta. Tente novamente.'); setDeleting(false); return }
    await supabase.from('transactions').delete().eq('user_id', userId!)
    await supabase.from('installment_groups').delete().eq('user_id', userId!)
    setDeleting(false)
    setShowDeleteConfirm(false)
    setDeletePassword('')
    setShowMenu(false)
    window.location.reload()
  }

  function handleAddCategory() {
    setCatError('')
    const label = newCatLabel.trim()
    if (!label) { setCatError('Nome obrigatório.'); return }
    // Gera slug a partir do label
    const key = label.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const cats = allCategories()
    if (cats.some(c => c.key === key)) { setCatError('Já existe uma categoria com este nome.'); return }
    addCustomCategory({ key, label, icon: newCatIcon, color: newCatColor })
    setNewCatLabel('')
    setNewCatIcon('📁')
    setNewCatColor('#6dd400')
  }

  const cats = allCategories()
  const isSystem = (key: string) => SYSTEM_CATEGORIES.some(c => c.key === key)

  return (
    <>
      {/* Overlay fecha menu */}
      {showMenu && (
        <div className="fixed inset-0 z-40" onClick={() => {
          setShowMenu(false)
          setShowBalances(false)
          setShowCategories(false)
          setShowDeleteConfirm(false)
        }} />
      )}

      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ background: '#0f1f12', borderColor: 'rgba(109,212,0,0.12)' }}>
        {/* Logo */}
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black" style={{ background: '#6dd400', color: '#0f1f12' }}>N</div>
            <div>
              <div className="font-['Barlow_Condensed'] text-sm font-black tracking-widest leading-none" style={{ color: '#e8f5e2' }}>
                NO<span style={{ color: '#6dd400' }}>OO</span>N <span className="font-light text-xs" style={{ color: '#7ab070' }}>CAIXA</span>
              </div>
              <div className="text-[8px] tracking-widest" style={{ color: '#4a6844' }}>GESTÃO FINANCEIRA</div>
            </div>
          </div>
        </div>

        {/* Direita: saldo + botão ferramentas */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[8px] font-bold uppercase tracking-widest" style={{ color: '#4a6844' }}>Saldo Total</div>
            <div className="font-['JetBrains_Mono'] text-sm font-semibold" style={{ color: '#6dd400' }}>{fmtCurrency(balance)}</div>
          </div>

          {/* Menu Ferramentas */}
          <div className="relative z-50">
            <button onClick={() => setShowMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-semibold transition-all"
              style={{
                background: showMenu ? 'rgba(109,212,0,0.1)' : '#1c2a1f',
                borderColor: showMenu ? 'rgba(109,212,0,0.3)' : 'rgba(109,212,0,0.15)',
                color: '#7ab070',
              }}>
              ⚙ Ferramentas
              <span style={{ fontSize: 8, color: '#4a6844' }}>{showMenu ? '▲' : '▼'}</span>
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-64 rounded-xl border overflow-hidden shadow-2xl"
                style={{ background: '#1c2a1f', borderColor: 'rgba(109,212,0,0.2)' }}>

                {/* ── Saldo em Contas ── */}
                <div>
                  <button
                    onMouseEnter={() => { setShowBalances(true); setShowCategories(false) }}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-[#223026]"
                    style={{ color: '#a8c8a0' }}>
                    <span className="flex items-center gap-2">💰 Saldo em Contas</span>
                    <span style={{ fontSize: 10, color: '#4a6844' }}>›</span>
                  </button>
                  {showBalances && (
                    <div className="border-t mx-3 mb-2 pt-2" style={{ borderColor: 'rgba(109,212,0,0.1)' }}>
                      {accounts.map(a => (
                        <div key={a.id} className="flex items-center justify-between px-1 py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: a.color }} />
                            <span className="text-[11px]" style={{ color: '#7ab070' }}>{a.name}</span>
                          </div>
                          <span className="font-['JetBrains_Mono'] text-[11px] font-semibold" style={{ color: '#6dd400' }}>
                            {fmtCurrency(a.current_balance ?? a.initial_balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t mx-3" style={{ borderColor: 'rgba(109,212,0,0.08)' }} />

                {/* ── Categorias ── */}
                <div>
                  <button
                    onMouseEnter={() => { setShowCategories(true); setShowBalances(false) }}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-[#223026]"
                    style={{ color: '#a8c8a0' }}>
                    <span className="flex items-center gap-2">🏷 Categorias</span>
                    <span style={{ fontSize: 10, color: '#4a6844' }}>›</span>
                  </button>

                  {showCategories && (
                    <div className="border-t mx-3 mb-2 pt-2" style={{ borderColor: 'rgba(109,212,0,0.1)' }}>
                      {/* Lista de categorias */}
                      <div className="max-h-48 overflow-y-auto mb-2">
                        {cats.map(cat => {
                          const inUse    = catInUse(cat.key)
                          const isSys    = isSystem(cat.key)
                          const canDelete = !inUse && !isSys
                          return (
                            <div key={cat.key}
                              className="flex items-center justify-between px-1 py-1.5 rounded-lg group"
                              style={{ opacity: inUse || isSys ? 1 : 0.45 }}>
                              <div className="flex items-center gap-2">
                                <span style={{ fontSize: 12 }}>{cat.icon}</span>
                                <span className="text-[11px]" style={{ color: inUse ? '#a8c8a0' : '#5a7850' }}>
                                  {cat.label}
                                </span>
                                {!inUse && !isSys && (
                                  <span className="text-[8px] px-1 rounded" style={{ background: 'rgba(255,87,87,0.1)', color: '#ff7070' }}>
                                    sem uso
                                  </span>
                                )}
                              </div>
                              {canDelete && (
                                <button
                                  onClick={() => deleteCustomCategory(cat.key)}
                                  className="text-[10px] px-1.5 py-0.5 rounded border opacity-0 group-hover:opacity-100 transition-opacity"
                                  style={{ borderColor: 'rgba(255,87,87,0.3)', color: '#ff7070', background: 'rgba(255,87,87,0.08)' }}>
                                  ✕ excluir
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {/* Form nova categoria */}
                      <div className="border-t pt-2" style={{ borderColor: 'rgba(109,212,0,0.1)' }}>
                        <div className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#4a6844' }}>
                          Nova categoria
                        </div>
                        <input
                          value={newCatLabel}
                          onChange={e => { setNewCatLabel(e.target.value); setCatError('') }}
                          placeholder="Ex: Marketing"
                          className="w-full rounded-lg px-2.5 py-1.5 text-[12px] outline-none mb-1.5"
                          style={{ background: '#223026', border: '1px solid rgba(109,212,0,0.2)', color: '#e8f5e2' }}
                        />
                        {/* Ícones */}
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {ICON_OPTIONS.map(ic => (
                            <button key={ic} onClick={() => setNewCatIcon(ic)}
                              className="w-6 h-6 rounded text-[12px] flex items-center justify-center border transition-all"
                              style={{
                                background: newCatIcon === ic ? 'rgba(109,212,0,0.15)' : '#223026',
                                borderColor: newCatIcon === ic ? 'rgba(109,212,0,0.4)' : 'rgba(109,212,0,0.1)',
                              }}>
                              {ic}
                            </button>
                          ))}
                        </div>
                        {/* Cores */}
                        <div className="flex flex-wrap gap-1 mb-2">
                          {COLOR_OPTIONS.map(col => (
                            <button key={col} onClick={() => setNewCatColor(col)}
                              className="w-5 h-5 rounded-full border-2 transition-all"
                              style={{
                                background: col,
                                borderColor: newCatColor === col ? '#fff' : 'transparent',
                              }} />
                          ))}
                        </div>
                        {catError && (
                          <div className="text-[10px] mb-1" style={{ color: '#ff7070' }}>{catError}</div>
                        )}
                        <button onClick={handleAddCategory}
                          className="w-full py-1.5 rounded-lg text-[11px] font-bold border transition-colors"
                          style={{ background: 'rgba(109,212,0,0.1)', borderColor: 'rgba(109,212,0,0.3)', color: '#6dd400' }}>
                          + Criar categoria
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t mx-3" style={{ borderColor: 'rgba(109,212,0,0.08)' }} />

                {/* ── Exportar / Apagar ── */}
                <div className="px-2 py-1">
                  <button onClick={handleExport} disabled={exporting}
                    className="w-full flex items-center gap-2 px-2 py-2.5 rounded-lg text-sm transition-colors hover:bg-[#223026]"
                    style={{ color: '#a8c8a0' }}>
                    📥 {exporting ? 'Exportando...' : 'Exportar Registros (CSV)'}
                  </button>

                  {!showDeleteConfirm ? (
                    <button onClick={() => setShowDeleteConfirm(true)}
                      className="w-full flex items-center gap-2 px-2 py-2.5 rounded-lg text-sm transition-colors hover:bg-[rgba(255,87,87,0.08)]"
                      style={{ color: '#ff7070' }}>
                      🗑 Apagar Registros
                    </button>
                  ) : (
                    <div className="px-1 py-2">
                      <div className="text-[10px] mb-1.5" style={{ color: '#ff7070' }}>
                        Confirme sua senha para apagar todos os registros:
                      </div>
                      <input
                        type="password"
                        value={deletePassword}
                        onChange={e => setDeletePassword(e.target.value)}
                        placeholder="Senha"
                        className="w-full rounded-lg px-2.5 py-1.5 text-sm outline-none mb-1.5"
                        style={{ background: '#223026', border: '1px solid rgba(255,87,87,0.3)', color: '#e8f5e2' }}
                      />
                      {deleteError && <div className="text-[10px] mb-1.5" style={{ color: '#ff7070' }}>{deleteError}</div>}
                      <div className="flex gap-2">
                        <button onClick={handleDeleteAll} disabled={deleting}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-bold border"
                          style={{ background: 'rgba(255,87,87,0.12)', borderColor: 'rgba(255,87,87,0.3)', color: '#ff7070' }}>
                          {deleting ? '...' : 'Confirmar'}
                        </button>
                        <button onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError('') }}
                          className="px-3 py-1.5 rounded-lg text-[11px] border"
                          style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#7ab070' }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t mx-3" style={{ borderColor: 'rgba(109,212,0,0.08)' }} />

                {/* ── Sair ── */}
                <button onClick={async () => { await supabase.auth.signOut(); window.location.reload() }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-[#223026]"
                  style={{ color: '#6dd400' }}>
                  ↪ Sair do NOOON Caixa
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
