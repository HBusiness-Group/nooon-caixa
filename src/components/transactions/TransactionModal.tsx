'use client'
import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { CAT_LABELS, fmtCurrency } from '@/lib/utils'
import { addMonths, format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import type { Category, TransactionType, TransactionStatus } from '@/types/database'
import type { Transaction } from '@/store/useAppStore'

interface Props {
  onClose: () => void
  editTx?: Transaction | null
}

export default function TransactionModal({ onClose, editTx }: Props) {
  const { accounts, currentAccountId, addTransaction, loadTransactions, loadAccounts } = useAppStore()
  const isEdit = !!editTx

  const [tipo, setTipo] = useState<TransactionType>('expense')
  const [desc, setDesc] = useState('')
  const [valor, setValor] = useState('')
  const [accountId, setAccountId] = useState(currentAccountId || '')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [status, setStatus] = useState<TransactionStatus>('completed')
  const [category, setCategory] = useState<Category>('business')
  const [groupRef, setGroupRef] = useState('')
  const [installments, setInstallments] = useState(1)
  const [customParc, setCustomParc] = useState('')
  const [loading, setLoading] = useState(false)

  // Preenche campos ao editar
  useEffect(() => {
    if (editTx) {
      setTipo(editTx.type as TransactionType)
      setDesc(editTx.description)
      setValor(String(editTx.amount))
      setAccountId(editTx.account_id)
      setDate(editTx.date)
      setPaymentDate(editTx.date)
      setStatus(editTx.status as TransactionStatus)
      setCategory(editTx.category as Category)
      setGroupRef(editTx.group_ref || '')
      setInstallments(1)
    }
  }, [editTx])

  const parcN = installments === 0 ? parseInt(customParc) || 1 : installments
  const parcVal = parseFloat(valor) / parcN
  const lastDate = parcN > 1 ? format(addMonths(new Date(date + 'T12:00:00'), parcN - 1), 'dd/MM/yyyy') : null
  const isOverdue = editTx?.status === 'overdue'

  async function handleSave() {
    if (!desc.trim() || !valor || !date || !accountId) return
    setLoading(true)

    if (isEdit && editTx) {
      // Monta descrição com data de pagamento se era atrasado
      let finalDesc = desc.trim()
      if (isOverdue && status === 'completed') {
        finalDesc = `${finalDesc} · Pago em ${format(new Date(paymentDate + 'T12:00:00'), 'dd/MM/yyyy')}`
      }
      await supabase.from('transactions').update({
        type: tipo,
        description: finalDesc,
        amount: parseFloat(valor),
        account_id: accountId,
        date: date,
        status,
        category,
        group_ref: groupRef,
      } as any).eq('id', editTx.id)
      await loadTransactions()
      await loadAccounts()
    } else {
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
    }
    setLoading(false)
    onClose()
  }

  const inputCls = "w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
  const inputStyle = { background: '#223026', border: '1px solid rgba(109,212,0,0.2)', color: '#e8f5e2' }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75">
      <div className="w-full max-w-2xl rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto border-t border-x" style={{ background: '#1c2a1f', borderColor: 'rgba(109,212,0,0.2)' }}>
        <div className="w-8 h-1 rounded mx-auto mb-5" style={{ background: '#2a3a2e' }} />
        <h2 className="font-['Barlow_Condensed'] text-xl font-black mb-5 tracking-wide" style={{ color: '#e8f5e2' }}>
          {isEdit ? 'Editar lançamento' : 'Novo lançamento'}
        </h2>

        {/* Tipo */}
        {!isEdit && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {(['income', 'expense'] as const).map(t => (
              <button key={t} onClick={() => setTipo(t)}
                className="py-2.5 rounded-lg font-semibold text-sm transition-all border"
                style={{
                  background: tipo === t ? (t === 'income' ? 'rgba(109,212,0,0.1)' : 'rgba(255,107,107,0.1)') : 'transparent',
                  borderColor: tipo === t ? (t === 'income' ? '#6dd400' : '#ff6b6b') : 'rgba(255,255,255,0.1)',
                  color: tipo === t ? (t === 'income' ? '#6dd400' : '#ff6b6b') : '#7ab070',
                }}>
                {t === 'income' ? '▲ Entrada' : '▼ Saída'}
              </button>
            ))}
          </div>
        )}

        {/* Alert atrasado */}
        {isOverdue && (
          <div className="mb-4 p-3 rounded-lg border" style={{ background: 'rgba(255,179,64,0.08)', borderColor: 'rgba(255,179,64,0.25)' }}>
            <div className="text-xs font-semibold mb-2" style={{ color: '#ffc04d' }}>⚠ Lançamento atrasado — informe a data real do pagamento</div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#7ab070' }}>Data do pagamento</label>
              <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                className={inputCls} style={{ ...inputStyle, borderColor: 'rgba(255,179,64,0.3)' }} />
            </div>
          </div>
        )}

        {/* Descrição */}
        <div className="mb-3">
          <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#7ab070' }}>Descrição</label>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: Crédito iPhone 15 PRO"
            className={inputCls} style={inputStyle} />
        </div>

        {/* Valor + Conta */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#7ab070' }}>Valor (R$)</label>
            <input type="number" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00"
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#7ab070' }}>Conta</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)}
              className={inputCls} style={inputStyle}>
              {accounts.map(a => <option key={a.id} value={a.id} style={{ background: '#223026' }}>{a.name}</option>)}
            </select>
          </div>
        </div>

        {/* Data + Status */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#7ab070' }}>Data planejada</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#7ab070' }}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as TransactionStatus)}
              className={inputCls} style={inputStyle}>
              <option value="completed" style={{ background: '#223026' }}>Realizado</option>
              <option value="planned" style={{ background: '#223026' }}>Planejado</option>
              <option value="overdue" style={{ background: '#223026' }}>Atrasado</option>
            </select>
          </div>
        </div>

        {/* Categoria + Grupo */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#7ab070' }}>Categoria</label>
            <select value={category} onChange={e => setCategory(e.target.value as Category)}
              className={inputCls} style={inputStyle}>
              {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v} style={{ background: '#223026' }}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#7ab070' }}>Grupo / Ref.</label>
            <input value={groupRef} onChange={e => setGroupRef(e.target.value)} placeholder="HB MicroCred 01/12"
              className={inputCls} style={inputStyle} />
          </div>
        </div>

        {/* Parcelamento — só no novo lançamento */}
        {!isEdit && (
          <div className="mb-5">
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#7ab070' }}>Parcelamento</label>
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {[1, 2, 3, 6, 12, 24, 36, 48, 60, 0].map(n => (
                <button key={n} onClick={() => setInstallments(n)}
                  className="py-2 rounded-lg font-['JetBrains_Mono'] text-xs font-semibold border transition-all"
                  style={{
                    background: installments === n ? 'rgba(91,200,255,0.1)' : '#223026',
                    borderColor: installments === n ? '#5bc8ff' : 'rgba(255,255,255,0.08)',
                    color: installments === n ? '#5bc8ff' : '#7ab070',
                  }}>
                  {n === 0 ? 'Outro' : n === 1 ? 'À vista' : `${n}×`}
                </button>
              ))}
            </div>
            {installments === 0 && (
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs whitespace-nowrap" style={{ color: '#7ab070' }}>Qtd parcelas:</label>
                <input type="number" min={2} max={360} value={customParc} onChange={e => setCustomParc(e.target.value)}
                  placeholder="Ex: 72" className="w-24 rounded-lg px-2.5 py-1.5 text-sm outline-none"
                  style={inputStyle} />
              </div>
            )}
            {parcN > 1 && parseFloat(valor) > 0 && (
              <div className="rounded-lg px-3 py-2 text-xs border" style={{ background: '#223026', borderColor: 'rgba(91,200,255,0.15)', color: '#a8c8a0' }}>
                <span style={{ color: '#5bc8ff', fontWeight: 700 }}>{parcN}×</span> de{' '}
                <span style={{ color: '#5bc8ff', fontWeight: 700 }}>{fmtCurrency(parcVal)}</span>
                {' '}· 1ª em {format(new Date(date + 'T12:00:00'), 'dd/MM/yyyy')}
                {lastDate && ` · última em ${lastDate}`}
              </div>
            )}
          </div>
        )}

        <button onClick={handleSave} disabled={loading || !desc || !valor}
          className="w-full py-3.5 rounded-xl font-['Barlow_Condensed'] font-black text-base uppercase tracking-wider transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: '#6dd400', color: '#0f1f12' }}>
          {loading ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Salvar lançamento'}
        </button>
        <button onClick={onClose}
          className="w-full mt-2 py-2.5 rounded-xl text-sm transition-colors border"
          style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#7ab070' }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
