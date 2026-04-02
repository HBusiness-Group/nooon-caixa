'use client'
import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { fmtCurrency, ACCOUNT_TYPE_LABELS } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { AccountType } from '@/types/database'

const COLORS = ['#6dd400','#1a5c2a','#40b4ff','#ffb340','#ff5757','#c084fc','#fb7185','#94a3b8']
const ACCOUNT_ICONS: Record<string, string> = {
  checking: '🏦', savings: '💰', credit_card: '💳', wallet: '👛', investment: '📈', other: '🏧'
}

export default function ContasScreen() {
  const { accounts, addAccount, deleteAccount, loadAccounts, userId, transactions } = useAppStore()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSaldo, setEditSaldo] = useState('')
  const [editDate, setEditDate] = useState('')
  const [showTransfer, setShowTransfer] = useState(false)
  const [tfFrom, setTfFrom] = useState('')
  const [tfTo, setTfTo] = useState('')
  const [tfAmount, setTfAmount] = useState('')
  const [tfAll, setTfAll] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('checking')
  const [saldo, setSaldo] = useState('')
  const [balanceDate, setBalanceDate] = useState(new Date().toISOString().split('T')[0])
  const [color, setColor] = useState(COLORS[0])
  const [loading, setLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const totalSaldo = accounts.reduce((s, a) => s + (a.current_balance ?? a.initial_balance), 0)

  // Verifica se conta tem movimentos (realizados ou planejados)
  function accountHasMovements(accountId: string): boolean {
    return transactions.some(
      t => t.account_id === accountId &&
        (t.status === 'completed' || t.status === 'planned' || t.status === 'overdue')
    )
  }

  async function handleSave() {
    if (!name.trim()) return
    setLoading(true)
    await addAccount({
      name: name.trim(),
      type,
      initial_balance: parseFloat(saldo) || 0,
      color,
      is_active: true,
      balance_date: balanceDate,
    } as any)
    setName(''); setSaldo(''); setType('checking'); setColor(COLORS[0])
    setBalanceDate(new Date().toISOString().split('T')[0])
    setShowForm(false)
    setLoading(false)
  }

  async function handleEditSaldo(id: string) {
    const val = parseFloat(editSaldo)
    if (isNaN(val)) return
    setLoading(true)
    await supabase.from('accounts').update({
      initial_balance: val,
      balance_date: editDate || new Date().toISOString().split('T')[0],
    } as any).eq('id', id)
    await loadAccounts()
    setEditingId(null)
    setEditSaldo('')
    setEditDate('')
    setLoading(false)
  }

  async function handleDelete(id: string) {
    setDeleteError(null)
    if (accountHasMovements(id)) {
      setDeleteError(id)
      return
    }
    await deleteAccount(id)
  }

  async function handleTransfer() {
    if (!tfFrom || !tfTo || tfFrom === tfTo) return
    const fromAcc = accounts.find(a => a.id === tfFrom)
    if (!fromAcc) return
    const bal = fromAcc.current_balance ?? fromAcc.initial_balance
    const amount = tfAll ? bal : parseFloat(tfAmount)
    if (!amount || amount <= 0 || amount > bal) return
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('transactions').insert([
      {
        user_id: userId,
        account_id: tfFrom,
        description: `Transferência para ${accounts.find(a => a.id === tfTo)?.name}`,
        group_ref: 'Transferência',
        category: 'other',
        amount,
        type: 'expense',
        status: 'completed',
        date: today,
      },
      {
        user_id: userId,
        account_id: tfTo,
        description: `Transferência de ${fromAcc.name}`,
        group_ref: 'Transferência',
        category: 'other',
        amount,
        type: 'income',
        status: 'completed',
        date: today,
      }
    ] as any)
    await loadAccounts()
    setShowTransfer(false)
    setTfFrom(''); setTfTo(''); setTfAmount(''); setTfAll(false)
    setLoading(false)
  }

  const fromAcc = accounts.find(a => a.id === tfFrom)
  const fromBal = fromAcc ? (fromAcc.current_balance ?? fromAcc.initial_balance) : 0

  return (
    <div className="p-4 pb-20">

      {/* Total geral */}
      <div className="bg-[#172010] border border-[rgba(109,212,0,0.12)] rounded-2xl p-4 mb-4">
        <div className="text-[9px] font-bold text-[#3a5030] uppercase tracking-widest mb-1">Saldo total — todas as contas</div>
        <div className={`font-['JetBrains_Mono'] text-2xl font-bold ${totalSaldo < 0 ? 'text-[#ff5757]' : 'text-[#6dd400]'}`}>
          {fmtCurrency(totalSaldo)}
        </div>
      </div>

      {/* Botão transferência */}
      <button onClick={() => setShowTransfer(!showTransfer)}
        className="w-full mb-4 py-2.5 border border-[rgba(64,180,255,0.2)] rounded-xl text-[#40b4ff] text-[12px] font-bold bg-[rgba(64,180,255,0.05)] hover:bg-[rgba(64,180,255,0.1)] transition-colors uppercase tracking-wider font-['Barlow_Condensed']">
        ⇄ Transferir entre contas
      </button>

      {/* Formulário de transferência */}
      {showTransfer && (
        <div className="bg-[#172010] border border-[rgba(64,180,255,0.2)] rounded-2xl p-4 mb-4">
          <div className="font-['Barlow_Condensed'] text-base font-black text-[#e8f0e4] mb-4">Transferência</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] font-bold text-[#4a6644] uppercase tracking-widest mb-1.5">De</label>
              <select value={tfFrom} onChange={e => { setTfFrom(e.target.value); setTfAll(false); setTfAmount('') }}
                className="w-full bg-[#1e2a18] border border-[rgba(109,212,0,0.15)] rounded-lg px-3 py-2.5 text-[#e8f0e4] text-sm outline-none focus:border-[#40b4ff]">
                <option value="">Selecione</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({fmtCurrency(a.current_balance ?? a.initial_balance)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#4a6644] uppercase tracking-widest mb-1.5">Para</label>
              <select value={tfTo} onChange={e => setTfTo(e.target.value)}
                className="w-full bg-[#1e2a18] border border-[rgba(109,212,0,0.15)] rounded-lg px-3 py-2.5 text-[#e8f0e4] text-sm outline-none focus:border-[#40b4ff]">
                <option value="">Selecione</option>
                {accounts.filter(a => a.id !== tfFrom).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-[10px] font-bold text-[#4a6644] uppercase tracking-widest mb-1.5">Valor</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={tfAll ? String(fromBal) : tfAmount}
                onChange={e => { setTfAmount(e.target.value); setTfAll(false) }}
                disabled={tfAll}
                placeholder="0,00"
                className="flex-1 bg-[#1e2a18] border border-[rgba(109,212,0,0.15)] rounded-lg px-3 py-2.5 text-[#e8f0e4] text-sm outline-none focus:border-[#40b4ff] disabled:opacity-50"
              />
              <button onClick={() => setTfAll(!tfAll)}
                className={`px-3 py-2 rounded-lg text-[11px] font-bold border transition-colors ${tfAll ? 'bg-[rgba(64,180,255,0.15)] border-[#40b4ff] text-[#40b4ff]' : 'border-[rgba(255,255,255,0.08)] text-[#4a6644]'}`}>
                Tudo
              </button>
            </div>
            {tfFrom && (
              <div className="text-[10px] text-[#4a6644] mt-1.5">
                Disponível: <span className="text-[#6dd400]">{fmtCurrency(fromBal)}</span>
              </div>
            )}
          </div>
          <button onClick={handleTransfer} disabled={loading || !tfFrom || !tfTo || (!tfAmount && !tfAll)}
            className="w-full bg-[#40b4ff] text-[#0d1410] py-3 rounded-xl font-['Barlow_Condensed'] font-black text-sm uppercase tracking-wider disabled:opacity-40 hover:opacity-90 transition-opacity">
            {loading ? 'Transferindo...' : 'Confirmar transferência'}
          </button>
          <button onClick={() => setShowTransfer(false)}
            className="w-full mt-2 py-2 text-[#4a6644] text-sm hover:text-[#8aab80] transition-colors">
            Cancelar
          </button>
        </div>
      )}

      <div className="font-['Barlow_Condensed'] text-[11px] font-bold text-[#3a5030] uppercase tracking-widest mb-3">
        Minhas contas
      </div>

      {accounts.map(acc => {
        const bal = acc.current_balance ?? acc.initial_balance
        const isEditing = editingId === acc.id
        const hasMovements = accountHasMovements(acc.id)
        const showDeleteError = deleteError === acc.id
        return (
          <div key={acc.id} className="bg-[#172010] border border-[rgba(109,212,0,0.08)] rounded-2xl p-4 mb-3 hover:border-[rgba(109,212,0,0.15)] transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: acc.color + '22' }}>
                {ACCOUNT_ICONS[acc.type] || '🏦'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[#e8f0e4] text-sm truncate">{acc.name}</div>
                <div className="text-[10px] text-[#3a5030] uppercase tracking-wider">{ACCOUNT_TYPE_LABELS[acc.type]}</div>
              </div>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: acc.color }} />
            </div>

            <div className="mb-3">
              <div className="text-[9px] font-bold text-[#3a5030] uppercase tracking-widest mb-1">Saldo atual</div>
              <div className={`font-['JetBrains_Mono'] text-xl font-bold ${bal < 0 ? 'text-[#ff5757]' : 'text-[#6dd400]'}`}>
                {fmtCurrency(bal)}
              </div>
              {(acc as any).balance_date && (
                <div className="text-[9px] text-[#3a5030] mt-0.5">
                  Saldo inicial registrado em {new Date((acc as any).balance_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                </div>
              )}
            </div>

            {isEditing && (
              <div className="mb-3">
                <div className="text-[9px] font-bold text-[#3a5030] uppercase tracking-widest mb-1.5">Novo saldo inicial (R$)</div>
                <div className="flex gap-2 mb-2">
                  <input type="number" value={editSaldo} onChange={e => setEditSaldo(e.target.value)}
                    placeholder={String(acc.initial_balance)}
                    className="flex-1 bg-[#1e2a18] border border-[rgba(109,212,0,0.2)] rounded-lg px-3 py-2 text-[#e8f0e4] text-sm outline-none focus:border-[#6dd400]" />
                </div>
                <div className="text-[9px] font-bold text-[#3a5030] uppercase tracking-widest mb-1.5">Data de referência</div>
                <div className="flex gap-2">
                  <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                    className="flex-1 bg-[#1e2a18] border border-[rgba(109,212,0,0.2)] rounded-lg px-3 py-2 text-[#e8f0e4] text-sm outline-none focus:border-[#6dd400]" />
                  <button onClick={() => handleEditSaldo(acc.id)} disabled={loading}
                    className="px-4 py-2 bg-[#6dd400] text-[#0d1410] rounded-lg text-sm font-bold disabled:opacity-50">
                    {loading ? '...' : 'Salvar'}
                  </button>
                  <button onClick={() => setEditingId(null)}
                    className="px-3 py-2 border border-[rgba(255,255,255,0.08)] rounded-lg text-[#4a6644] text-sm">✕</button>
                </div>
                <div className="text-[10px] text-[#4a6644] mt-1.5">Saldo atual = saldo inicial + transações realizadas.</div>
              </div>
            )}

            {showDeleteError && (
              <div className="mb-3 bg-[rgba(255,87,87,0.07)] border border-[rgba(255,87,87,0.2)] rounded-xl px-3 py-2 text-xs text-[#ffaaaa]">
                ⚠ Esta conta possui registros e não pode ser excluída.
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setEditingId(acc.id); setEditSaldo(String(acc.initial_balance)); setEditDate((acc as any).balance_date || '') }}
                className="text-xs text-[#40b4ff] border border-[rgba(64,180,255,0.15)] rounded-lg px-3 py-1.5 hover:bg-[rgba(64,180,255,0.07)] transition-colors">
                ✏ Editar saldo
              </button>
              <button
                onClick={() => handleDelete(acc.id)}
                className={`text-xs border rounded-lg px-3 py-1.5 transition-colors ${hasMovements ? 'text-[#4a6644] border-[rgba(255,255,255,0.06)] cursor-not-allowed opacity-50' : 'text-[#ff5757] border-[rgba(255,87,87,0.15)] hover:bg-[rgba(255,87,87,0.07)]'}`}
                title={hasMovements ? 'Conta com registros não pode ser excluída' : 'Excluir conta'}>
                ✕ Excluir
              </button>
            </div>
          </div>
        )
      })}

      {!showForm ? (
        <button onClick={() => setShowForm(true)}
          className="w-full bg-[rgba(109,212,0,0.05)] border border-dashed border-[rgba(109,212,0,0.2)] text-[#6dd400] rounded-2xl py-4 font-['Barlow_Condensed'] font-bold text-sm uppercase tracking-wider hover:bg-[rgba(109,212,0,0.08)] transition-colors">
          + Nova conta
        </button>
      ) : (
        <div className="bg-[#172010] border border-[rgba(109,212,0,0.15)] rounded-2xl p-4">
          <div className="font-['Barlow_Condensed'] text-base font-black text-[#e8f0e4] mb-4">Nova conta</div>
          <div className="mb-3">
            <label className="block text-[10px] font-bold text-[#4a6644] uppercase tracking-widest mb-1.5">Nome</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: PagBank, ItauCard"
              className="w-full bg-[#1e2a18] border border-[rgba(109,212,0,0.15)] rounded-lg px-3 py-2.5 text-[#e8f0e4] text-sm outline-none focus:border-[#6dd400] transition-colors placeholder:text-[#3a5030]" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] font-bold text-[#4a6644] uppercase tracking-widest mb-1.5">Tipo</label>
              <select value={type} onChange={e => setType(e.target.value as AccountType)}
                className="w-full bg-[#1e2a18] border border-[rgba(109,212,0,0.15)] rounded-lg px-3 py-2.5 text-[#e8f0e4] text-sm outline-none focus:border-[#6dd400] transition-colors">
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#4a6644] uppercase tracking-widest mb-1.5">Saldo inicial (R$)</label>
              <input type="number" value={saldo} onChange={e => setSaldo(e.target.value)} placeholder="0,00"
                className="w-full bg-[#1e2a18] border border-[rgba(109,212,0,0.15)] rounded-lg px-3 py-2.5 text-[#e8f0e4] text-sm outline-none focus:border-[#6dd400] transition-colors placeholder:text-[#3a5030]" />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-[10px] font-bold text-[#4a6644] uppercase tracking-widest mb-1.5">Data de referência do saldo</label>
            <input type="date" value={balanceDate} onChange={e => setBalanceDate(e.target.value)}
              className="w-full bg-[#1e2a18] border border-[rgba(109,212,0,0.15)] rounded-lg px-3 py-2.5 text-[#e8f0e4] text-sm outline-none focus:border-[#6dd400] transition-colors" />
          </div>
          <div className="mb-4">
            <label className="block text-[10px] font-bold text-[#4a6644] uppercase tracking-widest mb-2">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-lg transition-all ${color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-[#172010]' : ''}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <button onClick={handleSave} disabled={loading || !name}
            className="w-full bg-[#6dd400] text-[#0d1410] py-3 rounded-xl font-['Barlow_Condensed'] font-black text-sm uppercase tracking-wider disabled:opacity-40 hover:opacity-90 transition-opacity">
            {loading ? 'Salvando...' : 'Criar conta'}
          </button>
          <button onClick={() => setShowForm(false)}
            className="w-full mt-2 py-2 text-[#4a6644] text-sm hover:text-[#8aab80] transition-colors">
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
