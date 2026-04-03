import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function fmtCurrency(value: number): string {
  return 'R$ ' + Math.abs(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Formato sem R$, sinal no final: "7.039,68 +" ou "441,32 -"
export function fmtValue(amount: number, type: 'income' | 'expense'): string {
  const formatted = Math.abs(amount).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return type === 'income' ? `${formatted} +` : `${formatted} -`
}

// Formato compacto sem R$, sinal no final: "7,3k +" ou "18 -"
export function fmtValueK(amount: number, type: 'income' | 'expense'): string {
  const abs = Math.abs(amount)
  const formatted = abs >= 1000
    ? (abs / 1000).toFixed(1).replace('.', ',') + 'k'
    : abs.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return type === 'income' ? `${formatted} +` : `${formatted} -`
}

export function fmtCurrencyK(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1000) return 'R$' + (value / 1000).toFixed(1) + 'k'
  return 'R$' + Math.round(value)
}

export function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
]

export const DOW_NAMES = ['dom','seg','ter','qua','qui','sex','sáb']

export const CAT_LABELS: Record<string, string> = {
  business: 'Business',
  acquisition: 'Aquisição',
  loan: 'Empréstimo',
  transport: 'Transporte',
  food: 'Alimentação',
  health: 'Saúde',
  other: 'Outros',
}

export const CAT_ICONS: Record<string, string> = {
  business: '💼',
  acquisition: '🛒',
  loan: '🔁',
  transport: '🚗',
  food: '🍽',
  health: '❤',
  other: '📌',
}

export const CAT_COLORS: Record<string, string> = {
  business:    '#6dd400',
  acquisition: '#ffb340',
  loan:        '#ff5757',
  transport:   '#40b4ff',
  food:        '#c084fc',
  health:      '#fb7185',
  other:       '#94a3b8',
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking:    'Conta corrente',
  savings:     'Conta poupança',
  credit_card: 'Cartão de crédito',
  wallet:      'Carteira',
  investment:  'Investimento',
  other:       'Outro',
}

export const INSTALLMENT_OPTIONS = [1, 2, 3, 6, 12, 24, 36, 48, 60]
