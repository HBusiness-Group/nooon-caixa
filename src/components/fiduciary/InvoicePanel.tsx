'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Invoice } from '@/types/database'
import { fmtCurrency, fmtValue } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface InvoiceModalProps {
  accountId: string
  onClose: () => void
}

type Tab = 'fatura' | 'config' | 'historico'

export default function InvoicePanel({ accountId, onClose }: InvoiceModalProps) {
  const {
    accounts,
    invoices,
    transactions,
    loadTransactions,
    ensureInvoice,
    payInvoiceFull,
    payInvoicePartial,
    installInvoice,
    updateAccountFiduciary,
  } = useAppStore()

  // Busca account do store
  const account = accounts.find(a => a.id === accountId)

  const [tab, setTab] = useState<Tab>('fatura')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // --- Config fields ---
  const [closeDay, setCloseDay] = useState(account?.billing_close_day ?? 1)
  const [dueDay, setDueDay] = useState(account?.billing_due_day ?? 10)
  const [creditLimit, setCreditLimit] = useState(account?.credit_limit ?? 0)
  const [configSaving, setConfigSaving] = useState(false)

  // --- Payment modal ---
  const [showPayModal, setShowPayModal] = useState(false)
  const [payType, setPayType] = useState<'total' | 'parcial' | 'parcelar'>('total')
  const [payAmount, setPayAmount] = useState('')
  const [payInstallments, setPayInstallments] = useState('2')
  const [paySourceAccountId, setPaySourceAccountId] = useState('')
  const [payInterest, setPayInterest] = useState('')

  // Contas correntes disponíveis para debitar
  const debitableAccounts = accounts.filter(
    (a) =>
      a.is_active &&
      a.id !== accountId &&
      ['checking', 'savings', 'overdraft', 'wallet'].includes(a.type)
  )

  // Fatura atual
  const invoice: Invoice | undefined = invoices.find((i) => i.account_id === accountId)

  useEffect(() => {
    if (!accountId) return
    const init = async () => {
      setLoading(true)
      await loadTransactions()
      await ensureInvoice(accountId)
      setLoading(false)
    }
    init()
  }, [accountId])

  // Sincroniza campos de config quando account carrega
  useEffect(() => {
    if (account) {
      setCloseDay(account.billing_close_day ?? 1)
      setDueDay(account.billing_due_day ?? 10)
      setCreditLimit(account.credit_limit ?? 0)
    }
  }, [account?.id])

  if (!account) {
    return (
      <>
        <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#1c2a1f] rounded-t-2xl p-6 border-t border-[rgba(109,212,0,0.2)]">
          <p className="text-center text-[#6a9060]">Conta não encontrada.</p>
        </div>
      </>
    )
  }

  // Transações do ciclo atual
  const cycleTransactions = transactions.filter(
    (t) =>
      t.account_id === accountId &&
      invoice &&
      t.date >= invoice.cycle_start &&
      t.date <= invoice.cycle_end
  )

  const totalFatura = invoice?.total_amount ?? 0
  const pago = invoice?.paid_amount ?? 0
  const restante = totalFatura - pago

  const currentBalance = account.current_balance ?? 0
  const creditLimit_ = account.credit_limit ?? 0
  const usedPercent = creditLimit_ > 0 ? ((creditLimit_ - currentBalance) / creditLimit_) * 100 : 0

  // --- Handlers ---
  const handleOpenPay = () => {
    setPayAmount(String(restante.toFixed(2)))
    setPaySourceAccountId(debitableAccounts[0]?.id ?? '')
    setPayInterest('')
    setPayType('total')
    setPayInstallments('2')
    setShowPayModal(true)
    setError('')
  }

  const handlePay = async () => {
    if (!invoice) return
    if (!paySourceAccountId) {
      setError('Selecione a conta corrente que irá debitar.')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (payType === 'total') {
        await payInvoiceFull(invoice.id, accountId, paySourceAccountId)
      } else if (payType === 'parcial') {
        const valor = parseFloat(payAmount.replace(',', '.'))
        if (!valor || valor <= 0 || valor > restante) {
          setError('Valor inválido para pagamento parcial.')
          setLoading(false)
          return
        }
        const juros = parseFloat((payInterest || '0').replace(',', '.'))
        await payInvoicePartial(invoice.id, accountId, paySourceAccountId, valor, juros)
      } else {
        const n = parseInt(payInstallments)
        if (!n || n < 2) {
          setError('Número de parcelas inválido.')
          setLoading(false)
          return
        }
        await installInvoice(invoice.id, accountId, paySourceAccountId, n)
      }

      await loadTransactions()
      await ensureInvoice(accountId)
      setShowPayModal(false)
    } catch (e: any) {
      setError(e.message ?? 'Erro ao processar pagamento.')
    }

    setLoading(false)
  }

  const handleSaveConfig = async () => {
    setConfigSaving(true)
    await updateAccountFiduciary(accountId, {
      billing_close_day: closeDay,
      billing_due_day: dueDay,
      credit_limit: creditLimit,
    })
    await loadTransactions()
    await ensureInvoice(accountId)
    setConfigSaving(false)
  }

  const statusColor: Record<string, string> = {
    EM_ABERTO: 'text-amber-400',
    PARCIAL: 'text-blue-400',
    PARCELADO: 'text-purple-400',
    PAGO: 'text-green-400',
  }

  const statusLabel: Record<string, string> = {
    EM_ABERTO: 'EM ABERTO',
    PARCIAL: 'PARCIAL',
    PARCELADO: 'PARCELADO',
    PAGO: 'PAGO',
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />

      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#1c2a1f] rounded-t-2xl max-h-[92vh] overflow-y-auto border-t border-[rgba(109,212,0,0.2)]">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#3a5a3e]" />
        </div>

        <div className="px-5 pb-3 flex items-center justify-between">
          <div>
            <p className="font-['Barlow_Condensed'] font-black uppercase tracking-wider text-[#e8f5e2] text-lg">
              {account.name}
            </p>
            <p className="text-xs text-[#6a9060]">
              {account.type === 'prepaid_card' ? 'CC PRÉ-PAGO' : account.type === 'credit_card' ? 'CC NORMAL' : 'CHEQUE ESPECIAL'} · FATURA
            </p>
          </div>
          <button onClick={onClose} className="text-[#6a9060] text-xl font-bold px-2">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[rgba(109,212,0,0.15)] px-5 gap-6">
          {(['fatura', 'config', 'historico'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`font-['Barlow_Condensed'] font-black uppercase tracking-wider text-sm pb-2 border-b-2 transition-colors ${
                tab === t
                  ? 'border-[#6dd400] text-[#6dd400]'
                  : 'border-transparent text-[#6a9060]'
              }`}
            >
              {t === 'historico' ? 'Histórico' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="px-5 pt-4 pb-8">
          {/* TAB FATURA */}
          {tab === 'fatura' && (
            <div className="space-y-4">
              {loading && (
                <p className="text-center text-[#6a9060] text-sm py-4">Carregando fatura...</p>
              )}

              {!loading && invoice && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[#a8c8a0] text-xs">Status</span>
                    <span className={`font-['Barlow_Condensed'] font-black text-sm ${statusColor[invoice.status] ?? 'text-[#e8f5e2]'}`}>
                      {statusLabel[invoice.status] ?? invoice.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Total', value: totalFatura, color: 'text-[#ff6b6b]' },
                      { label: 'Pago', value: pago, color: 'text-[#6dd400]' },
                      { label: 'Restante', value: restante, color: 'text-amber-400' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-[#223026] rounded-xl p-3 text-center">
                        <p className="text-[#6a9060] text-xs mb-1">{label}</p>
                        <p className={`font-['JetBrains_Mono'] font-semibold text-sm ${color}`}>
                          {fmtValue(value)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Barra de limite */}
                  {creditLimit_ > 0 && (
                    <div className="bg-[#223026] rounded-xl p-3 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#a8c8a0]">Limite disponível</span>
                        <span className={`font-['JetBrains_Mono'] font-semibold ${currentBalance < 0 ? 'text-[#ff6b6b]' : 'text-[#6dd400]'}`}>
                          {fmtCurrency(currentBalance)}
                        </span>
                      </div>
                      <div className="h-2 bg-[#2a3a2e] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            usedPercent > 80 ? 'bg-[#ff6b6b]' : usedPercent > 50 ? 'bg-amber-400' : 'bg-[#6dd400]'
                          }`}
                          style={{ width: `${Math.min(Math.max(usedPercent, 0), 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-[#6a9060]">
                        <span>Limite total: {fmtCurrency(creditLimit_)}</span>
                        <span>{usedPercent.toFixed(0)}% utilizado</span>
                      </div>
                    </div>
                  )}

                  {/* Datas */}
                  <div className="bg-[#223026] rounded-xl p-3 space-y-2">
                    {invoice.close_date && (
                      <div className="flex justify-between text-xs">
                        <span className="text-[#a8c8a0]">Fechamento</span>
                        <span className="text-[#e8f5e2] font-['JetBrains_Mono']">
                          {format(new Date(invoice.close_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      </div>
                    )}
                    {invoice.due_date && (
                      <div className="flex justify-between text-xs">
                        <span className="text-[#a8c8a0]">Vencimento</span>
                        <span className="text-[#e8f5e2] font-['JetBrains_Mono']">
                          {format(new Date(invoice.due_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-[#a8c8a0]">Referência</span>
                      <span className="text-[#e8f5e2] font-['JetBrains_Mono']">{invoice.reference_month}</span>
                    </div>
                  </div>

                  {/* Transações do ciclo */}
                  {cycleTransactions.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[#6a9060] text-xs font-['Barlow_Condensed'] uppercase tracking-wider">
                        Lançamentos do ciclo
                      </p>
                      {cycleTransactions.map((t) => (
                        <div key={t.id} className="flex justify-between items-center py-1.5 border-b border-[rgba(109,212,0,0.08)]">
                          <span className="text-[#a8c8a0] text-xs truncate max-w-[60%]">{t.description}</span>
                          <span className={`font-['JetBrains_Mono'] text-xs ${t.type === 'income' ? 'text-[#6dd400]' : 'text-[#ff6b6b]'}`}>
                            {t.type === 'income' ? '+' : '-'}{fmtValue(t.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {invoice.status !== 'PAGO' && (
                    <button
                      onClick={handleOpenPay}
                      className="w-full bg-[#1a5c2a] border border-[rgba(109,212,0,0.3)] rounded-xl py-3 font-['Barlow_Condensed'] font-black uppercase tracking-wider text-[#6dd400] text-sm mt-2"
                    >
                      Pagar Fatura
                    </button>
                  )}
                </>
              )}

              {!loading && !invoice && (
                <p className="text-center text-[#6a9060] text-sm py-4">Nenhuma fatura encontrada para este ciclo.</p>
              )}
            </div>
          )}

          {/* TAB CONFIG */}
          {tab === 'config' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-[#a8c8a0] mb-1">Dia de fechamento</label>
                  <input
                    type="number" min={1} max={31} value={closeDay}
                    onChange={(e) => setCloseDay(Number(e.target.value))}
                    className="w-full bg-[#223026] border border-[rgba(109,212,0,0.2)] rounded-xl px-4 py-2.5 text-[#e8f5e2] font-['JetBrains_Mono'] text-sm outline-none focus:border-[#6dd400]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#a8c8a0] mb-1">Dia de vencimento</label>
                  <input
                    type="number" min={1} max={31} value={dueDay}
                    onChange={(e) => setDueDay(Number(e.target.value))}
                    className="w-full bg-[#223026] border border-[rgba(109,212,0,0.2)] rounded-xl px-4 py-2.5 text-[#e8f5e2] font-['JetBrains_Mono'] text-sm outline-none focus:border-[#6dd400]"
                  />
                </div>
                {account.type === 'credit_card' && (
                  <div>
                    <label className="block text-xs text-[#a8c8a0] mb-1">Limite de crédito (R$)</label>
                    <input
                      type="number" min={0} value={creditLimit}
                      onChange={(e) => setCreditLimit(Number(e.target.value))}
                      className="w-full bg-[#223026] border border-[rgba(109,212,0,0.2)] rounded-xl px-4 py-2.5 text-[#e8f5e2] font-['JetBrains_Mono'] text-sm outline-none focus:border-[#6dd400]"
                    />
                  </div>
                )}
              </div>
              <button
                onClick={handleSaveConfig}
                disabled={configSaving}
                className="w-full bg-[#1a5c2a] border border-[rgba(109,212,0,0.3)] rounded-xl py-3 font-['Barlow_Condensed'] font-black uppercase tracking-wider text-[#6dd400] text-sm disabled:opacity-50"
              >
                {configSaving ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>
          )}

          {/* TAB HISTÓRICO */}
          {tab === 'historico' && (
            <AuditLog accountId={accountId} />
          )}
        </div>
      </div>

      {/* MODAL DE PAGAMENTO */}
      {showPayModal && (
        <>
          <div className="fixed inset-0 bg-black/80 z-[60]" onClick={() => setShowPayModal(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[70] bg-[#1c2a1f] rounded-t-2xl border-t border-[rgba(109,212,0,0.2)] px-5 pt-4 pb-8 space-y-4">
            <div className="flex justify-center mb-1">
              <div className="w-10 h-1 rounded-full bg-[#3a5a3e]" />
            </div>

            <p className="font-['Barlow_Condensed'] font-black uppercase tracking-wider text-[#e8f5e2] text-base">
              Pagar Fatura · {account.name}
            </p>

            {/* Seleção de conta debitada */}
            <div>
              <label className="block text-xs text-[#a8c8a0] mb-1">
                Débito de qual conta? <span className="text-[#ff6b6b]">*</span>
              </label>
              {debitableAccounts.length === 0 ? (
                <p className="text-xs text-[#ff6b6b]">
                  Nenhuma conta corrente disponível.
                </p>
              ) : (
                <select
                  value={paySourceAccountId}
                  onChange={(e) => setPaySourceAccountId(e.target.value)}
                  className="w-full bg-[#223026] border border-[rgba(109,212,0,0.2)] rounded-xl px-4 py-2.5 text-[#e8f5e2] text-sm outline-none focus:border-[#6dd400]"
                >
                  <option value="">Selecione a conta...</option>
                  {debitableAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {fmtCurrency(a.current_balance ?? 0)}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-[#6a9060] mt-1">
                O valor será debitado desta conta e o limite do CC será restaurado.
              </p>
            </div>

            {/* Tipo de pagamento */}
            <div>
              <label className="block text-xs text-[#a8c8a0] mb-1">Tipo de pagamento</label>
              <div className="flex gap-2">
                {[
                  { id: 'total', label: 'Total' },
                  { id: 'parcial', label: 'Parcial' },
                  { id: 'parcelar', label: 'Parcelar' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setPayType(id as any)}
                    className={`flex-1 py-2 rounded-xl text-xs font-['Barlow_Condensed'] font-black uppercase tracking-wider border transition-colors ${
                      payType === id
                        ? 'bg-[#1a5c2a] border-[#6dd400] text-[#6dd400]'
                        : 'bg-[#223026] border-[rgba(109,212,0,0.2)] text-[#6a9060]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {payType === 'total' && (
              <div className="bg-[#223026] rounded-xl p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#a8c8a0]">Valor total a pagar</span>
                  <span className="font-['JetBrains_Mono'] text-[#6dd400] font-semibold">
                    {fmtCurrency(restante)}
                  </span>
                </div>
              </div>
            )}

            {payType === 'parcial' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-[#a8c8a0] mb-1">
                    Valor a pagar (máx. {fmtCurrency(restante)})
                  </label>
                  <input
                    type="number" value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-[#223026] border border-[rgba(109,212,0,0.2)] rounded-xl px-4 py-2.5 text-[#e8f5e2] font-['JetBrains_Mono'] text-sm outline-none focus:border-[#6dd400]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#a8c8a0] mb-1">Juros e multas (R$)</label>
                  <input
                    type="number" value={payInterest}
                    onChange={(e) => setPayInterest(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-[#223026] border border-[rgba(109,212,0,0.2)] rounded-xl px-4 py-2.5 text-[#e8f5e2] font-['JetBrains_Mono'] text-sm outline-none focus:border-[#6dd400]"
                  />
                </div>
              </div>
            )}

            {payType === 'parcelar' && (
              <div>
                <label className="block text-xs text-[#a8c8a0] mb-1">Número de parcelas</label>
                <input
                  type="number" min={2} max={48} value={payInstallments}
                  onChange={(e) => setPayInstallments(e.target.value)}
                  className="w-full bg-[#223026] border border-[rgba(109,212,0,0.2)] rounded-xl px-4 py-2.5 text-[#e8f5e2] font-['JetBrains_Mono'] text-sm outline-none focus:border-[#6dd400]"
                />
              </div>
            )}

            {error && (
              <p className="text-[#ff6b6b] text-xs bg-[rgba(255,107,107,0.1)] rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowPayModal(false)}
                className="flex-1 py-3 rounded-xl border border-[rgba(109,212,0,0.2)] text-[#6a9060] font-['Barlow_Condensed'] font-black uppercase tracking-wider text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handlePay}
                disabled={loading || !paySourceAccountId}
                className="flex-1 py-3 rounded-xl bg-[#1a5c2a] border border-[rgba(109,212,0,0.3)] text-[#6dd400] font-['Barlow_Condensed'] font-black uppercase tracking-wider text-sm disabled:opacity-40"
              >
                {loading ? 'Processando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// Labels legíveis para cada ação
const ACTION_LABEL: Record<string, string> = {
  STATUS_CHANGED:      'Pagamento total',
  PAYMENT_REGISTERED:  'Pagamento parcial',
  INSTALLMENT_CREATED: 'Fatura parcelada',
  INTEREST_ADDED:      'Juros adicionados',
}

const ACTION_COLOR: Record<string, string> = {
  STATUS_CHANGED:      '#6dd400',
  PAYMENT_REGISTERED:  '#ffb340',
  INSTALLMENT_CREATED: '#5bc8ff',
  INTEREST_ADDED:      '#ff6b6b',
}

function formatLogDetails(action: string, newValue: any): string {
  if (!newValue) return ''
  try {
    const v = typeof newValue === 'string' ? JSON.parse(newValue) : newValue
    if (action === 'STATUS_CHANGED') {
      const valor = v.paid_amount ?? v.valor
      return valor ? `Valor pago: R$ ${Number(valor).toFixed(2).replace('.', ',')}` : ''
    }
    if (action === 'PAYMENT_REGISTERED') {
      const parts = []
      if (v.paid_amount) parts.push(`Pago: R$ ${Number(v.paid_amount).toFixed(2).replace('.', ',')}`)
      if (v.remaining)   parts.push(`Restante: R$ ${Number(v.remaining).toFixed(2).replace('.', ',')}`)
      return parts.join(' · ')
    }
    if (action === 'INSTALLMENT_CREATED') {
      const parts = []
      if (v.installments) parts.push(`${v.installments}x`)
      if (v.total_amount) parts.push(`R$ ${Number(v.total_amount).toFixed(2).replace('.', ',')}`)
      return parts.join(' de ')
    }
    if (action === 'INTEREST_ADDED') {
      return v.interest_amount ? `R$ ${Number(v.interest_amount).toFixed(2).replace('.', ',')}` : ''
    }
  } catch { }
  return ''
}

// Sub-componente: Log de auditoria
function AuditLog({ accountId }: { accountId: string }) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { invoices, userId, supabase } = useAppStore() as any

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        // Busca via user_id para satisfazer RLS
        const { data: invData } = await supabase
          .from('invoices')
          .select('id, reference_month')
          .eq('account_id', accountId)
          .eq('user_id', userId)

        const ids = (invData ?? []).map((i: any) => i.id)
        if (ids.length === 0) {
          setLogs([])
          setLoading(false)
          return
        }

        const { data } = await supabase
          .from('invoice_audit_log')
          .select('*, invoices(reference_month)')
          .in('invoice_id', ids)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50)
        setLogs(data ?? [])
      } catch (e) {
        setLogs([])
      }
      setLoading(false)
    }
    fetchLogs()
  }, [accountId, userId])

  if (loading) return <p className="text-center text-[#6a9060] text-sm py-4">Carregando...</p>
  if (logs.length === 0) return <p className="text-center text-[#6a9060] text-sm py-4">Nenhum registro de auditoria.</p>

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const label    = ACTION_LABEL[log.action] ?? log.action
        const color    = ACTION_COLOR[log.action] ?? '#a8c8a0'
        const detail   = formatLogDetails(log.action, log.new_value)
        const refMonth = log.invoices?.reference_month ?? ''
        return (
          <div key={log.id} className="bg-[#223026] rounded-xl p-3 space-y-1">
            <div className="flex justify-between items-center">
              <span
                className="font-['Barlow_Condensed'] font-black uppercase tracking-wider text-xs px-2 py-0.5 rounded-full"
                style={{ color, background: color + '18' }}
              >
                {label}
              </span>
              <span className="text-[#6a9060] text-xs font-['JetBrains_Mono']">
                {format(new Date(log.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              {detail ? (
                <span className="text-[#e8f5e2] text-xs font-['JetBrains_Mono']">{detail}</span>
              ) : <span />}
              {refMonth && (
                <span className="text-[#6a9060] text-[10px]">fatura {refMonth}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
