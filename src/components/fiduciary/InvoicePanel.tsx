'use client'
// src/components/fiduciary/InvoicePanel.tsx — NOOON Caixa V4 #003

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAppStore, isCreditCard, isCreditCardNormal, isPrepaidCard, isOverdraft } from '@/store/useAppStore'
import { fmtCurrency } from '@/lib/utils'
import type { Invoice, InvoiceStatus } from '@/types/database'

interface Props {
  accountId: string
  onClose: () => void
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; bg: string }> = {
  EM_ABERTO:  { label: 'Em Aberto',  color: '#ff6b6b', bg: 'rgba(255,107,107,0.12)' },
  PARCIAL:    { label: 'Parcial',    color: '#ffb340', bg: 'rgba(255,179,64,0.12)'  },
  PARCELADO:  { label: 'Parcelado',  color: '#5bc8ff', bg: 'rgba(91,200,255,0.12)'  },
  PAGO:       { label: 'Pago',       color: '#6dd400', bg: 'rgba(109,212,0,0.12)'   },
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {status === 'EM_ABERTO' && '⚠ '}{cfg.label}
    </span>
  )
}

export default function InvoicePanel({ accountId, onClose }: Props) {
  const {
    accounts, invoices, transactions, loadInvoices, loadTransactions,
    ensureInvoice, payInvoiceFull, payInvoicePartial,
    installInvoice, setInvoiceInterest, getInvoiceAuditLog,
    updateAccountFiduciary, loadAccounts,
  } = useAppStore()

  const account = accounts.find(a => a.id === accountId)
  const isCC    = account ? isCreditCard(account.type) : false
  const isCE    = account ? isOverdraft(account.type)  : false

  const today    = new Date()

  // refMonth = mês do vencimento da fatura, não o mês corrente
  function calcRefMonth(): string {
    if (!account) return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    if (isCreditCard(account.type)) {
      const closeDay = account.billing_close_day ?? 10
      const dueDay   = account.billing_due_day   ?? 20
      const currM    = today.getMonth() + 1
      const currY    = today.getFullYear()
      const currentMonth = `${currY}-${String(currM).padStart(2, '0')}`
      // dueDay > closeDay → vence no mesmo mês
      if (dueDay > closeDay) return currentMonth
      // vence no mês seguinte
      const next = new Date(currY, currM, 1)
      return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
    }
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  }

  const refMonth = calcRefMonth()
  const invoice  = invoices.find(i => i.account_id === accountId && i.reference_month === refMonth)

  const [tab, setTab]                       = useState<'fatura' | 'config' | 'historico'>('fatura')
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [action, setAction]                 = useState<'pago' | 'parcial' | 'parcelado' | null>(null)
  const [payValue, setPayValue]             = useState('')
  const [interestVal, setInterestVal]       = useState('')
  const [installN, setInstallN]             = useState(6)
  const [payDate, setPayDate]               = useState(format(today, 'yyyy-MM-dd'))
  const [loading, setLoading]               = useState(false)
  const [auditLog, setAuditLog]             = useState<any[]>([])

  const [closeDay, setCloseDay]               = useState(String(account?.billing_close_day ?? 10))
  const [dueDay, setDueDay]                   = useState(String(account?.billing_due_day   ?? 20))
  const [overdraftDay, setOverdraftDay]       = useState(String(account?.overdraft_due_day ?? 0))
  const [creditLimit, setCreditLimit]         = useState(String(account?.credit_limit      ?? ''))
  const [overdraftLimit, setOverdraftLimit]   = useState(String(account?.overdraft_limit   ?? ''))
  const [savingConfig, setSavingConfig]       = useState(false)

  useEffect(() => {
    async function init() {
      await loadInvoices()
      await loadTransactions()
      setInvoiceLoading(true)
      await ensureInvoice(accountId, refMonth)
      setInvoiceLoading(false)
    }
    init()
  }, [accountId, refMonth])

  useEffect(() => {
    if (tab === 'historico' && invoice) {
      getInvoiceAuditLog(invoice.id).then(setAuditLog)
    }
  }, [tab, invoice])

  async function handlePayFull() {
    if (!invoice || !payDate) return
    if (isCE && !interestVal) return
    setLoading(true)
    if (isCE && interestVal) await setInvoiceInterest(invoice.id, parseFloat(interestVal))
    await payInvoiceFull(invoice.id, payDate)
    setLoading(false)
    setAction(null)
  }

  async function handlePayPartial() {
    if (!invoice || !payValue || !payDate) return
    setLoading(true)
    await payInvoicePartial(invoice.id, parseFloat(payValue), payDate)
    setLoading(false)
    setAction(null)
  }

  async function handleInstall() {
    if (!invoice || !payValue) return
    setLoading(true)
    await installInvoice(invoice.id, parseFloat(payValue), installN, payDate)
    setLoading(false)
    setAction(null)
  }

  async function handleSaveConfig() {
    setSavingConfig(true)
    if (isCC) {
      await updateAccountFiduciary(accountId, {
        billing_close_day: parseInt(closeDay),
        billing_due_day:   parseInt(dueDay),
        credit_limit:      creditLimit ? parseFloat(creditLimit) : null,
      })
    } else {
      await updateAccountFiduciary(accountId, {
        overdraft_due_day: parseInt(overdraftDay),
        overdraft_limit:   overdraftLimit ? parseFloat(overdraftLimit) : null,
      })
    }
    await loadAccounts()
    setSavingConfig(false)
  }

  const totalFatura  = invoice?.total_amount ?? 0
  const pago         = invoice?.paid_amount  ?? 0
  const remaining    = totalFatura - pago
  const isPending    = invoice && invoice.status !== 'PAGO'
  const creditLimit_ = account?.credit_limit ?? 0
  const limitUsedPct = isCC && creditLimit_ > 0
    ? Math.min((totalFatura / creditLimit_) * 100, 100)
    : null

  const inputCls   = 'w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors'
  const inputStyle = { background: '#223026', border: '1px solid rgba(109,212,0,0.2)', color: '#e8f5e2' }
  const labelCls   = 'block text-[10px] font-bold uppercase tracking-widest mb-1.5'

  if (!account) return null

  const accountTypeLabel = isCreditCardNormal(account.type) ? 'Cartão de Crédito'
    : isPrepaidCard(account.type) ? 'Cartão Pré-pago'
    : 'Cheque Especial'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75">
      <div
        className="w-full max-w-2xl rounded-t-2xl p-5 max-h-[92vh] overflow-y-auto border-t border-x"
        style={{ background: '#1c2a1f', borderColor: 'rgba(109,212,0,0.2)' }}
      >
        <div className="w-8 h-1 rounded mx-auto mb-4" style={{ background: '#2a3a2e' }} />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 20 }}>💳</span>
              <h2 className="font-['Barlow_Condensed'] text-xl font-black tracking-wide" style={{ color: '#e8f5e2' }}>
                {account.name}
              </h2>
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: '#7ab070' }}>
              {accountTypeLabel} · {refMonth}
            </div>
          </div>
          {invoice && <StatusBadge status={invoice.status} />}
        </div>

        {/* Alerta pendente */}
        {isPending && invoice && (
          <div className="mb-4 px-3 py-2.5 rounded-lg border flex items-center gap-2"
            style={{ background: 'rgba(255,107,107,0.07)', borderColor: 'rgba(255,107,107,0.3)' }}>
            <span style={{ fontSize: 18 }}>🔴</span>
            <div className="text-[12px] font-semibold" style={{ color: '#ff6b6b' }}>
              Fatura em aberto — vence em{' '}
              <strong>{format(parseISO(invoice.due_date), "dd/MM/yyyy", { locale: ptBR })}</strong>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: '#223026' }}>
          {(['fatura', 'config', 'historico'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
              style={{
                background: tab === t ? '#1c2a1f' : 'transparent',
                color:      tab === t ? '#6dd400' : '#7ab070',
                border:     tab === t ? '1px solid rgba(109,212,0,0.25)' : '1px solid transparent',
              }}
            >
              {t === 'fatura' ? '📋 Fatura' : t === 'config' ? '⚙️ Config' : '📜 Histórico'}
            </button>
          ))}
        </div>

        {/* ── ABA: FATURA ─────────────────────────────────────────────────── */}
        {tab === 'fatura' && (
          invoiceLoading ? (
            <div className="text-center py-10 text-sm" style={{ color: '#7ab070' }}>
              Carregando fatura...
            </div>
          ) : !invoice ? (
            <div className="text-center py-10 text-sm" style={{ color: '#7ab070' }}>
              Nenhuma fatura encontrada para este período.
            </div>
          ) : (
            <div>
              {/* Cards de totais */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: 'Total fatura', value: totalFatura, color: '#ff6b6b' },
                  { label: 'Pago',         value: pago,        color: '#6dd400' },
                  { label: 'Restante',     value: remaining,   color: remaining > 0 ? '#ffb340' : '#6dd400' },
                ].map(c => (
                  <div key={c.label} className="rounded-xl p-3 border" style={{ background: '#223026', borderColor: 'rgba(109,212,0,0.12)' }}>
                    <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#7ab070' }}>{c.label}</div>
                    <div className="font-['JetBrains_Mono'] font-bold text-base" style={{ color: c.color }}>
                      {fmtCurrency(c.value)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Barra de limite (CC) */}
              {isCC && creditLimit_ > 0 && limitUsedPct !== null && (
                <div className="mb-4 rounded-xl p-3 border" style={{ background: '#223026', borderColor: 'rgba(109,212,0,0.12)' }}>
                  <div className="flex justify-between text-[10px] mb-2" style={{ color: '#7ab070' }}>
                    <span>Limite utilizado</span>
                    <span style={{ color: limitUsedPct > 80 ? '#ff6b6b' : '#a8c8a0' }}>
                      {fmtCurrency(totalFatura)} / {fmtCurrency(creditLimit_)} ({limitUsedPct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden mb-2" style={{ background: '#2a3a2e' }}>
                    <div className="h-2 rounded-full transition-all" style={{
                      width: `${limitUsedPct}%`,
                      background: limitUsedPct > 80 ? '#ff6b6b' : limitUsedPct > 50 ? '#ffb340' : '#6dd400',
                    }} />
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span style={{ color: '#7ab070' }}>Limite disponível</span>
                    <span className="font-['JetBrains_Mono'] font-semibold"
                      style={{ color: (account.current_balance ?? 0) <= 0 ? '#ff6b6b' : '#6dd400' }}>
                      {fmtCurrency(Math.max(account.current_balance ?? 0, 0))}
                    </span>
                  </div>
                </div>
              )}

              {/* Datas */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                <div className="rounded-lg px-3 py-2 border" style={{ background: '#223026', borderColor: 'rgba(109,212,0,0.1)' }}>
                  <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: '#7ab070' }}>
                    {isCC ? 'Fechamento' : 'Vencimento CE'}
                  </div>
                  <div className="text-sm font-semibold" style={{ color: '#e8f5e2' }}>
                    {format(parseISO(invoice.close_date), "dd/MM/yyyy")}
                  </div>
                </div>
                <div className="rounded-lg px-3 py-2 border" style={{ background: '#223026', borderColor: 'rgba(109,212,0,0.1)' }}>
                  <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: '#7ab070' }}>Vencimento</div>
                  <div className="text-sm font-semibold" style={{ color: '#e8f5e2' }}>
                    {format(parseISO(invoice.due_date), "dd/MM/yyyy")}
                  </div>
                </div>
              </div>

              {invoice.generates_interest && (
                <div className="mb-4 px-3 py-2.5 rounded-lg border text-xs"
                  style={{ background: 'rgba(217,70,239,0.07)', borderColor: 'rgba(217,70,239,0.25)', color: '#d946ef' }}>
                  ⚠️ Esta fatura gerará <strong>Juros e Multas</strong> na próxima.
                </div>
              )}

              {/* Botões de ação */}
              {invoice.status !== 'PAGO' && !action && (
                <div className="grid grid-cols-1 gap-2">
                  <button onClick={() => setAction('pago')}
                    className="w-full py-3 rounded-xl font-['Barlow_Condensed'] font-black text-sm uppercase tracking-wider border"
                    style={{ background: 'rgba(109,212,0,0.1)', borderColor: '#6dd400', color: '#6dd400' }}>
                    ✓ Pagamento Total
                  </button>
                  {isCC && (
                    <>
                      <button onClick={() => setAction('parcial')}
                        className="w-full py-3 rounded-xl font-['Barlow_Condensed'] font-black text-sm uppercase tracking-wider border"
                        style={{ background: 'rgba(255,179,64,0.08)', borderColor: '#ffb340', color: '#ffb340' }}>
                        ◑ Pagamento Parcial
                      </button>
                      <button onClick={() => setAction('parcelado')}
                        className="w-full py-3 rounded-xl font-['Barlow_Condensed'] font-black text-sm uppercase tracking-wider border"
                        style={{ background: 'rgba(91,200,255,0.08)', borderColor: '#5bc8ff', color: '#5bc8ff' }}>
                        ≡ Parcelar Fatura
                      </button>
                    </>
                  )}
                </div>
              )}

              {invoice.status === 'PAGO' && (
                <div className="text-center py-4 text-sm rounded-xl border"
                  style={{ background: 'rgba(109,212,0,0.05)', borderColor: 'rgba(109,212,0,0.2)', color: '#6dd400' }}>
                  ✓ Fatura quitada
                </div>
              )}

              {/* Form: PAGO TOTAL */}
              {action === 'pago' && (
                <div className="rounded-xl border p-4 mt-2" style={{ background: '#223026', borderColor: 'rgba(109,212,0,0.2)' }}>
                  <div className="text-sm font-bold mb-3" style={{ color: '#6dd400' }}>✓ Confirmar pagamento total</div>
                  <div className="mb-3 px-3 py-2 rounded-lg text-xs border" style={{ background: '#1c2a1f', borderColor: 'rgba(109,212,0,0.1)', color: '#a8c8a0' }}>
                    Será criado um registro <strong style={{ color: '#6dd400' }}>Pagamento de CC</strong> no valor de{' '}
                    <strong style={{ color: '#6dd400' }}>{fmtCurrency(remaining)}</strong> com status Realizado,
                    devolvendo o limite ao disponível.
                  </div>
                  {isCE && (
                    <div className="mb-3">
                      <label className={labelCls} style={{ color: '#d946ef' }}>⚠️ Juros e Multas cobrados (obrigatório)</label>
                      <input type="number" value={interestVal} onChange={e => setInterestVal(e.target.value)}
                        placeholder="Ex: 47,80" className={inputCls}
                        style={{ ...inputStyle, borderColor: interestVal ? 'rgba(109,212,0,0.3)' : 'rgba(217,70,239,0.4)' }} />
                    </div>
                  )}
                  <div className="mb-3">
                    <label className={labelCls} style={{ color: '#7ab070' }}>Data do pagamento</label>
                    <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handlePayFull} disabled={loading || (isCE && !interestVal)}
                      className="flex-1 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider disabled:opacity-40"
                      style={{ background: '#6dd400', color: '#0f1f12' }}>
                      {loading ? 'Salvando...' : 'Confirmar'}
                    </button>
                    <button onClick={() => setAction(null)} className="px-4 py-2.5 rounded-lg text-sm border"
                      style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#7ab070' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Form: PARCIAL */}
              {action === 'parcial' && (
                <div className="rounded-xl border p-4 mt-2" style={{ background: '#223026', borderColor: 'rgba(255,179,64,0.2)' }}>
                  <div className="text-sm font-bold mb-3" style={{ color: '#ffb340' }}>◑ Pagamento parcial</div>
                  <div className="mb-3 px-3 py-2 rounded-lg text-xs border" style={{ background: '#1c2a1f', borderColor: 'rgba(255,179,64,0.15)', color: '#a8c8a0' }}>
                    Será criado um registro <strong style={{ color: '#ffb340' }}>Pagamento de CC</strong> com o valor informado.
                    O saldo restante permanece comprometido para ajuste posterior.
                  </div>
                  <div className="mb-3">
                    <label className={labelCls} style={{ color: '#7ab070' }}>Valor pago (R$)</label>
                    <input type="number" value={payValue} onChange={e => setPayValue(e.target.value)}
                      placeholder="0,00" className={inputCls} style={inputStyle} />
                  </div>
                  <div className="mb-3">
                    <label className={labelCls} style={{ color: '#7ab070' }}>Data do pagamento</label>
                    <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                  {payValue && parseFloat(payValue) > 0 && (
                    <div className="text-xs mb-3 px-3 py-2 rounded-lg border" style={{ background: '#1c2a1f', borderColor: 'rgba(255,179,64,0.15)', color: '#a8c8a0' }}>
                      Restante: <strong style={{ color: '#ff6b6b' }}>{fmtCurrency(remaining - parseFloat(payValue))}</strong>
                      {' '}· Um marcador de juros R$1,00 será criado na próxima fatura.
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={handlePayPartial} disabled={loading || !payValue}
                      className="flex-1 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider disabled:opacity-40"
                      style={{ background: '#ffb340', color: '#1a1a1a' }}>
                      {loading ? 'Salvando...' : 'Confirmar'}
                    </button>
                    <button onClick={() => setAction(null)} className="px-4 py-2.5 rounded-lg text-sm border"
                      style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#7ab070' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Form: PARCELADO */}
              {action === 'parcelado' && (
                <div className="rounded-xl border p-4 mt-2" style={{ background: '#223026', borderColor: 'rgba(91,200,255,0.2)' }}>
                  <div className="text-sm font-bold mb-3" style={{ color: '#5bc8ff' }}>≡ Parcelar fatura</div>
                  <div className="mb-3 px-3 py-2 rounded-lg text-xs border" style={{ background: '#1c2a1f', borderColor: 'rgba(91,200,255,0.15)', color: '#a8c8a0' }}>
                    Será criado um registro <strong style={{ color: '#5bc8ff' }}>Pagamento de CC</strong> parcelado.
                    O saldo comprometido será distribuído nas parcelas.
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className={labelCls} style={{ color: '#7ab070' }}>Valor total (R$)</label>
                      <input type="number" value={payValue} onChange={e => setPayValue(e.target.value)}
                        placeholder="0,00" className={inputCls} style={inputStyle} />
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: '#7ab070' }}>Nº de parcelas</label>
                      <select value={installN} onChange={e => setInstallN(parseInt(e.target.value))} className={inputCls} style={inputStyle}>
                        {[2, 3, 4, 6, 8, 10, 12, 18, 24, 36, 48].map(n => (
                          <option key={n} value={n} style={{ background: '#223026' }}>{n}×</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className={labelCls} style={{ color: '#7ab070' }}>Data 1ª parcela</label>
                    <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                  {payValue && parseFloat(payValue) > 0 && (
                    <div className="text-xs mb-3 px-3 py-2 rounded-lg border" style={{ background: '#1c2a1f', borderColor: 'rgba(91,200,255,0.15)', color: '#a8c8a0' }}>
                      <span style={{ color: '#5bc8ff', fontWeight: 700 }}>{installN}×</span> de{' '}
                      <span style={{ color: '#5bc8ff', fontWeight: 700 }}>{fmtCurrency(parseFloat(payValue) / installN)}</span>
                      {' '}· Classificado como Saldo Financiado
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={handleInstall} disabled={loading || !payValue}
                      className="flex-1 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider disabled:opacity-40"
                      style={{ background: '#5bc8ff', color: '#0a1a2a' }}>
                      {loading ? 'Salvando...' : 'Confirmar'}
                    </button>
                    <button onClick={() => setAction(null)} className="px-4 py-2.5 rounded-lg text-sm border"
                      style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#7ab070' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* ── ABA: CONFIG ─────────────────────────────────────────────────── */}
        {tab === 'config' && (
          <div>
            {isCC && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className={labelCls} style={{ color: '#7ab070' }}>Dia de fechamento (1–28)</label>
                    <input type="number" min={1} max={28} value={closeDay} onChange={e => setCloseDay(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: '#7ab070' }}>Dia de vencimento (1–28)</label>
                    <input type="number" min={1} max={28} value={dueDay} onChange={e => setDueDay(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                </div>
                <div className="mb-4">
                  <label className={labelCls} style={{ color: '#7ab070' }}>Limite do cartão (R$)</label>
                  <input type="number" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} placeholder="Ex: 5000" className={inputCls} style={inputStyle} />
                </div>
                <div className="text-xs mb-4 px-3 py-2 rounded-lg border" style={{ background: '#223026', borderColor: 'rgba(109,212,0,0.1)', color: '#7ab070' }}>
                  ℹ️ Se o dia cair em fim de semana ou feriado, o sistema ajusta automaticamente para o próximo dia útil.
                </div>
              </>
            )}
            {isCE && (
              <>
                <div className="mb-3">
                  <label className={labelCls} style={{ color: '#7ab070' }}>Dia de vencimento (0 = último dia do mês)</label>
                  <input type="number" min={0} max={28} value={overdraftDay} onChange={e => setOverdraftDay(e.target.value)} className={inputCls} style={inputStyle} />
                </div>
                <div className="mb-4">
                  <label className={labelCls} style={{ color: '#7ab070' }}>Limite do cheque especial (R$)</label>
                  <input type="number" value={overdraftLimit} onChange={e => setOverdraftLimit(e.target.value)} placeholder="Ex: 2000" className={inputCls} style={inputStyle} />
                </div>
              </>
            )}
            <button onClick={handleSaveConfig} disabled={savingConfig}
              className="w-full py-3 rounded-xl font-['Barlow_Condensed'] font-black text-sm uppercase tracking-wider disabled:opacity-40"
              style={{ background: '#6dd400', color: '#0f1f12' }}>
              {savingConfig ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </div>
        )}

        {/* ── ABA: HISTÓRICO ──────────────────────────────────────────────── */}
        {tab === 'historico' && (
          <div>
            {auditLog.length === 0 ? (
              <div className="text-center py-10 text-sm" style={{ color: '#7ab070' }}>
                Nenhum registro de auditoria ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {auditLog.map(log => (
                  <div key={log.id} className="rounded-xl px-3 py-2.5 border" style={{ background: '#223026', borderColor: 'rgba(109,212,0,0.1)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#6dd400' }}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px]" style={{ color: '#6a9060' }}>
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}
                      </span>
                    </div>
                    {log.new_value && (
                      <pre className="text-[10px] font-['JetBrains_Mono']" style={{ color: '#a8c8a0' }}>
                        {JSON.stringify(log.new_value, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button onClick={onClose}
          className="w-full mt-5 py-2.5 rounded-xl text-sm border transition-colors"
          style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#7ab070' }}>
          Fechar
        </button>
      </div>
    </div>
  )
}
