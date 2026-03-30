'use client'
import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { CAT_LABELS, INSTALLMENT_OPTIONS, fmtCurrency } from '@/lib/utils'
import { addMonths, format } from 'date-fns'
import type { Category, TransactionType, TransactionStatus } from '@/types/database'

interface Props {
  onClose: () => void
}

export default function TransactionModal({ onClose }: Props) {
  const { accounts, currentAccountId, addTransaction } = useAppStore()
  const [tipo, setTipo] = useState<TransactionType>('expense')
  const [desc, setDesc] = useState('')
  const [valor, setValor] = useState('')
  const [accountId, setAccountId] = useState(currentAccountId || '')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [status, setStatus] = useState<TransactionStatus>('completed')
  const [category, setCategory] = useState<Category>('business')
  const [groupRef, setGroupRef] = useState('')
  const [installments, setInstallments] = useState(1)
  const [customParc, setCustomParc] = useState('')
  const [loading, setLoading] = useState(false)

  const parcN = installments === 0 ? parseInt(customParc) || 1 : installments
  const parcVal = parseFloat(valor) / parcN

  const lastDate = parcN > 1
    ? format(addMonths(new Date(date + 'T12:00:00'), parcN - 1), 'dd/MM/yyyy')
    : null

  async function handleSave() {
    if (!desc.trim() || !valor || !date || !accountId) return
    setLoading(true)
    await addTransaction({
      account_id: accountId,
      description: desc.trim(),
      group_ref: groupRef,
      category,
      amount: parseFloat(valor),
      type: tipo,
      status,
      date,
      installments: parcN > 1 ? parcN : undefined,
    })
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70">
      <div className="w-full max-w-2xl bg-[#111a14] border border-[rgba(109,212,0,0.15)] rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="w-8 h-1 bg-[#243020] rounded mx-auto mb-5" />
        <h2 className="font-['Barlow_Condensed'] text-xl font-black mb-5 text-[#e8f0e4] tracking-wide">
          Novo lançamento
        </h2>

        {/* Tipo */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {(['income', 'expense'] as const).map(t => (
            <button key={t} onClick={() => setTipo(t)}
              className={`py-2.5 rounded-lg font-semibold text-sm transition-all border ${
                tipo === t
                  ? t === 'income'
                    ? 'bg-[rgba(109,212,0,0.1)] border-[#6dd400] text-[#6dd400]'
                    : 'bg-[rgba(255,87,87,0.1)] border-[#ff5757] text-[#ff5757]'
                  : 'border-[rgba(255,255,255,0.08)] text-[#4a6644]'
              }`}>
              {t === 'income' ? '▲ Entrada' : '▼ Saída'}
            </button>
          ))}
        </div>

        {/* Descrição */}
        <div className="mb-3">
          <label className="block text-[10px] font-bold text-[#4a6644] uppercase tracking-widest mb-1.5">Descrição</label>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: Crédito iPhone 15 PRO"
            className="w-full bg-[#1e2a18] border border-[rgba(109,212,0,0.15)] rounded-lg px-3 py-2.5 text-[#e8f0e4] text-sm outline-none focus:border-[#6dd400] transition-colors placeholder:text-[#3a5030]" />
        </div>

        {/* Valor + Conta */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[10px] font-bold text-[#4a6644] uppercase tracking-widest mb-1.5">Valor (R$)</label>
            <input type="number" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00"
              className="w-full bg-[#1e2a18] border border-[rgba(109,212,0,0.15)] rounded-lg px-3 py-2.5 text-[#e8f0e4] text-sm outline-none focus:border-[#6dd400] transition-colors placeholder:text-[#3a5030]" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#4a6644] uppercase tracking-widest mb-1.5">Conta</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)}
              className="w-full bg-[#1e2a18] border border-[rgba(109,212,0,0.15)] rounded-lg px-3 py-2.5 text-[#e8f0e4] text-sm outline-none focus:border-[#6dd400] transition-colors">
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>

        {/* Data + Status */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[10px] font-bold text-[#4a6644] uppercase tracking-widest mb-1.5">Data</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full bg-[#1e2a18] border border-[rgba(109,212,0,0.15)] rounded-lg px-3 py-2.5 text-[#e8f0e4] text-sm outline-none focus:border-[#6dd400] transition-colors" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#4a6644] uppercase tracking-widest mb-1.5">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as TransactionStatus)}
              className="w-full bg-[#1e2a18] border border-[rgba(109,212,0,0.15)] rounded-lg px-3 py-2.5 text-[#e8f0e4] text-sm outline-none focus:border-[#6dd400] transition-colors">
              <option value="completed">Realizado</option>
              <option value="planned">Planejado</option>
            </select>
          </div>
        </div>

        {/* Categoria + Grupo */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[10px] font-bold text-[#4a6644] uppercase tracking-widest mb-1.5">Categoria</label>
            <select value={category} onChange={e => setCategory(e.target.value as Category)}
              className="w-full bg-[#1e2a18] border border-[rgba(109,212,0,0.15)] rounded-lg px-3 py-2.5 text-[#e8f0e4] text-sm outline-none focus:border-[#6dd400] transition-colors">
              {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#4a6644] uppercase tracking-widest mb-1.5">Grupo / Ref.</label>
            <input value={groupRef} onChange={e => setGroupRef(e.target.value)} placeholder="HB MicroCred 01/12"
              className="w-full bg-[#1e2a18] border border-[rgba(109,212,0,0.15)] rounded-lg px-3 py-2.5 text-[#e8f0e4] text-sm outline-none focus:border-[#6dd400] transition-colors placeholder:text-[#3a5030]" />
          </div>
        </div>

        {/* Parcelamento */}
        <div className="mb-5">
          <label className="block text-[10px] font-bold text-[#4a6644] uppercase tracking-widest mb-2">Parcelamento</label>
          <div className="grid grid-cols-5 gap-1.5 mb-2">
            {[1, 2, 3, 6, 12, 24, 36, 48, 60, 0].map(n => (
              <button key={n} onClick={() => setInstallments(n)}
                className={`py-2 rounded-lg font-['JetBrains_Mono'] text-xs font-semibold border transition-all ${
                  installments === n
                    ? 'bg-[rgba(64,180,255,0.1)] border-[#40b4ff] text-[#40b4ff]'
                    : 'bg-[#1e2a18] border-[rgba(255,255,255,0.08)] text-[#4a6644] hover:text-[#8aab80]'
                }`}>
                {n === 0 ? 'Outro' : n === 1 ? 'À vista' : `${n}×`}
              </button>
            ))}
          </div>
          {installments === 0 && (
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs text-[#4a6644] whitespace-nowrap">Qtd parcelas:</label>
              <input type="number" min={2} max={360} value={customParc} onChange={e => setCustomParc(e.target.value)}
                placeholder="Ex: 72"
                className="w-24 bg-[#1e2a18] border border-[rgba(109,212,0,0.15)] rounded-lg px-2.5 py-1.5 text-[#e8f0e4] text-sm outline-none focus:border-[#6dd400]" />
            </div>
          )}
          {parcN > 1 && parseFloat(valor) > 0 && (
            <div className="bg-[#1e2a18] border border-[rgba(64,180,255,0.15)] rounded-lg px-3 py-2 text-xs text-[#8aab80]">
              <span className="text-[#40b4ff] font-bold">{parcN}×</span> de{' '}
              <span className="text-[#40b4ff] font-bold">{fmtCurrency(parcVal)}</span>
              {' '}· 1ª em {format(new Date(date + 'T12:00:00'), 'dd/MM/yyyy')}
              {lastDate && ` · última em ${lastDate}`}
            </div>
          )}
        </div>

        <button onClick={handleSave} disabled={loading || !desc || !valor}
          className="w-full bg-[#6dd400] text-[#0d1410] py-3.5 rounded-xl font-['Barlow_Condensed'] font-black text-base uppercase tracking-wider disabled:opacity-40 transition-opacity hover:opacity-90">
          {loading ? 'Salvando...' : 'Salvar lançamento'}
        </button>
        <button onClick={onClose}
          className="w-full mt-2 py-2.5 border border-[rgba(255,255,255,0.07)] rounded-xl text-[#4a6644] text-sm hover:border-[rgba(255,255,255,0.15)] transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  )
}
