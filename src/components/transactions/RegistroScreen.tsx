'use client'
import { useState, useMemo } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { CAT_ICONS, CAT_LABELS, fmtCurrency, MONTH_NAMES } from '@/lib/utils'
import TransactionModal from './TransactionModal'
import type { Transaction } from '@/types/database'

type Filter = 'todos' | 'completed' | 'planned' | 'income' | 'expense' | 'parcela'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'completed', label: 'Realizados' },
  { id: 'planned', label: 'Planejados' },
  { id: 'income', label: 'Entradas' },
  { id: 'expense', label: 'Saídas' },
  { id: 'parcela', label: 'Parcelados' },
]

export default function RegistroScreen() {
  const { transactions } = useAppStore()
  const [filter, setFilter] = useState<Filter>('todos')
  const [showModal, setShowModal] = useState(false)

  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const filtered = useMemo(() => {
    let txs = [...transactions]
    if (filter === 'completed') txs = txs.filter(t => t.status === 'completed')
    else if (filter === 'planned') txs = txs.filter(t => t.status === 'planned')
    else if (filter === 'income') txs = txs.filter(t => t.type === 'income')
    else if (filter === 'expense') txs = txs.filter(t => t.type === 'expense')
    else if (filter === 'parcela') txs = txs.filter(t => t.installment_group_id)
    return txs.sort((a, b) => b.date.localeCompare(a.date))
  }, [transactions, filter])

  const thisMonthTxs = transactions.filter(t => t.date.startsWith(thisMonth))
  const income = thisMonthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = thisMonthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const result = income - expense

  // Group by month
  const groups: Record<string, Transaction[]> = {}
  filtered.forEach(t => {
    const m = t.date.substring(0, 7)
    if (!groups[m]) groups[m] = []
    groups[m].push(t)
  })

  return (
    <div className="relative pb-20">
      {/* Stats */}
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

      {/* Filters */}
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

      {/* List */}
      <div className="px-4">
        {Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(month => {
          const [y, m] = month.split('-')
          return (
            <div key={month}>
              <div className="text-[10px] font-bold text-[#3a5030] uppercase tracking-widest py-3 border-t border-[rgba(109,212,0,0.06)] first:border-t-0">
                {MONTH_NAMES[parseInt(m) - 1]} {y}
              </div>
              {groups[month].map(tx => (
                <TxItem key={tx.id} tx={tx} />
              ))}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center text-[#3a5030] text-sm py-16">Nenhum lançamento encontrado</div>
        )}
      </div>

      {/* FAB */}
      <button onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-4 w-12 h-12 bg-[#6dd400] text-[#0d1410] rounded-[14px] text-2xl font-bold flex items-center justify-center shadow-lg shadow-[rgba(109,212,0,0.2)] hover:opacity-90 transition-opacity z-40">
        +
      </button>

      {showModal && <TransactionModal onClose={() => setShowModal(false)} />}
    </div>
  )
}

function TxItem({ tx }: { tx: Transaction }) {
  const { updateTransactionStatus } = useAppStore()
  const icon = CAT_ICONS[tx.category] || '📌'
  const isIncome = tx.type === 'income'
  const isPlanned = tx.status === 'planned'
  const day = tx.date.split('-')[2]

  const valColor = isIncome ? 'text-[#6dd400]' : isPlanned ? 'text-[#ffb340]' : 'text-[#ff5757]'
  const barColor = isIncome ? '#6dd400' : isPlanned ? '#ffb340' : '#ff5757'

  return (
    <div className="flex items-center gap-2.5 bg-[#172010] border border-[rgba(109,212,0,0.07)] rounded-xl p-2.5 mb-1.5 relative overflow-hidden hover:border-[rgba(109,212,0,0.15)] transition-colors">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl" style={{ background: barColor }} />
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
          <button onClick={() => updateTransactionStatus(tx.id, tx.status === 'completed' ? 'planned' : 'completed')}
            className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full transition-colors ${
              tx.status === 'completed'
                ? 'bg-[rgba(109,212,0,0.1)] text-[#6dd400]'
                : tx.status === 'planned'
                ? 'bg-[rgba(255,179,64,0.1)] text-[#ffb340]'
                : 'bg-[rgba(255,87,87,0.1)] text-[#ff5757]'
            }`}>
            {tx.status === 'completed' ? 'OK' : tx.status === 'planned' ? 'Plan' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
