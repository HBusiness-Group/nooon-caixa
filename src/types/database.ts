export type TransactionType   = 'income' | 'expense'
export type TransactionStatus = 'planned' | 'completed' | 'cancelled' | 'overdue' | 'simulated'
export type AccountType       = 'checking' | 'savings' | 'credit_card' | 'wallet' | 'investment' | 'other'
export type Category          = string
export type Plan              = 'free' | 'nooon' | 'pro'

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
  category: Category
  amount: number
  type: TransactionType
  status: TransactionStatus
  date: string
  created_at: string
  updated_at: string
  // joined
  account?: Account
  installment_group?: InstallmentGroup
}

export interface NewTransactionPayload {
  account_id: string
  description: string
  group_ref?: string
  category: Category
  amount: number
  type: TransactionType
  status: TransactionStatus
  date: string
  installments?: number
}

// Supabase DB typing stub (expands as needed)
export interface Database {
  public: {
    Tables: {
      users:              { Row: User;              Insert: Partial<User>;                                          Update: Partial<User> }
      accounts:           { Row: Account;           Insert: Omit<Account, 'id' | 'created_at'>;                   Update: Partial<Account> }
      transactions:       { Row: Transaction;       Insert: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Transaction> }
      installment_groups: { Row: InstallmentGroup;  Insert: Omit<InstallmentGroup, 'id' | 'created_at'>;          Update: Partial<InstallmentGroup> }
    }
    Views: {
      account_balances: { Row: Account & { current_balance: number } }
    }
  }
}
