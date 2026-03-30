'use client'
import { useMemo } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { MONTH_NAMES, DOW_NAMES, fmtCurrencyK, fmtCurrency } from '@/lib/utils'
import type { Transaction } from '@/types/database'

const DISPLAY_CATS = ['business', 'acquisition', 'loan'] as const

export default function CalendarioScreen() {
  const { transactions, calendarMonth, calendarYear, setCalendarMonth } = useAppStore()

  const monthStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
  const today = new Date().toISOString().split('T')[0]

  const days = useMemo(() => {
    const arr = []
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      arr.push({ d, ds, dow: new Date(ds + 'T12:00:00').getDay() })
    }
    return arr
  }, [calendarMonth, calendarYear, daysInMonth])

  const txByDay = useMemo(() => {
    const map: Record<string, Transaction[]> = {}
    days.forEach(({ ds }) => { map[ds] = [] })
    transactions
      .filter(t => t.date.startsWith(monthStr) && t.status !== 'cancelled')
      .forEach(t => { if (map[t.date]) map[t.date].push(t) })
    return map
  }, [transactions, days, monthStr])

  // Running balance from initial accounts balance
  const saldoByDay = useMemo(() => {
    let s = 12000 // TODO: replace with sum of account initial_balances + prior completed txs
    const map: Record<string, number> = {}
    days.forEach(({ ds }) => {
      ;(txByDay[ds] || []).forEach(t => { s += t.type === 'income' ? t.amount : -t.amount })
      map[ds] = s
    })
    return map
  }, [txByDay, days])

  const minSaldo = Math.min(...Object.values(saldoByDay))
  const minDay = Object.keys(saldoByDay).find(d => saldoByDay[d] === minSaldo)

  // Build weeks
  const weeks = useMemo(() => {
    const ws: (typeof days[0] | null)[][] = []
    let week: (typeof days[0] | null)[] = []
    days.forEach((day, i) => {
      if (i === 0 && day.dow > 0) {
        for (let j = 0; j < day.dow; j++) week.push(null)
      }
      week.push(day)
      if (day.dow === 6) { ws.push(week); week = [] }
    })
    if (week.length) {
      while (week.length < 7) week.push(null)
      ws.push(week)
    }
    return ws
  }, [days])

  function navMonth(dir: number) {
    let m = calendarMonth + dir
    let y = calendarYear
    if (m > 11) { m = 0; y++ }
    if (m < 0) { m = 11; y-- }
    setCalendarMonth(m, y)
  }

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navMonth(-1)} className="w-7 h-7 bg-[#172010] border border-[rgba(109,212,0,0.1)] rounded-lg text-[#8aab80] flex items-center justify-center text-sm hover:bg-[#1e2a18] transition-colors">‹</button>
          <div>
            <span className="font-['Barlow_Condensed'] text-lg font-black text-[#e8f0e4]">{MONTH_NAMES[calendarMonth]}</span>
            <span className="text-[#3a5030] text-sm ml-1.5">{calendarYear}</span>
          </div>
          <button onClick={() => navMonth(1)} className="w-7 h-7 bg-[#172010] border border-[rgba(109,212,0,0.1)] rounded-lg text-[#8aab80] flex items-center justify-center text-sm hover:bg-[#1e2a18] transition-colors">›</button>
        </div>
        <div className="text-[10px] text-[#3a5030]">Plano <span className="text-[#ffb340]">×</span> Real</div>
      </div>

      {/* Alert */}
      {minSaldo < 5000 && minDay && (
        <div className="mx-4 mb-3 bg-[rgba(255,87,87,0.07)] border border-[rgba(255,87,87,0.2)] rounded-xl px-3 py-2.5 flex items-center gap-2">
          <span className="text-base flex-shrink-0">⚠</span>
          <span className="text-xs text-[#ffaaaa]">
            Risco de saldo baixo em <strong className="text-[#ff5757]">dia {minDay.split('-')[2]}</strong>.
            Mínimo projetado: <strong className="text-[#ff5757]">{fmtCurrency(minSaldo)}</strong>
          </span>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-3 px-4 pb-2 flex-wrap">
        {[
          { color: '#6dd400', label: 'Entrada' },
          { color: '#ff5757', label: 'Saída real' },
          { color: '#ffb340', label: 'Planejado' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5 text-[10px] text-[#4a6644]">
            <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="px-4 overflow-x-auto">
        <div style={{ minWidth: 560 }}>
          {/* Day headers */}
          <div className="grid gap-[2px] mb-1" style={{ gridTemplateColumns: '80px repeat(7, 1fr)' }}>
            <div />
            {DOW_NAMES.map(d => (
              <div key={d} className="text-[9px] font-bold text-[#3a5030] text-center uppercase tracking-wider py-1">{d}</div>
            ))}
          </div>

          {weeks.map((week, wi) => (
            <div key={wi}>
              <div className="text-[9px] font-bold text-[#3a5030] uppercase tracking-wider py-2">Semana {wi + 1}</div>

              {/* Saldo row */}
              <div className="grid gap-[2px] mb-[2px]" style={{ gridTemplateColumns: '80px repeat(7, 1fr)' }}>
                <div className="text-[9px] font-bold text-[#3a5030] flex items-center uppercase tracking-wider">Saldo</div>
                {week.map((day, i) => {
                  if (!day) return <div key={i} />
                  const s = saldoByDay[day.ds] ?? 0
                  const cls = s > 8000 ? 'bg-[rgba(109,212,0,0.1)] text-[#6dd400] border-[rgba(109,212,0,0.15)]'
                    : s > 4000 ? 'bg-[rgba(255,179,64,0.08)] text-[#ffb340] border-[rgba(255,179,64,0.15)]'
                    : 'bg-[rgba(255,87,87,0.08)] text-[#ff5757] border-[rgba(255,87,87,0.2)]'
                  const todayCls = day.ds === today ? '!border-[#6dd400]' : ''
                  return (
                    <div key={i} className={`${cls} ${todayCls} border rounded-[4px] px-1 py-1 text-center font-['JetBrains_Mono'] text-[8px] font-semibold`}>
                      {fmtCurrencyK(s)}
                    </div>
                  )
                })}
              </div>

              {/* Category rows */}
              {DISPLAY_CATS.map(cat => (
                <div key={cat} className="grid gap-[2px] mb-[2px]" style={{ gridTemplateColumns: '80px repeat(7, 1fr)' }}>
                  <div className="text-[10px] text-[#8aab80] flex items-center capitalize pl-0.5">{cat}</div>
                  {week.map((day, i) => {
                    if (!day) return <div key={i} />
                    const catTxs = (txByDay[day.ds] || []).filter(t => t.category === cat)
                    const isToday = day.ds === today
                    return (
                      <div key={i} className={`min-h-[36px] bg-[#172010] border rounded-[4px] p-[2px] flex flex-col gap-[1px] ${isToday ? 'border-[#6dd400]' : 'border-[rgba(109,212,0,0.07)]'}`}>
                        <div className="text-[8px] text-[#3a5030] text-center leading-none mb-[1px]">{day.d}</div>
                        {catTxs.slice(0, 2).map((t, ti) => {
                          const ec = t.type === 'income' ? 'bg-[rgba(109,212,0,0.15)] text-[#6dd400]'
                            : t.status === 'planned' ? 'bg-[rgba(255,179,64,0.12)] text-[#ffb340]'
                            : 'bg-[rgba(255,87,87,0.1)] text-[#ff5757]'
                          return (
                            <div key={ti} className={`${ec} rounded-[2px] text-center font-['JetBrains_Mono'] text-[7px] font-semibold px-[1px] leading-[1.4]`}>
                              {t.type === 'income' ? '+' : '-'}{fmtCurrencyK(t.amount)}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
