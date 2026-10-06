import { ArrowRight, Bot, Check, ChevronRight, Globe2, LockKeyhole, MessageCircle, Send, ShieldCheck, Sparkles, UsersRound, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type AuthMode = 'login' | 'register'

type AuthUser = {
  name?: string
  email?: string
}

const startAuth = () => {
  const redirectUri = `${window.location.origin}/manus-oauth/callback`
  window.location.assign(`/api/auth/start?redirectUri=${encodeURIComponent(redirectUri)}`)
}

const REVEAL_SELECTOR = [
  '.marketing-nav',
  '.hero-copy',
  '.hero-visual',
  '.logo-strip',
  '.section-intro',
  '.feature-card',
  '.workflow-card',
  '.security-section',
  '.marketing-cta-section',
].join(', ')

/** Adds scroll-reveal animations to the landing page sections (progressive enhancement). */
function useScrollReveal() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR))
    if (!targets.length) return
    if (typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    targets.forEach((target) => {
      target.setAttribute('data-reveal', '')
      if (target.classList.contains('feature-card')) {
        const index = Array.from(target.parentElement?.children ?? []).indexOf(target)
        target.style.setProperty('--reveal-delay', `${Math.max(index, 0) * 110}ms`)
      }
    })

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.08, rootMargin: '0px 0px -45px 0px' })

    // Double rAF so the hidden starting state paints first and the transition plays.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => targets.forEach((target) => observer.observe(target)))
    })

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])
}

/** Shows a loading notification for ~950ms after every interactive click. */
function useClickProcessing() {
  const [active, setActive] = useState(false)
  const [runId, setRunId] = useState(0)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target?.closest('a, button, [role="button"], [data-processing]')) return
      setRunId((current) => current + 1)
      setActive(true)
      window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setActive(false), 950)
    }

    document.addEventListener('click', handleClick, true)
    return () => {
      document.removeEventListener('click', handleClick, true)
      window.clearTimeout(timerRef.current)
    }
  }, [])

  return { active, runId }
}

function ProcessingOverlay() {
  return <>
    <div className="processing-progress" aria-hidden="true"><i /></div>
    <div className="processing-notice" role="status" aria-live="polite">
      <span className="processing-spinner" aria-hidden="true" />
      <span className="processing-copy"><strong>Memproses…</strong><small>Sistem sedang memproses permintaan Anda</small></span>
      <span className="processing-line" aria-hidden="true"><i /></span>
    </div>
  </>
}

export function LandingPage() {
  const processing = useClickProcessing()
  useScrollReveal()

  return <div className="marketing-shell">
    <header className="marketing-nav">
      <a className="marketing-brand" href="/" aria-label="SupportFlow home"><span className="brand-mark" aria-hidden="true"><span /><span /><i /></span><span><strong>SupportFlow</strong><small>AI support operations</small></span></a>
      <nav className="marketing-links" aria-label="Marketing navigation"><a href="#product">Product</a><a href="#how-it-works">How it works</a><a href="#security">Security</a></nav>
      <div className="marketing-actions"><a className="marketing-login" href="/login">Log in</a><a className="button button-primary marketing-cta" href="/register">Start free <ArrowRight size={15} /></a></div>
    </header>

    <main>
      <section className="marketing-hero">
        <div className="hero-copy"><span className="eyebrow compact"><span className="eyebrow-line" /> AI CUSTOMER SUPPORT, REWIRED</span><h1>Every conversation,<br /><em>handled with context.</em></h1><p>SupportFlow brings WhatsApp, Instagram, and web chat into one calm workspace — with grounded AI that knows when to answer and when to hand off.</p><div className="hero-actions"><a className="button button-primary marketing-large-cta" href="/register">Start free <ArrowRight size={16} /></a><a className="text-link" href="#product">See how it works <ChevronRight size={15} /></a></div><div className="hero-proof"><div className="proof-avatars"><span>MK</span><span>DL</span><span>SP</span><span>+2k</span></div><div><strong>Loved by support teams</strong><small>Built for fast-moving customer conversations</small></div></div></div><div className="hero-visual"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-console"><div className="console-top"><span><i /> All systems operational</span><small>AI resolution 72.4%</small></div><div className="console-thread"><div className="console-side"><strong>Inbox</strong><span className="console-count">12</span><div className="console-row active"><b>MK</b><span><strong>Mira Kusuma</strong><small>Can I change my delivery address?</small></span></div><div className="console-row"><b>DL</b><span><strong>Daniel Lim</strong><small>Do you ship to Singapore?</small></span></div><div className="console-row"><b>SP</b><span><strong>Sasha Petrov</strong><small>Thanks, that solved it.</small></span></div></div><div className="console-main"><div className="console-thread-head"><div className="console-person"><b>MK</b><span><strong>Mira Kusuma</strong><small>WhatsApp · Jakarta, ID</small></span></div><span className="handoff-pill">Human handoff</span></div><div className="console-bubbles"><div className="bubble customer">Can I change the delivery address after checkout?</div><div className="bubble ai"><span><Sparkles size={11} /> SupportFlow AI</span>I can help check that. Address changes may be possible before your order ships.</div><div className="console-confidence"><span>AI suggested reply</span><strong>92%</strong><i><b /></i></div></div><div className="console-input">Ask SupportFlow AI anything <SendIcon /></div></div></div></div></div></section>

      <section className="logo-strip"><span>One workspace for your whole support stack</span><div><strong>northstar</strong><strong>BRIGHTLINE</strong><strong>HELIOS</strong><strong>COMMON GOODS</strong></div></section>

      <section className="marketing-section" id="product"><div className="section-intro"><span className="eyebrow compact">ONE OPERATING PICTURE</span><h2>Less tab-switching.<br />More helpful answers.</h2><p>Turn every customer signal into a clear next action for your team.</p></div><div className="feature-grid"><FeatureCard icon={<MessageCircle size={18} />} tone="blue" title="Unified conversations" copy="Bring WhatsApp, Instagram, and web chat into one searchable inbox." /><FeatureCard icon={<Bot size={18} />} tone="mint" title="Grounded AI replies" copy="Give agents fast drafts backed by approved knowledge, not guesswork." /><FeatureCard icon={<UsersRound size={18} />} tone="orange" title="Human when it matters" copy="Route sensitive or low-confidence moments to the right person instantly." /></div></section>

      <section className="marketing-section workflow-section" id="how-it-works"><div className="workflow-card"><div><span className="eyebrow compact">THE SUPPORTFLOW LOOP</span><h2>Calm operations,<br /><em>even at volume.</em></h2><p>SupportFlow makes the right context visible before your team sends a reply.</p><a className="text-link" href="/register">Explore the workspace <ChevronRight size={15} /></a></div><div className="workflow-steps"><Step number="01" title="Connect every channel" copy="One inbox for the conversations already happening." /><Step number="02" title="Ground every answer" copy="Approved docs keep AI precise and on-brand." /><Step number="03" title="Hand off with confidence" copy="Agents see the full thread and the why behind every suggestion." /></div></div></section>

      <section className="marketing-section security-section" id="security"><div className="security-icon"><ShieldCheck size={23} /></div><div><span className="eyebrow compact">BUILT FOR TRUST</span><h2>AI that shows its work.</h2><p>Every suggested reply can carry its sources, confidence, and handoff signal — so your team stays in control.</p></div><div className="security-points"><span><Check size={14} /> Approved knowledge only</span><span><Check size={14} /> Human handoff controls</span><span><Check size={14} /> Multi-channel audit trail</span></div></section>

      <section className="marketing-cta-section"><span className="eyebrow compact">READY WHEN YOU ARE</span><h2>Your next best reply<br /><em>is already in context.</em></h2><a className="button button-primary marketing-large-cta" href="/register">Start free <ArrowRight size={16} /></a></section>
    </main>

    <footer className="marketing-footer"><a className="marketing-brand" href="/"><span className="brand-mark" aria-hidden="true"><span /><span /><i /></span><span><strong>SupportFlow</strong><small>AI support operations</small></span></a><span>© 2024 SupportFlow. Built for better conversations.</span><div><a href="/login">Log in</a><a href="/register">Create account</a></div></footer>
    <LandingChatWidget />
    {processing.active && <ProcessingOverlay key={processing.runId} />}
  </div>
}

type LandingChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

const LANDING_CONVERSATION_KEY = 'supportflow-landing-conversation'

const getLandingConversationId = () => {
  let id = window.localStorage.getItem(LANDING_CONVERSATION_KEY)
  if (!id) {
    id = `landing-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
    window.localStorage.setItem(LANDING_CONVERSATION_KEY, id)
  }
  return id
}

function LandingChatWidget() {
  const [open, setOpen] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [pending, setPending] = useState(false)
  const [handoff, setHandoff] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<LandingChatMessage[]>([
    { role: 'assistant', content: 'Hi there — how can we help today?' },
  ])
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || historyLoaded) return
    setHistoryLoaded(true)
    let active = true
    fetch(`/api/chat/public/history?conversationId=${encodeURIComponent(getLandingConversationId())}`)
      .then(async (response) => (response.ok ? response.json() as Promise<{ messages?: LandingChatMessage[] }> : null))
      .then((payload) => {
        if (active && payload?.messages?.length) setMessages(payload.messages)
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [open, historyLoaded])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight })
  }, [messages, pending, open])

  const send = async () => {
    const content = message.trim()
    if (!content || pending) return
    const nextMessages = [...messages, { role: 'user' as const, content }]
    setMessages(nextMessages)
    setMessage('')
    setPending(true)
    try {
      const response = await fetch('/api/chat/public', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId: getLandingConversationId(), messages: nextMessages }),
      })
      const payload = await response.json() as { message?: string; status?: string }
      if (!response.ok || !payload.message) throw new Error('AI response unavailable')
      const reply = payload.message
      setMessages((current) => [...current, { role: 'assistant', content: reply }])
      setHandoff(payload.status === 'HUMAN_HANDOFF')
    } catch {
      setMessages((current) => [...current, { role: 'assistant', content: 'I’m sorry — I couldn’t reach the AI service. Please try again or request a human agent.' }])
    } finally {
      setPending(false)
    }
  }

  return <>
    {open && <section className="landing-widget" aria-label="SupportFlow chat widget">
      <header className="landing-widget-head">
        <div className="widget-logo"><Sparkles size={14} /></div>
        <div><strong>SupportFlow AI</strong><span>{handoff ? 'Connecting you to our human team' : 'Usually replies instantly'}</span></div>
        <button onClick={() => setOpen(false)} aria-label="Close chat">×</button>
      </header>
      <div className="landing-widget-body" ref={bodyRef} aria-live="polite">
        {messages.map((entry, index) => <div className={`mini-chat ${entry.role === 'user' ? 'outgoing' : 'incoming'}`} key={`${entry.role}-${index}`}>{entry.content}</div>)}
        {pending && <div className="typing-indicator"><span /><span /><span /><em>AI is typing…</em></div>}
      </div>
      <div className="landing-widget-input">
        <input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void send() }} placeholder={pending ? 'AI is typing…' : 'Write a message…'} aria-label="Chat message" disabled={pending} />
        <button onClick={() => void send()} aria-label="Send message" disabled={pending}><Send size={15} /></button>
      </div>
      <footer className="landing-widget-footer">{handoff ? <><UsersRound size={12} /> A human agent will join shortly</> : <><LockKeyhole size={12} /> Powered by SupportFlow AI</>}</footer>
    </section>}
    <button className="landing-widget-launcher" onClick={() => setOpen(!open)} aria-label={open ? 'Close chat' : 'Open chat'} aria-expanded={open}>
      {open ? '×' : <MessageCircle size={22} />}
    </button>
  </>
}

function FeatureCard({ icon, tone, title, copy }: { icon: React.ReactNode; tone: string; title: string; copy: string }) {
  return <article className="feature-card"><div className={`feature-icon ${tone}`}>{icon}</div><h3>{title}</h3><p>{copy}</p><a href="/register" aria-label={`Learn more about ${title}`}>Learn more <ArrowRight size={14} /></a></article>
}

function Step({ number, title, copy }: { number: string; title: string; copy: string }) {
  return <div className="workflow-step"><span>{number}</span><div><strong>{title}</strong><p>{copy}</p></div></div>
}

function SendIcon() { return <span className="send-icon"><ArrowRight size={13} /></span> }

export function AuthPage({ mode }: { mode: AuthMode }) {
  const isRegister = mode === 'register'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)

  useEffect(() => {
    fetch('/api/auth/providers').then(async (response) => {
      if (!response.ok) return
      const payload = await response.json() as { google?: boolean }
      setGoogleReady(Boolean(payload.google))
    }).catch(() => undefined)
  }, [])

  const submit = async () => {
    if (pending) return
    setError('')
    if (!email.trim() || !password) {
      setError('Email dan password wajib diisi.')
      return
    }
    setPending(true)
    try {
      const response = await fetch(isRegister ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(isRegister ? { name, email, password } : { email, password }),
      })
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Terjadi kesalahan')
      window.location.assign('/app')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Terjadi kesalahan')
    } finally {
      setPending(false)
    }
  }

  const GoogleIcon = () => <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>

  return <div className="auth-shell"><div className="auth-panel"><a className="marketing-brand auth-brand" href="/"><span className="brand-mark" aria-hidden="true"><span /><span /><i /></span><span><strong>SupportFlow</strong><small>AI support operations</small></span></a><div className="auth-copy"><span className="eyebrow compact">{isRegister ? 'START YOUR WORKSPACE' : 'WELCOME BACK'}</span><h1>{isRegister ? 'Build a support team that feels one step ahead.' : 'Good support starts with the full picture.'}</h1><p>{isRegister ? 'Create your SupportFlow workspace and bring every customer conversation into context.' : 'Sign in to return to your conversations, knowledge, and AI-assisted workflows.'}</p></div><div className="auth-card"><div className="auth-card-icon"><Zap size={18} /></div><h2>{isRegister ? 'Create your account' : 'Log in to SupportFlow'}</h2>
    <form className="auth-form" onSubmit={(event) => { event.preventDefault(); void submit() }}>
      {isRegister && <label>Nama<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Nama Anda" /></label>}
      <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="nama@perusahaan.com" required /></label>
      <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder={isRegister ? 'Minimal 8 karakter' : 'Password Anda'} required /></label>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="button button-primary auth-button" type="submit" disabled={pending}>{pending ? 'Memproses…' : isRegister ? 'Buat akun' : 'Masuk'} <ArrowRight size={16} /></button>
    </form>
    <div className="auth-divider"><span>atau</span></div>
    {googleReady
      ? <a className="button button-secondary auth-button google-button" href="/api/auth/google/start"><GoogleIcon /> Masuk dengan Google</a>
      : <button className="button button-secondary auth-button google-button" type="button" disabled title="Login Google belum dikonfigurasi (GOOGLE_CLIENT_ID/SECRET)"><GoogleIcon /> Masuk dengan Google</button>}
    <small className="auth-note">Akun Anda tersimpan aman di database Turso kami.</small></div><div className="auth-switch">{isRegister ? 'Already have an account?' : 'New to SupportFlow?'} <a href={isRegister ? '/login' : '/register'}>{isRegister ? 'Log in' : 'Create an account'}</a></div></div><div className="auth-aside"><div className="auth-aside-orb" /><div className="auth-aside-content"><div className="auth-quote-mark">“</div><blockquote>SupportFlow gives our team the context to be helpful without slowing down.</blockquote><div className="quote-author"><span>MK</span><div><strong>Mira Kusuma</strong><small>Support lead · Northstar Goods</small></div></div></div><div className="auth-aside-footer"><Globe2 size={15} /> WhatsApp · Instagram · Web chat</div></div></div>
}

export function AuthCallbackPage() {
  const [message, setMessage] = useState('Completing secure sign-in…')
  useEffect(() => {
    fetch('/api/auth/session').then((response) => {
      if (response.ok) window.location.assign('/app')
      else setMessage('Sign-in could not be completed. Please return to login and try again.')
    }).catch(() => setMessage('Sign-in could not be completed. Please return to login and try again.'))
  }, [])
  return <div className="auth-callback"><div className="auth-callback-card"><div className="auth-card-icon"><Sparkles size={18} /></div><h1>SupportFlow</h1><p>{message}</p><a className="text-link" href="/login">Back to login <ArrowRight size={14} /></a></div></div>
}

export type { AuthUser }
