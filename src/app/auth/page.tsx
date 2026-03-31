'use client'
export const runtime = 'edge'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit() {
    setLoading(true)
    setMessage('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name } }
      })
      if (error) setMessage(error.message)
      else setMessage('Verifique seu e-mail para confirmar o cadastro.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0d1410] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-2">
            <svg width="36" height="36" viewBox="0 0 100 100" fill="none">
              <path d="M50 5L93 27.5V72.5L50 95L7 72.5V27.5L50 5Z" fill="#1a5c2a" opacity="0.9"/>
              <rect x="28" y="32" width="44" height="36" rx="10" fill="none" stroke="#6dd400" strokeWidth="8"/>
            </svg>
            <span className="font-['Barlow_Condensed'] text-3xl font-black tracking-wide text-[#1a5c2a]">
              NO<span className="text-[#6dd400]">O</span>ON
              <span className="text-[#4a6644] text-lg font-semibold ml-2">CAIXA</span>
            </span>
          </div>
          <p className="text-[#4a6644] text-sm tracking-widest uppercase">Gestão financeira pessoal</p>
        </div>

        {/* Card */}
        <div className="bg-[#111a14] border border-[rgba(109,212,0,0.1)] rounded-2xl p-6">
          <div className="flex gap-2 mb-6">
            {(['login', 'signup'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg font-['Barlow_Condensed'] font-bold text-sm uppercase tracking-wider transition-all ${
                  mode === m
                    ? 'bg-[rgba(109,212,0,0.1)] text-[#6dd400] border border-[rgba(109,212,0,0.3)]'
                    : 'text-[#4a6644] border border-[rgba(255,255,255,0.05)]'
                }`}>
                {m === 'login' ? 'Entrar' : 'Cadastrar'}
              </button>
            ))}
          </div>

          {mode === 'signup' && (
            <div className="mb-4">
              <label className="block text-[10px] font-bold text-[#4a6644] uppercase tracking-widest mb-2">Nome completo</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Seu nome"
                className="w-full bg-[#1e2a18] border border-[rgba(109,212,0,0.15)] rounded-lg px-3 py-2.5 text-[#e8f0e4] text-sm outline-none focus:border-[#6dd400] transition-colors placeholder:text-[#3a5030]" />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-[10px] font-bold text-[#4a6644] uppercase tracking-widest mb-2">E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full bg-[#1e2a18] border border-[rgba(109,212,0,0.15)] rounded-lg px-3 py-2.5 text-[#e8f0e4] text-sm outline-none focus:border-[#6dd400] transition-colors placeholder:text-[#3a5030]" />
          </div>

          <div className="mb-6">
            <label className="block text-[10px] font-bold text-[#4a6644] uppercase tracking-widest mb-2">Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full bg-[#1e2a18] border border-[rgba(109,212,0,0.15)] rounded-lg px-3 py-2.5 text-[#e8f0e4] text-sm outline-none focus:border-[#6dd400] transition-colors placeholder:text-[#3a5030]" />
          </div>

          {message && (
            <div className="mb-4 p-3 rounded-lg bg-[rgba(109,212,0,0.06)] border border-[rgba(109,212,0,0.15)] text-[#8aab80] text-xs">
              {message}
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading}
            className="w-full bg-[#6dd400] text-[#0d1410] py-3 rounded-xl font-['Barlow_Condensed'] font-black text-base uppercase tracking-wider disabled:opacity-50 transition-opacity hover:opacity-90">
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </div>

        <p className="text-center text-[#3a5030] text-xs mt-6">
          NOOON Caixa · HBusiness Group Tecnologia
        </p>
      </div>
    </div>
  )
}
