'use client'
import { useMemo } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { MONTH_NAMES, CAT_LABELS, CAT_COLORS, fmtCurrency } from '@/lib/utils'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

export default function ResumoScreen() {
  const { transactions, calendarMonth, calendarYear } = useAppStore()

  const monthStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()

  const txMonth = transactions.filter(t => t.date.startsWith(monthStr) && t.status !== 'cancelled')

  const income = txMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = txMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  // Daily balance curve
  const chartData = useMemo(() => {
    let s = 0
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      const ds = `${monthStr}-${String(d).padStart(2, '0')}`
      txMonth.filter(t => t.date === ds).forEach(t => { s += t.type === 'income' ? t.amount : -t.amount })
      return { dia: d, saldo: Math.round(s) }
    })
  }, [transactions, calendarMonth, calendarYear])

  const minSaldo = Math.min(...chartData.map(d => d.saldo))
  const maxSaldo = Math.max(...chartData.map(d => d.saldo))
  const minDia = chartData.find(d => d.saldo === minSaldo)?.dia
  const maxDia = chartData.find(d => d.saldo === maxSaldo)?.dia

  // Category breakdown
  const catTotals = useMemo(() => {
    const map: Record<string, number> = {}
    txMonth.filter(t => t.type === 'expense').forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [transactions, calendarMonth, calendarYear])

  const maxCat = catTotals[0]?.[1] || 1

  return (
    <div className="px-4 py-4 pb-20">
      <div className="font-['Barlow_Condensed'] text-[11px] font-bold text-[#3a5030] uppercase tracking-widest mb-3">
        Fluxo — {MONTH_NAMES[calendarMonth]} {calendarYear}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-1.5 mb-5">
        {[
          { label: 'Entradas', value: income, color: 'text-[#6dd400]' },
          { label: 'Saídas', value: expense, color: 'text-[#ff5757]' },
          { label: 'Resultado', value: income - expense, color: income - expense >= 0 ? 'text-[#6dd400]' : 'text-[#ff5757]' },
        ].map(s => (
          <div key={s.label} className="bg-[#172010] border border-[rgba(109,212,0,0.08)] rounded-xl p-2.5">
            <div className="text-[9px] font-bold text-[#3a5030] uppercase tracking-widest mb-1">{s.label}</div>
            <div className={`font-['JetBrains_Mono'] text-[12px] font-semibold ${s.color}`}>
              {fmtCurrency(Math.abs(income - expense === s.value ? s.value : s.value))}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="h-48 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(109,212,0,0.05)" />
            <XAxis dataKey="dia" tick={{ fontSize: 9, fill: '#4a6644' }} tickLine={false} axisLine={false} interval={4} />
            <YAxis tick={{ fontSize: 9, fill: '#4a6644' }} tickLine={false} axisLine={false}
              tickFormatter={v => `R$${Math.round(v / 1000)}k`} />
            <Tooltip
              contentStyle={{ background: '#111a14', border: '1px solid rgba(109,212,0,0.2)', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#8aab80' }}
              formatter={(v: number) => [fmtCurrency(v), 'Saldo']}
              labelFormatter={d => `Dia ${d}`}
            />
            <Line type="monotone" dataKey="saldo" stroke="#6dd400" strokeWidth={2} dot={false}
              activeDot={{ r: 4, fill: '#6dd400', stroke: '#0d1410', strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Min/Max */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        <div className="bg-[#172010] border border-[rgba(109,212,0,0.08)] rounded-xl p-3">
          <div className="text-[9px] font-bold text-[#3a5030] uppercase tracking-widest mb-1">Mínimo</div>
          <div className="font-['JetBrains_Mono'] text-sm font-semibold text-[#ff5757]">{fmtCurrency(minSaldo)}</div>
          <div className="text-[10px] text-[#3a5030] mt-0.5">Dia {minDia}</div>
        </div>
        <div className="bg-[#172010] border border-[rgba(109,212,0,0.08)] rounded-xl p-3">
          <div className="text-[9px] font-bold text-[#3a5030] uppercase tracking-widest mb-1">Máximo</div>
          <div className="font-['JetBrains_Mono'] text-sm font-semibold text-[#6dd400]">{fmtCurrency(maxSaldo)}</div>
          <div className="text-[10px] text-[#3a5030] mt-0.5">Dia {maxDia}</div>
        </div>
      </div>

      {/* Category bars */}
      {catTotals.length > 0 && (
        <>
          <div className="font-['Barlow_Condensed'] text-[11px] font-bold text-[#3a5030] uppercase tracking-widest mb-3">
            Saídas por categoria
          </div>
          {catTotals.map(([cat, val]) => (
            <div key={cat} className="flex items-center gap-2 mb-2.5">
              <div className="text-xs text-[#8aab80] w-24 flex-shrink-0 truncate">{CAT_LABELS[cat] || cat}</div>
              <div className="flex-1 h-1.5 bg-[#1e2a18] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${Math.round((val / maxCat) * 100)}%`, background: CAT_COLORS[cat] || '#94a3b8' }} />
              </div>
              <div className="font-['JetBrains_Mono'] text-[11px] text-[#8aab80] w-24 text-right flex-shrink-0">
                {fmtCurrency(val)}
              </div>
            </div>
          ))}
        </>
      )}

      {txMonth.length === 0 && (
        <div className="text-center text-[#3a5030] text-sm py-10">
          Nenhum lançamento em {MONTH_NAMES[calendarMonth]}
        </div>
      )}
    </div>
  )
}
