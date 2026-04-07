'use client'
import { useMemo, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { MONTH_NAMES, fmtCurrencyK, fmtCurrency, fmtValueK } from '@/lib/utils'
import type { Transaction } from '@/types/database'

export default function CalendarioScreen() {
  const { transactions, accounts, calendarMonth, calendarYear, setCalendarMonth } = useAppStore()

  // Toggle: simulados refletem nos cálculos (true) ou são zerados (false)
  const [simuladoAtivo, setSimuladoAtivo] = useState(false)

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

  // Transações efetivas para cálculo: simulado desativado = amount 0 / cancelled
  const effectiveTxs = useMemo(() => {
    return transactions.map(t => {
      if (t.status === 'simulated') {
        if (!simuladoAtivo) return { ...t, amount: 0, status: 'cancelled' as const }
        return { ...t, status: 'planned' as const }
      }
      return t
    })
  }, [transactions, simuladoAtivo])

  // Transações para exibição nas células (respeita toggle de visibilidade)
  const txByDay = useMemo(() => {
    const map: Record<string, Transaction[]> = {}
    days.forEach(({ ds }) => { map[ds] = [] })
    transactions
      .filter(t => {
        if (t.status === 'cancelled') return false
        if (t.status === 'simulated' && !simuladoAtivo) return false
        return t.date.startsWith(monthStr)
      })
      .forEach(t => { if (map[t.date]) map[t.date].push(t) })
    return map
  }, [transactions, days, monthStr, simuladoAtivo])

  const saldoByDay = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    const totalAtual = accounts.reduce((s, a) => s + (a.current_balance ?? a.initial_balance ?? 0), 0)

    const allMonthTxs = effectiveTxs
      .filter(t => t.date.startsWith(monthStr) && t.status !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date))

    const accountEntries = accounts
      .filter(a => (a as any).balance_date && (a as any).balance_date.startsWith(monthStr))
      .map(a => ({ date: (a as any).balance_date as string, balance: a.initial_balance }))

    const map: Record<string, number> = {}
    days.forEach(({ ds }) => {
      let delta = 0
      if (ds > todayStr) {
        allMonthTxs
          .filter(t => t.date > todayStr && t.date <= ds)
          .forEach(t => { delta += t.type === 'income' ? t.amount : -t.amount })
      } else if (ds < todayStr) {
        allMonthTxs
          .filter(t => t.date > ds && t.date <= todayStr && t.status === 'completed')
          .forEach(t => { delta += t.type === 'income' ? -t.amount : t.amount })
      }
      accountEntries.forEach(entry => {
        if (ds < entry.date) delta -= entry.balance
      })
      map[ds] = totalAtual + delta
    })
    return map
  }, [days, accounts, effectiveTxs, monthStr])

  const minSaldo = Math.min(...Object.values(saldoByDay))
  const minDay = Object.keys(saldoByDay).find(d => saldoByDay[d] === minSaldo)

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

  function fmtDay(d: number, month: number) {
    return `${String(d).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}`
  }

  const ROWS = [
    { key: 'saldo',   label: 'SALDO' },
    { key: 'overdue', label: 'ATRASADOS' },
    { key: 'income',  label: 'ENTRADA' },
    { key: 'expense', label: 'SAÍDA' },
  ] as const

  return (
    <div className="pb-6">

      {/* ── Header ── */}
      <div className="px-4 py-3 flex flex-col gap-2">

        {/* Linha 1: navegação de mês + botão Simulado */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navMonth(-1)}
              className="w-7 h-7 bg-[#172010] border border-[rgba(109,212,0,0.1)] rounded-lg text-[#8aab80] flex items-center justify-center text-sm hover:bg-[#1e2a18] transition-colors">‹</button>
            <div>
              <span className="font-['Barlow_Condensed'] text-lg font-black text-[#e8f0e4]">{MONTH_NAMES[calendarMonth]}</span>
              <span className="text-[#3a5030] text-sm ml-1.5">{calendarYear}</span>
            </div>
            <button onClick={() => navMonth(1)}
              className="w-7 h-7 bg-[#172010] border border-[rgba(109,212,0,0.1)] rounded-lg text-[#8aab80] flex items-center justify-center text-sm hover:bg-[#1e2a18] transition-colors">›</button>
          </div>

          {/* Botão toggle Simulado */}
          <button
            onClick={() => setSimuladoAtivo(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all"
            style={{
              background: simuladoAtivo ? 'rgba(192,132,252,0.12)' : '#172010',
              borderColor: simuladoAtivo ? 'rgba(192,132,252,0.4)' : 'rgba(109,212,0,0.15)',
              color: simuladoAtivo ? '#c084fc' : '#4a6844',
            }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: simuladoAtivo ? '#c084fc' : '#4a6844',
              display: 'inline-block',
            }} />
            Simulado {simuladoAtivo ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Linha 2: mensagem de status do simulado */}
        <p className="text-[9px] leading-tight"
          style={{ color: simuladoAtivo ? '#6dd400' : '#4a6844' }}>
          {simuladoAtivo
            ? 'Os registros SIMULADOS estão refletindo dentro da projeção financeira'
            : 'Os registros SIMULADOS estão nulos e NÃO refletem na projeção financeira'}
        </p>
      </div>

      {/* Alerta saldo negativo */}
      {minSaldo < 0 && minDay && (
        <div className="mx-4 mb-3 bg-[rgba(255,87,87,0.07)] border border-[rgba(255,87,87,0.2)] rounded-xl px-3 py-2.5 flex items-center gap-2">
          <span className="text-base flex-shrink-0">⚠</span>
          <span className="text-xs text-[#ffaaaa]">
            Risco de saldo negativo em <strong className="text-[#ff5757]">dia {minDay.split('-')[2]}</strong>.
            Mínimo projetado: <strong className="text-[#ff5757]">{fmtCurrency(minSaldo)}</strong>
          </span>
        </div>
      )}

      {/* Legenda */}
      <div className="flex gap-3 px-4 pb-2 flex-wrap">
        {[
          { color: '#6dd400', label: 'Realizado' },
          { color: '#ffb340', label: 'Planejado' },
          { color: '#ff5757', label: 'Atrasado' },
          { color: '#c084fc', label: 'Simulado' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5 text-[10px] text-[#4a6644]">
            <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Grade */}
      <div className="px-4 overflow-x-auto">
        <div style={{ minWidth: 560 }}>

          {/* Header dias da semana */}
          <div className="grid gap-[2px] mb-1" style={{ gridTemplateColumns: '72px repeat(7, 1fr)' }}>
            <div />
            {['DOM','SEG','TER','QUA','QUI','SEX','SÁB'].map(d => (
              <div key={d} className="text-[9px] font-bold text-[#3a5030] text-center uppercase tracking-wider py-1">{d}</div>
            ))}
          </div>

          {weeks.map((week, wi) => (
            <div key={wi}>
              <div className="text-[9px] font-bold text-[#3a5030] uppercase tracking-wider py-2">Semana {wi + 1}</div>

              {ROWS.map(row => (
                <div key={row.key} className="grid gap-[2px] mb-[2px]" style={{ gridTemplateColumns: '72px repeat(7, 1fr)' }}>
                  <div className="flex items-center">
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${
                      row.key === 'saldo'   ? 'text-[#3a5030]' :
                      row.key === 'overdue' ? 'text-[#ffc04d]' :
                      row.key === 'income'  ? 'text-[#5bc8ff]' :
                                              'text-[#ff5757]'
                    }`}>{row.label}</span>
                  </div>

                  {week.map((day, i) => {
                    if (!day) return <div key={i} />
                    const isToday = day.ds === today

                    // ── SALDO ──
                    if (row.key === 'saldo') {
                      const s = saldoByDay[day.ds] ?? 0
                      const cls = s > 0
                        ? 'bg-[rgba(109,212,0,0.1)] text-[#6dd400] border-[rgba(109,212,0,0.15)]'
                        : s > -500
                        ? 'bg-[rgba(255,179,64,0.08)] text-[#ffb340] border-[rgba(255,179,64,0.15)]'
                        : 'bg-[rgba(255,87,87,0.08)] text-[#ff5757] border-[rgba(255,87,87,0.2)]'
                      return (
                        <div key={i} className={`${cls} ${isToday ? '!border-[#6dd400] border-[1.5px]' : ''} border rounded-[4px] px-1 py-1 text-center`}>
                          <div style={{ color: '#6dd400', fontSize: 7, fontWeight: 700, lineHeight: 1, marginBottom: 1 }}>
                            {fmtDay(day.d, calendarMonth)}
                          </div>
                          <div className="font-['JetBrains_Mono'] text-[8px] font-semibold">
                            {fmtCurrencyK(s)}
                          </div>
                        </div>
                      )
                    }

                    // ── ATRASADOS ──
                    if (row.key === 'overdue') {
                      const overdueTxs = (txByDay[day.ds] || []).filter(t => t.status === 'overdue')
                      const visibleOv = overdueTxs.slice(0, 2)
                      const restOv = overdueTxs.slice(2)
                      const restOvTotal = restOv.reduce((s, t) => s + t.amount, 0)
                      return (
                        <div key={i} className={`min-h-[28px] bg-[#172010] border rounded-[4px] p-[2px] flex flex-col gap-[1px] ${isToday ? 'border-[#6dd400]' : 'border-[rgba(109,212,0,0.07)]'}`}>
                          {visibleOv.map((t, ti) => (
                            <div key={ti} className="bg-[rgba(255,87,87,0.12)] text-[#ff5757] rounded-[2px] text-center font-['JetBrains_Mono'] text-[7px] font-semibold px-[1px] leading-[1.4]">
                              {fmtValueK(t.amount, t.type)}
                            </div>
                          ))}
                          {restOv.length > 0 && (
                            <div className="bg-[rgba(255,87,87,0.12)] text-[#ff5757] rounded-[2px] text-center font-['JetBrains_Mono'] text-[7px] font-semibold px-[1px] leading-[1.4]">
                              +{fmtValueK(restOvTotal, 'expense')}
                            </div>
                          )}
                        </div>
                      )
                    }

                    // ── ENTRADA ──
                    if (row.key === 'income') {
                      const incomeTxs = (txByDay[day.ds] || []).filter(t => t.type === 'income')
                      const visible = incomeTxs.slice(0, 2)
                      const rest = incomeTxs.slice(2)
                      const restTotal = rest.reduce((s, t) => s + t.amount, 0)
                      return (
                        <div key={i} className={`min-h-[28px] bg-[#172010] border rounded-[4px] p-[2px] flex flex-col gap-[1px] ${isToday ? 'border-[#6dd400]' : 'border-[rgba(109,212,0,0.07)]'}`}>
                          {visible.map((t, ti) => {
                            const color = t.status === 'simulated'
                              ? 'bg-[rgba(192,132,252,0.12)] text-[#c084fc]'
                              : t.status === 'completed'
                              ? 'bg-[rgba(109,212,0,0.15)] text-[#6dd400]'
                              : 'bg-[rgba(255,179,64,0.12)] text-[#ffb340]'
                            return (
                              <div key={ti} className={`${color} rounded-[2px] text-center font-['JetBrains_Mono'] text-[7px] font-semibold px-[1px] leading-[1.4]`}>
                                {fmtValueK(t.amount, 'income')}
                              </div>
                            )
                          })}
                          {rest.length > 0 && (
                            <div className="bg-[rgba(109,212,0,0.08)] text-[#6dd400] rounded-[2px] text-center font-['JetBrains_Mono'] text-[7px] font-semibold px-[1px] leading-[1.4]">
                              +{fmtValueK(restTotal, 'income')}
                            </div>
                          )}
                        </div>
                      )
                    }

                    // ── SAÍDA ──
                    const expenseTxs = (txByDay[day.ds] || []).filter(t => t.type === 'expense' && t.status !== 'overdue')
                    const visibleExp = expenseTxs.slice(0, 2)
                    const restExp = expenseTxs.slice(2)
                    const restExpTotal = restExp.reduce((s, t) => s + t.amount, 0)
                    return (
                      <div key={i} className={`min-h-[28px] bg-[#172010] border rounded-[4px] p-[2px] flex flex-col gap-[1px] ${isToday ? 'border-[#6dd400]' : 'border-[rgba(109,212,0,0.07)]'}`}>
                        {visibleExp.map((t, ti) => {
                          const color = t.status === 'simulated'
                            ? 'bg-[rgba(192,132,252,0.12)] text-[#c084fc]'
                            : t.status === 'completed'
                            ? 'bg-[rgba(109,212,0,0.15)] text-[#6dd400]'
                            : 'bg-[rgba(255,179,64,0.12)] text-[#ffb340]'
                          return (
                            <div key={ti} className={`${color} rounded-[2px] text-center font-['JetBrains_Mono'] text-[7px] font-semibold px-[1px] leading-[1.4]`}>
                              {fmtValueK(t.amount, 'expense')}
                            </div>
                          )
                        })}
                        {restExp.length > 0 && (
                          <div className="bg-[rgba(255,87,87,0.1)] text-[#ff7070] rounded-[2px] text-center font-['JetBrains_Mono'] text-[7px] font-semibold px-[1px] leading-[1.4]">
                            +{fmtValueK(restExpTotal, 'expense')}
                          </div>
                        )}
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
