// src/types/database.ts — NOOON Caixa V4

export type TransactionType   = 'income' | 'expense'
export type TransactionStatus = 'planned' | 'completed' | 'cancelled' | 'overdue' | 'simulated'
export type AccountType       = 'checking' | 'savings' | 'credit_card' | 'overdraft' | 'wallet' | 'investment' | 'other'

/** Status de fatura / obrigação fiduciária */
export type InvoiceStatus = 'EM_ABERTO' | 'PARCIAL' | 'PARCELADO' | 'PAGO'

export type Plan = 'free' | 'nooon' | 'pro'

export interface User {
  id: string
  email: string
  full_name?: string
  plan: Plan
  created_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  initial_balance: number
  balance_date?: string
  color: string
  is_active: boolean
  created_at: string
  current_balance?: number

  // ── Cartão de Crédito ────────────────────────────────────
  credit_limit?:       number | null   // limite total do cartão
  billing_close_day?:  number | null   // dia de fechamento da fatura (1–28)
  billing_due_day?:    number | null   // dia de vencimento (1–28)

  // ── Cheque Especial ──────────────────────────────────────
  overdraft_limit?:    number | null   // limite do cheque especial
  overdraft_due_day?:  number | null   // dia de vencimento (0 = último dia do mês)
}

export interface InstallmentGroup {
  id: string
  user_id: string
  description: string
  total_amount: number
  total_installments: number
  created_at: string
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
  type: TransactionType
  status: TransactionStatus
  date: string
  created_at: string
  updated_at: string
  account?: Account
  installment_group?: InstallmentGroup
}

export interface NewTransactionPayload {
  account_id: string
  description: string
  group_ref?: string
  category: string
  amount: number
  type: TransactionType
  status: TransactionStatus
  date: string
  installments?: number
}

/** Fatura mensal de CC ou CE */
export interface Invoice {
  id: string
  user_id: string
  account_id: string
  reference_month: string     // 'YYYY-MM'
  close_date: string          // 'YYYY-MM-DD'
  due_date: string            // 'YYYY-MM-DD'
  total_amount: number
  paid_amount: number
  status: InvoiceStatus
  interest_amount: number | null
  generates_interest: boolean
  created_at: string
  updated_at: string
}

/** Entrada do log de auditoria de faturas */
export interface InvoiceAuditLog {
  id: string
  invoice_id: string
  user_id: string
  action: 'STATUS_CHANGED' | 'PAYMENT_REGISTERED' | 'INTEREST_ADDED' | 'INSTALLMENT_CREATED'
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
}
