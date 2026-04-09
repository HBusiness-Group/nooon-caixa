'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Account, Invoice } from '@/types/database'
import { fmtCurrency, fmtValue } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface InvoiceModalProps {
  account: Account
  onClose: () => void
}

type Tab = 'fatura' | 'config' | 'historico'

export default function InvoicePanel({ account, onClose }: InvoiceModalProps) {
  const {
    accounts,
    invoices,
    transactions,
    loadTransactions,
    ensureInvoice,
    payInvoice,
    payInvoicePartial,
    installInvoice,
    updateAccountFiduciary,
  } = useAppStore()

  const [tab, setTab] = useState<Tab>('fatura')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // --- Config fields ---
  const [closeDay, setCloseDay] = useState(account.billing_close_day ?? 1)
  const [dueDay, setDueDay] = useState(account.billing_due_day ?? 10)
  const [creditLimit, setCreditLimit] = useState(account.credit_limit ?? 0)
  const [configSaving, setConfigSaving] = useState(false)

  // --- Payment modal ---
  const [showPayModal, setShowPayModal] = useState(false)
  const [payType, setPayType] = useState<'total' | 'parcial' | 'parcelar'>('total')
  const [payAmount, setPayAmount] = useState('')
  const [payInstallments, setPayInstallments] = useState('2')
  const [paySourceAccountId, setPaySourceAccountId] = useState('')  // ← NOVO: conta debitada
  const [payInterest, setPayInterest] = useState('')

  // Contas correntes disponíveis para debitar (checking, savings, overdraft — excluindo fiduciárias)
  const debitableAccounts = accounts.filter(
    (a) =>
      a.is_active &&
      a.id !== account.id &&
      ['checking', 'savings', 'overdraft', 'wallet'].includes(a.type)
  )

  // Fatura atual
  const invoice: Invoice | undefined = invoices.find((i) => i.account_id === account.id)

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await loadTransactions()
      await ensureInvoice(account.id)
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id])

  // Transações do ciclo atual
  const cycleTransactions = transactions.filter(
    (t) =>
      t.account_id === account.id &&
      invoice &&
      t.reference_date >= invoice.cycle_start &&
      t.reference_date <= invoice.cycle_end
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
        // Debita na conta corrente escolhida + quita fatura do CC
        await payInvoice(invoice.id, account.id, paySourceAccountId)
      } else if (payType === 'parcial') {
        const valor = parseFloat(payAmount.replace(',', '.'))
        if (!valor || valor <= 0 || valor > restante) {
          setError('Valor inválido para pagamento parcial.')
          setLoading(false)
          return
        }
        const juros = parseFloat((payInterest || '0').replace(',', '.'))
        await payInvoicePartial(invoice.id, account.id, paySourceAccountId, valor, juros)
      } else {
        const n = parseInt(payInstallments)
        if (!n || n < 2) {
          setError('Número de parcelas inválido.')
          setLoading(false)
          return
        }
        await installInvoice(invoice.id, account.id, paySourceAccountId, n)
      }

      await loadTransactions()
      await ensureInvoice(account.id)
      setShowPayModal(false)
    } catch (e: any) {
      setError(e.message ?? 'Erro ao processar pagamento.')
    }

    setLoading(false)
  }

  const handleSaveConfig = async () => {
    setConfigSaving(true)
    await updateAccountFiduciary(account.id, {
      billing_close_day: closeDay,
      billing_due_day: dueDay,
      credit_limit: creditLimit,
    })
    await loadTransactions()
    await ensureInvoice(account.id)
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
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#3a5a3e]" />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 flex items-center justify-between">
          <div>
            <p className="font-['Barlow_Condensed'] font-black uppercase tracking-wider text-[#e8f5e2] text-lg">
              {account.name}
            </p>
            <p className="text-xs text-[#6a9060]">
              {account.type === 'prepaid_card' ? 'CC PRÉ-PAGO' : 'CC NORMAL'} · FATURA
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
          {/* ===================== TAB FATURA ===================== */}
          {tab === 'fatura' && (
            <div className="space-y-4">
              {loading && (
                <p className="text-center text-[#6a9060] text-sm py-4">Carregando fatura...</p>
              )}

              {!loading && invoice && (
                <>
                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-[#a8c8a0] text-xs">Status</span>
                    <span className={`font-['Barlow_Condensed'] font-black text-sm ${statusColor[invoice.status] ?? 'text-[#e8f5e2]'}`}>
                      {statusLabel[invoice.status] ?? invoice.status}
                    </span>
                  </div>

                  {/* Cards totais */}
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
                        style={{ width: `${Math.min(usedPercent, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-[#6a9060]">
                      <span>Limite total: {fmtCurrency(creditLimit_)}</span>
                      <span>{usedPercent.toFixed(0)}% utilizado</span>
                    </div>
                  </div>

                  {/* Datas */}
                  <div className="bg-[#223026] rounded-xl p-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#a8c8a0]">Fechamento</span>
                      <span className="text-[#e8f5e2] font-['JetBrains_Mono']">
                        {format(new Date(invoice.cycle_end + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#a8c8a0]">Vencimento</span>
                      <span className="text-[#e8f5e2] font-['JetBrains_Mono']">
                        {format(new Date(invoice.due_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#a8c8a0]">Referência</span>
                      <span className="text-[#e8f5e2] font-['JetBrains_Mono']">{invoice.ref_month}</span>
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

                  {/* Botão Pagar */}
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
            </div>
          )}

          {/* ===================== TAB CONFIG ===================== */}
          {tab === 'config' && (
            <div className="space-y-4">
              <div className="space-y-3">
                {[
                  { label: 'Dia de fechamento', value: closeDay, setter: setCloseDay, min: 1, max: 31 },
                  { label: 'Dia de vencimento', value: dueDay, setter: setDueDay, min: 1, max: 31 },
                ].map(({ label, value, setter, min, max }) => (
                  <div key={label}>
                    <label className="block text-xs text-[#a8c8a0] mb-1">{label}</label>
                    <input
                      type="number"
                      min={min}
                      max={max}
                      value={value}
                      onChange={(e) => setter(Number(e.target.value))}
                      className="w-full bg-[#223026] border border-[rgba(109,212,0,0.2)] rounded-xl px-4 py-2.5 text-[#e8f5e2] font-['JetBrains_Mono'] text-sm outline-none focus:border-[#6dd400]"
                    />
                  </div>
                ))}

                {account.type === 'credit_card' && (
                  <div>
                    <label className="block text-xs text-[#a8c8a0] mb-1">Limite de crédito (R$)</label>
                    <input
                      type="number"
                      min={0}
                      value={creditLimit}
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

          {/* ===================== TAB HISTÓRICO ===================== */}
          {tab === 'historico' && (
            <AuditLog accountId={account.id} />
          )}
        </div>
      </div>

      {/* ===================== MODAL DE PAGAMENTO ===================== */}
      {showPayModal && (
        <>
          <div className="fixed inset-0 bg-black/80 z-60" onClick={() => setShowPayModal(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-70 bg-[#1c2a1f] rounded-t-2xl border-t border-[rgba(109,212,0,0.2)] px-5 pt-4 pb-8 space-y-4">
            <div className="flex justify-center mb-1">
              <div className="w-10 h-1 rounded-full bg-[#3a5a3e]" />
            </div>

            <p className="font-['Barlow_Condensed'] font-black uppercase tracking-wider text-[#e8f5e2] text-base">
              Pagar Fatura · {account.name}
            </p>

            {/* ── SELEÇÃO DE CONTA DEBITADA ── */}
            <div>
              <label className="block text-xs text-[#a8c8a0] mb-1">
                Débito de qual conta? <span className="text-[#ff6b6b]">*</span>
              </label>
              {debitableAccounts.length === 0 ? (
                <p className="text-xs text-[#ff6b6b]">
                  Nenhuma conta corrente disponível. Cadastre uma conta do tipo Corrente, Poupança ou similar.
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

            {/* Campos condicionais */}
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
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-[#223026] border border-[rgba(109,212,0,0.2)] rounded-xl px-4 py-2.5 text-[#e8f5e2] font-['JetBrains_Mono'] text-sm outline-none focus:border-[#6dd400]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#a8c8a0] mb-1">Juros e multas (R$)</label>
                  <input
                    type="number"
                    value={payInterest}
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
                  type="number"
                  min={2}
                  max={48}
                  value={payInstallments}
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

// ── Sub-componente: Log de auditoria ──────────────────────────────
function AuditLog({ accountId }: { accountId: string }) {
  const { supabase } = useAppStore()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('invoice_audit_log')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(50)
      setLogs(data ?? [])
      setLoading(false)
    }
    fetch()
  }, [accountId])

  if (loading) return <p className="text-center text-[#6a9060] text-sm py-4">Carregando...</p>
  if (logs.length === 0) return <p className="text-center text-[#6a9060] text-sm py-4">Nenhum registro de auditoria.</p>

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="bg-[#223026] rounded-xl p-3">
          <div className="flex justify-between items-start">
            <span className="text-[#e8f5e2] text-xs font-['Barlow_Condensed'] uppercase tracking-wider">
              {log.action}
            </span>
            <span className="text-[#6a9060] text-xs font-['JetBrains_Mono']">
              {format(new Date(log.created_at), 'dd/MM HH:mm', { locale: ptBR })}
            </span>
          </div>
          {log.details && (
            <p className="text-[#a8c8a0] text-xs mt-1">{JSON.stringify(log.details)}</p>
          )}
        </div>
      ))}
    </div>
  )
}
