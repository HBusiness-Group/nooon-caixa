import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Account, Transaction, NewTransactionPayload } from '@/types/database'
import { addMonths, format } from 'date-fns'

interface AppState {
  // Auth
  userId: string | null
  setUserId: (id: string | null) => void

  // Accounts
  accounts: Account[]
  currentAccountId: string | null
  loadAccounts: () => Promise<void>
  setCurrentAccount: (id: string) => void
  addAccount: (data: Omit<Account, 'id' | 'user_id' | 'created_at'>) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  get currentAccount(): Account | undefined

  // Transactions
  transactions: Transaction[]
  loadTransactions: () => Promise<void>
  addTransaction: (data: NewTransactionPayload) => Promise<void>
  updateTransactionStatus: (id: string, status: Transaction['status']) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>

  // UI
  activeTab: 'registro' | 'calendario' | 'resumo' | 'contas'
  setActiveTab: (tab: AppState['activeTab']) => void
  calendarMonth: number
  calendarYear: number
  setCalendarMonth: (m: number, y: number) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  userId: null,
  setUserId: (id) => set({ userId: id }),

  accounts: [],
  currentAccountId: null,

  get currentAccount() {
    const { accounts, currentAccountId } = get()
    return accounts.find(a => a.id === currentAccountId)
  },

  loadAccounts: async () => {
    const { data } = await supabase
      .from('account_balances')
      .select('*')
      .eq('is_active', true)
      .order('created_at')
    if (data && data.length > 0) {
      set({ accounts: data as Account[], currentAccountId: data[0].id })
    }
  },

  setCurrentAccount: (id) => set({ currentAccountId: id }),

  addAccount: async (data) => {
    const { userId } = get()
    if (!userId) return
    const { data: created } = await supabase
      .from('accounts')
      .insert({ ...data, user_id: userId })
      .select()
      .single()
    if (created) {
      set(s => ({ accounts: [...s.accounts, { ...created, current_balance: created.initial_balance }] }))
    }
  },

  deleteAccount: async (id) => {
    await supabase.from('accounts').update({ is_active: false }).eq('id', id)
    set(s => ({
      accounts: s.accounts.filter(a => a.id !== id),
      currentAccountId: s.currentAccountId === id
        ? (s.accounts.find(a => a.id !== id)?.id ?? null)
        : s.currentAccountId
    }))
  },

  transactions: [],

  loadTransactions: async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*, account:accounts(id,name,color,type)')
      .order('date', { ascending: false })
      .limit(500)
    if (data) set({ transactions: data as Transaction[] })
  },

  addTransaction: async (payload) => {
    const { userId } = get()
    if (!userId) return
    const { account_id, description, group_ref, category, amount, type, status, date, installments } = payload
    const n = installments && installments > 1 ? installments : 1

    if (n > 1) {
      // Create installment group
      const { data: group } = await supabase
        .from('installment_groups')
        .insert({ user_id: userId, description, total_amount: amount, total_installments: n })
        .select()
        .single()

      if (!group) return

      const rows = Array.from({ length: n }, (_, i) => ({
        user_id: userId,
        account_id,
        installment_group_id: group.id,
        installment_number: i + 1,
        description: `${description} [${i + 1}/${n}]`,
        group_ref: group_ref || '',
        category,
        amount: Math.round((amount / n) * 100) / 100,
        type,
        status: i === 0 ? status : 'planned' as const,
        date: format(addMonths(new Date(date + 'T12:00:00'), i), 'yyyy-MM-dd'),
      }))

      await supabase.from('transactions').insert(rows)
    } else {
      await supabase.from('transactions').insert({
        user_id: userId, account_id, description,
        group_ref: group_ref || '', category, amount, type, status, date,
      })
    }

    await get().loadTransactions()
    await get().loadAccounts()
  },

  updateTransactionStatus: async (id, status) => {
    await supabase.from('transactions').update({ status }).eq('id', id)
    set(s => ({
      transactions: s.transactions.map(t => t.id === id ? { ...t, status } : t)
    }))
    await get().loadAccounts()
  },

  deleteTransaction: async (id) => {
    await supabase.from('transactions').delete().eq('id', id)
    set(s => ({ transactions: s.transactions.filter(t => t.id !== id) }))
    await get().loadAccounts()
  },

  activeTab: 'registro',
  setActiveTab: (tab) => set({ activeTab: tab }),

  calendarMonth: new Date().getMonth(),
  calendarYear: new Date().getFullYear(),
  setCalendarMonth: (m, y) => set({ calendarMonth: m, calendarYear: y }),
}))
