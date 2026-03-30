# NOOON Caixa

Aplicação de gestão financeira pessoal — ecossistema NOOON.

## Stack
- Next.js 14 + TypeScript
- Tailwind CSS
- Supabase (PostgreSQL + Auth)
- Zustand (state management)
- Recharts (gráficos)
- Cloudflare Pages (deploy)

## Setup local

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
O arquivo `.env.local` já está configurado com as credenciais do projeto Supabase.
Caso precise recriar:
```
NEXT_PUBLIC_SUPABASE_URL=https://yxwwxopbrwcvwsozsyfv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<sua_anon_key>
```

### 3. Rodar em desenvolvimento
```bash
npm run dev
```
Acesse http://localhost:3000

### 4. Build para produção
```bash
npm run build
```
A pasta `out/` é gerada com o site estático — pronta para o Cloudflare Pages.

## Deploy no Cloudflare Pages

1. Suba o repositório para `HBusiness-Group/nooon-caixa` no GitHub
2. No Cloudflare Pages: **Create project → Connect to Git → selecione o repo**
3. Configurações de build:
   - **Framework preset:** Next.js (Static HTML Export)
   - **Build command:** `npm run build`
   - **Build output directory:** `out`
4. Adicione as variáveis de ambiente no painel do Cloudflare Pages:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. **Save and Deploy**

### Subdomínio
No Cloudflare DNS, adicione um CNAME:
- **Name:** `caixa`
- **Target:** `<seu-projeto>.pages.dev`

Pronto: `caixa.nooon.com.br` estará no ar.

## Estrutura do projeto
```
src/
  app/              # Next.js App Router (páginas)
  components/
    layout/         # AppShell, Topbar, NavBar
    transactions/   # RegistroScreen, ResumoScreen, TransactionModal
    calendar/       # CalendarioScreen
    accounts/       # ContasScreen
  lib/              # supabase.ts, utils.ts
  store/            # Zustand store (useAppStore.ts)
  types/            # TypeScript types (database.ts)
```

## Banco de dados
Scripts SQL em `/supabase/` — já executados no projeto Supabase.
Tabelas: `users`, `accounts`, `installment_groups`, `transactions`
View: `account_balances`
