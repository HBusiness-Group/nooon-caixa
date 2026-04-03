'use client'
import { useState, useMemo, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { CAT_ICONS, CAT_LABELS, fmtCurrency, fmtValue, MONTH_NAMES } from '@/lib/utils'
import TransactionModal from './TransactionModal'
import type { Transaction } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

type Filter = 'todos' | 'completed' | 'planned' | 'overdue' | 'simulated' | 'income' | 'expense' | 'parcela'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todos',     label: 'Todos' },
  { id: 'completed', label: 'Realizados' },
  { id: 'planned',   label: 'Planejados' },
  { id: 'overdue',   label: 'Atrasados' },
  { id: 'simulated', label: 'Simulados' },
  { id: 'income',    label: 'Entradas' },
  { id: 'expense',   label: 'Saídas' },
  { id: 'parcela',   label: 'Parcelados' },
]

function statusPriority(status: string) {
  if (status === 'overdue')   return 0
  if (status === 'planned')   return 1
  if (status === 'simulated') return 2
  return 3
}

export default function RegistroScreen() {
  const { transactions, loadTransactions, loadAccounts } = useAppStore()
  const [filter, setFilter] = useState<Filter>('todos')
  const [showModal, setShowModal] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    if (transactions.length > 0) markOverdue()
  }, [transactions.length])

  async function markOverdue() {
    const today = new Date().toISOString().split('T')[0]
    const toMark = transactions.filter(t => t.status === 'planned' && t.date < today)
    if (toMark.length === 0) return
    for (const t of toMark) {
      await supabase.from('transactions').update({ status: 'overdue' } as any).eq('id', t.id)
    }
    await loadTransactions()
  }

  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const hasActiveSearch = search.trim() !== '' || dateFrom !== '' || dateTo !== ''

  const filtered = useMemo(() => {
    let txs = [...transactions]

    if (filter === 'completed')  txs = txs.filter(t => t.status === 'completed')
    else if (filter === 'planned')   txs = txs.filter(t => t.status === 'planned')
    else if (filter === 'overdue')   txs = txs.filter(t => t.status === 'overdue')
    else if (filter === 'simulated') txs = txs.filter(t => t.status === 'simulated')
    else if (filter === 'income')    txs = txs.filter(t => t.type === 'income')
    else if (filter === 'expense')   txs = txs.filter(t => t.type === 'expense')
    else if (filter === 'parcela')   txs = txs.filter(t => t.installment_group_id)

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      txs = txs.filter(t =>
        t.description.toLowerCase().includes(q) ||
        (t.group_ref || '').toLowerCase().includes(q) ||
        CAT_LABELS[t.category]?.toLowerCase().includes(q) ||
        String(t.amount).includes(q) ||
        t.date.includes(q) ||
        (t.account?.name || '').toLowerCase().includes(q)
      )
    }

    if (dateFrom) txs = txs.filter(t => t.date >= dateFrom)
    if (dateTo)   txs = txs.filter(t => t.date <= dateTo)

    return txs.sort((a, b) => {
      const pa = statusPriority(a.status)
      const pb = statusPriority(b.status)
      if (pa !== pb) return pa - pb
      return a.date.localeCompare(b.date)
    })
  }, [transactions, filter, search, dateFrom, dateTo])

  const thisMonthTxs = transactions.filter(t => t.date.startsWith(thisMonth))
  const income  = thisMonthTxs.filter(t => t.type === 'income'  && t.status === 'completed').reduce((s, t) => s + t.amount, 0)
  const expense = thisMonthTxs.filter(t => t.type === 'expense' && t.status === 'completed').reduce((s, t) => s + t.amount, 0)
  const result  = income - expense

  const groups: Record<string, Transaction[]> = {}
  filtered.forEach(t => {
    const m = t.date.substring(0, 7)
    if (!groups[m]) groups[m] = []
    groups[m].push(t)
  })

  const sortedMonths = Object.keys(groups).sort((a, b) => {
    const aHasPending = groups[a].some(t => t.status !== 'completed')
    const bHasPending = groups[b].some(t => t.status !== 'completed')
    if (aHasPending && !bHasPending) return -1
    if (!aHasPending && bHasPending) return 1
    return a.localeCompare(b)
  })

  function clearSearch() {
    setSearch('')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="relative pb-20">

      {/* Stats — mantém R$ */}
      <div className="grid grid-cols-3 gap-1.5 p-4 pb-3">
        {[
          { label: 'Entradas', value: income,  color: '#6dd400' },
          { label: 'Saídas',   value: expense, color: '#ff6b6b' },
          { label: 'Resultado',value: result,  color: result >= 0 ? '#6dd400' : '#ff6b6b' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-2.5 border" style={{ background: '#1c2a1f', borderColor: 'rgba(109,212,0,0.15)' }}>
            <div className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#6a9060' }}>{s.label}</div>
            <div className="font-['JetBrains_Mono'] text-[13px] font-semibold" style={{ color: s.color }}>
              {fmtCurrency(Math.abs(s.value))}
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto scrollbar-none">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className="whitespace-nowrap text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all flex-shrink-0"
            style={{
              background: filter === f.id ? 'rgba(109,212,0,0.1)' : '#1c2a1f',
              borderColor: filter === f.id ? 'rgba(109,212,0,0.3)' : 'rgba(109,212,0,0.12)',
              color: filter === f.id ? '#6dd400' : '#7ab070',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Busca */}
      <div className="px-4 pb-3">
        <button
          onClick={() => { setShowSearch(!showSearch); if (showSearch) clearSearch() }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors"
          style={{
            background: hasActiveSearch ? 'rgba(109,212,0,0.08)' : '#1c2a1f',
            borderColor: hasActiveSearch ? 'rgba(109,212,0,0.3)' : 'rgba(109,212,0,0.12)',
            color: hasActiveSearch ? '#6dd400' : '#7ab070',
          }}>
          <span style={{ fontSize: 14 }}>🔍</span>
          <span className="flex-1 text-left text-[12px]">
            {hasActiveSearch
              ? `Filtrando: ${[search && `"${search}"`, dateFrom && `de ${dateFrom}`, dateTo && `até ${dateTo}`].filter(Boolean).join(' · ')}`
              : 'Buscar e filtrar por período...'}
          </span>
          {hasActiveSearch && (
            <span onClick={e => { e.stopPropagation(); clearSearch(); setShowSearch(false) }}
              className="text-[11px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(255,107,107,0.15)', color: '#ff6b6b' }}>
              ✕ Limpar
            </span>
          )}
          <span style={{ fontSize: 10, color: '#4a6844' }}>{showSearch ? '▲' : '▼'}</span>
        </button>

        {showSearch && (
          <div className="mt-2 p-3 rounded-xl border" style={{ background: '#172010', borderColor: 'rgba(109,212,0,0.15)' }}>
            <input
              type="text"
              placeholder="Descrição, categoria, conta, valor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-2"
              style={{ background: '#1c2a1f', border: '1px solid rgba(109,212,0,0.2)', color: '#e8f5e2' }}
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: '#4a6844' }}>De</div>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: '#1c2a1f', border: '1px solid rgba(109,212,0,0.2)', color: '#e8f5e2' }} />
              </div>
              <div className="flex-1">
                <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: '#4a6844' }}>Até</div>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: '#1c2a1f', border: '1px solid rgba(109,212,0,0.2)', color: '#e8f5e2' }} />
              </div>
            </div>
            {filtered.length > 0 && hasActiveSearch && (
              <div className="text-[10px] mt-2 text-center" style={{ color: '#4a6844' }}>
                {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="px-4">
        {sortedMonths.map(month => {
          const [y, m] = month.split('-')
          const hasPending = groups[month].some(t => t.status !== 'completed')
          return (
            <div key={month}>
              <div className="text-[10px] font-bold uppercase tracking-widest py-3 border-t flex items-center gap-2"
                style={{ color: hasPending ? '#ffc04d' : '#6a9060', borderColor: 'rgba(109,212,0,0.12)' }}>
                {MONTH_NAMES[parseInt(m) - 1]} {y}
                {hasPending && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: 'rgba(255,192,77,0.15)', color: '#ffc04d' }}>
                    pendências
                  </span>
                )}
              </div>
              {groups[month].map(tx => (
                <TxItem key={tx.id} tx={tx} onEdit={() => setEditingTx(tx)} />
              ))}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-sm" style={{ color: '#4a6844' }}>
            {hasActiveSearch ? 'Nenhum resultado para esta busca' : 'Nenhum lançamento encontrado'}
          </div>
        )}
      </div>

      <button onClick={() => { setEditingTx(null); setShowModal(true) }}
        className="fixed bottom-6 right-4 w-12 h-12 rounded-[14px] text-2xl font-bold flex items-center justify-center z-40 hover:opacity-90 transition-opacity"
        style={{ background: '#6dd400', color: '#0f1f12', boxShadow: '0 4px 20px rgba(109,212,0,0.25)' }}>
        +
      </button>

      {(showModal || editingTx) && (
        <TransactionModal
          editTx={editingTx}
          onClose={() => { setShowModal(false); setEditingTx(null) }}
        />
      )}
    </div>
  )
}

function TxItem({ tx, onEdit }: { tx: Transaction; onEdit: () => void }) {
  const { deleteTransaction, loadTransactions, loadAccounts } = useAppStore()
  const [showActions, setShowActions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPaymentDate, setShowPaymentDate] = useState(false)
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const icon = CAT_ICONS[tx.category] || '📌'
  const isIncome = tx.type === 'income'
  const day = tx.date.split('-')[2]

  const statusConfig: Record<string, { color: string; bg: string; label: string; bar: string }> = {
    completed: { color: '#6dd400', bg: 'rgba(109,212,0,0.1)',    label: 'OK',       bar: '#6dd400' },
    planned:   { color: '#ffc04d', bg: 'rgba(255,192,77,0.1)',   label: 'Plan',     bar: '#ffc04d' },
    overdue:   { color: '#ff6b6b', bg: 'rgba(255,107,107,0.1)',  label: 'Atrasado', bar: '#ff6b6b' },
    simulated: { color: '#c084fc', bg: 'rgba(192,132,252,0.1)',  label: 'Sim',      bar: '#c084fc' },
    cancelled: { color: '#555',    bg: 'rgba(100,100,100,0.1)',  label: 'Cancel',   bar: '#555'    },
  }
  const sc = statusConfig[tx.status] || statusConfig.planned

  // Cor do valor: entrada=verde, saída realizada=vermelho, saída planejada/atrasada=âmbar, simulado=roxo
  const valColor = tx.status === 'simulated'
    ? '#c084fc'
    : isIncome
    ? '#6dd400'
    : tx.status === 'completed'
    ? '#ff6b6b'
    : '#ffc04d'

  async function handleMarkCompleted() {
    if (tx.status === 'overdue') {
      setShowPaymentDate(true)
      return
    }
    await cycleStatus()
  }

  async function confirmPaymentDate() {
    if (loading) return
    setLoading(true)
    const newDesc = `${tx.description} · Pago em ${format(new Date(paymentDate + 'T12:00:00'), 'dd/MM/yyyy')}`
    await supabase.from('transactions').update({ status: 'completed', description: newDesc } as any).eq('id', tx.id)
    await loadTransactions()
    await loadAccounts()
    setShowPaymentDate(false)
    setShowActions(false)
    setLoading(false)
  }

  async function cycleStatus() {
    if (loading) return
    setLoading(true)
    // Simulado → Realizado direto; Realizado → Planejado; Planejado → Realizado
    const next = tx.status === 'completed' ? 'planned' : 'completed'
    await supabase.from('transactions').update({ status: next } as any).eq('id', tx.id)
    await loadTransactions()
    await loadAccounts()
    setLoading(false)
    setShowActions(false)
  }

  async function handleDelete() {
    if (!confirm('Excluir este lançamento?')) return
    await deleteTransaction(tx.id)
    setShowActions(false)
  }

  return (
    <div className="mb-1.5">
      <div className="flex items-center gap-2.5 rounded-xl p-2.5 relative overflow-hidden cursor-pointer border transition-colors"
        style={{ background: '#1c2a1f', borderColor: 'rgba(109,212,0,0.12)' }}
        onClick={() => { setShowActions(!showActions); setShowPaymentDate(false) }}>
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl" style={{ background: sc.bar }} />
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ml-1" style={{ background: '#223026' }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold truncate" style={{ color: '#e8f5e2' }}>{tx.description}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {tx.account && (
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: tx.account.color }} />
                <span className="text-[10px]" style={{ color: '#4a6844' }}>{tx.account.name}</span>
              </span>
            )}
            <span className="text-[10px]" style={{ color: '#4a6844' }}>· {CAT_LABELS[tx.category]}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-['JetBrains_Mono'] text-[13px] font-semibold" style={{ color: valColor }}>
            {fmtValue(tx.amount, tx.type as 'income' | 'expense')}
          </div>
          <div className="flex items-center gap-1 justify-end mt-1">
            <span className="text-[10px]" style={{ color: '#4a6844' }}>dia {day}</span>
            {tx.installment_number && (
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(91,200,255,0.1)', color: '#5bc8ff' }}>
                {tx.installment_number}/{tx.installment_group?.total_installments ?? '?'}
              </span>
            )}
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>
              {sc.label}
            </span>
          </div>
        </div>
      </div>

      {showPaymentDate && (
        <div className="mx-1 mt-1 mb-1 p-3 rounded-xl border" style={{ background: '#223026', borderColor: 'rgba(255,192,77,0.25)' }}>
          <div className="text-xs font-semibold mb-2" style={{ color: '#ffc04d' }}>
            Informe a data real do pagamento:
          </div>
          <div className="flex gap-2 items-center">
            <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
              className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: '#1c2a1f', border: '1px solid rgba(255,192,77,0.3)', color: '#e8f5e2' }} />
            <button onClick={confirmPaymentDate} disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 hover:opacity-90"
              style={{ background: '#6dd400', color: '#0f1f12' }}>
              {loading ? '...' : 'OK'}
            </button>
            <button onClick={() => setShowPaymentDate(false)}
              className="px-3 py-2 rounded-lg text-sm border"
              style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#7ab070' }}>✕</button>
          </div>
        </div>
      )}

      {showActions && !showPaymentDate && (
        <div className="flex gap-2 px-1 pt-1 pb-1">
          <button onClick={handleMarkCompleted} disabled={loading}
            className="flex-1 py-2 rounded-lg text-[11px] font-semibold border transition-colors"
            style={{ background: 'rgba(109,212,0,0.08)', borderColor: 'rgba(109,212,0,0.2)', color: '#6dd400' }}>
            {loading ? '...' : tx.status === 'completed' ? '↩ Voltar para planejado' : '✓ Marcar como realizado'}
          </button>
          <button onClick={onEdit}
            className="px-3 py-2 rounded-lg text-[11px] font-semibold border transition-colors"
            style={{ background: 'rgba(91,200,255,0.08)', borderColor: 'rgba(91,200,255,0.2)', color: '#5bc8ff' }}>
            ✏ Editar
          </button>
          <button onClick={handleDelete}
            className="px-3 py-2 rounded-lg text-[11px] font-semibold border transition-colors"
            style={{ background: 'rgba(255,107,107,0.08)', borderColor: 'rgba(255,107,107,0.2)', color: '#ff6b6b' }}>
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
