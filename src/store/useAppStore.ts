// ─────────────────────────────────────────────────────────────────────────────
// SUBSTITUIR no useAppStore.ts as funções: payInvoice, payInvoicePartial, installInvoice
//
// LÓGICA CORRETA:
//   1. Cria transação de SAÍDA na conta corrente escolhida (sourceAccountId)
//   2. Cria transação de ENTRADA na conta CC (restaura o limite na view)
//   3. Atualiza status da fatura
//   4. Loga no invoice_audit_log
// ─────────────────────────────────────────────────────────────────────────────

// ── payInvoice (pagamento total) ────────────────────────────────────────────
payInvoice: async (invoiceId: string, ccAccountId: string, sourceAccountId: string) => {
  const { supabase, invoices, loadTransactions, ensureInvoice } = get()

  const invoice = invoices.find((i) => i.id === invoiceId)
  if (!invoice) return

  const valor = invoice.total_amount - (invoice.paid_amount ?? 0)
  const descricao = `Pagamento fatura ${invoice.ref_month}`

  // 1. Saída na conta corrente de origem
  await supabase.from('transactions').insert({
    account_id: sourceAccountId,
    type: 'expense',
    description: descricao,
    amount: valor,
    reference_date: new Date().toISOString().split('T')[0],
    status: 'completed',
    category: 'Pagamentos de Empréstimos',
  } as any)

  // 2. Entrada na conta CC (restaura o crédito disponível na view account_balances)
  await supabase.from('transactions').insert({
    account_id: ccAccountId,
    type: 'income',
    description: descricao,
    amount: valor,
    reference_date: new Date().toISOString().split('T')[0],
    status: 'completed',
    category: 'Pagamentos de Empréstimos',
  } as any)

  // 3. Atualiza fatura para PAGO
  await supabase
    .from('invoices')
    .update({ status: 'PAGO', paid_amount: invoice.total_amount } as any)
    .eq('id', invoiceId)

  // 4. Log de auditoria
  await supabase.from('invoice_audit_log').insert({
    invoice_id: invoiceId,
    account_id: ccAccountId,
    action: 'PAGAMENTO_TOTAL',
    details: {
      valor,
      source_account_id: sourceAccountId,
      ref_month: invoice.ref_month,
    },
  } as any)

  // 5. Atualiza store local
  set((state) => ({
    invoices: state.invoices.map((i) =>
      i.id === invoiceId ? { ...i, status: 'PAGO', paid_amount: i.total_amount } : i
    ),
  }))

  await loadTransactions()
  await ensureInvoice(ccAccountId)
},

// ── payInvoicePartial (pagamento parcial) ──────────────────────────────────
payInvoicePartial: async (
  invoiceId: string,
  ccAccountId: string,
  sourceAccountId: string,
  valor: number,
  juros: number
) => {
  const { supabase, invoices, loadTransactions, ensureInvoice } = get()

  const invoice = invoices.find((i) => i.id === invoiceId)
  if (!invoice) return

  const novoPago = (invoice.paid_amount ?? 0) + valor
  const novoStatus = novoPago >= invoice.total_amount ? 'PAGO' : 'PARCIAL'
  const descricao = `Pagamento parcial fatura ${invoice.ref_month}`
  const today = new Date().toISOString().split('T')[0]

  // 1. Saída na conta de origem
  await supabase.from('transactions').insert({
    account_id: sourceAccountId,
    type: 'expense',
    description: descricao,
    amount: valor,
    reference_date: today,
    status: 'completed',
    category: 'Pagamentos de Empréstimos',
  } as any)

  // 2. Entrada no CC (restaura crédito parcialmente)
  await supabase.from('transactions').insert({
    account_id: ccAccountId,
    type: 'income',
    description: descricao,
    amount: valor,
    reference_date: today,
    status: 'completed',
    category: 'Pagamentos de Empréstimos',
  } as any)

  // 3. Juros (se houver) — lançado como saída na conta de origem também
  if (juros > 0) {
    await supabase.from('transactions').insert({
      account_id: sourceAccountId,
      type: 'expense',
      description: `Juros e multas fatura ${invoice.ref_month}`,
      amount: juros,
      reference_date: today,
      status: 'completed',
      category: 'Taxas e Impostos',
    } as any)
  }

  // 4. Atualiza fatura
  await supabase
    .from('invoices')
    .update({ status: novoStatus, paid_amount: novoPago } as any)
    .eq('id', invoiceId)

  // 5. Log de auditoria
  await supabase.from('invoice_audit_log').insert({
    invoice_id: invoiceId,
    account_id: ccAccountId,
    action: 'PAGAMENTO_PARCIAL',
    details: {
      valor,
      juros,
      source_account_id: sourceAccountId,
      ref_month: invoice.ref_month,
      novo_status: novoStatus,
    },
  } as any)

  // 6. Atualiza store local
  set((state) => ({
    invoices: state.invoices.map((i) =>
      i.id === invoiceId ? { ...i, status: novoStatus, paid_amount: novoPago } : i
    ),
  }))

  await loadTransactions()
  await ensureInvoice(ccAccountId)
},

// ── installInvoice (parcelamento) ──────────────────────────────────────────
installInvoice: async (
  invoiceId: string,
  ccAccountId: string,
  sourceAccountId: string,
  parcelas: number
) => {
  const { supabase, invoices, loadTransactions, ensureInvoice } = get()

  const invoice = invoices.find((i) => i.id === invoiceId)
  if (!invoice) return

  const valorParcela = parseFloat(
    ((invoice.total_amount - (invoice.paid_amount ?? 0)) / parcelas).toFixed(2)
  )
  const today = new Date()

  // Cria N parcelas de saída na conta de origem (meses subsequentes)
  for (let i = 0; i < parcelas; i++) {
    const refDate = new Date(today.getFullYear(), today.getMonth() + i, today.getDate())
      .toISOString()
      .split('T')[0]

    await supabase.from('transactions').insert({
      account_id: sourceAccountId,
      type: 'expense',
      description: `Parcela ${i + 1}/${parcelas} fatura ${invoice.ref_month}`,
      amount: valorParcela,
      reference_date: refDate,
      status: 'planned',
      category: 'Pagamentos de Empréstimos',
    } as any)
  }

  // Atualiza fatura para PARCELADO
  await supabase
    .from('invoices')
    .update({ status: 'PARCELADO' } as any)
    .eq('id', invoiceId)

  // Log de auditoria
  await supabase.from('invoice_audit_log').insert({
    invoice_id: invoiceId,
    account_id: ccAccountId,
    action: 'PARCELAMENTO',
    details: {
      parcelas,
      valor_parcela: valorParcela,
      source_account_id: sourceAccountId,
      ref_month: invoice.ref_month,
    },
  } as any)

  set((state) => ({
    invoices: state.invoices.map((i) =>
      i.id === invoiceId ? { ...i, status: 'PARCELADO' } : i
    ),
  }))

  await loadTransactions()
  await ensureInvoice(ccAccountId)
},
