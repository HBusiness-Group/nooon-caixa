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
  balance_date?: string
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
  status: 'planned' | 'completed' | 'cancelled' | 'overdue' | 'simulated'
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

export interface CustomCategory {
  key: string
  label: string
  icon: string
  color: string
  group?: string   // grupo ao qual pertence (para categorias custom)
}

export interface CategoryGroup {
  key: string
  label: string
  color: string       // cor do grupo (para badge/header)
  emoji: string       // emoji do grupo
}

// ─── GRUPOS DE CATEGORIAS ────────────────────────────────────────────────────
export const CATEGORY_GROUPS: CategoryGroup[] = [
  { key: 'receitas',               label: 'Receitas',                      color: '#22c55e', emoji: '🟢' },
  { key: 'despesas_pessoais',      label: 'Despesas Pessoais',             color: '#ef4444', emoji: '🔴' },
  { key: 'despesas_financeiras',   label: 'Despesas Financeiras',          color: '#a855f7', emoji: '🟣' },
  { key: 'negocios',               label: 'Negócios',                      color: '#3b82f6', emoji: '🔵' },
  { key: 'patrimonio',             label: 'Patrimônio e Investimentos',    color: '#eab308', emoji: '🟡' },
]

// ─── CATEGORIAS DO SISTEMA (não excluíveis) ───────────────────────────────────
export const SYSTEM_CATEGORIES: CustomCategory[] = [
  // 🟢 RECEITAS
  { key: 'receita_pessoal',       label: 'Receita Pessoal',           icon: '💰', color: '#22c55e', group: 'receitas' },
  { key: 'receita_negocios',      label: 'Receita de Negócios',       icon: '📈', color: '#16a34a', group: 'receitas' },
  { key: 'emprestimos_recebidos', label: 'Empréstimos Recebidos',     icon: '🤝', color: '#4ade80', group: 'receitas' },
  { key: 'outras_entradas',       label: 'Outras Entradas',           icon: '➕', color: '#86efac', group: 'receitas' },

  // 🔴 DESPESAS PESSOAIS
  { key: 'moradia',               label: 'Moradia',                   icon: '🏠', color: '#ef4444', group: 'despesas_pessoais' },
  { key: 'alimentacao',           label: 'Alimentação',               icon: '🍽️', color: '#f87171', group: 'despesas_pessoais' },
  { key: 'transporte',            label: 'Transporte',                icon: '🚗', color: '#fca5a5', group: 'despesas_pessoais' },
  { key: 'saude',                 label: 'Saúde',                     icon: '❤️', color: '#fb7185', group: 'despesas_pessoais' },
  { key: 'educacao',              label: 'Educação',                  icon: '📚', color: '#f43f5e', group: 'despesas_pessoais' },
  { key: 'entretenimento',        label: 'Entretenimento',            icon: '🎬', color: '#e11d48', group: 'despesas_pessoais' },
  { key: 'servicos_assinaturas',  label: 'Serviços e Assinaturas',   icon: '📱', color: '#be123c', group: 'despesas_pessoais' },
  { key: 'despesas_gerais',       label: 'Despesas Gerais',           icon: '📌', color: '#9f1239', group: 'despesas_pessoais' },

  // 🟣 DESPESAS FINANCEIRAS
  { key: 'taxas_impostos',        label: 'Taxas e Impostos',          icon: '🏛️', color: '#a855f7', group: 'despesas_financeiras' },
  { key: 'pagamento_emprestimos', label: 'Pagamento de Empréstimos', icon: '🔁', color: '#c084fc', group: 'despesas_financeiras' },
  { key: 'juros_multas',          label: 'Juros e Multas',            icon: '⚠️', color: '#d946ef', group: 'despesas_financeiras' },

  // 🔵 NEGÓCIOS
  { key: 'custos_operacionais',   label: 'Custos Operacionais',       icon: '⚙️', color: '#3b82f6', group: 'negocios' },
  { key: 'investimentos_negocio', label: 'Investimentos no Negócio', icon: '💼', color: '#60a5fa', group: 'negocios' },

  // 🟡 PATRIMÔNIO E INVESTIMENTOS
  { key: 'aquisicao_ativos',      label: 'Aquisição de Ativos',       icon: '🏗️', color: '#eab308', group: 'patrimonio' },
  { key: 'investimentos_fin',     label: 'Investimentos Financeiros', icon: '📊', color: '#facc15', group: 'patrimonio' },
]

// Helper: retorna categorias agrupadas para renderização em selects/listas
export function getCategoriesByGroup(): { group: CategoryGroup; categories: CustomCategory[] }[] {
  return CATEGORY_GROUPS.map(group => ({
    group,
    categories: SYSTEM_CATEGORIES.filter(c => c.group === group.key),
  }))
}

// Helper: retorna o grupo de uma categoria pelo key
export function getGroupForCategory(categoryKey: string, allCats: CustomCategory[]): CategoryGroup | undefined {
  const cat = allCats.find(c => c.key === categoryKey)
  if (!cat?.group) return undefined
  return CATEGORY_GROUPS.find(g => g.key === cat.group)
}

// ─── STORE ───────────────────────────────────────────────────────────────────
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

  customCategories: CustomCategory[]
  loadCustomCategories: () => Promise<void>
  addCustomCategory: (cat: CustomCategory) => Promise<void>
  deleteCustomCategory: (key: string) => Promise<void>
  allCategories: () => CustomCategory[]

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
        current_balance: Number(a.current_balance),
      }))
      set(s => ({ accounts, currentAccountId: s.currentAccountId ?? accounts[0].id }))
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
      currentAccountId:
        s.currentAccountId === id ? (s.accounts.find(a => a.id !== id)?.id ?? null) : s.currentAccountId,
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
      transactions: s.transactions.map(t =>
        t.id === id ? { ...t, status: status as Transaction['status'] } : t
      ),
    }))
    await get().loadAccounts()
  },
  deleteTransaction: async (id) => {
    await supabase.from('transactions').delete().eq('id', id)
    set(s => ({ transactions: s.transactions.filter(t => t.id !== id) }))
    await get().loadAccounts()
  },

  customCategories: [],
  loadCustomCategories: async () => {
    const { data, error } = await supabase
      .from('user_categories')
      .select('key, label, icon, color, group')
      .order('created_at')
    if (error || !data) return
    const cats: CustomCategory[] = data.map((r: any) => ({
      key: r.key, label: r.label, icon: r.icon, color: r.color, group: r.group ?? undefined,
    }))
    set({ customCategories: cats })
  },
  addCustomCategory: async (cat) => {
    const { userId, customCategories } = get()
    if (!userId) return
    if (customCategories.some(c => c.key === cat.key)) return
    const { error } = await supabase.from('user_categories').insert({
      user_id: userId, key: cat.key, label: cat.label, icon: cat.icon, color: cat.color, group: cat.group ?? null,
    } as any)
    if (error) return
    set(s => ({ customCategories: [...s.customCategories, cat] }))
  },
  deleteCustomCategory: async (key) => {
    const { userId } = get()
    if (!userId) return
    const { error } = await supabase.from('user_categories').delete().eq('user_id', userId).eq('key', key)
    if (error) return
    set(s => ({ customCategories: s.customCategories.filter(c => c.key !== key) }))
  },
  allCategories: () => {
    const { customCategories } = get()
    return [...SYSTEM_CATEGORIES, ...customCategories]
  },

  activeTab: 'registro',
  setActiveTab: (tab) => set({ activeTab: tab }),

  calendarMonth: new Date().getMonth(),
  calendarYear: new Date().getFullYear(),
  setCalendarMonth: (m, y) => set({ calendarMonth: m, calendarYear: y }),
}))
