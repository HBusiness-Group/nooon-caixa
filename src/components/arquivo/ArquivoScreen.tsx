'use client'
import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { fmtCurrency, fmtValue } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/store/useAppStore'

interface MonthSummary {
  month: string   // 'YYYY-MM'
  label: string   // 'Fevereiro 2026'
}

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`
}

function getArchiveCutoff() {
  // Arquiva meses com 2+ meses atrás: se abril/26, corte é fevereiro/26 (inclusive)
  const now = new Date()
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1)
  return `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`
}

export default function ArquivoScreen() {
  const { userId } = useAppStore()
  const [months, setMonths] = useState<MonthSummary[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [txs, setTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMonths, setLoadingMonths] = useState(true)

  const cutoff = getArchiveCutoff()

  useEffect(() => {
    loadArchivedMonths()
  }, [])

  async function loadArchivedMonths() {
    setLoadingMonths(true)
    // Busca meses distintos com date <= último dia do mês de corte
    const cutoffEnd = `${cutoff}-31`
    const res = await supabase
      .from('transactions')
      .select('date')
      .lte('date', cutoffEnd)
      .order('date', { ascending: false })

    const data: any[] = (res as any).data || []

    // Extrai meses únicos
    const seen = new Set<string>()
    const result: MonthSummary[] = []
    for (const row of data) {
      const ym = (row.date as string).substring(0, 7)
      if (!seen.has(ym)) {
        seen.add(ym)
        result.push({ month: ym, label: monthLabel(ym) })
      }
    }
    setMonths(result)
    setLoadingMonths(false)
  }

  async function loadMonth(ym: string) {
    if (selectedMonth === ym) {
      setSelectedMonth(null)
      setTxs([])
      return
    }
    setLoading(true)
    setSelectedMonth(ym)
    const from = `${ym}-01`
    const to   = `${ym}-31`
    const res = await supabase
      .from('transactions')
      .select('*, account:accounts(id,name,color,type)')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false })
    const data: any[] = (res as any).data || []
    setTxs(data as Transaction[])
    setLoading(false)
  }

  // Stats do mês selecionado
  const income  = txs.filter(t => t.type === 'income'  && t.status === 'completed').reduce((s,t) => s + t.amount, 0)
  const expense = txs.filter(t => t.type === 'expense' && t.status === 'completed').reduce((s,t) => s + t.amount, 0)
  const result  = income - expense

  const statusConfig: Record<string, { color: string; bg: string; label: string; bar: string }> = {
    completed: { color: '#6dd400', bg: 'rgba(109,212,0,0.1)',   label: 'OK',       bar: '#6dd400' },
    planned:   { color: '#ffc04d', bg: 'rgba(255,192,77,0.1)',  label: 'Plan',     bar: '#ffc04d' },
    overdue:   { color: '#ff6b6b', bg: 'rgba(255,107,107,0.1)', label: 'Atrasado', bar: '#ff6b6b' },
    simulated: { color: '#c084fc', bg: 'rgba(192,132,252,0.1)', label: 'Sim',      bar: '#c084fc' },
    cancelled: { color: '#555',    bg: 'rgba(100,100,100,0.1)', label: 'Cancel',   bar: '#555'    },
  }

  return (
    <div className="pb-20">

      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="font-['Barlow_Condensed'] font-black uppercase tracking-wider text-lg" style={{ color: '#6dd400' }}>
          Arquivo
        </div>
        <div className="text-xs mt-0.5" style={{ color: '#6a9060' }}>
          Histórico de meses encerrados — somente leitura
        </div>
      </div>

      {/* Lista de meses */}
      <div className="px-4 space-y-2">
        {loadingMonths && (
          <div className="text-center py-12 text-sm" style={{ color: '#4a6844' }}>
            Carregando...
          </div>
        )}

        {!loadingMonths && months.length === 0 && (
          <div className="rounded-xl border p-8 text-center" style={{ background: '#1c2a1f', borderColor: 'rgba(109,212,0,0.1)' }}>
            <div style={{ fontSize: 32 }}>🗂️</div>
            <div className="mt-3 text-sm font-semibold" style={{ color: '#a8c8a0' }}>
              Nenhum mês arquivado ainda
            </div>
            <div className="mt-1 text-xs" style={{ color: '#4a6844' }}>
              Registros com 2+ meses de passado aparecem aqui
            </div>
          </div>
        )}

        {months.map(m => {
          const isOpen = selectedMonth === m.month
          return (
            <div key={m.month}>
              {/* Botão do mês */}
              <button
                onClick={() => loadMonth(m.month)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all"
                style={{
                  background: isOpen ? 'rgba(109,212,0,0.08)' : '#1c2a1f',
                  borderColor: isOpen ? 'rgba(109,212,0,0.3)' : 'rgba(109,212,0,0.12)',
                }}
              >
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 18 }}>🗂️</span>
                  <span
                    className="font-['Barlow_Condensed'] font-bold uppercase tracking-wider"
                    style={{ fontSize: 15, color: isOpen ? '#6dd400' : '#a8c8a0' }}
                  >
                    {m.label}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: '#4a6844' }}>
                  {isOpen ? '▲' : '▼'}
                </span>
              </button>

              {/* Conteúdo do mês expandido */}
              {isOpen && (
                <div className="mt-1 rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(109,212,0,0.12)', background: '#172010' }}>

                  {loading ? (
                    <div className="text-center py-8 text-sm" style={{ color: '#4a6844' }}>
                      Carregando...
                    </div>
                  ) : (
                    <>
                      {/* Mini stats */}
                      <div className="grid grid-cols-3 gap-1.5 p-3">
                        {[
                          { label: 'Entradas', value: income,  color: '#6dd400' },
                          { label: 'Saídas',   value: expense, color: '#ff6b6b' },
                          { label: 'Resultado',value: result,  color: result >= 0 ? '#6dd400' : '#ff6b6b' },
                        ].map(s => (
                          <div key={s.label} className="rounded-lg p-2 border" style={{ background: '#1c2a1f', borderColor: 'rgba(109,212,0,0.1)' }}>
                            <div className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#6a9060' }}>{s.label}</div>
                            <div className="font-['JetBrains_Mono'] text-[12px] font-semibold" style={{ color: s.color }}>
                              {fmtCurrency(Math.abs(s.value))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Badge somente leitura */}
                      <div className="px-3 pb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(109,212,0,0.08)', color: '#4a6844', border: '1px solid rgba(109,212,0,0.15)' }}>
                          🔒 SOMENTE LEITURA
                        </span>
                      </div>

                      {/* Lista de transações */}
                      <div className="px-3 pb-3 space-y-1">
                        {txs.map(tx => {
                          const sc = statusConfig[tx.status] || statusConfig.planned
                          const isIncome = tx.type === 'income'
                          const day = tx.date.split('-')[2]
                          const valColor = tx.status === 'simulated'
                            ? '#c084fc'
                            : isIncome
                            ? '#6dd400'
                            : tx.status === 'completed'
                            ? '#ff6b6b'
                            : '#ffc04d'

                          return (
                            <div
                              key={tx.id}
                              className="flex items-center gap-2.5 rounded-xl p-2.5 relative overflow-hidden border"
                              style={{ background: '#1c2a1f', borderColor: 'rgba(109,212,0,0.08)' }}
                            >
                              <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl" style={{ background: sc.bar }} />
                              <div className="flex-1 min-w-0 ml-1">
                                <div className="text-[13px] font-semibold truncate" style={{ color: '#e8f5e2' }}>{tx.description}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {tx.account && (
                                    <span className="inline-flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: (tx.account as any).color }} />
                                      <span className="text-[10px]" style={{ color: '#4a6844' }}>{(tx.account as any).name}</span>
                                    </span>
                                  )}
                                  <span className="text-[10px]" style={{ color: '#4a6844' }}>· {tx.category}</span>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="font-['JetBrains_Mono'] text-[13px] font-semibold" style={{ color: valColor }}>
                                  {fmtValue(tx.amount, tx.type as 'income' | 'expense')}
                                </div>
                                <div className="flex items-center gap-1 justify-end mt-1">
                                  <span className="text-[10px]" style={{ color: '#4a6844' }}>dia {day}</span>
                                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>
                                    {sc.label}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
