// src/lib/invoiceUtils.ts — NOOON Caixa V4
// Helpers para datas de fatura, dias úteis e cálculos fiduciários

import { addDays, getDaysInMonth, format, parseISO, addMonths } from 'date-fns'

// ── Dias úteis ───────────────────────────────────────────────────────────────

/**
 * Feriados nacionais fixos (MM-DD). Expanda conforme necessário.
 * Para feriados móveis (Carnaval, Páscoa) seria necessário cálculo extra.
 */
const NATIONAL_HOLIDAYS: string[] = [
  '01-01', // Ano Novo
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência
  '10-12', // N.S. Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '11-20', // Consciência Negra
  '12-25', // Natal
]

function isHoliday(date: Date): boolean {
  const mmdd = format(date, 'MM-dd')
  return NATIONAL_HOLIDAYS.includes(mmdd)
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

/** Retorna true se a data é dia não útil (fim de semana ou feriado nacional) */
export function isNonBusinessDay(date: Date): boolean {
  return isWeekend(date) || isHoliday(date)
}

/**
 * Ajusta uma data para o próximo dia útil se cair em fim de semana ou feriado.
 * Segue a convenção bancária brasileira.
 */
export function toNextBusinessDay(date: Date): Date {
  let d = new Date(date)
  while (isNonBusinessDay(d)) {
    d = addDays(d, 1)
  }
  return d
}

// ── Cálculo de datas de fatura ───────────────────────────────────────────────

/**
 * Dado um dia de fechamento e um mês de referência ('YYYY-MM'),
 * retorna a data de fechamento ajustada para dia útil.
 */
export function getCloseDate(closeDay: number, referenceMonth: string): Date {
  const [year, month] = referenceMonth.split('-').map(Number)
  const daysInMonth = getDaysInMonth(new Date(year, month - 1))
  const safeDay = Math.min(closeDay, daysInMonth, 28) // limita a 28 para segurança
  const raw = new Date(year, month - 1, safeDay)
  return toNextBusinessDay(raw)
}

/**
 * Dado um dia de vencimento, dia de fechamento e mês de referência ('YYYY-MM'),
 * retorna a data de vencimento ajustada para dia útil.
 * Regra: se dueDay > closeDay → vencimento no mesmo mês do fechamento.
 *        se dueDay <= closeDay → vencimento no mês seguinte (caso raro).
 */
export function getDueDate(dueDay: number, referenceMonth: string, closeDay?: number): Date {
  const [year, month] = referenceMonth.split('-').map(Number)

  // Vencimento no mesmo mês se dueDay > closeDay (regra padrão brasileira)
  const sameMonth = closeDay !== undefined ? dueDay > closeDay : false

  if (sameMonth) {
    const daysInMonth = getDaysInMonth(new Date(year, month - 1))
    const safeDay = Math.min(dueDay, daysInMonth, 28)
    const raw = new Date(year, month - 1, safeDay)
    return toNextBusinessDay(raw)
  }

  // Vencimento no mês seguinte (comportamento legado / fallback)
  const nextMonth  = new Date(year, month, 1)
  const nextYear   = nextMonth.getFullYear()
  const nextM      = nextMonth.getMonth() + 1
  const daysInNext = getDaysInMonth(new Date(nextYear, nextM - 1))
  const safeDay    = Math.min(dueDay, daysInNext, 28)
  const raw        = new Date(nextYear, nextM - 1, safeDay)
  return toNextBusinessDay(raw)
}

/**
 * Para Cheque Especial: dia 0 = último dia útil do mês.
 */
export function getOverdraftDueDate(dueDayOrZero: number, referenceMonth: string): Date {
  const [year, month] = referenceMonth.split('-').map(Number)
  if (dueDayOrZero === 0) {
    // Último dia do mês, andando para trás até achar dia útil
    let d = new Date(year, month, 0) // último dia do mês atual
    while (isNonBusinessDay(d)) {
      d = addDays(d, -1)
    }
    return d
  }
  const daysInMonth = getDaysInMonth(new Date(year, month - 1))
  const safeDay = Math.min(dueDayOrZero, daysInMonth, 28)
  const raw = new Date(year, month - 1, safeDay)
  return toNextBusinessDay(raw)
}

/** Retorna o mês de referência atual como 'YYYY-MM' */
export function currentReferenceMonth(): string {
  return format(new Date(), 'yyyy-MM')
}

/** Retorna o próximo mês de referência como 'YYYY-MM' */
export function nextReferenceMonth(from: string): string {
  return format(addMonths(parseISO(from + '-01'), 1), 'yyyy-MM')
}

// ── Cálculos de saldo fiduciário ─────────────────────────────────────────────

/**
 * Saldo disponível de um cartão de crédito:
 * limite total - valor comprometido (total_amount - paid_amount)
 */
export function creditAvailable(creditLimit: number, totalAmount: number, paidAmount: number): number {
  const committed = Math.max(totalAmount - paidAmount, 0)
  return creditLimit - committed
}

/**
 * Classifica o tipo de saldo para exibição:
 * - 'available'  → dinheiro utilizável
 * - 'committed'  → valores usados não pagos
 * - 'financed'   → parcelado (tratado como empréstimo)
 */
export type BalanceClass = 'available' | 'committed' | 'financed'

export function classifyBalance(status: string): BalanceClass {
  if (status === 'PAGO')      return 'available'
  if (status === 'PARCELADO') return 'financed'
  return 'committed' // EM_ABERTO ou PARCIAL
}

// ── Geração de cronograma de parcelamento de fatura ──────────────────────────

export interface InstallmentScheduleRow {
  installment_number: number
  due_date: string       // 'YYYY-MM-DD'
  amount: number
}

/**
 * Gera cronograma de parcelamento de fatura CC.
 * @param totalAmount  valor total a parcelar
 * @param installments número de parcelas
 * @param firstDueDate data do primeiro vencimento (Date)
 */
export function generateInstallmentSchedule(
  totalAmount: number,
  installments: number,
  firstDueDate: Date
): InstallmentScheduleRow[] {
  const base   = Math.floor((totalAmount / installments) * 100) / 100
  const last   = Math.round((totalAmount - base * (installments - 1)) * 100) / 100

  return Array.from({ length: installments }, (_, i) => ({
    installment_number: i + 1,
    due_date: format(addMonths(firstDueDate, i), 'yyyy-MM-dd'),
    amount: i === installments - 1 ? last : base,
  }))
}
