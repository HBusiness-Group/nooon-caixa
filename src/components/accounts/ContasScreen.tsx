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
  const { accounts, addAccount, deleteAccount, loadAccounts } = useAppStore()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSaldo, setEditSaldo] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('checking')
  const [saldo, setSaldo] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setLoading(true)
    await addAccount({ name: name.trim(), type, initial_balance: parseFloat(saldo) || 0, color, is_active: true })
    setName(''); setSaldo(''); setType('checking'); setColor(COLORS[0])
    setShowForm(false)
    setLoading(false)
  }

  async function handleEditSaldo(id: string) {
    const val = parseFloat(editSaldo)
    if (isNaN(val)) return
    setLoading(true)
    await supabase.from('accounts').update({ initial_balance: val } as any).eq('id', id)
    await loadAccounts()
    setEditingId(null)
    setEditSaldo('')
    setLoading(false)
  }

  return (
    <div className="p-4 pb-20">
      <div className="font-['Barlow_Condensed'] text-[11px] font-bold text-[#3a5030] uppercase tracking-widest mb-4">
        Minhas contas
      </div>

      {accounts.map(acc => {
        const bal = acc.current_balance ?? acc.initial_balance
        const isEditing = editingId === acc.id
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
            </div>

            {isEditing ? (
              <div className="mb-3">
                <div className="text-[9px] font-bold text-[#3a5030] uppercase tracking-widest mb-1.5">
                  Novo saldo inicial (R$)
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={editSaldo}
                    onChange={e => setEditSaldo(e.target.value)}
                    placeholder={String(acc.initial_balance)}
                    className="flex-1 bg-[#1e2a18] border border-[rgba(109,212,0,0.2)] rounded-lg px-3 py-2 text-[#e8f0e4] text-sm outline-none focus:border-[#6dd400]"
                  />
                  <button onClick={() => handleEditSaldo(acc.id)} disabled={loading}
                    className="px-4 py-2 bg-[#6dd400] text-[#0d1410] rounded-lg text-sm font-bold disabled:opacity-50">
                    {loading ? '...' : 'Salvar'}
                  </button>
                  <button onClick={() => setEditingId(null)}
                    className="px-3 py-2 border border-[rgba(255,255,255,0.08)] rounded-lg text-[#4a6644] text-sm">
                    ✕
                  </button>
                </div>
                <div className="text-[10px] text-[#4a6644] mt-1.5">
                  O saldo atual é calculado sobre este valor + transações realizadas.
                </div>
              </div>
            ) : null}

            <div className="flex gap-2">
              <button onClick={() => { setEditingId(acc.id); setEditSaldo(String(acc.initial_balance)) }}
                className="text-xs text-[#40b4ff] border border-[rgba(64,180,255,0.15)] rounded-lg px-3 py-1.5 hover:bg-[rgba(64,180,255,0.07)] transition-colors">
                ✏ Editar saldo
              </button>
              <button onClick={() => deleteAccount(acc.id)}
                className="text-xs text-[#ff5757] border border-[rgba(255,87,87,0.15)] rounded-lg px-3 py-1.5 hover:bg-[rgba(255,87,87,0.07)] transition-colors">
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
