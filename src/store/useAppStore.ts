/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { addMonths, format } from 'date-fns'

export interface Account {
  id: string
  user_id: string
  name: string
  type: string
  initial_balance: number
  color: string
  is_active: boolean
  created_at: string
  current_balance: number
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  installment_group_id?: string
  installment_number?: number
  description: string
  group_ref?: string
  category: string
  amount: number
  type: string
  status: string
  date: string
  created_at: string
  updated_at: string
  account?: any
  installment_group?: any
}

export interface NewTransactionPayload {
  account_id: string
  description: string
  group_ref?: string
  category: string
  amount: number
  type: string
  status: string
  date: string
  installments?: number
}

interface AppState {
  userId: string | null
  setUserId: (id: string | null) => void
  accounts: Account[]
  currentAccountId: string | null
  loadAccounts: () => Promise<void>
  setCurrentAccount: (id: string) => void
  addAccount: (data: Omit<Account, 'id' | 'user_id' | 'created_at' | 'current_balance'>) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  transactions: Transaction[]
  loadTransactions: () => Promise<void>
  addTransaction: (data: NewTransactionPayload) => Promise<void>
  updateTransactionStatus: (id: string, status: string) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
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

  loadAccounts: async () => {
    const res = await supabase
      .from('account_balances')
      .select('*')
      .eq('is_active', true)
      .order('created_at')
    const data: any[] = (res as any).data || []
    if (data.length > 0) {
      const accounts: Account[] = data.map((a: any) => ({
        ...a,
        current_balance: Number(a.current_balance)
      }))
      set(s => ({
        accounts,
        currentAccountId: s.currentAccountId ?? accounts[0].id
      }))
    }
  },

  setCurrentAccount: (id) => set({ currentAccountId: id }),

  addAccount: async (data) => {
    const { userId } = get()
    if (!userId) return
    const res = await supabase.from('accounts').insert({ ...data, user_id: userId } as any).select().single()
    const created: any = (res as any).data
    if (created) {
      const account: Account = { ...created, current_balance: Number(created.initial_balance) }
      set(s => ({ accounts: [...s.accounts, account] }))
    }
  },

  deleteAccount: async (id) => {
    await supabase.from('accounts').update({ is_active: false } as any).eq('id', id)
    set(s => ({
      accounts: s.accounts.filter(a => a.id !== id),
      currentAccountId: s.currentAccountId === id
        ? (s.accounts.find(a => a.id !== id)?.id ?? null)
        : s.currentAccountId
    }))
  },

  transactions: [],

  loadTransactions: async () => {
    const res = await supabase
      .from('transactions')
      .select('*, account:accounts(id,name,color,type)')
      .order('date', { ascending: false })
      .limit(500)
    const data: any[] = (res as any).data || []
    set({ transactions: data as Transaction[] })
  },

  addTransaction: async (payload) => {
    const { userId } = get()
    if (!userId) return
    const { account_id, description, group_ref, category, amount, type, status, date, installments } = payload
    const n = installments && installments > 1 ? installments : 1

    if (n > 1) {
      const res = await supabase
        .from('installment_groups')
        .insert({ user_id: userId, description, total_amount: amount, total_installments: n } as any)
        .select()
        .single()
      const group: any = (res as any).data
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
        status: i === 0 ? status : 'planned',
        date: format(addMonths(new Date(date + 'T12:00:00'), i), 'yyyy-MM-dd'),
      }))

      await supabase.from('transactions').insert(rows as any)
    } else {
      await supabase.from('transactions').insert({
        user_id: userId, account_id, description,
        group_ref: group_ref || '', category, amount, type, status, date,
      } as any)
    }

    await get().loadTransactions()
    await get().loadAccounts()
  },

  updateTransactionStatus: async (id, status) => {
    await supabase.from('transactions').update({ status } as any).eq('id', id)
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
