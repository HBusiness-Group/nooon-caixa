'use client'
import { useState, useMemo, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { CAT_ICONS, CAT_LABELS, fmtCurrency, MONTH_NAMES } from '@/lib/utils'
import TransactionModal from './TransactionModal'
import type { Transaction } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'

type Filter = 'todos' | 'completed' | 'planned' | 'overdue' | 'income' | 'expense' | 'parcela'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'completed', label: 'Realizados' },
  { id: 'planned', label: 'Planejados' },
  { id: 'overdue', label: 'Atrasados' },
  { id: 'income', label: 'Entradas' },
  { id: 'expense', label: 'Saídas' },
  { id: 'parcela', label: 'Parcelados' },
]

export default function RegistroScreen() {
  const { transactions, loadTransactions, loadAccounts } = useAppStore()
  const [filter, setFilter] = useState<Filter>('todos')
  const [showModal, setShowModal] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  useEffect(() => {
    if (transactions.length > 0) {
      markOverdue()
    }
  }, [transactions])

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

  const filtered = useMemo(() => {
    let txs = [...transactions]
    if (filter === 'completed') txs = txs.filter(t => t.status === 'completed')
    else if (filter === 'planned') txs = txs.filter(t => t.status === 'planned')
    else if (filter === 'overdue') txs = txs.filter(t => t.status === 'overdue')
    else if (filter === 'income') txs = txs.filter(t => t.type === 'income')
    else if (filter === 'expense') txs = txs.filter(t => t.type === 'expense')
    else if (filter === 'parcela') txs = txs.filter(t => t.installment_group_id)
    return txs.sort((a, b) => a.date.localeCompare(b.date))
  }, [transactions, filter])

  const thisMonthTxs = transactions.filter(t => t.date.startsWith(thisMonth))
  const income = thisMonthTxs.filter(t => t.type === 'income' && t.status === 'completed').reduce((s, t) => s + t.amount, 0)
  const expense = thisMonthTxs.filter(t => t.type === 'expense' && t.status === 'completed').reduce((s, t) => s + t.amount, 0)
  const result = income - expense

  const groups: Record<string, Transaction[]> = {}
  filtered.forEach(t => {
    const m = t.date.substring(0, 7)
    if (!groups[m]) groups[m] = []
    groups[m].push(t)
  })

  return (
    <div className="relative pb-20">
      <div className="grid grid-cols-3 gap-1.5 p-4 pb-3">
        {[
          { label: 'Entradas', value: income, color: 'text-[#6dd400]' },
          { label: 'Saídas', value: expense, color: 'text-[#ff5757]' },
          { label: 'Resultado', value: result, color: result >= 0 ? 'text-[#6dd400]' : 'text-[#ff5757]' },
        ].map(s => (
          <div key={s.label} className="bg-[#172010] border border-[rgba(109,212,0,0.08)] rounded-xl p-2.5">
            <div className="text-[9px] font-bold text-[#3a5030] uppercase tracking-widest mb-1">{s.label}</div>
            <div className={`font-['JetBrains_Mono'] text-[13px] font-semibold ${s.color}`}>
              {fmtCurrency(Math.abs(s.value))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-none">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`whitespace-nowrap text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all flex-shrink-0 ${
              filter === f.id
                ? 'bg-[rgba(109,212,0,0.1)] text-[#6dd400] border-[rgba(109,212,0,0.25)]'
                : 'bg-[#172010] text-[#4a6644] border-[rgba(255,255,255,0.06)] hover:text-[#8aab80]'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="px-4">
        {Object.keys(groups).sort((a, b) => a.localeCompare(b)).map(month => {
          const [y, m] = month.split('-')
          return (
            <div key={month}>
              <div className="text-[10px] font-bold text-[#3a5030] uppercase tracking-widest py-3 border-t border-[rgba(109,212,0,0.06)] first:border-t-0">
                {MONTH_NAMES[parseInt(m) - 1]} {y}
              </div>
              {groups[month].map(tx => (
                <TxItem key={tx.id} tx={tx} onEdit={() => setEditingTx(tx)} />
              ))}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center text-[#3a5030] text-sm py-16">Nenhum lançamento encontrado</div>
        )}
      </div>

      <button onClick={() => { setEditingTx(null); setShowModal(true) }}
        className="fixed bottom-6 right-4 w-12 h-12 bg-[#6dd400] text-[#0d1410] rounded-[14px] text-2xl font-bold flex items-center justify-center shadow-lg shadow-[rgba(109,212,0,0.2)] hover:opacity-90 transition-opacity z-40">
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

  const icon = CAT_ICONS[tx.category] || '📌'
  const isIncome = tx.type === 'income'
  const day = tx.date.split('-')[2]

  const statusConfig = {
    completed: { color: 'text-[#6dd400]', bg: 'bg-[rgba(109,212,0,0.1)]', label: 'OK', bar: '#6dd400' },
    planned:   { color: 'text-[#ffb340]', bg: 'bg-[rgba(255,179,64,0.1)]', label: 'Plan', bar: '#ffb340' },
    overdue:   { color: 'text-[#ff5757]', bg: 'bg-[rgba(255,87,87,0.1)]', label: 'Atrasado', bar: '#ff5757' },
    cancelled: { color: 'text-[#555]', bg: 'bg-[rgba(100,100,100,0.1)]', label: 'Cancel', bar: '#555' },
  }
  const sc = statusConfig[tx.status as keyof typeof statusConfig] || statusConfig.planned
  const valColor = isIncome ? 'text-[#6dd400]' : tx.status === 'completed' ? 'text-[#ff5757]' : 'text-[#ffb340]'

  async function cycleStatus() {
    if (loading) return
    setLoading(true)
    const next = tx.status === 'completed' ? 'planned'
      : tx.status === 'planned' ? 'completed'
      : tx.status === 'overdue' ? 'completed'
      : 'planned'
    await supabase.from('transactions').update({ status: next } as any).eq('id', tx.id)
    await loadTransactions()
    await loadAccounts()
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirm('Excluir este lançamento?')) return
    await deleteTransaction(tx.id)
    setShowActions(false)
  }

  return (
    <div className="mb-1.5">
      <div className="flex items-center gap-2.5 bg-[#172010] border border-[rgba(109,212,0,0.07)] rounded-xl p-2.5 relative overflow-hidden hover:border-[rgba(109,212,0,0.15)] transition-colors cursor-pointer"
        onClick={() => setShowActions(!showActions)}>
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl" style={{ background: sc.bar }} />
        <div className="w-8 h-8 rounded-lg bg-[#1e2a18] flex items-center justify-center text-sm flex-shrink-0 ml-1">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-[#e8f0e4] truncate">{tx.description}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {tx.account && (
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: tx.account.color }} />
                <span className="text-[10px] text-[#3a5030]">{tx.account.name}</span>
              </span>
            )}
            <span className="text-[10px] text-[#3a5030]">· {CAT_LABELS[tx.category]}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`font-['JetBrains_Mono'] text-[13px] font-semibold ${valColor}`}>
            {isIncome ? '+' : '-'}{fmtCurrency(tx.amount)}
          </div>
          <div className="flex items-center gap-1 justify-end mt-1">
            <span className="text-[10px] text-[#3a5030]">dia {day}</span>
            {tx.installment_number && (
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-[rgba(64,180,255,0.1)] text-[#40b4ff]">
                {tx.installment_number}/{tx.installment_group?.total_installments ?? '?'}
              </span>
            )}
            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${sc.bg} ${sc.color}`}>
              {sc.label}
            </span>
          </div>
        </div>
      </div>

      {showActions && (
        <div className="flex gap-2 px-1 pt-1 pb-1">
          <button onClick={cycleStatus} disabled={loading}
            className="flex-1 py-2 rounded-lg text-[11px] font-semibold bg-[rgba(109,212,0,0.08)] text-[#6dd400] border border-[rgba(109,212,0,0.15)] hover:bg-[rgba(109,212,0,0.15)] transition-colors">
            {loading ? '...' : tx.status === 'completed' ? '↩ Voltar para planejado' : '✓ Marcar como realizado'}
          </button>
          <button onClick={onEdit}
            className="px-3 py-2 rounded-lg text-[11px] font-semibold bg-[rgba(64,180,255,0.08)] text-[#40b4ff] border border-[rgba(64,180,255,0.15)] hover:bg-[rgba(64,180,255,0.15)] transition-colors">
            ✏ Editar
          </button>
          <button onClick={handleDelete}
            className="px-3 py-2 rounded-lg text-[11px] font-semibold bg-[rgba(255,87,87,0.08)] text-[#ff5757] border border-[rgba(255,87,87,0.15)] hover:bg-[rgba(255,87,87,0.15)] transition-colors">
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
