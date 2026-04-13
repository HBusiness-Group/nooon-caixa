'use client'
// src/components/accounts/ContasScreen.tsx — NOOON Caixa V4 #002

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useAppStore, isFiduciary, isCreditCard, isCreditCardNormal, isPrepaidCard, isOverdraft } from '@/store/useAppStore'
import { nextReferenceMonth } from '@/lib/invoiceUtils'
import { fmtCurrency } from '@/lib/utils'
import InvoicePanel from '@/components/fiduciary/InvoicePanel'

// ── Constantes ───────────────────────────────────────────────────────────────

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'checking',     label: 'Conta Corrente',       icon: '🏦' },
  { value: 'savings',      label: 'Poupança',              icon: '🐷' },
  { value: 'wallet',       label: 'Carteira',              icon: '👛' },
  { value: 'investment',   label: 'Investimento',          icon: '📊' },
  { value: 'credit_card',  label: 'Cartão de Crédito',     icon: '💳' },
  { value: 'prepaid_card', label: 'Cartão Pré-pago',       icon: '💳' },
  { value: 'overdraft',    label: 'Cheque Especial',        icon: '🏦' },
  { value: 'other',        label: 'Outro',                  icon: '📁' },
]

const COLOR_OPTIONS = [
  '#6dd400','#ffb340','#ff5757','#40b4ff','#c084fc',
  '#fb7185','#94a3b8','#f59e0b','#10b981','#ef4444',
  '#a855f7','#5bc8ff','#d946ef','#eab308','#22c55e',
]

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  checking:     'Conta Corrente',
  savings:      'Poupança',
  wallet:       'Carteira',
  investment:   'Investimento',
  credit_card:  'Cartão de Crédito',
  prepaid_card: 'Cartão Pré-pago',
  overdraft:    'Cheque Especial',
  other:        'Outro',
}

const ACCOUNT_TYPE_ICON: Record<string, string> = {
  checking:     '🏦',
  savings:      '🐷',
  wallet:       '👛',
  investment:   '📊',
  credit_card:  '💳',
  prepaid_card: '💳',
  overdraft:    '🏦',
  other:        '📁',
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

type ModalMode = 'add' | 'edit_balance' | 'transfer' | null

// ── Componente ───────────────────────────────────────────────────────────────

export default function ContasScreen() {
  const {
    accounts, transactions,
    addAccount, deleteAccount, updateAccountFiduciary,
    loadAccounts, addTransaction,
    invoices, loadInvoices, ensureInvoice,
  } = useAppStore()

  // ── Modals e seleção ────────────────────────────────────────────────────
  const [modalMode, setModalMode]       = useState<ModalMode>(null)
  const [editAccountId, setEditAccountId] = useState<string | null>(null)
  const [invoicePanelId, setInvoicePanelId] = useState<string | null>(null)
  const [loading, setLoading]           = useState(false)
  const [deleteError, setDeleteError]   = useState<Record<string, string>>({})

  // ── Form: nova conta ────────────────────────────────────────────────────
  const [newName, setNewName]           = useState('')
  const [newType, setNewType]           = useState('checking')
  const [newColor, setNewColor]         = useState('#6dd400')
  const [newBalance, setNewBalance]     = useState('')
  const [newBalanceDate, setNewBalanceDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  // Campos fiduciários (mostrados condicionalmente)
  const [newCloseDay, setNewCloseDay]   = useState('10')
  const [newDueDay, setNewDueDay]       = useState('20')
  const [newCreditLimit, setNewCreditLimit] = useState('')
  const [newOverdraftDay, setNewOverdraftDay] = useState('0')
  const [newOverdraftLimit, setNewOverdraftLimit] = useState('')

  // ── Form: editar saldo ──────────────────────────────────────────────────
  const [editBalance, setEditBalance]   = useState('')
  const [editBalanceDate, setEditBalanceDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  // ── Form: transferência ─────────────────────────────────────────────────
  const [fromAccount, setFromAccount]   = useState('')
  const [toAccount, setToAccount]       = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferDate, setTransferDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [transferDesc, setTransferDesc] = useState('Transferência')

  // ── Mês corrente para fatura ─────────────────────────────────────────────
  const today    = new Date()
  const refMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => {
    loadInvoices()
  }, [])

  // Garante fatura para todas as contas fiduciárias ativas
  useEffect(() => {
    const fiduciaryAccounts = accounts.filter(a => isFiduciary(a.type)).sort((a, b) => (b.current_balance ?? 0) - (a.current_balance ?? 0))
    if (fiduciaryAccounts.length === 0) return
    if (transactions.length === 0) return
    fiduciaryAccounts.forEach(a => {
      ensureInvoice(a.id, refMonth)
      ensureInvoice(a.id, nextReferenceMonth(refMonth))
    })
  }, [accounts, transactions])

  // Label do mês da fatura = mês do vencimento (apenas visual)
  function getInvoiceMonthLabel(account: any): string {
    if (isCreditCard(account.type)) {
      const closeDay = account.billing_close_day ?? 10
      const dueDay   = account.billing_due_day   ?? 20
      const y = today.getFullYear()
      const m = today.getMonth() + 1
      if (dueDay > closeDay) return `${y}-${String(m).padStart(2, '0')}`
      const next = new Date(y, m, 1)
      return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
    }
    return refMonth
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  // Retorna a fatura mais relevante: prefere EM_ABERTO/PARCIAL/PARCELADO
  // Se a do mês atual está PAGO, busca a do próximo mês
  function getInvoice(accountId: string) {
    const current = invoices.find(i => i.account_id === accountId && i.reference_month === refMonth)
    if (current && current.status !== 'PAGO') return current
    const next = invoices.find(i => i.account_id === accountId && i.reference_month === nextReferenceMonth(refMonth))
    if (next) return next
    return current // fallback: retorna a atual mesmo que PAGO
  }

  function hasTransactions(accountId: string) {
    return transactions.some(t => t.account_id === accountId)
  }

  function resetAddForm() {
    setNewName('')
    setNewType('checking')
    setNewColor('#6dd400')
    setNewBalance('')
    setNewBalanceDate(format(new Date(), 'yyyy-MM-dd'))
    setNewCloseDay('10')
    setNewDueDay('20')
    setNewCreditLimit('')
    setNewOverdraftDay('0')
    setNewOverdraftLimit('')
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleAddAccount() {
    if (!newName.trim() || !newBalance) return
    setLoading(true)

    const base = {
      name:            newName.trim(),
      type:            newType,
      color:           newColor,
      initial_balance: parseFloat(newBalance),
      balance_date:    newBalanceDate,
      is_active:       true,
    }

    // Campos fiduciários opcionais
    const fiduciary: Record<string, unknown> = {}
    if (isCreditCard(newType)) {
      fiduciary.billing_close_day = parseInt(newCloseDay)
      fiduciary.billing_due_day   = parseInt(newDueDay)
      fiduciary.credit_limit      = parseFloat(newBalance)
    }
    if (isOverdraft(newType)) {
      fiduciary.overdraft_due_day = parseInt(newOverdraftDay)
      fiduciary.overdraft_limit   = parseFloat(newBalance)
    }

    await addAccount({ ...base, ...fiduciary } as any)
    resetAddForm()
    setLoading(false)
    setModalMode(null)
  }

  async function handleEditBalance() {
    if (!editAccountId || !editBalance) return
    setLoading(true)
    // Cria transação de ajuste de saldo
    const account = accounts.find(a => a.id === editAccountId)
    if (account) {
      const diff = parseFloat(editBalance) - (account.current_balance ?? account.initial_balance)
      if (diff !== 0) {
        await addTransaction({
          account_id:  editAccountId,
          description: 'Ajuste de saldo',
          category:    diff > 0 ? 'outras_entradas' : 'despesas_gerais',
          amount:      Math.abs(diff),
          type:        diff > 0 ? 'income' : 'expense',
          status:      'completed',
          date:        editBalanceDate,
          group_ref:   'ajuste_saldo',
        })
      }
    }
    setLoading(false)
    setModalMode(null)
    setEditAccountId(null)
  }

  async function handleTransfer() {
    if (!fromAccount || !toAccount || !transferAmount || fromAccount === toAccount) return
    setLoading(true)
    const amount = parseFloat(transferAmount)
    await addTransaction({
      account_id:  fromAccount,
      description: transferDesc || 'Transferência',
      category:    'outras_entradas',
      amount,
      type:        'expense',
      status:      'completed',
      date:        transferDate,
      group_ref:   `transf_${Date.now()}`,
    })
    await addTransaction({
      account_id:  toAccount,
      description: transferDesc || 'Transferência',
      category:    'outras_entradas',
      amount,
      type:        'income',
      status:      'completed',
      date:        transferDate,
      group_ref:   `transf_${Date.now()}`,
    })
    setTransferAmount('')
    setTransferDesc('Transferência')
    setLoading(false)
    setModalMode(null)
  }

  async function handleDeleteAccount(id: string) {
    if (hasTransactions(id)) {
      setDeleteError(e => ({ ...e, [id]: 'Conta com transações não pode ser excluída.' }))
      return
    }
    await deleteAccount(id)
  }

  // ── Estilos compartilhados ───────────────────────────────────────────────

  const inputCls   = 'w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors'
  const inputStyle = { background: '#223026', border: '1px solid rgba(109,212,0,0.2)', color: '#e8f5e2' }
  const labelCls   = 'block text-[10px] font-bold uppercase tracking-widest mb-1.5'

  const isNewCC = isCreditCard(newType)
  const isNewCE = isOverdraft(newType)

  // Sufixo automático por tipo
  const TYPE_SUFFIX: Record<string, string> = {
    savings:      'Poupança',
    credit_card:  'CC',
    prepaid_card: 'CC PP',
    overdraft:    'CE',
    wallet:       'Carteira',
    investment:   'Invest',
  }

  // Nome base = tudo antes do sufixo conhecido (para trocar ao mudar tipo)
  function applyTypeSuffix(currentName: string, newType: string) {
    const knownSuffixes = Object.values(TYPE_SUFFIX)
    const trimmed = currentName.trim()
    // Remove sufixo anterior se existir
    const base = knownSuffixes.reduce((n, s) => {
      if (n.endsWith(` ${s}`)) return n.slice(0, -(s.length + 1)).trim()
      return n
    }, trimmed)
    const suffix = TYPE_SUFFIX[newType]
    return suffix ? `${base} ${suffix}`.trim() : base
  }

  function handleTypeChange(t: string) {
    setNewType(t)
    if (newName.trim()) setNewName(applyTypeSuffix(newName, t))
  }

  // ── Totais ───────────────────────────────────────────────────────────────

  const totalDisponivel = accounts
    .filter(a => !isFiduciary(a.type))
    .reduce((s, a) => s + (a.current_balance ?? 0), 0)

  const totalComprometido = accounts
    .filter(a => isFiduciary(a.type))
    .reduce((s, a) => {
      const inv = getInvoice(a.id)
      return s + (inv ? inv.total_amount - inv.paid_amount : 0)
    }, 0)

  // ── Separação de contas por tipo ─────────────────────────────────────────

  const regularAccounts   = accounts.filter(a => !isFiduciary(a.type)).sort((a, b) => (b.current_balance ?? 0) - (a.current_balance ?? 0))
  const fiduciaryAccounts = accounts.filter(a => isFiduciary(a.type)).sort((a, b) => (b.current_balance ?? 0) - (a.current_balance ?? 0))

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4" style={{ background: '#0f1f12' }}>

      {/* ── Totais ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl p-3.5 border" style={{ background: '#1c2a1f', borderColor: 'rgba(109,212,0,0.15)' }}>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#7ab070' }}>Saldo Disponível</div>
          <div className="font-['JetBrains_Mono'] font-bold text-lg" style={{ color: totalDisponivel < 0 ? '#ff6b6b' : '#6dd400' }}>
            {fmtCurrency(totalDisponivel)}
          </div>
        </div>
        <div className="rounded-xl p-3.5 border" style={{ background: '#1c2a1f', borderColor: 'rgba(255,107,107,0.15)' }}>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#7ab070' }}>Saldo Comprometido</div>
          <div className="font-['JetBrains_Mono'] font-bold text-lg" style={{ color: totalComprometido > 0 ? '#ff6b6b' : '#6dd400' }}>
            {fmtCurrency(totalComprometido)}
          </div>
        </div>
      </div>

      {/* ── Botões de ação ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <button
          onClick={() => { setModalMode('add'); resetAddForm() }}
          className="py-2.5 rounded-xl font-['Barlow_Condensed'] font-black text-sm uppercase tracking-wider border transition-all"
          style={{ background: 'rgba(109,212,0,0.08)', borderColor: 'rgba(109,212,0,0.3)', color: '#6dd400' }}
        >
          + Nova Conta
        </button>
        <button
          onClick={() => setModalMode('transfer')}
          className="py-2.5 rounded-xl font-['Barlow_Condensed'] font-black text-sm uppercase tracking-wider border transition-all"
          style={{ background: 'rgba(91,200,255,0.08)', borderColor: 'rgba(91,200,255,0.25)', color: '#5bc8ff' }}
        >
          ⇄ Transferência
        </button>
      </div>

      {/* ── Contas regulares ─────────────────────────────────────────────── */}
      {regularAccounts.length > 0 && (
        <div className="mb-5">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#4a6844' }}>
            Contas
          </div>
          <div className="space-y-2">
            {regularAccounts.map(account => (
              <div
                key={account.id}
                className="rounded-xl border px-4 py-3.5 flex items-center gap-3"
                style={{ background: '#1c2a1f', borderColor: 'rgba(109,212,0,0.12)' }}
              >
                {/* cor + ícone */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg"
                  style={{ background: account.color + '22', border: `2px solid ${account.color}` }}
                >
                  {ACCOUNT_TYPE_ICON[account.type] || '📁'}
                </div>

                {/* info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate" style={{ color: '#e8f5e2', fontSize: 14 }}>
                    {account.name}
                  </div>
                  <div className="text-[11px]" style={{ color: '#6a9060' }}>
                    {ACCOUNT_TYPE_LABEL[account.type] || account.type}
                  </div>
                </div>

                {/* saldo */}
                <div className="text-right">
                  <div
                    className="font-['JetBrains_Mono'] font-bold"
                    style={{ fontSize: 15, color: (account.current_balance ?? 0) < 0 ? '#ff6b6b' : '#6dd400' }}
                  >
                    {fmtCurrency(account.current_balance ?? account.initial_balance)}
                  </div>
                  <div className="text-[10px]" style={{ color: '#4a6844' }}>saldo atual</div>
                </div>

                {/* ações */}
                <div className="flex flex-col gap-1.5 ml-1">
                  <button
                    onClick={() => {
                      setEditAccountId(account.id)
                      setEditBalance(String(account.current_balance ?? account.initial_balance))
                      setEditBalanceDate(format(new Date(), 'yyyy-MM-dd'))
                      setModalMode('edit_balance')
                    }}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold border transition-all"
                    style={{ background: 'rgba(109,212,0,0.08)', borderColor: 'rgba(109,212,0,0.2)', color: '#6dd400' }}
                  >
                    Editar
                  </button>
                  {!hasTransactions(account.id) && (account.current_balance ?? 0) === 0 && (
                    <button
                      onClick={() => handleDeleteAccount(account.id)}
                      className="px-2 py-1 rounded-lg text-[10px] font-bold border transition-all"
                      style={{ background: 'rgba(255,87,87,0.06)', borderColor: 'rgba(255,87,87,0.2)', color: '#ff7070' }}
                    >
                      Excluir
                    </button>
                  )}
                </div>

                {/* erro de exclusão */}
                {deleteError[account.id] && (
                  <div className="absolute text-[10px] mt-1" style={{ color: '#ff7070' }}>
                    {deleteError[account.id]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Carteiras Fiduciárias ─────────────────────────────────────────── */}
      {fiduciaryAccounts.length > 0 && (
        <div className="mb-5">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#4a6844' }}>
            Carteiras Fiduciárias
          </div>
          <div className="space-y-2">
            {fiduciaryAccounts.map(account => {
              const inv              = getInvoice(account.id)
              const isPending        = inv && inv.status !== 'PAGO'
              const invoiceRemaining = inv ? inv.total_amount - inv.paid_amount : null
              // Se fatura zerada ou inexistente, mostra zero (não usa current_balance como fallback)
              const remaining        = (invoiceRemaining !== null && invoiceRemaining > 0)
                ? invoiceRemaining
                : 0
              const limitUsed   = isCreditCard(account.type) && account.credit_limit
                ? account.credit_limit - (account.current_balance ?? 0)
                : 0
              const limitPct    = isCreditCard(account.type) && account.credit_limit
                ? Math.min(limitUsed / account.credit_limit * 100, 100)
                : null

              const STATUS_COLOR: Record<string, string> = {
                EM_ABERTO: '#ff6b6b',
                PARCIAL:   '#ffb340',
                PARCELADO: '#5bc8ff',
                PAGO:      '#6dd400',
              }

              return (
                <div
                  key={account.id}
                  className="rounded-xl border overflow-hidden"
                  style={{
                    background:   '#1c2a1f',
                    borderColor:  isPending ? 'rgba(255,107,107,0.35)' : 'rgba(109,212,0,0.12)',
                  }}
                >
                  {/* linha principal */}
                  <div className="px-4 py-3.5 flex items-center gap-3">
                    {/* ícone com badge de alerta */}
                    <div className="relative flex-shrink-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                        style={{ background: account.color + '22', border: `2px solid ${account.color}` }}
                      >
                        {isCreditCard(account.type) ? '💳' : '🏦'}
                      </div>
                      {/* badge de alerta vermelho */}
                      {isPending && (
                        <div
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black"
                          style={{ background: '#ff6b6b', color: '#fff' }}
                        >
                          !
                        </div>
                      )}
                    </div>

                    {/* info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold truncate" style={{ color: '#e8f5e2', fontSize: 14 }}>
                          {account.name}
                        </div>

                      </div>
                      <div className="text-[11px] flex items-center gap-1.5" style={{ color: '#6a9060' }}>
                        {ACCOUNT_TYPE_LABEL[account.type]} · {inv?.reference_month ?? refMonth}
                        {isCreditCardNormal(account.type) && (
                          <span className="px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-wider" style={{ background: 'rgba(109,212,0,0.12)', color: '#6dd400' }}>crédito</span>
                        )}
                        {isPrepaidCard(account.type) && (
                          <span className="px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-wider" style={{ background: 'rgba(91,200,255,0.12)', color: '#5bc8ff' }}>pré-pago</span>
                        )}
                      </div>
                    </div>

                    {/* saldo comprometido / fatura */}
                    <div className="text-right flex-shrink-0">
                      <div
                        className="font-['JetBrains_Mono'] font-bold"
                        style={{ fontSize: 15, color: remaining > 0 ? '#ff6b6b' : '#6dd400' }}
                      >
                        {fmtCurrency(remaining)}
                      </div>
                      <div className="text-[10px]" style={{ color: '#4a6844' }}>
                        {remaining > 0 ? 'em aberto' : 'fatura zerada'}
                      </div>
                    </div>

                    {/* botões: fatura + excluir */}
                    <div className="flex flex-col gap-1.5 ml-1 flex-shrink-0">
                      <button
                        onClick={() => setInvoicePanelId(account.id)}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all"
                        style={{
                          background:  isPending ? 'rgba(255,107,107,0.1)' : 'rgba(109,212,0,0.08)',
                          borderColor: isPending ? 'rgba(255,107,107,0.35)' : 'rgba(109,212,0,0.2)',
                          color:       isPending ? '#ff6b6b' : '#6dd400',
                        }}
                      >
                        Fatura
                      </button>
                      {!hasTransactions(account.id) && (account.current_balance ?? 0) === 0 && (
                        <button
                          onClick={() => handleDeleteAccount(account.id)}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all"
                          style={{ background: 'rgba(255,87,87,0.06)', borderColor: 'rgba(255,87,87,0.2)', color: '#ff7070' }}
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </div>

                  {/* barra de limite (CC) */}
                  {limitPct !== null && inv && (
                    <div className="px-4 pb-3">
                      <div className="flex justify-between text-[9px] mb-1" style={{ color: '#4a6844' }}>
                        <span>Limite usado</span>
                        <span style={{ color: limitPct > 80 ? '#ff6b6b' : '#6a9060' }}>
                          {fmtCurrency(limitUsed)} / {fmtCurrency(account.credit_limit!)} ({limitPct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden mb-2" style={{ background: '#2a3a2e' }}>
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{
                            width: `${limitPct}%`,
                            background: limitPct > 80 ? '#ff6b6b' : limitPct > 50 ? '#ffb340' : '#6dd400',
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span style={{ color: '#4a6844' }}>Limite disponível</span>
                        <span className="font-['JetBrains_Mono'] font-semibold" style={{
                          color: (account.current_balance ?? 0) <= 0 ? '#ff6b6b' : '#6dd400'
                        }}>
                          {fmtCurrency(Math.max(account.current_balance ?? 0, 0))}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* erro de exclusão */}
                  {deleteError[account.id] && (
                    <div className="px-4 pb-2 text-[10px]" style={{ color: '#ff7070' }}>
                      {deleteError[account.id]}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* vazio */}
      {accounts.length === 0 && (
        <div className="text-center py-16" style={{ color: '#4a6844' }}>
          <div style={{ fontSize: 36 }}>🏦</div>
          <div className="mt-2 text-sm">Nenhuma conta cadastrada</div>
          <div className="text-[11px] mt-1">Clique em + Nova Conta para começar</div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL: Nova Conta
      ════════════════════════════════════════════════════════════════════ */}
      {modalMode === 'add' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75">
          <div
            className="w-full max-w-2xl rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto border-t border-x"
            style={{ background: '#1c2a1f', borderColor: 'rgba(109,212,0,0.2)' }}
          >
            <div className="w-8 h-1 rounded mx-auto mb-5" style={{ background: '#2a3a2e' }} />
            <h2 className="font-['Barlow_Condensed'] text-xl font-black mb-5 tracking-wide" style={{ color: '#e8f5e2' }}>
              Nova Conta
            </h2>

            {/* nome */}
            <div className="mb-3">
              <label className={labelCls} style={{ color: '#7ab070' }}>Nome da conta</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Nubank, Bradesco CC" className={inputCls} style={inputStyle} />
            </div>

            {/* tipo */}
            <div className="mb-3">
              <label className={labelCls} style={{ color: '#7ab070' }}>Tipo de conta</label>
              <select value={newType} onChange={e => handleTypeChange(e.target.value)} className={inputCls} style={inputStyle}>
                {ACCOUNT_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value} style={{ background: '#223026' }}>
                    {o.icon} {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* aviso fiduciário */}
            {(isNewCC || isNewCE) && (
              <div
                className="mb-3 px-3 py-2.5 rounded-lg border text-[11px]"
                style={{ background: 'rgba(91,200,255,0.06)', borderColor: 'rgba(91,200,255,0.2)', color: '#5bc8ff' }}
              >
                {isNewCC
                  ? '💳 Cartão de Crédito — não afeta o Saldo Disponível. Gerenciado como Saldo Comprometido via faturas.'
                  : '🏦 Cheque Especial — registra obrigações financeiras. Juros sempre cobrados no pagamento.'}
              </div>
            )}

            {/* saldo inicial + data */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={labelCls} style={{ color: '#7ab070' }}>
                  {isNewCC ? 'Limite do cartão (R$)' : isNewCE ? 'Limite do cheque especial (R$)' : 'Saldo inicial (R$)'}
                </label>
                <input type="number" value={newBalance} onChange={e => setNewBalance(e.target.value)} placeholder="0,00" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={{ color: '#7ab070' }}>Data de referência</label>
                <input type="date" value={newBalanceDate} onChange={e => setNewBalanceDate(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
            </div>

            {/* campos CC */}
            {isNewCC && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={labelCls} style={{ color: '#7ab070' }}>Dia fechamento (1–28)</label>
                  <input type="number" min={1} max={28} value={newCloseDay} onChange={e => setNewCloseDay(e.target.value)} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: '#7ab070' }}>Dia vencimento (1–28)</label>
                  <input type="number" min={1} max={28} value={newDueDay} onChange={e => setNewDueDay(e.target.value)} className={inputCls} style={inputStyle} />
                </div>
              </div>
            )}

            {/* campos CE */}
            {isNewCE && (
              <div className="mb-3">
                <label className={labelCls} style={{ color: '#7ab070' }}>Dia vencimento (0 = último dia do mês)</label>
                <input type="number" min={0} max={28} value={newOverdraftDay} onChange={e => setNewOverdraftDay(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
            )}

            {/* cor */}
            <div className="mb-5">
              <label className={labelCls} style={{ color: '#7ab070' }}>Cor da conta</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {COLOR_OPTIONS.map(col => (
                  <button
                    key={col}
                    onClick={() => setNewColor(col)}
                    className="w-7 h-7 rounded-full border-2 transition-all"
                    style={{ background: col, borderColor: newColor === col ? '#fff' : 'transparent' }}
                  />
                ))}
              </div>
              {/* preview */}
              <div className="flex items-center gap-2 mt-2">
                <div className="w-3 h-3 rounded-full" style={{ background: newColor }} />
                <span className="text-[11px]" style={{ color: '#7ab070' }}>
                  {newName || 'Preview da conta'}
                </span>
              </div>
            </div>

            {/* botões */}
            <button
              onClick={handleAddAccount}
              disabled={loading || !newName || !newBalance}
              className="w-full py-3.5 rounded-xl font-['Barlow_Condensed'] font-black text-base uppercase tracking-wider transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: '#6dd400', color: '#0f1f12' }}
            >
              {loading ? 'Criando...' : 'Criar conta'}
            </button>
            <button onClick={() => setModalMode(null)} className="w-full mt-2 py-2.5 rounded-xl text-sm border" style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#7ab070' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL: Editar Saldo
      ════════════════════════════════════════════════════════════════════ */}
      {modalMode === 'edit_balance' && editAccountId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75">
          <div
            className="w-full max-w-2xl rounded-t-2xl p-5 border-t border-x"
            style={{ background: '#1c2a1f', borderColor: 'rgba(109,212,0,0.2)' }}
          >
            <div className="w-8 h-1 rounded mx-auto mb-5" style={{ background: '#2a3a2e' }} />
            <h2 className="font-['Barlow_Condensed'] text-xl font-black mb-5 tracking-wide" style={{ color: '#e8f5e2' }}>
              Ajustar Saldo
            </h2>
            <div className="mb-3">
              <label className={labelCls} style={{ color: '#7ab070' }}>Novo saldo (R$)</label>
              <input type="number" value={editBalance} onChange={e => setEditBalance(e.target.value)} placeholder="0,00" className={inputCls} style={inputStyle} />
            </div>
            <div className="mb-5">
              <label className={labelCls} style={{ color: '#7ab070' }}>Data do ajuste</label>
              <input type="date" value={editBalanceDate} onChange={e => setEditBalanceDate(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
            <button onClick={handleEditBalance} disabled={loading || !editBalance} className="w-full py-3.5 rounded-xl font-['Barlow_Condensed'] font-black text-base uppercase tracking-wider disabled:opacity-40" style={{ background: '#6dd400', color: '#0f1f12' }}>
              {loading ? 'Salvando...' : 'Salvar ajuste'}
            </button>
            <button onClick={() => { setModalMode(null); setEditAccountId(null) }} className="w-full mt-2 py-2.5 rounded-xl text-sm border" style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#7ab070' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL: Transferência
      ════════════════════════════════════════════════════════════════════ */}
      {modalMode === 'transfer' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75">
          <div
            className="w-full max-w-2xl rounded-t-2xl p-5 border-t border-x"
            style={{ background: '#1c2a1f', borderColor: 'rgba(109,212,0,0.2)' }}
          >
            <div className="w-8 h-1 rounded mx-auto mb-5" style={{ background: '#2a3a2e' }} />
            <h2 className="font-['Barlow_Condensed'] text-xl font-black mb-5 tracking-wide" style={{ color: '#e8f5e2' }}>
              Transferência entre Contas
            </h2>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={labelCls} style={{ color: '#7ab070' }}>De</label>
                <select value={fromAccount} onChange={e => setFromAccount(e.target.value)} className={inputCls} style={inputStyle}>
                  <option value="" style={{ background: '#223026' }}>Selecionar…</option>
                  {accounts.filter(a => !isFiduciary(a.type)).map(a => (
                    <option key={a.id} value={a.id} style={{ background: '#223026' }}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} style={{ color: '#7ab070' }}>Para</label>
                <select value={toAccount} onChange={e => setToAccount(e.target.value)} className={inputCls} style={inputStyle}>
                  <option value="" style={{ background: '#223026' }}>Selecionar…</option>
                  {accounts.filter(a => !isFiduciary(a.type) && a.id !== fromAccount).map(a => (
                    <option key={a.id} value={a.id} style={{ background: '#223026' }}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={labelCls} style={{ color: '#7ab070' }}>Valor (R$)</label>
                <input type="number" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="0,00" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={{ color: '#7ab070' }}>Data</label>
                <input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
            </div>

            <div className="mb-5">
              <label className={labelCls} style={{ color: '#7ab070' }}>Descrição</label>
              <input value={transferDesc} onChange={e => setTransferDesc(e.target.value)} placeholder="Transferência" className={inputCls} style={inputStyle} />
            </div>

            <button
              onClick={handleTransfer}
              disabled={loading || !fromAccount || !toAccount || !transferAmount}
              className="w-full py-3.5 rounded-xl font-['Barlow_Condensed'] font-black text-base uppercase tracking-wider disabled:opacity-40"
              style={{ background: '#5bc8ff', color: '#0a1a2a' }}
            >
              {loading ? 'Transferindo...' : 'Confirmar transferência'}
            </button>
            <button onClick={() => setModalMode(null)} className="w-full mt-2 py-2.5 rounded-xl text-sm border" style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#7ab070' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          INVOICE PANEL (CC / CE)
      ════════════════════════════════════════════════════════════════════ */}
      {invoicePanelId && (
        <InvoicePanel
          accountId={invoicePanelId}
          onClose={() => setInvoicePanelId(null)}
        />
      )}
    </div>
  )
}
