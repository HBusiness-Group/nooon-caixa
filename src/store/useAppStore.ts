/* eslint-disable @typescript-eslint/no-explicit-any */
// src/store/useAppStore.ts — NOOON Caixa V4 #002
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { addMonths, format } from 'date-fns'
import type { Invoice, InvoiceStatus, InvoiceAuditLog } from '@/types/database'
import {
  getCloseDate, getDueDate, getOverdraftDueDate,
  currentReferenceMonth, nextReferenceMonth,
  generateInstallmentSchedule,
} from '@/lib/invoiceUtils'

// ─── RE-EXPORTS de tipos do banco ────────────────────────────────────────────
export type { Invoice, InvoiceStatus, InvoiceAuditLog }

// ─── TIPOS LOCAIS ────────────────────────────────────────────────────────────

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
  // Cartão de Crédito
  credit_limit?:      number | null
  billing_close_day?: number | null
  billing_due_day?:   number | null
  // Cheque Especial
  overdraft_limit?:    number | null
  overdraft_due_day?:  number | null
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
  group?: string
}

export interface CategoryGroup {
  key: string
  label: string
  color: string
  emoji: string
}

// ─── GRUPOS DE CATEGORIAS ────────────────────────────────────────────────────
export const CATEGORY_GROUPS: CategoryGroup[] = [
  { key: 'receitas',             label: 'Receitas',                   color: '#22c55e', emoji: '🟢' },
  { key: 'despesas_pessoais',    label: 'Despesas Pessoais',          color: '#ef4444', emoji: '🔴' },
  { key: 'despesas_financeiras', label: 'Despesas Financeiras',       color: '#a855f7', emoji: '🟣' },
  { key: 'negocios',             label: 'Negócios',                   color: '#3b82f6', emoji: '🔵' },
  { key: 'patrimonio',           label: 'Patrimônio e Investimentos', color: '#eab308', emoji: '🟡' },
]

// ─── CATEGORIAS DO SISTEMA ───────────────────────────────────────────────────
export const SYSTEM_CATEGORIES: CustomCategory[] = [
  { key: 'receita_pessoal',       label: 'Receita Pessoal',           icon: '💰', color: '#22c55e', group: 'receitas' },
  { key: 'receita_negocios',      label: 'Receita de Negócios',       icon: '📈', color: '#16a34a', group: 'receitas' },
  { key: 'emprestimos_recebidos', label: 'Empréstimos Recebidos',     icon: '🤝', color: '#4ade80', group: 'receitas' },
  { key: 'outras_entradas',       label: 'Outras Entradas',           icon: '➕', color: '#86efac', group: 'receitas' },
  { key: 'moradia',               label: 'Moradia',                   icon: '🏠', color: '#ef4444', group: 'despesas_pessoais' },
  { key: 'alimentacao',           label: 'Alimentação',               icon: '🍽️', color: '#f87171', group: 'despesas_pessoais' },
  { key: 'transporte',            label: 'Transporte',                icon: '🚗', color: '#fca5a5', group: 'despesas_pessoais' },
  { key: 'saude',                 label: 'Saúde',                     icon: '❤️', color: '#fb7185', group: 'despesas_pessoais' },
  { key: 'educacao',              label: 'Educação',                  icon: '📚', color: '#f43f5e', group: 'despesas_pessoais' },
  { key: 'entretenimento',        label: 'Entretenimento',            icon: '🎬', color: '#e11d48', group: 'despesas_pessoais' },
  { key: 'servicos_assinaturas',  label: 'Serviços e Assinaturas',    icon: '📱', color: '#be123c', group: 'despesas_pessoais' },
  { key: 'despesas_gerais',       label: 'Despesas Gerais',           icon: '📌', color: '#9f1239', group: 'despesas_pessoais' },
  { key: 'taxas_impostos',        label: 'Taxas e Impostos',          icon: '🏛️', color: '#a855f7', group: 'despesas_financeiras' },
  { key: 'pagamento_emprestimos', label: 'Pagamento de Empréstimos',  icon: '🔁', color: '#c084fc', group: 'despesas_financeiras' },
  { key: 'juros_multas',          label: 'Juros e Multas',            icon: '⚠️', color: '#d946ef', group: 'despesas_financeiras' },
  { key: 'custos_operacionais',   label: 'Custos Operacionais',       icon: '⚙️', color: '#3b82f6', group: 'negocios' },
  { key: 'investimentos_negocio', label: 'Investimentos no Negócio',  icon: '💼', color: '#60a5fa', group: 'negocios' },
  { key: 'aquisicao_ativos',      label: 'Aquisição de Ativos',       icon: '🏗️', color: '#eab308', group: 'patrimonio' },
  { key: 'investimentos_fin',     label: 'Investimentos Financeiros', icon: '📊', color: '#facc15', group: 'patrimonio' },
]

export function getCategoriesByGroup(): { group: CategoryGroup; categories: CustomCategory[] }[] {
  return CATEGORY_GROUPS.map(group => ({
    group,
    categories: SYSTEM_CATEGORIES.filter(c => c.group === group.key),
  }))
}

export function getGroupForCategory(categoryKey: string, allCats: CustomCategory[]): CategoryGroup | undefined {
  const cat = allCats.find(c => c.key === categoryKey)
  if (!cat?.group) return undefined
  return CATEGORY_GROUPS.find(g => g.key === cat.group)
}

// ─── HELPERS: contas fiduciárias ─────────────────────────────────────────────

export function isFiduciary(type: string): boolean {
  return type === 'credit_card' || type === 'overdraft'
}

export function isCreditCard(type: string): boolean {
  return type === 'credit_card'
}

export function isOverdraft(type: string): boolean {
  return type === 'overdraft'
}

// ─── INTERFACE DO STORE ──────────────────────────────────────────────────────

interface AppState {
  userId: string | null
  setUserId: (id: string | null) => void

  accounts: Account[]
  currentAccountId: string | null
  loadAccounts: () => Promise<void>
  setCurrentAccount: (id: string) => void
  addAccount: (data: Omit<Account, 'id' | 'user_id' | 'created_at' | 'current_balance'>) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  updateAccountFiduciary: (id: string, data: Partial<Pick<Account,
    'billing_close_day' | 'billing_due_day' | 'credit_limit' |
    'overdraft_limit' | 'overdraft_due_day'
  >>) => Promise<void>

  transactions: Transaction[]
  loadTransactions: () => Promise<void>
  addTransaction: (data: NewTransactionPayload) => Promise<void>
  updateTransactionStatus: (id: string, status: string) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>

  // ── Faturas ─────────────────────────────────────────────────────────────
  invoices: Invoice[]
  loadInvoices: () => Promise<void>

  /** Garante que existe uma fatura para o mês de referência de uma conta fiduciária */
  ensureInvoice: (accountId: string, referenceMonth?: string) => Promise<Invoice | null>

  /** Paga fatura total */
  payInvoiceFull: (invoiceId: string, paymentDate: string) => Promise<void>

  /** Pagamento parcial: abate valor e cria marcador de juros no próximo mês */
  payInvoicePartial: (invoiceId: string, paidAmount: number, paymentDate: string) => Promise<void>

  /** Parcela a fatura: cria lançamentos de empréstimo e muda status */
  installInvoice: (invoiceId: string, totalAmount: number, installments: number, firstDueDate: string) => Promise<void>

  /** Define valor de juros manualmente numa fatura */
  setInvoiceInterest: (invoiceId: string, interestAmount: number) => Promise<void>

  /** Log de auditoria da fatura */
  getInvoiceAuditLog: (invoiceId: string) => Promise<InvoiceAuditLog[]>

  // ── Categorias ──────────────────────────────────────────────────────────
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

// ─── STORE ───────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  userId: null,
  setUserId: (id) => set({ userId: id }),

  // ── Contas ──────────────────────────────────────────────────────────────
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

  updateAccountFiduciary: async (id, data) => {
    await supabase.from('accounts').update(data as any).eq('id', id)
    set(s => ({
      accounts: s.accounts.map(a => a.id === id ? { ...a, ...data } : a),
    }))
  },

  // ── Transações ──────────────────────────────────────────────────────────
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
        .select().single()
      const group: any = (res as any).data
      if (!group) return
      const rows = Array.from({ length: n }, (_, i) => ({
        user_id: userId, account_id,
        installment_group_id: group.id,
        installment_number: i + 1,
        description: `${description} [${i + 1}/${n}]`,
        group_ref: group_ref || '', category,
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

  // ── Faturas ─────────────────────────────────────────────────────────────
  invoices: [],

  loadInvoices: async () => {
    const res = await supabase
      .from('invoices')
      .select('*')
      .order('reference_month', { ascending: false })
      .limit(100)
    const data: any[] = (res as any).data || []
    set({ invoices: data as Invoice[] })
  },

ensureInvoice: async (accountId, referenceMonth) => {
  const { userId, accounts, transactions } = get()
  if (!userId) return null

  const refMonth = referenceMonth || currentReferenceMonth()
  const account  = accounts.find(a => a.id === accountId)
  if (!account) return null

  // Calcula ciclo e total SEMPRE — independente de a fatura já existir
  const closeDay = isCreditCard(account.type)
    ? (account.billing_close_day ?? 10)
    : (account.overdraft_due_day ?? 0)

  const [refYear, refMonthNum] = refMonth.split('-').map(Number)
  const prevMonth = refMonthNum === 1
    ? `${refYear - 1}-12`
    : `${refYear}-${String(refMonthNum - 1).padStart(2, '0')}`

  // cycleStart = fechamento do mês anterior + 1 dia (primeiro dia do ciclo)
  const cycleStart = isCreditCard(account.type)
    ? format(addDays(getCloseDate(closeDay, prevMonth), 1), 'yyyy-MM-dd')
    : format(addDays(getOverdraftDueDate(closeDay, prevMonth), 1), 'yyyy-MM-dd')

  // cycleEnd = fechamento deste mês (último dia do ciclo)
  const cycleEnd = isCreditCard(account.type)
    ? format(getCloseDate(closeDay, refMonth), 'yyyy-MM-dd')
    : format(getOverdraftDueDate(closeDay, refMonth), 'yyyy-MM-dd')

  const total = Math.round(
    transactions
      .filter(t =>
        t.account_id === accountId &&
        t.type === 'expense' &&
        t.status !== 'cancelled' &&
        t.status !== 'simulated' &&
        t.date >= cycleStart &&
        t.date <= cycleEnd
      )
      .reduce((sum, t) => sum + t.amount, 0)
    * 100) / 100

  // Se já existe — atualiza total_amount se estiver zerado ou diferente
  const existing = get().invoices.find(
    inv => inv.account_id === accountId && inv.reference_month === refMonth
  )
  if (existing) {
    if (existing.total_amount !== total && existing.status === 'EM_ABERTO') {
      await supabase.from('invoices').update({ total_amount: total } as any).eq('id', existing.id)
      set(s => ({
        invoices: s.invoices.map(i =>
          i.id === existing.id ? { ...i, total_amount: total } : i
        ),
      }))
      return { ...existing, total_amount: total }
    }
    return existing
  }

  // Calcula datas
  let closeDate: string
  let dueDate: string

  if (isCreditCard(account.type)) {
    const closeDay = account.billing_close_day ?? 10
    const dueDay   = account.billing_due_day   ?? 20
    closeDate = format(getCloseDate(closeDay, refMonth), 'yyyy-MM-dd')
    dueDate   = format(getDueDate(dueDay, refMonth),     'yyyy-MM-dd')
  } else {
    const dueDay = account.overdraft_due_day ?? 0
    closeDate = format(getOverdraftDueDate(dueDay, refMonth), 'yyyy-MM-dd')
    dueDate   = closeDate
  }

  const payload = {
    user_id:            userId,
    account_id:         accountId,
    reference_month:    refMonth,
    close_date:         closeDate,
    due_date:           dueDate,
    total_amount:       Math.round(total * 100) / 100,
    paid_amount:        0,
    status:             'EM_ABERTO' as InvoiceStatus,
    interest_amount:    null,
    generates_interest: false,
  }

  const res = await supabase.from('invoices').insert(payload as any).select().single()
  const created: any = (res as any).data
  if (!created) return null

  set(s => ({ invoices: [created as Invoice, ...s.invoices] }))
  return created as Invoice
},

  payInvoiceFull: async (invoiceId, paymentDate) => {
    const { userId, invoices } = get()
    if (!userId) return

    const invoice = invoices.find(i => i.id === invoiceId)
    if (!invoice) return

    const oldStatus = invoice.status

    // 1. Atualiza fatura para PAGO
    await supabase.from('invoices').update({
      status:      'PAGO',
      paid_amount: invoice.total_amount,
    } as any).eq('id', invoiceId)

    // 2. Cria lançamento de pagamento nas transações
    await get().addTransaction({
      account_id:  invoice.account_id,
      description: `Pagamento fatura ${invoice.reference_month}`,
      category:    'pagamento_emprestimos',
      amount:      invoice.total_amount,
      type:        'expense',
      status:      'completed',
      date:        paymentDate,
    })

    // 3. Log de auditoria
    await supabase.from('invoice_audit_log').insert({
      invoice_id: invoiceId,
      user_id:    userId,
      action:     'STATUS_CHANGED',
      old_value:  { status: oldStatus, paid_amount: invoice.paid_amount },
      new_value:  { status: 'PAGO',    paid_amount: invoice.total_amount },
    } as any)

    // 4. Atualiza estado local
    set(s => ({
      invoices: s.invoices.map(i =>
        i.id === invoiceId
          ? { ...i, status: 'PAGO', paid_amount: i.total_amount }
          : i
      ),
    }))
  },

  payInvoicePartial: async (invoiceId, paidAmount, paymentDate) => {
    const { userId, invoices } = get()
    if (!userId) return

    const invoice = invoices.find(i => i.id === invoiceId)
    if (!invoice) return

    const remaining = invoice.total_amount - paidAmount

    // 1. Atualiza fatura para PARCIAL
    await supabase.from('invoices').update({
      status:      'PARCIAL',
      paid_amount: paidAmount,
    } as any).eq('id', invoiceId)

    // 2. Cria lançamento de pagamento parcial
    await get().addTransaction({
      account_id:  invoice.account_id,
      description: `Pagamento parcial fatura ${invoice.reference_month}`,
      category:    'pagamento_emprestimos',
      amount:      paidAmount,
      type:        'expense',
      status:      'completed',
      date:        paymentDate,
    })

    // 3. Cria marcador de juros simbólico (R$1) na próxima fatura
    const nextMonth   = nextReferenceMonth(invoice.reference_month)
    const nextInvoice = await get().ensureInvoice(invoice.account_id, nextMonth)

    if (nextInvoice) {
      await get().addTransaction({
        account_id:  invoice.account_id,
        description: `⚠️ Juros referente fatura ${invoice.reference_month} — ajuste o valor`,
        category:    'juros_multas',
        amount:      1,
        type:        'expense',
        status:      'planned',
        date:        nextInvoice.due_date,
        group_ref:   `juros_fatura_${invoiceId}`,
      })

      // Sinaliza que a próxima fatura vai gerar juros
      await supabase.from('invoices').update({ generates_interest: true } as any).eq('id', nextInvoice.id)
      set(s => ({
        invoices: s.invoices.map(i =>
          i.id === nextInvoice.id ? { ...i, generates_interest: true } : i
        ),
      }))
    }

    // 4. Log
    await supabase.from('invoice_audit_log').insert({
      invoice_id: invoiceId,
      user_id:    userId,
      action:     'PAYMENT_REGISTERED',
      old_value:  { status: invoice.status,  paid_amount: invoice.paid_amount },
      new_value:  { status: 'PARCIAL',        paid_amount: paidAmount, remaining },
    } as any)

    // 5. Estado local
    set(s => ({
      invoices: s.invoices.map(i =>
        i.id === invoiceId ? { ...i, status: 'PARCIAL', paid_amount: paidAmount } : i
      ),
    }))
  },

  installInvoice: async (invoiceId, totalAmount, installments, firstDueDate) => {
    const { userId, invoices } = get()
    if (!userId) return

    const invoice = invoices.find(i => i.id === invoiceId)
    if (!invoice) return

    // 1. Gera cronograma
    const schedule = generateInstallmentSchedule(
      totalAmount, installments, new Date(firstDueDate + 'T12:00:00')
    )

    // 2. Cria lançamentos parcelados como empréstimo
    for (const row of schedule) {
      await get().addTransaction({
        account_id:   invoice.account_id,
        description:  `Parcelamento fatura ${invoice.reference_month} [${row.installment_number}/${installments}]`,
        category:     'pagamento_emprestimos',
        amount:       row.amount,
        type:         'expense',
        status:       'planned',
        date:         row.due_date,
        group_ref:    `parcela_fatura_${invoiceId}`,
      })
    }

    // 3. Atualiza fatura para PARCELADO
    await supabase.from('invoices').update({ status: 'PARCELADO' } as any).eq('id', invoiceId)

    // 4. Log
    await supabase.from('invoice_audit_log').insert({
      invoice_id: invoiceId,
      user_id:    userId,
      action:     'INSTALLMENT_CREATED',
      old_value:  { status: invoice.status },
      new_value:  { status: 'PARCELADO', installments, total_amount: totalAmount },
    } as any)

    // 5. Estado local
    set(s => ({
      invoices: s.invoices.map(i =>
        i.id === invoiceId ? { ...i, status: 'PARCELADO' } : i
      ),
    }))
  },

  setInvoiceInterest: async (invoiceId, interestAmount) => {
    const { userId } = get()
    if (!userId) return

    await supabase.from('invoices').update({ interest_amount: interestAmount } as any).eq('id', invoiceId)

    await supabase.from('invoice_audit_log').insert({
      invoice_id: invoiceId,
      user_id:    userId,
      action:     'INTEREST_ADDED',
      old_value:  null,
      new_value:  { interest_amount: interestAmount },
    } as any)

    set(s => ({
      invoices: s.invoices.map(i =>
        i.id === invoiceId ? { ...i, interest_amount: interestAmount } : i
      ),
    }))
  },

  getInvoiceAuditLog: async (invoiceId) => {
    const res = await supabase
      .from('invoice_audit_log')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false })
    return ((res as any).data || []) as InvoiceAuditLog[]
  },

  // ── Categorias ──────────────────────────────────────────────────────────
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
      user_id: userId, key: cat.key, label: cat.label,
      icon: cat.icon, color: cat.color, group: cat.group ?? null,
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
