import { useEffect, useMemo, useState, useRef } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Clock3,
  Code2,
  Copy,
  Database,
  Eye,
  FileCheck2,
  FileText,
  Globe2,
  Headphones,
  Image,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  PanelRight,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  UploadCloud,
  UserRound,
  UsersRound,
  Zap,
} from 'lucide-react'
import { AuthCallbackPage, AuthPage, LandingPage } from './Marketing'
import './styles.css'

type NavItem = 'Overview' | 'Inbox' | 'Knowledge base' | 'Widget' | 'Analytics' | 'AI Agent' | 'Team' | 'Settings'
type AgentStatus = 'ready' | 'exhausted' | 'unconfigured' | 'disabled'

type AiAgent = {
  id: string
  name: string
  model: string
  apiUrl: string
  keyHint: string
  enabled: boolean
  status: AgentStatus
}

type AgentDraft = AiAgent & { apiKeyInput?: string }
type Channel = 'WhatsApp' | 'Instagram' | 'Web chat'
type ConversationStatus = 'AI active' | 'Needs handoff' | 'Agent controlled' | 'Resolved'
type MessageKind = 'customer' | 'ai' | 'agent'

type Attachment = {
  name: string
  url: string
  type: 'image' | 'pdf' | 'doc' | 'xls' | 'other'
}

type Message = {
  from: MessageKind
  text: string
  time: string
  attachment?: Attachment
}

type WidgetChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type Conversation = {
  id: string
  name: string
  initials: string
  avatar: string
  channel: Channel
  preview: string
  time: string
  unread: number
  status: ConversationStatus
  intent: string
  location: string
  customerType: string
  tags: string[]
  confidence: number
  sentiment: 'Positive' | 'Neutral' | 'At risk'
  firstResponse: string
  agentId?: string
  suggestion: string
  messages: Message[]
}

type KnowledgeDocument = {
  name: string
  type: string
  size: string
  status: 'Indexed' | 'Processing'
  updated: string
  chunks: string
}

const DEFAULT_SUGGESTION = 'Here’s a clear answer based on the latest support policy. I can also connect you with a specialist if you need help with anything else.'

const defaultAgents: AiAgent[] = [
  { id: 'primary', name: 'Primary · Managed LLM', model: 'gpt-5-mini', apiUrl: '', keyHint: '', enabled: true, status: 'unconfigured' },
]

const initialConversations: Conversation[] = [
  {
    id: 'mira',
    name: 'Mira Kusuma',
    initials: 'MK',
    avatar: 'avatar-coral',
    channel: 'WhatsApp',
    preview: 'Can I change the delivery address after checkout?',
    time: '2m',
    unread: 2,
    status: 'Needs handoff',
    intent: 'Change delivery address',
    location: 'Jakarta, ID',
    customerType: 'Returning customer',
    tags: ['delivery', 'order #8421'],
    confidence: 62,
    sentiment: 'At risk',
    firstResponse: '42 sec',
    suggestion: 'I can help with that. Address changes may be possible before your order ships. Let me check the order status and I’ll confirm the next step for you.',
    messages: [
      { from: 'customer', text: 'Hi! I just placed order #8421, but I noticed the delivery address is wrong.', time: '09:41' },
      { from: 'ai', text: 'I can help check that for you. What would you like to update the address to?', time: '09:41' },
      { from: 'customer', text: 'Can I change the delivery address after checkout? It needs to go to my office instead.', time: '09:42' },
    ],
  },
  {
    id: 'daniel',
    name: 'Daniel Lim',
    initials: 'DL',
    avatar: 'avatar-blue',
    channel: 'Instagram',
    preview: 'The new collection looks great — do you ship to Singapore?',
    time: '8m',
    unread: 1,
    status: 'AI active',
    intent: 'Shipping availability',
    location: 'Singapore, SG',
    customerType: 'New customer',
    tags: ['shipping', 'new collection'],
    confidence: 94,
    sentiment: 'Positive',
    firstResponse: '8 sec',
    suggestion: DEFAULT_SUGGESTION,
    messages: [
      { from: 'customer', text: 'The new collection looks great — do you ship to Singapore?', time: '09:35' },
      { from: 'ai', text: 'Yes — we ship to Singapore. Standard delivery is 3–5 business days and express is 1–2 business days.', time: '09:35' },
    ],
  },
  {
    id: 'sasha',
    name: 'Sasha Petrov',
    initials: 'SP',
    avatar: 'avatar-lilac',
    channel: 'Web chat',
    preview: 'Thanks, that solved it. One more question about returns…',
    time: '16m',
    unread: 0,
    status: 'Resolved',
    intent: 'Return policy',
    location: 'Berlin, DE',
    customerType: 'Returning customer',
    tags: ['returns'],
    confidence: 97,
    sentiment: 'Positive',
    firstResponse: '11 sec',
    suggestion: DEFAULT_SUGGESTION,
    messages: [
      { from: 'customer', text: 'How long do I have to return an item?', time: '09:24' },
      { from: 'ai', text: 'You have 30 days from delivery to request a return. Items should be unused and in the original packaging.', time: '09:24' },
      { from: 'customer', text: 'Thanks, that solved it. One more question about returns…', time: '09:25' },
    ],
  },
  {
    id: 'noah',
    name: 'Noah Williams',
    initials: 'NW',
    avatar: 'avatar-mint',
    channel: 'Web chat',
    preview: 'I was charged twice for the same order.',
    time: '24m',
    unread: 0,
    status: 'Agent controlled',
    intent: 'Duplicate charge',
    location: 'Austin, US',
    customerType: 'VIP customer',
    tags: ['billing', 'urgent'],
    confidence: 55,
    sentiment: 'At risk',
    firstResponse: '1m 02s',
    suggestion: 'I’m checking the payment authorizations now. I’ll confirm whether one of the charges is only a temporary hold and update you shortly.',
    messages: [
      { from: 'customer', text: 'I was charged twice for the same order. Can someone please look into this?', time: '09:16' },
      { from: 'agent', text: 'Hi Noah — I’m looking into the duplicate authorization now. I’ll update you in a moment.', time: '09:17' },
    ],
  },
  {
    id: 'alyssa',
    name: 'Alyssa Chen',
    initials: 'AC',
    avatar: 'avatar-yellow',
    channel: 'WhatsApp',
    preview: 'Where can I find the care instructions for linen?',
    time: '31m',
    unread: 0,
    status: 'AI active',
    intent: 'Product care',
    location: 'Melbourne, AU',
    customerType: 'Returning customer',
    tags: ['care guide'],
    confidence: 91,
    sentiment: 'Neutral',
    firstResponse: '14 sec',
    suggestion: DEFAULT_SUGGESTION,
    messages: [
      { from: 'customer', text: 'Where can I find the care instructions for linen?', time: '09:09' },
      { from: 'ai', text: 'For linen, wash cold on a gentle cycle and lay flat or hang to dry. Avoid bleach and high heat.', time: '09:09' },
    ],
  },
]

const initialDocuments: KnowledgeDocument[] = [
  { name: 'Shipping & delivery policy.pdf', type: 'PDF', size: '1.2 MB', status: 'Indexed', updated: 'Today, 08:42', chunks: '148 chunks' },
  { name: 'Returns and exchanges.md', type: 'MD', size: '84 KB', status: 'Indexed', updated: 'Yesterday, 17:20', chunks: '62 chunks' },
  { name: 'Product care guide.txt', type: 'TXT', size: '42 KB', status: 'Indexed', updated: 'Sep 28, 12:16', chunks: '31 chunks' },
  { name: 'International shipping rates.pdf', type: 'PDF', size: '760 KB', status: 'Processing', updated: 'Just now', chunks: '—' },
]

function ChannelIcon({ channel, small = false }: { channel: Channel; small?: boolean }) {
  const iconProps = { size: small ? 13 : 15, strokeWidth: 2.2 }
  if (channel === 'Instagram') return <Camera {...iconProps} />
  if (channel === 'Web chat') return <Globe2 {...iconProps} />
  return <MessageCircle {...iconProps} />
}

function StatusBadge({ status, onClick }: { status: ConversationStatus; onClick?: () => void }) {
  const className = status.toLowerCase().replaceAll(' ', '-')
  return (
    <button type="button" className={`status-badge ${className}`} onClick={onClick} style={{ border: 'none' }}>
      <span className="status-dot" />
      {status}
    </button>
  )
}

function Avatar({ conversation, size = 'md' }: { conversation: Conversation; size?: 'sm' | 'md' | 'lg' }) {
  return <div className={`avatar ${conversation.avatar} avatar-${size}`}>{conversation.initials}</div>
}

const COMPOSER_MAX_HEIGHT = 114 // 3× tinggi textarea awal (38px); setelah ini textarea scroll sendiri (overflow)

const growComposer = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
  const element = event.currentTarget
  element.style.height = 'auto'
  element.style.height = `${Math.min(element.scrollHeight, COMPOSER_MAX_HEIGHT)}px`
}

function DashboardApp() {
  const path = window.location.pathname
  const initialNav: NavItem = path.includes('agents') ? 'AI Agent' : path.includes('knowledge') ? 'Knowledge base' : path.includes('widget') ? 'Widget' : path.includes('analytics') ? 'Analytics' : path.includes('inbox') ? 'Inbox' : 'Overview'
  const [activeNav, setActiveNav] = useState<NavItem>(initialNav)
  const [collapsed, setCollapsed] = useState(false)
  const [conversations, setConversations] = useState(initialConversations)
  const [documents, setDocuments] = useState(initialDocuments)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'All' | ConversationStatus>('All')
  const [composer, setComposer] = useState('')
  const [widgetOpen, setWidgetOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [agents, setAgents] = useState<AiAgent[]>(defaultAgents)
  const [autoFallback, setAutoFallback] = useState(true)
  const [savingAgents, setSavingAgents] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const selected = selectedId ? conversations.find((conversation) => conversation.id === selectedId) ?? null : null
  const activeAgent = useMemo(() => {
    if (!selected) return null
    const explicit = selected.agentId ? agents.find((agent) => agent.id === selected.agentId) : undefined
    return explicit ?? agents.find((agent) => agent.enabled && agent.status === 'ready') ?? agents.find((agent) => agent.enabled) ?? null
  }, [agents, selected])

  const handleNewConversation = () => {
    setConversations((current) => {
      const newId = `new-${Date.now()}`
      const base = current[0]
      const nextConv: Conversation = {
        ...base,
        id: newId,
        name: 'New contact',
        initials: 'NC',
        avatar: base.avatar,
        channel: 'WhatsApp',
        preview: 'Type a message to start the conversation...',
        status: 'AI active',
        unread: 0,
        location: 'Jakarta, ID',
        customerType: 'New customer',
        tags: [],
        confidence: 95,
        sentiment: 'Positive',
        firstResponse: 'Pending',
        suggestion: DEFAULT_SUGGESTION,
        messages: [],
      }
      setSelectedId(newId)
      return [nextConv, ...current]
    })
    setToast('New conversation created')
  }

  const showToast = (value: string) => {
    setToast(value)
    window.setTimeout(() => setToast(''), 2600)
  }

  useEffect(() => {
    let active = true
    fetch('/api/agents').then(async (response) => {
      if (!response.ok) throw new Error('agents unavailable')
      const payload = await response.json() as { agents?: AiAgent[]; autoFallback?: boolean }
      if (active && Array.isArray(payload.agents) && payload.agents.length) {
        setAgents(payload.agents)
        setAutoFallback(payload.autoFallback !== false)
      }
    }).catch(() => undefined)
    return () => { active = false }
  }, [])

  const assignAgent = (agentId: string) => {
    const agent = agents.find((item) => item.id === agentId)
    if (!agent || !selected) return
    const applyAgent = (id: string) => setConversations((current) => current.map((conversation) => conversation.id === selected.id ? { ...conversation, agentId: id } : conversation))
    if (agent.status === 'exhausted' && autoFallback) {
      const fallback = agents.find((item) => item.enabled && item.status === 'ready' && item.id !== agent.id)
      if (!fallback) {
        showToast(`Quota ${agent.name} exhausted · no backup agent available`)
        return
      }
      applyAgent(fallback.id)
      showToast(`Quota ${agent.name} exhausted · router switched to ${fallback.name} automatically`)
      return
    }
    if (agent.status === 'exhausted') {
      showToast(`Quota ${agent.name} exhausted · auto-switch is off`)
      return
    }
    applyAgent(agent.id)
    showToast(`${agent.name} now handles this conversation`)
  }

  const saveAgentSettings = async (draft: AgentDraft[], nextAutoFallback: boolean) => {
    setSavingAgents(true)
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agents: draft.map((agent) => ({ id: agent.id, name: agent.name, model: agent.model, apiUrl: agent.apiUrl, enabled: agent.enabled, apiKey: agent.apiKeyInput?.trim() || undefined })),
          autoFallback: nextAutoFallback,
        }),
      })
      const payload = await response.json() as { agents?: AiAgent[]; autoFallback?: boolean; error?: string }
      if (!response.ok || !Array.isArray(payload.agents)) throw new Error(payload.error ?? 'Save failed')
      setAgents(payload.agents)
      setAutoFallback(payload.autoFallback !== false)
      showToast('AI agent settings saved')
    } catch {
      showToast('Could not save agent settings · check your session')
    } finally {
      setSavingAgents(false)
    }
  }

  const regenerateSuggestion = async () => {
    if (!selected || regenerating) return
    const chatMessages: WidgetChatMessage[] = []
    for (const message of selected.messages) {
      chatMessages.push({ role: message.from === 'customer' ? 'user' : 'assistant', content: message.text })
    }
    while (chatMessages.length && chatMessages[chatMessages.length - 1].role !== 'user') chatMessages.pop()
    if (!chatMessages.length) {
      showToast('AI needs a customer message before it can draft a reply')
      return
    }
    setRegenerating(true)
    try {
      const response = await fetch('/api/chat/public', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId: `inbox:${selected.id}`, messages: chatMessages, agentId: activeAgent?.id }),
      })
      const payload = await response.json() as { message?: string; error?: string; agent?: { id: string; name: string }; switchedFrom?: string | null }
      if (!response.ok || !payload.message) throw new Error(payload.error ?? 'AI suggestion unavailable')
      const suggested = payload.message
      setConversations((current) => current.map((conversation) => conversation.id === selected.id ? { ...conversation, suggestion: suggested } : conversation))
      const answeredBy = payload.agent?.name ?? 'Knowledge Base fallback'
      showToast(payload.switchedFrom ? `Quota ${payload.switchedFrom} exhausted · routed to ${answeredBy}` : `Suggestion generated by ${answeredBy}`)
    } catch {
      showToast('AI suggestion unavailable · try again shortly')
    } finally {
      setRegenerating(false)
    }
  }

  const filteredConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      const matchesQuery = `${conversation.name} ${conversation.preview} ${conversation.channel}`.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFilter = filter === 'All' || conversation.status === filter
      return matchesQuery && matchesFilter
    })
  }, [conversations, filter, searchQuery])

  const navigate = (item: NavItem) => {
    setActiveNav(item)
    const route = item === 'Overview' ? '/app' : item === 'Inbox' ? '/app/inbox' : item === 'Knowledge base' ? '/app/knowledge' : item === 'Widget' ? '/app/widget' : item === 'AI Agent' ? '/app/agents' : '/app/analytics'
    window.history.replaceState({}, '', route)
  }

  const updateSelectedStatus = (status: ConversationStatus, message: string) => {
    setConversations((current) => current.map((conversation) => conversation.id === selected?.id ? { ...conversation, status } : conversation))
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }

  const sendMessage = (attachment?: Attachment) => {
    if (!composer.trim() && !attachment) return
    const text = composer.trim()
    const attPreview = attachment?.type === 'image' ? attachment.url : attachment?.name || 'File attachment'
    setConversations((current) => current.map((conversation) => conversation.id === selected?.id ? {
      ...conversation,
      status: 'Agent controlled',
      preview: text || attPreview,
      time: 'now',
      messages: [...conversation.messages, { from: 'agent', text, time: '09:48', ...(attachment ? { attachment } : {}) }],
    } : conversation))
    setComposer('')
    setToast('Reply sent · AI paused for this thread')
    window.setTimeout(() => setToast(''), 2400)
  }

  const addDocument = () => {
    setDocuments((current) => [{ name: 'New support document.md', type: 'MD', size: 'Uploading…', status: 'Processing', updated: 'Just now', chunks: '—' }, ...current])
    setToast('Document added to the indexing queue')
    window.setTimeout(() => setToast(''), 2400)
  }

  return (
    <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span /><span /><i /></div>
          <div><div className="brand-name">SupportFlow</div><div className="brand-subtitle">AI support operations</div></div>
          <button className="collapse-toggle" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-avatar">N</div>
          <div className="workspace-copy"><strong>Northstar Goods</strong><span>Workspace · Pro</span></div>
          <ChevronDown size={15} />
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          <div className="nav-label">Workspace</div>
          <NavButton icon={<LayoutDashboard size={17} />} label="Overview" active={activeNav === 'Overview'} onClick={() => navigate('Overview')} />
          <NavButton icon={<Inbox size={17} />} label="Inbox" active={activeNav === 'Inbox'} count="12" onClick={() => navigate('Inbox')} />
          <NavButton icon={<Database size={17} />} label="Knowledge base" active={activeNav === 'Knowledge base'} onClick={() => navigate('Knowledge base')} />
          <NavButton icon={<Code2 size={17} />} label="Widget" active={activeNav === 'Widget'} onClick={() => navigate('Widget')} />
          <NavButton icon={<BarChart3 size={17} />} label="Analytics" active={activeNav === 'Analytics'} onClick={() => navigate('Analytics')} />
          <div className="nav-label nav-label-spaced">Manage</div>
          <NavButton icon={<Bot size={17} />} label="AI Agent" active={activeNav === 'AI Agent'} count={String(agents.filter((agent) => agent.enabled).length)} onClick={() => navigate('AI Agent')} />
          <NavButton icon={<UsersRound size={17} />} label="Team" active={activeNav === 'Team'} onClick={() => navigate('Team')} />
          <NavButton icon={<Settings2 size={17} />} label="Settings" active={activeNav === 'Settings'} onClick={() => navigate('Settings')} />
        </nav>

        <div className="sidebar-bottom">
          <div className="upgrade-card"><div className="upgrade-icon"><Zap size={15} /></div><div><strong>AI usage</strong><span>68% of monthly credits</span></div><ArrowUpRight size={15} /></div>
          <div className="sidebar-user"><div className="user-avatar">AR</div><div><strong>Ayunda Rahma</strong><span>Admin</span></div><MoreHorizontal size={17} /></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Northstar Goods</span><ChevronRight size={14} /><strong>{activeNav}</strong></div>
          <div className="topbar-actions"><div className="live-pill"><span className="live-pulse" /> All systems operational</div><button className="icon-button" aria-label="Help"><CircleHelp size={18} /></button><button className="icon-button" aria-label="Notifications"><span className="notification-dot" /><LifeBuoy size={18} /></button><a className="logout-link" href="/manus-oauth/logout">Log out</a></div>
        </header>

        <div className="page-wrap">
          {activeNav !== 'Inbox' && <div className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> TODAY · WEDNESDAY, 17 APR</div><h1>{activeNav}</h1><p>{activeNav === 'Overview' ? 'Ringkasan performa support & AI dalam 7 hari terakhir.' : activeNav === 'Knowledge base' ? 'Keep the AI grounded in your latest support knowledge.' : activeNav === 'Widget' ? 'Give every visitor a fast, human-feeling answer.' : activeNav === 'AI Agent' ? 'Pick which AI agents answer — the router fails over automatically when quota runs out.' : activeNav === 'Team' ? 'Kelola anggota tim support & role akses mereka.' : activeNav === 'Settings' ? 'Konfigurasi workspace, channel, notifikasi & integrasi.' : 'See how your support system is performing.'}</p></div>
          </div>}

          {activeNav === 'Inbox' && <div className="inbox-fullscreen"><InboxView selected={selected} conversations={filteredConversations} selectedId={selectedId} searchQuery={searchQuery} setSearchQuery={setSearchQuery} filter={filter} setFilter={setFilter} setSelectedId={setSelectedId} composer={composer} setComposer={setComposer} sendMessage={sendMessage} updateSelectedStatus={updateSelectedStatus} setToast={setToast} onNewConversation={handleNewConversation} agents={agents} autoFallback={autoFallback} activeAgent={activeAgent} onAssignAgent={assignAgent} onRegenerate={regenerateSuggestion} regenerating={regenerating} onManageAgents={() => navigate('AI Agent')} /></div>}
          {activeNav === 'Overview' && <OverviewView />}
          {activeNav === 'Knowledge base' && <KnowledgeView documents={documents} addDocument={addDocument} setToast={setToast} />}
          {activeNav === 'AI Agent' && <AgentsView agents={agents} autoFallback={autoFallback} saving={savingAgents} onSave={saveAgentSettings} />}
          {activeNav === 'Team' && <TeamView setToast={setToast} />}
          {activeNav === 'Settings' && <SettingsView setToast={setToast} />}
          {activeNav === 'Widget' && <WidgetView widgetOpen={widgetOpen} setWidgetOpen={setWidgetOpen} setToast={setToast} />}
          {activeNav === 'Analytics' && <AnalyticsView agents={agents} />}
        </div>
      </main>

      {toast && <div className="toast"><CheckCircle2 size={17} /> {toast}</div>}
    </div>
  )
}

function NavButton({ icon, label, active, count, onClick }: { icon: React.ReactNode; label: string; active?: boolean; count?: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{count && <em>{count}</em>}<span className="nav-tooltip" aria-hidden="true">{label}</span></button>
}

function ButtonDropdown({ actions, conversationId, onClose }: { actions: Array<{ label: string, onClick: () => void }>, conversationId: string, onClose: () => void }) {
  return <div style={{ position: 'relative' }}>
    <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', zIndex: 100, minWidth: '150px', background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 8px 20px rgba(0,0,0,0.12)', padding: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {actions.map((action, index) => <button key={index} onClick={(e: React.MouseEvent) => { e.stopPropagation(); action.onClick(); onClose() }} style={{ all: 'unset', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: '9px', color: '#6e7670', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {action.label}
      </button>)}
    </div>
  </div>
}

function MetricCard({ label, value, trend, trendLabel, icon, tone }: { label: string; value: string; trend: string; trendLabel: string; icon: React.ReactNode; tone: string }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small><b className={tone === 'orange' || tone === 'lilac' ? 'neutral-trend' : ''}>{trend}</b> {trendLabel}</small></div><ArrowUpRight className="metric-arrow" size={15} /></div>
}

function InboxView({ selected, conversations, selectedId, searchQuery, setSearchQuery, filter, setFilter, setSelectedId, composer, setComposer, sendMessage, updateSelectedStatus, setToast, onNewConversation, agents, autoFallback, activeAgent, onAssignAgent, onRegenerate, regenerating, onManageAgents }: { selected: Conversation | null; conversations: Conversation[]; selectedId: string | null; searchQuery: string; setSearchQuery: (value: string) => void; filter: 'All' | ConversationStatus; setFilter: (value: 'All' | ConversationStatus) => void; setSelectedId: (value: string) => void; composer: string; setComposer: (value: string) => void; sendMessage: (attachment?: Attachment | undefined) => void; updateSelectedStatus: (status: ConversationStatus, message: string) => void; setToast: (value: string) => void; onNewConversation?: () => void; agents: AiAgent[]; autoFallback: boolean; activeAgent: AiAgent | null; onAssignAgent: (agentId: string) => void; onRegenerate: () => void; regenerating: boolean; onManageAgents: () => void }) {
  const [activeThreadDropdown, setActiveThreadDropdown] = useState<string | null>(null)
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [attachment, setAttachment] = useState<{ name: string; url: string; type: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => { setAttachment(null) }, [selectedId])

  useEffect(() => { if (!composer && composerTextareaRef.current) composerTextareaRef.current.style.height = '' }, [composer])

  const pickFile = (file: File | undefined) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setToast('File must be under 5 MB'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result)
      const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('application/') ? 'doc' : 'other'
      setAttachment(prev => ({ name: file.name, url, type }))
    }
    reader.readAsDataURL(file)
  }

  const handleSend = () => {
    if (attachment) {
      sendMessage(attachment as Attachment)
      setAttachment(null)
      return
    }
    sendMessage()
  }

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!activeThreadDropdown) return
      const target = event.target as Element
      if (!target) return
      const container = document.querySelector(`[data-app-id="${activeThreadDropdown}"]`)
      if (container && container.contains(target)) return
      setActiveThreadDropdown(null)
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveThreadDropdown(null)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onEscape)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onEscape)
    }
  }, [activeThreadDropdown])

  useEffect(() => {
    const closeFilterMenu = (event: MouseEvent) => {
      if (!filterMenuOpen) return
      const target = event.target as Element
      if (!target) return
      if (target.closest('[data-filter-menu]')) return
      setFilterMenuOpen(false)
    }
    window.addEventListener('mousedown', closeFilterMenu)
    return () => window.removeEventListener('mousedown', closeFilterMenu)
  }, [filterMenuOpen])

  function handleMarkAsRead() {
    setToast('Conversation marked as read')
    setActiveThreadDropdown(null)
  }
  function handleArchive() {
    setToast('Conversation archived')
    setActiveThreadDropdown(null)
  }
  function handleDelete() {
    setToast('Conversation deleted')
    setActiveThreadDropdown(null)
  }

  return <div className="inbox-layout">
    <section className="conversation-panel panel">
      <div className="panel-heading"><div><h2>Conversations</h2><span className="heading-count">128 open</span></div><div className="panel-heading-actions"><button className="button button-primary small" onClick={() => { onNewConversation?.() ; setToast('New conversation created') }}><Plus size={14} /> New</button><div data-filter-menu style={{ position: 'relative' }}><button className="icon-button subtle" aria-label="Filter conversations" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setFilterMenuOpen(!filterMenuOpen) }}><SlidersHorizontal size={17} /></button>
      {filterMenuOpen && <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 100, minWidth: '150px', background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 8px 20px rgba(0,0,0,0.12)', padding: '6px' }}>
        {['All', 'Needs handoff', 'Unread'].map((label, idx) => <button key={idx} onClick={() => {
            if (label === 'Unread') setFilter('All')
            else setFilter(label as 'All' | ConversationStatus)
            setFilterMenuOpen(false)
            setToast(`Filter: ${label}`)
          }} style={{ all: 'unset', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: '9px', color: '#6e7670', borderRadius: '6px', cursor: 'pointer' }}>{label}</button>)}
      </div>}</div></div></div>
      <div className="search-field"><Search size={16} /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" /><kbd>⌘ K</kbd></div>
      <div className="filter-row"><FilterChip label="All" active={filter === 'All'} count="128" onClick={() => setFilter('All')} /><FilterChip label="Needs handoff" active={filter === 'Needs handoff'} count="12" onClick={() => setFilter('Needs handoff')} /><FilterChip label="Unread" active={false} count="6" onClick={() => setFilter('All')} /></div>
      <div className="conversation-list">{conversations.map((conversation) => <ConversationRow key={conversation.id} conversation={conversation} active={conversation.id === selectedId} onClick={() => { setSelectedId(conversation.id); window.history.pushState({}, '', `/app/inbox/${conversation.id}`); window.dispatchEvent(new PopStateEvent('popstate')) }} />)}{conversations.length === 0 && <div className="empty-state"><Search size={24} /><strong>No conversations found</strong><span>Try a different search or filter.</span></div>}</div>
      <div className="list-footer"><span>Showing {conversations.length} of 128</span><button>View all <ArrowUpRight size={13} /></button></div>
    </section>

    {selected ? <section className="thread-panel panel">
      <div className="thread-header"><div className="contact-summary"><Avatar conversation={selected!} size="lg" /><div><div className="contact-name-row"><h2>{selected!.name}</h2></div></div></div><div className="thread-meta"><span className="channel-label"><ChannelIcon channel={selected!.channel} small /> {selected!.channel}</span><span className="contact-location">{selected!.location}</span></div><div className="thread-actions"><AgentSelect agents={agents.filter((agent) => agent.enabled)} activeAgent={activeAgent} autoFallback={autoFallback} onAssign={onAssignAgent} onManage={onManageAgents} /><StatusBadge status={selected!.status} onClick={() => {
            const next = selected!.status === 'AI active' ? 'Needs handoff' : selected!.status === 'Needs handoff' ? 'Agent controlled' : selected!.status === 'Agent controlled' ? 'Resolved' : 'AI active'
            updateSelectedStatus(next, next === 'AI active' ? 'AI activated' : next === 'Needs handoff' ? 'Needs handoff flagged' : next === 'Agent controlled' ? 'You took over the conversation' : 'Conversation resolved')
          }} />
            <div data-app-id={selected!.id} style={{ position: 'relative' }}>
              <button className="button button-secondary small" type="button" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setActiveThreadDropdown(activeThreadDropdown === selected!.id ? null : selected!.id) }}>{activeThreadDropdown === selected!.id ? 'X' : 'More...'}</button>
              {activeThreadDropdown === selected!.id && <ButtonDropdown actions={[
                { label: 'Mark as read', onClick: handleMarkAsRead },
                { label: 'Archive', onClick: handleArchive },
                { label: 'Delete', onClick: handleDelete }
              ]} conversationId={selected!.id} onClose={() => setActiveThreadDropdown(null)} />}
            </div>
          </div></div>
      {selected!.status === 'Needs handoff' && <div className="handoff-banner"><div className="handoff-banner-icon"><AlertTriangle size={17} /></div><div><strong>Human handoff recommended</strong><span>An agent should review before sending.</span></div><button onClick={() => updateSelectedStatus('Agent controlled', 'You took over the conversation')}>Take over <ArrowUpRight size={14} /></button></div>}
      <div className="thread-body"><div className="date-divider"><span>Today</span></div>{selected!.messages.map((message, index) => <MessageBubble key={`${selected!.id}-${index}`} message={message} conversation={selected} />)}<TypingIndicator /></div>
      <div className="reply-assistant"><div className="assistant-title"><div className="assistant-label"><div className="sparkle-icon"><Sparkles size={15} /></div><strong>AI suggested reply</strong><span>· {activeAgent?.name ?? 'auto router'}</span></div><button className="button button-ghost small" onClick={() => setComposer(selected!.suggestion)}>Edit response</button></div>
        <p>{selected!.suggestion}</p>
        <div className="assistant-actions"><button className="button button-primary small" onClick={() => setComposer(selected!.suggestion)}><Sparkles size={14} /> Use reply</button><button className="button button-secondary small" onClick={onRegenerate} disabled={regenerating}><RefreshCw size={13} /> {regenerating ? 'Generating…' : 'Regenerate'}</button></div>
      </div>
      <div className="composer"><div className="composer-top"><span className="composer-mode"><Bot size={14} /> {selected!.status === 'Agent controlled' ? 'Agent reply' : 'AI assisted reply'}{activeAgent ? ` · ${activeAgent.name}` : ''} <ChevronDown size={13} /></span><span className="composer-hint">Press ⌘ + Enter to send</span></div><textarea ref={composerTextareaRef} value={composer} onChange={(event) => { setComposer(event.target.value); growComposer(event) }} onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) handleSend() }} placeholder="Write a reply…" aria-label="Write a reply" />{attachment && <div className="composer-attachment">{attachment.type === 'image' ? <img src={attachment.url} alt={attachment.name} /> : <span><div className="attachment-icon"><FileText size={16} /></div>{attachment.name}</span>}<button type="button" aria-label="Remove attachment" onClick={() => setAttachment(null)}>×</button></div>}<div className="composer-bottom"><div className="composer-tools"><button aria-label="Attach file" onClick={() => fileInputRef.current?.click()}><Paperclip size={16} /></button><button aria-label="Attach image" onClick={() => imageInputRef.current?.click()}><Image size={16} /></button></div><button className="send-button" onClick={handleSend}><Send size={15} /> Send reply</button></div><input ref={fileInputRef} type="file" accept="*" hidden onChange={(event) => { pickFile(event.target.files?.[0]); event.target.value = '' }} /><input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => { pickFile(event.target.files?.[0]); event.target.value = '' }} /></div>
    </section> : <section className="thread-panel panel"><div className="empty-state"><MessageCircle size={42} /><strong style={{ fontSize: '14px' }}>No conversation selected</strong><span style={{ fontSize: '11px' }}>Choose a conversation or click New to start</span></div></section>}

    {selected && <aside className="context-panel">
      <div className="context-header"><div><span className="eyebrow compact">CONVERSATION CONTEXT</span><h2>Customer details</h2></div><button className="icon-button subtle" aria-label="Close context panel"><PanelRight size={17} /></button></div>
      <div className="customer-card"><Avatar conversation={selected!} size="md" /><div><strong>{selected!.name}</strong><span>{selected!.customerType}</span></div><button className="icon-button subtle" aria-label="Customer actions"><MoreHorizontal size={17} /></button></div>
      <div className="detail-grid"><div><span>Location</span><strong>{selected!.location}</strong></div><div><span>First response</span><strong>{selected!.firstResponse}</strong></div><div><span>Sentiment</span><strong className={`sentiment ${selected!.sentiment.toLowerCase().replaceAll(' ', '-')}`}>{selected!.sentiment}</strong></div><div><span>Last seen</span><strong>Just now</strong></div></div>
      <div className="context-section"><div className="section-title"><span>Tags</span><button className="text-button"><Plus size={13} /> Add</button></div><div className="tag-row">{selected!.tags.map((tag) => <span className="tag" key={tag}><Tag size={11} /> {tag}</span>)}</div></div>
      <div className="context-section"><div className="section-title"><span>Handoff control</span><span className="live-label"><span className="live-pulse" /> Live</span></div><div className="control-card"><div className="control-line"><div className="control-icon blue"><Bot size={15} /></div><div><strong>AI handling</strong><span>{selected!.status === 'Agent controlled' ? 'Paused by agent' : selected!.status === 'Resolved' ? 'Thread resolved' : 'Active on this thread'}</span></div><div className={`toggle ${selected!.status !== 'Agent controlled' && selected!.status !== 'Resolved' ? 'on' : ''}`}><span /></div></div><div className="control-divider" /><div className="control-line"><div className="control-icon orange"><Headphones size={15} /></div><div><strong>Human handoff</strong><span>{selected!.status === 'Needs handoff' ? 'Recommended' : 'Available to team'}</span></div><button className="assign-button" onClick={() => updateSelectedStatus(selected!.status === 'Agent controlled' ? 'AI active' : 'Agent controlled', selected!.status === 'Agent controlled' ? 'Conversation returned to AI' : 'You took over the conversation')}>{selected!.status === 'Agent controlled' ? 'Return to AI' : 'Take over'}</button></div></div></div>
      <div className="context-footer"><ShieldCheck size={15} /><span>AI replies are restricted to approved workspace sources.</span></div>
    </aside>}
  </div>
}

function ConversationPage({ path }: { path: string }) {
  const id = decodeURIComponent(path.split('/app/inbox/')[1] ?? 'mira')
  const [conversations, setConversations] = useState(initialConversations)
  const conversation = conversations.find((item) => item.id === id) ?? conversations[0]
  const [composer, setComposer] = useState('')
  const [attachment, setAttachment] = useState<{ name: string; url: string; type: string } | null>(null)
  const [toast, setToast] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => { if (!composer && composerTextareaRef.current) composerTextareaRef.current.style.height = '' }, [composer])

  const pickFile = (file: File | undefined) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setToast('File must be under 5 MB'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result)
      const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('application/') ? 'doc' : 'other'
      setAttachment(prev => ({ name: file.name, url, type }))
    }
    reader.readAsDataURL(file)
  }

  const handleSend = () => {
    if (!composer.trim() && !attachment) return
    const text = composer.trim()
    const attPreview = attachment?.type === 'image' ? attachment.url : attachment?.name || 'File attachment'
    setConversations((current) => current.map((item) => item.id === conversation.id ? {
      ...item,
      status: 'Agent controlled' as ConversationStatus,
      preview: text || attPreview,
      time: 'now',
      messages: [...item.messages, { from: 'agent' as const, text, time: '09:48', ...(attachment ? { attachment: attachment as Attachment } : {}) }],
    } : item))
    setComposer('')
    setAttachment(null)
    setToast('Reply sent · AI paused for this thread')
    window.setTimeout(() => setToast(''), 2400)
  }

  const takeOver = () => {
    setConversations((current) => current.map((item) => item.id === conversation.id ? { ...item, status: 'Agent controlled' as ConversationStatus } : item))
    setToast('You took over the conversation')
    window.setTimeout(() => setToast(''), 2400)
  }

  return (
    <div className="app-shell" style={{height:'100vh'}}>
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span /><span /><i /></div>
          <div><div className="brand-name">SupportFlow</div><div className="brand-subtitle">AI support operations</div></div>
        </div>
        <div className="workspace-switcher">
          <div className="workspace-avatar">N</div>
          <div className="workspace-copy"><strong>Northstar Goods</strong><span>Workspace · Pro</span></div>
          <ChevronDown size={15} />
        </div>
        <nav className="primary-nav" aria-label="Primary navigation">
          <div className="nav-label">Workspace</div>
          <NavButton icon={<LayoutDashboard size={17} />} label="Overview" onClick={() => { window.location.assign('/app'); }} />
          <NavButton icon={<Inbox size={17} />} label="Inbox" active onClick={() => { window.location.assign('/app'); }} />
          <NavButton icon={<Database size={17} />} label="Knowledge base" onClick={() => { window.location.assign('/app'); }} />
          <NavButton icon={<Code2 size={17} />} label="Widget" onClick={() => { window.location.assign('/app'); }} />
          <NavButton icon={<BarChart3 size={17} />} label="Analytics" onClick={() => { window.location.assign('/app'); }} />
          <div className="nav-label nav-label-spaced">Manage</div>
          <NavButton icon={<Bot size={17} />} label="AI Agent" onClick={() => { window.location.assign('/app'); }} />
          <NavButton icon={<UsersRound size={17} />} label="Team" onClick={() => { window.location.assign('/app'); }} />
          <NavButton icon={<Settings2 size={17} />} label="Settings" onClick={() => { window.location.assign('/app'); }} />
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade-card"><div className="upgrade-icon"><Zap size={15} /></div><div><strong>AI usage</strong><span>68% of monthly credits</span></div><ArrowUpRight size={15} /></div>
          <div className="sidebar-user"><div className="user-avatar">AR</div><div><strong>Ayunda Rahma</strong><span>Admin</span></div><MoreHorizontal size={17} /></div>
        </div>
      </aside>
      <main className="main-area" style={{height:'100vh', overflow:'hidden'}}>
        <div className="conversation-page" style={{height:'100%'}}>
          <div className="thread-panel panel">
            <div className="thread-header"><button className="back-button" aria-label="Back to inbox" onClick={() => { window.history.pushState({}, '', '/app') }}><ChevronLeft size={18} /></button><div className="contact-summary"><Avatar conversation={conversation} size="lg" /><div><div className="contact-name-row"><h2>{conversation.name}</h2></div></div></div><div className="thread-meta"><span className="channel-label"><ChannelIcon channel={conversation.channel} small /> {conversation.channel}</span><span className="contact-location">{conversation.location}</span></div><div className="thread-actions"><StatusBadge status={conversation.status} /><button className="icon-button subtle" aria-label="More conversation actions"><MoreHorizontal size={18} /></button></div></div>
            {conversation.status === 'Needs handoff' && <div className="handoff-banner"><div className="handoff-banner-icon"><AlertTriangle size={17} /></div><div><strong>Human handoff recommended</strong><span>An agent should review before sending.</span></div><button className="assign-button" onClick={takeOver}>Take over <ArrowUpRight size={14} /></button></div>}
            <div className="thread-body"><div className="date-divider"><span>Today</span></div>{conversation.messages.map((message, index) => <MessageBubble key={`${conversation.id}-${index}`} message={message} conversation={conversation} />)}<TypingIndicator /></div>
            <div className="composer"><div className="composer-top"><span className="composer-mode"><Bot size={14} /> {conversation.status === 'Agent controlled' ? 'Agent reply' : 'AI assisted reply'} <ChevronDown size={13} /></span><span className="composer-hint">Press ⌘ + Enter to send</span></div><textarea ref={composerTextareaRef} value={composer} onChange={(event) => { setComposer(event.target.value); growComposer(event) }} onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) handleSend() }} placeholder="Write a reply…" aria-label="Write a reply" />{attachment && <div className="composer-attachment">{attachment.type === 'image' ? <img src={attachment.url} alt={attachment.name} /> : <span><div className="attachment-icon"><FileText size={16} /></div>{attachment.name}</span>}<button type="button" aria-label="Remove attachment" onClick={() => setAttachment(null)}>×</button></div>}<div className="composer-bottom"><div className="composer-tools"><button aria-label="Attach file" onClick={() => fileInputRef.current?.click()}><Paperclip size={16} /></button><button aria-label="Attach image" onClick={() => imageInputRef.current?.click()}><Image size={16} /></button></div><button className="send-button" onClick={handleSend}><Send size={15} /> Send reply</button></div><input ref={fileInputRef} type="file" accept="*" hidden onChange={(event) => { pickFile(event.target.files?.[0]); event.target.value = '' }} /><input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => { pickFile(event.target.files?.[0]); event.target.value = '' }} /></div>
          </div>
        </div>
        {toast && <div className="toast"><CheckCircle2 size={17} /> {toast}</div>}
      </main>
    </div>
  )
}

function FilterChip({ label, active, count, onClick }: { label: string; active: boolean; count: string; onClick: () => void }) {
  return <button className={`filter-chip ${active ? 'active' : ''}`} onClick={onClick}>{label}<span>{count}</span></button>
}

function ConversationRow({ conversation, active, onClick }: { conversation: Conversation; active: boolean; onClick: () => void }) {
  return <button className={`conversation-row ${active ? 'active' : ''}`} onClick={onClick}><Avatar conversation={conversation} size="sm" /><div className="conversation-row-main"><div className="conversation-topline"><strong>{conversation.name}</strong><time>{conversation.time}</time></div><div className="conversation-preview">{conversation.preview}</div><div className="conversation-bottomline"><span className={`channel-label ${conversation.channel.toLowerCase().replaceAll(' ', '-')}`}><ChannelIcon channel={conversation.channel} small /> {conversation.channel}</span><StatusBadge status={conversation.status} /></div></div>{conversation.unread > 0 && <span className="unread-count">{conversation.unread}</span>}</button>
}function MessageBubble({ message, conversation }: { message: Message; conversation: Conversation }) {
  const isCustomer = message.from === 'customer'
  return <div className={`message-row ${isCustomer ? 'customer' : 'outbound'}`}><div className="message-avatar">{isCustomer ? <Avatar conversation={conversation} size="sm" /> : message.from === 'ai' ? <div className="mini-ai"><Bot size={14} /></div> : <div className="mini-agent">AR</div>}</div><div className="message-content"><div className="message-meta"><strong>{isCustomer ? conversation.name : message.from === 'ai' ? 'SupportFlow AI' : 'Ayunda · agent'}</strong><time>{message.time}</time>{message.from === 'ai' && <span className="ai-label"><Sparkles size={11} /> AI</span>}</div><div className={`message-bubble ${isCustomer ? 'customer-bubble' : message.from === 'ai' ? 'ai-bubble' : 'agent-bubble'}`}>{message.text}{message.attachment ? (message.attachment.type === 'image' ? <img className="message-image" src={message.attachment.url} alt={message.attachment.name} /> : <div className="attachment-line"><div className="message-attachment-icon"><FileText size={16} /></div><span>{message.attachment.name}</span></div>) : null}</div></div></div>
}

function TypingIndicator() {
  return <div className="typing-row"><div className="mini-ai"><Bot size={14} /></div><div className="typing-bubble"><span /><span /><span /></div><small>AI is ready with context</small></div>
}

function KnowledgeSource({ label, score }: { label: string; score: string }) {
  return <div className="knowledge-source"><div className="source-doc"><FileText size={14} /></div><div><strong>{label}</strong><span>Relevant passage · {score}</span></div><ChevronRight size={14} /></div>
}

function KnowledgeView({ documents, addDocument, setToast }: { documents: KnowledgeDocument[]; addDocument: () => void; setToast: (value: string) => void }) {
  return <div className="secondary-layout"><div className="section-toolbar actions-only"><div className="toolbar-actions"><button className="button button-secondary" onClick={() => setToast('Index is healthy · last sync 2m ago')}><RefreshCw size={15} /> Re-index all</button><button className="button button-primary" onClick={addDocument}><UploadCloud size={15} /> Add document</button></div></div><div className="knowledge-overview"><div className="knowledge-stat"><div className="knowledge-stat-icon blue"><Database size={18} /></div><div><span>Indexed content</span><strong>241</strong><small>chunks available to AI</small></div></div><div className="knowledge-stat"><div className="knowledge-stat-icon mint"><CheckCircle2 size={18} /></div><div><span>Retrieval quality</span><strong>92.8%</strong><small>top-3 relevance score</small></div></div><div className="knowledge-stat"><div className="knowledge-stat-icon orange"><Clock3 size={18} /></div><div><span>Last sync</span><strong>2m ago</strong><small>all systems operational</small></div></div></div><div className="table-card panel"><div className="table-heading"><div><h3>Source documents</h3><span>Only approved workspace documents can ground an AI reply.</span></div><button className="icon-button subtle"><SlidersHorizontal size={17} /></button></div><div className="document-table"><div className="document-row document-head"><span>Name</span><span>Type</span><span>Updated</span><span>Chunks</span><span>Status</span><span /></div>{documents.map((document) => <div className="document-row" key={document.name}><div className="document-name"><div className="document-icon"><FileText size={16} /></div><div><strong>{document.name}</strong><span>{document.size}</span></div></div><span className="file-type">{document.type}</span><span>{document.updated}</span><span>{document.chunks}</span><span className={`index-status ${document.status.toLowerCase()}`}><span className="status-dot" /> {document.status}</span><button className="icon-button subtle" aria-label={`More actions for ${document.name}`}><MoreHorizontal size={17} /></button></div>)}</div></div></div>
}

const WIDGET_EMBED_SNIPPET = [
  '<script src="https://unpkg.com/supportflow-widget/src/widget.js"></script>',
  '<script>',
  '  window.SUPPORTFLOW_WIDGET_CONFIG = {',
  '    baseUrl: "https://YOUR-SUPPORTFLOW-HOST",',
  '    conversationId: "your-conversation-id",',
  '    title: "Northstar concierge",',
  '    accentColor: "#4263eb",',
  '    endpoints: "*"',
  '  }',
  '</script>',
].join('\n')

function WidgetView({ widgetOpen, setWidgetOpen, setToast }: { widgetOpen: boolean; setWidgetOpen: (value: boolean) => void; setToast: (value: string) => void }) {
  const [widgetMessage, setWidgetMessage] = useState('')
  const [widgetPending, setWidgetPending] = useState(false)
  const [widgetHandoff, setWidgetHandoff] = useState(false)
  const [widgetMessages, setWidgetMessages] = useState<WidgetChatMessage[]>(() => {
    try {
      const stored = window.localStorage.getItem('supportflow-widget-history')
      return stored ? JSON.parse(stored) as WidgetChatMessage[] : [
        { role: 'assistant', content: 'Hi there — how can we help today?' },
        { role: 'user', content: 'I have a question about delivery' },
        { role: 'assistant', content: 'Happy to help. What can I look into?' },
      ]
    } catch {
      return [{ role: 'assistant', content: 'Hi there — how can we help today?' }]
    }
  })

  useEffect(() => {
    window.localStorage.setItem('supportflow-widget-history', JSON.stringify(widgetMessages))
  }, [widgetMessages])

  useEffect(() => {
    let active = true
    fetch('/api/chat/public/history?conversationId=northstar-widget-demo').then(async (response) => {
      if (!response.ok) return
      const payload = await response.json() as { messages?: WidgetChatMessage[] }
      if (active && Array.isArray(payload.messages) && payload.messages.length) setWidgetMessages(payload.messages)
    }).catch(() => undefined)
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    fetch('/api/conversations').then(async (response) => {
      if (!response.ok) return
      const payload = await response.json() as { data?: Array<{ id: string; status: string }> }
      const match = payload.data?.find((conversation) => conversation.id === 'northstar-widget-demo')
      if (active && match) setWidgetHandoff(match.status === 'HUMAN_HANDOFF')
    }).catch(() => undefined)
    return () => { active = false }
  }, [])

  const sendWidgetMessage = async () => {
    const content = widgetMessage.trim()
    if (!content || widgetPending) return
    const nextMessages = [...widgetMessages, { role: 'user' as const, content }]
    setWidgetMessages(nextMessages)
    setWidgetMessage('')
    setWidgetPending(true)
    try {
      const response = await fetch('/api/chat/public', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId: 'northstar-widget-demo', messages: nextMessages }),
      })
      const payload = await response.json() as { message?: string; error?: string; status?: string }
      if (!response.ok || !payload.message) throw new Error(payload.error ?? 'Live AI response unavailable')
      setWidgetMessages((current) => [...current, { role: 'assistant', content: payload.message ?? '' }])
      setWidgetHandoff(payload.status === 'HUMAN_HANDOFF')
      setToast(payload.status === 'HUMAN_HANDOFF' ? 'Dialihkan ke tim Customer Service' : 'Live AI response received')
    } catch {
      setWidgetMessages((current) => [...current, { role: 'assistant', content: 'I’m sorry — I couldn’t reach the AI service. Please try again or request a human agent.' }])
      setToast('Live AI unavailable · retry when ready')
    } finally {
      setWidgetPending(false)
    }
  }

  const copyEmbedCode = async () => {
    try {
      await navigator.clipboard.writeText(WIDGET_EMBED_SNIPPET)
      setToast('Embed snippet copied to clipboard')
    } catch {
      setToast('Gagal menyalin — blok kode lalu tekan Ctrl+C')
    }
  }

  return <div className="secondary-layout"><div className="section-toolbar actions-only"><div className="toolbar-actions"><button className="button button-secondary" onClick={copyEmbedCode}><Copy size={15} /> Copy embed code</button>            <button className="button button-primary" onClick={() => setWidgetOpen(!widgetOpen)}><Eye size={15} /> Preview widget</button></div></div><div className="widget-layout"><div className="widget-config panel"><div className="table-heading"><div><h3>Widget configuration</h3><span>Give visitors a clear path to a helpful answer.</span></div><div className="configured-pill"><Check size={13} /> Published</div></div><div className="config-form"><label>Widget name<input defaultValue="Northstar concierge" /></label><label>Welcome message<textarea defaultValue="Hi there — how can we help today?" /></label><div className="config-split"><label>Accent color<div className="color-input"><span className="color-swatch" /> #4263EB <ChevronDown size={14} /></div></label><label>Human handoff<div className="select-input">Enabled <ChevronDown size={14} /></div></label></div><div className="toggle-setting"><div><strong>Show AI confidence</strong><span>Let agents see the grounding signal before sending.</span></div><div className="toggle on"><span /></div></div><div className="toggle-setting"><div><strong>Collect contact details</strong><span>Ask for email when the visitor requests a human.</span></div><div className="toggle on"><span /></div></div><button className="button button-primary full" onClick={() => setToast('Widget settings saved')}>Save widget settings</button></div></div><div className="widget-preview-card panel"><div className="preview-label"><span><MonitorDot /> Live preview</span><span className="preview-status"><span className="live-pulse" /> Published</span></div><div className="browser-frame"><div className="browser-top"><span /><span /><span /><small>northstar-goods.com</small></div><div className="browser-page"><div className="fake-site-nav"><strong>SupportFlow</strong><span>Inbox</span><span>Knowledge</span><span>Widget</span><span>Analytics</span></div><div className="preview-dashboard"><div className="preview-dash-header"><div><strong>Dashboard utama</strong><span>Ringkasan operasional hari ini</span></div><span className="preview-pill">Live</span></div><div className="preview-stats"><div className="preview-stat"><span>Conversations</span><strong>1,284</strong><small>+12% vs kemarin</small></div><div className="preview-stat"><span>AI Resolved</span><strong>72.4%</strong><small>Target 70%</small></div><div className="preview-stat"><span>Handoff</span><strong>186</strong><small>Butuh tindak lanjut</small></div><div className="preview-stat"><span>Avg Response</span><strong>28s</strong><small>Dalam target</small></div></div><div className="preview-activity"><strong>Aktivitas terbaru</strong><div className="preview-activity-item"><span className="pa-dot blue" /><div><span>Pesan baru dari WhatsApp</span><small>1 menit lalu</small></div></div><div className="preview-activity-item"><span className="pa-dot mint" /><div><span>AI berhasil menyelesaikan tiket</span><small>5 menit lalu</small></div></div><div className="preview-activity-item"><span className="pa-dot orange" /><div><span>Dihubungkan ke CS (handoff)</span><small>12 menit lalu</small></div></div></div></div><div className="widget-launcher" onClick={() => setWidgetOpen(!widgetOpen)}><MessageCircle size={20} /></div>{widgetOpen && <div className="widget-mini"><div className="widget-mini-head"><div className="widget-logo"><Sparkles size={14} /></div><div><strong>Northstar concierge</strong><span>{widgetHandoff ? 'Terhubung ke tim Customer Service' : 'Usually replies instantly'}</span></div><button onClick={() => setWidgetOpen(false)}>×</button></div><div className="widget-mini-body" aria-live="polite">{widgetMessages.map((message, index) => <div className={`mini-chat ${message.role === 'user' ? 'outgoing' : 'incoming'}`} key={`${message.role}-${index}`}>{message.content}</div>)}{widgetPending && <div className="typing-indicator"><span /><span /><span /><em>AI is typing…</em></div>}</div><div className="widget-mini-input"><input value={widgetMessage} onChange={(event) => setWidgetMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void sendWidgetMessage() }} placeholder={widgetPending ? 'AI is typing…' : 'Write a message…'} aria-label="Widget message" disabled={widgetPending} /><button onClick={() => void sendWidgetMessage()} aria-label="Send widget message" disabled={widgetPending}><Send size={14} /></button></div></div>}</div></div></div></div><div className="install-card panel">
        <div className="table-heading"><div><h3>Pasang widget di aplikasi lain</h3><span>Tempel snippet ini ke halaman HTML aplikasi kamu — launcher widget muncul di pojok kanan bawah.</span></div><button className="button button-secondary small" onClick={copyEmbedCode}><Copy size={14} /> Salin kode</button></div>
        <div className="install-body">
          <ol className="install-steps">
            <li>Klik <strong>Salin kode</strong> untuk menyalin snippet di sebelahnya.</li>
            <li>Tempel sebelum tag <code>&lt;/body&gt;</code> pada halaman HTML aplikasi tujuan.</li>
            <li>Ganti <code>baseUrl</code> dengan URL backend SupportFlow kamu, dan isi <code>conversationId</code> biperlukan.</li>
            <li>Buka halaman tersebut — launcher widget siap dipakai.</li>
          </ol>
          <pre className="install-snippet"><code>{WIDGET_EMBED_SNIPPET}</code></pre>
          <div className="install-alt">Cara lain (proyek npm): <code>npm install supportflow-widget</code> lalu <code>npx supportflow-widget init</code>, atau dari React/Vue/Next.js panggil <code>{'SupportFlowWidget.init({ baseUrl, conversationId, title, accentColor })'}</code>.</div>
        </div>
      </div>
    </div>
}

type OverviewUnreadRow = { id: string; name: string; channel: Channel; preview: string; time: string; unread: number; status: ConversationStatus }

type OverviewData = {
  meta: { source: string; generatedAt: string }
  total: number
  statusCounts: Record<string, number>
  unanswered: number
  avgResponseSeconds: number | null
  aiResolvedPercent: number
  trendPercent: number | null
  series: Array<{ date: string; label: string; incoming: number; resolved: number }>
  channels: Record<Channel, number>
  unread: OverviewUnreadRow[]
}

const formatElapsed = (iso: string) => {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (!Number.isFinite(minutes) || minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes}m lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}j lalu`
  return `${Math.floor(hours / 24)}h lalu`
}

function OverviewView() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/overview')
      .then((response) => {
        if (!response.ok) throw new Error('Overview tidak tersedia')
        return response.json() as Promise<OverviewData>
      })
      .then((payload) => setData(payload))
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Overview tidak tersedia'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="secondary-layout"><div className="empty-state"><strong>Memuat overview…</strong><span>Mengambil data terbaru dari database.</span></div></div>
  if (loadError || !data) return <div className="secondary-layout"><div className="empty-state"><strong>Gagal memuat overview</strong><span>{loadError || 'Database tidak tersedia'}</span></div></div>

  const handoff = data.statusCounts.HUMAN_HANDOFF ?? 0
  const resolvedCount = data.statusCounts.RESOLVED ?? 0
  const unresolved = Math.max(0, data.total - resolvedCount - handoff)
  const trendValue = data.trendPercent == null ? '–' : `${data.trendPercent > 0 ? '+' : ''}${data.trendPercent}%`
  const trendLabel = data.trendPercent == null ? 'periode berjalan' : 'vs last week'
  const averageResponse = data.avgResponseSeconds == null ? '–' : `${data.avgResponseSeconds}s`
  const maxVolume = Math.max(1, ...data.series.map((day) => day.incoming))
  const yTicks = [0, 1, 2, 3, 4].map((step) => Math.round((maxVolume * (4 - step)) / 4))
  const waCount = data.channels['WhatsApp'] ?? 0
  const igCount = data.channels['Instagram'] ?? 0
  const webCount = data.channels['Web chat'] ?? 0
  const channelTotal = Math.max(1, waCount + igCount + webCount)
  const waPercent = (waCount / channelTotal) * 100
  const igPercent = (igCount / channelTotal) * 100
  const webPercent = 100 - waPercent - igPercent
  const donutStyle = { background: `conic-gradient(var(--blue) 0 ${waPercent}%, #a686dc ${waPercent}% ${waPercent + igPercent}%, #8dd8ba ${waPercent + igPercent}% 100%)` }
  const rounded = (value: number) => Math.round(value)

  return <div className="secondary-layout"><div className="metric-row"><MetricCard label="Total conversations" value={data.total.toLocaleString()} trend={trendValue} trendLabel={trendLabel} icon={<MessageCircle size={19} />} tone="blue" /><MetricCard label="Chat yang diarahkan" value={String(handoff)} trend="–" trendLabel="periode berjalan" icon={<AlertTriangle size={19} />} tone="orange" /><MetricCard label="Chat yang belum dibalas" value={String(data.unanswered)} trend="–" trendLabel="periode berjalan" icon={<Clock3 size={19} />} tone="purple" /><MetricCard label="AI resolved" value={`${data.aiResolvedPercent}%`} trend="–" trendLabel="periode berjalan" icon={<Sparkles size={19} />} tone="mint" /><MetricCard label="Needs handoff" value={String(handoff)} trend="–" trendLabel="periode berjalan" icon={<AlertTriangle size={19} />} tone="orange" /><MetricCard label="Avg. response time" value={averageResponse} trend="–" trendLabel="periode berjalan" icon={<Clock3 size={19} />} tone="lilac" /></div><div className="analytics-grid" style={{ marginTop: '16px' }}><div className="chart-card panel"><div className="chart-heading"><div><h3>Conversation volume</h3><span>{data.total} total conversations</span></div><div className="chart-legend"><span><i className="legend-dot blue-dot" /> Incoming</span><span><i className="legend-dot mint-dot" /> Resolved</span></div></div><div className="chart-area"><div className="y-labels">{yTicks.map((tick, index) => <span key={index}>{tick}</span>)}</div><div className="bars">{data.series.map((day) => <div className="bar-group" key={day.date}><div className="bar-stack"><span className="bar incoming" style={{ height: `${day.incoming === 0 ? 0 : Math.max(8, (day.incoming / maxVolume) * 100)}%` }} /><span className="bar resolved" style={{ height: `${day.resolved === 0 ? 0 : Math.max(8, (day.resolved / maxVolume) * 100)}%` }} /></div><small>{day.label}</small></div>)}</div></div></div><div className="performance-card panel"><div className="chart-heading"><div><h3>AI performance</h3><span>Live dari database</span></div><Sparkles size={18} color="#4263eb" /></div><div className="performance-score"><strong>{data.aiResolvedPercent}%</strong><span>AI resolution rate</span><div className="score-line"><span style={{ width: `${Math.min(100, data.aiResolvedPercent)}%` }} /></div></div><div className="performance-row"><span><span className="signal-dot green" /> Resolved by AI</span><strong>{resolvedCount}</strong></div><div className="performance-row"><span><span className="signal-dot orange" /> Human handoff</span><strong>{handoff}</strong></div><div className="performance-row"><span><span className="signal-dot gray" /> Unresolved</span><strong>{unresolved}</strong></div></div><div className="channel-card panel"><div className="chart-heading"><div><h3>Channel mix</h3><span>By conversations</span></div><MoreHorizontal size={18} /></div><div className="donut-wrap"><div className="donut" style={donutStyle}><div>{data.total}<strong>total</strong></div></div><div className="channel-legend"><span><i className="legend-dot blue-dot" /> WhatsApp <b>{rounded(waPercent)}%</b></span><span><i className="legend-dot purple-dot" /> Instagram <b>{rounded(igPercent)}%</b></span><span><i className="legend-dot mint-dot" /> Web chat <b>{rounded(webPercent)}%</b></span></div></div></div></div>
      <div className="table-card panel" style={{ marginTop: 16, gridColumn: '1 / -1' }}>
        <div className="table-heading"><div><h3>Pesan yang belum dibaca</h3><span>Chat dengan pesan belum dibaca</span></div></div>
        <div className="document-table">
          <div className="document-row document-head"><span>Pelanggan</span><span>Channel</span><span>Pesan terakhir</span><span>Waktu</span><span>Unread</span><span>Status</span><span>Aksi</span></div>
          {data.unread.length === 0 && <div className="document-row"><span>Tidak ada pesan yang belum dibaca</span></div>}
          {data.unread.map((row) => (
            <div className="document-row" key={row.id}>
              <div className="document-name"><div className="avatar avatar-sm avatar-blue">{row.name.slice(0, 2).toUpperCase()}</div><div><strong>{row.name}</strong><span>{row.channel}</span></div></div>
              <span><span className={`channel-label ${row.channel.toLowerCase().replace(/\s+/g, '-')} push-left`}><ChannelIcon channel={row.channel} small /> {row.channel}</span></span>
              <span className="cell-ellipsis">{row.preview}</span>
              <span className="cell-muted">{formatElapsed(row.time)}</span>
              <span><span className="unread-pill">{row.unread}</span></span>
              <span><span className={`status-badge ${row.status.toLowerCase().replaceAll(' ', '-')}`}><span className="status-dot" />{row.status}</span></span>
              <span><button className="button button-secondary small" onClick={() => { window.location.assign(`/app/inbox/${encodeURIComponent(row.id)}`) }}>Buka</button></span>
            </div>
          ))}
        </div>
      </div>
    </div>
}function AnalyticsView({ agents }: { agents: AiAgent[] }) {
  const tokenRows = agents.map((agent, idx) => {
    const base = 40000 + idx * 25000
    const prompt = Math.floor(base * 0.7)
    const completion = Math.floor(base * 0.3)
    const requests = 120 + idx * 40
    const total = prompt + completion
    const avg = requests > 0 ? Math.round(total / requests) : 0
    const cost = (total / 1000000) * 0.002
    const reports = Math.max(0, Math.floor((idx + 1) * 6 - (idx % 2) * 4))
    const repClass = reports >= 20 ? 'bad' : reports >= 10 ? 'warn' : 'ok'
    return { agent, prompt, completion, total, requests, avg, cost, reports, repClass }
  })

  return <div className="secondary-layout"><div className="section-toolbar actions-only"><div className="toolbar-actions"><button className="button button-secondary"><Clock3 size={15} /> Last 7 days <ChevronDown size={14} /></button><button className="button button-primary"><ArrowUpRight size={15} /> Export report</button></div></div><div className="analytics-grid"><div className="chart-card panel"><div className="chart-heading"><div><h3>Conversation volume</h3><span>1,284 total conversations</span></div><div className="chart-legend"><span><i className="legend-dot blue-dot" /> Incoming</span><span><i className="legend-dot mint-dot" /> Resolved</span></div></div><div className="chart-area"><div className="y-labels"><span>240</span><span>180</span><span>120</span><span>60</span><span>0</span></div><div className="bars">{[58, 74, 48, 86, 66, 92, 78].map((height, index) => <div className="bar-group" key={index}><div className="bar-stack"><span className="bar incoming" style={{ height: `${height}%` }} /><span className="bar resolved" style={{ height: `${Math.max(18, height - 22)}%` }} /></div><small>{['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'][index]}</small></div>)}</div></div></div><div className="performance-card panel"><div className="chart-heading"><div><h3>AI performance</h3><span>Last 7 days</span></div><Sparkles size={18} color="#4263eb" /></div><div className="performance-score"><strong>72.4%</strong><span>AI resolution rate</span><div className="score-line"><span style={{ width: '72.4%' }} /></div></div><div className="performance-row"><span><span className="signal-dot green" /> Resolved by AI</span><strong>930</strong></div><div className="performance-row"><span><span className="signal-dot orange" /> Human handoff</span><strong>186</strong></div><div className="performance-row"><span><span className="signal-dot gray" /> Unresolved</span><strong>168</strong></div><button className="text-button full-text">View resolution breakdown <ArrowUpRight size={14} /></button></div><div className="channel-card panel"><div className="chart-heading"><div><h3>Channel mix</h3><span>By conversations</span></div><MoreHorizontal size={18} /></div><div className="donut-wrap"><div className="donut"><div>1,284<strong>total</strong></div></div><div className="channel-legend"><span><i className="legend-dot blue-dot" /> WhatsApp <b>48%</b></span><span><i className="legend-dot purple-dot" /> Instagram <b>31%</b></span><span><i className="legend-dot mint-dot" /> Web chat <b>21%</b></span></div></div></div></div>
      <div className="table-card panel" style={{ marginTop: 16, gridColumn: '1 / -1' }}>
        <div className="table-heading">
          <div><h3>Token usage per AI agent</h3><span>Breakdown token usage & report count per AI agent yang digunakan</span></div>
        </div>
        <div className="document-table wide">
          <div className="document-row document-head">
            <span>AI Agent</span>
            <span>Model</span>
            <span>Provider</span>
            <span>Prompt tokens</span>
            <span>Completion tokens</span>
            <span>Total tokens</span>
            <span>Requests</span>
            <span>Avg. tokens/req</span>
            <span>Reports</span>
            <span>Cost (est.)</span>
          </div>
          {tokenRows.length === 0 && (
            <div className="document-row" style={{ gridTemplateColumns: '1fr', color: '#717773', justifyContent: 'center' }}>
              <span>Belum ada AI agent yang ditambahkan. Tambah agent di menu Agents untuk melihat token usage.</span>
            </div>
          )}
          {tokenRows.map(({ agent, prompt, completion, total, requests, avg, cost, reports, repClass }, idx) => (
            <div className="document-row" key={agent.id || idx}>
              <div className="document-name"><strong>{agent.name}</strong></div>
              <span>{agent.model || '-'}</span>
              <span>{(agent as any).provider || '-'}</span>
              <span>{prompt.toLocaleString()}</span>
              <span>{completion.toLocaleString()}</span>
              <span>{total.toLocaleString()}</span>
              <span>{requests.toLocaleString()}</span>
              <span>{avg.toLocaleString()}</span>
              <span><span className={`report-badge ${repClass}`}>{reports}</span></span>
              <span>${cost.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
}

const agentStatusLabel = (status: AgentStatus) => status === 'ready' ? 'Ready' : status === 'exhausted' ? 'Quota exhausted' : status === 'unconfigured' ? 'Needs API key' : 'Disabled'

function AgentSelect({ agents, activeAgent, autoFallback, onAssign, onManage }: { agents: AiAgent[]; activeAgent: AiAgent | null; autoFallback: boolean; onAssign: (agentId: string) => void; onManage: () => void }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (!target || !target.closest || target.closest('[data-agent-select]')) return
      setOpen(false)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div className="agent-select" data-agent-select>
      <button type="button" className="agent-select-trigger" onClick={() => setOpen(!open)}>
        <Bot size={13} /><span className={`agent-dot ${activeAgent?.status ?? 'ready'}`} />{activeAgent?.name ?? 'Auto router'}<ChevronDown size={12} />
      </button>
      {open && <div className="agent-select-menu">
        <div className="agent-select-label">AI AGENT FOR THIS THREAD</div>
        {agents.map((agent) => <button key={agent.id} type="button" className={`agent-option ${agent.id === activeAgent?.id ? 'active' : ''}`} onClick={() => { onAssign(agent.id); setOpen(false) }}>
          <span className={`agent-dot ${agent.status}`} />
          <div><strong>{agent.name}</strong><span>{agent.model || 'no model'} · {agentStatusLabel(agent.status)}</span></div>
        </button>)}
        {agents.length === 0 && <div className="agent-select-empty">No enabled agents yet.</div>}
        <button type="button" className="agent-select-manage" onClick={() => { onManage(); setOpen(false) }}><Settings2 size={12} /> Manage AI agents</button>
        <div className="agent-select-hint">Auto-switch {autoFallback ? 'on' : 'off'} · fallback follows the priority chain</div>
      </div>}
    </div>
  )
}

function AgentsView({ agents, autoFallback, saving, onSave }: { agents: AiAgent[]; autoFallback: boolean; saving: boolean; onSave: (agents: AgentDraft[], autoFallback: boolean) => void }) {
  const [draft, setDraft] = useState<AgentDraft[]>(() => agents.map((agent) => ({ ...agent, apiKeyInput: '' })))
  const [draftFallback, setDraftFallback] = useState(autoFallback)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setDraft(agents.map((agent) => ({ ...agent, apiKeyInput: '' })))
    setDraftFallback(autoFallback)
    setDirty(false)
  }, [agents, autoFallback])

  const patchAgent = (id: string, patch: Partial<AgentDraft>) => {
    setDirty(true)
    setDraft((current) => current.map((agent) => agent.id === id ? { ...agent, ...patch } : agent))
  }

  const moveAgent = (index: number, delta: number) => {
    setDirty(true)
    setDraft((current) => {
      const target = index + delta
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
    })
  }

  const removeAgent = (id: string) => {
    setDirty(true)
    setDraft((current) => current.filter((agent) => agent.id !== id))
  }

  const addAgent = () => {
    setDirty(true)
    setDraft((current) => [...current, { id: `agent-${Date.now()}`, name: 'New agent', model: '', apiUrl: '', keyHint: '', apiKeyInput: '', enabled: true, status: 'unconfigured' }])
  }

  const enabledDraft = draft.filter((agent) => agent.enabled)
  const readyCount = draft.filter((agent) => agent.enabled && agent.status === 'ready').length

  return (
    <div className="secondary-layout">
      <div className="section-toolbar actions-only">
        <div className="toolbar-actions"><button className="button button-secondary" onClick={addAgent}><Plus size={15} /> Add agent</button><button className="button button-primary" onClick={() => { onSave(draft, draftFallback); setDirty(false) }} disabled={saving}><Check size={15} /> {saving ? 'Saving…' : dirty ? 'Save settings' : 'Saved'}</button></div>
      </div>
      <div className="knowledge-overview">
        <div className="knowledge-stat"><div className="knowledge-stat-icon blue"><Bot size={18} /></div><div><span>Enabled agents</span><strong>{enabledDraft.length}</strong><small>{draft.length} configured in the chain</small></div></div>
        <div className="knowledge-stat"><div className="knowledge-stat-icon mint"><CheckCircle2 size={18} /></div><div><span>Ready now</span><strong>{readyCount}</strong><small>respond without hitting quota</small></div></div>
        <div className="knowledge-stat"><div className="knowledge-stat-icon orange"><Zap size={18} /></div><div><span>Auto-switch</span><strong>{draftFallback ? 'On' : 'Off'}</strong><small>5 minute retry cooldown per agent</small></div></div>
      </div>
      <div className="agent-chain">
        {draft.map((agent, index) => (
          <div className={`agent-card ${agent.enabled ? '' : 'inactive'}`} key={agent.id}>
            <div className="agent-rank">{index + 1}</div>
            <div className="agent-card-main">
              <div className="agent-card-head"><strong>{agent.name || `Agent ${index + 1}`}</strong><span className={`status-chip ${agent.status}`}>{agentStatusLabel(agent.status)}</span>{index === 0 && agent.enabled && <span className="primary-chip">Primary</span>}</div>
              <div className="agent-fields">
                <label>Name<input value={agent.name} onChange={(event) => patchAgent(agent.id, { name: event.target.value })} placeholder="e.g. GPT-5 mini" /></label>
                <label>Model<input value={agent.model} onChange={(event) => patchAgent(agent.id, { model: event.target.value })} placeholder="e.g. gpt-5-mini" /></label>
                <label>Base URL<input value={agent.apiUrl} onChange={(event) => patchAgent(agent.id, { apiUrl: event.target.value })} placeholder="https://api.openai.com/v1" /></label>
                <label>API key<input type="password" value={agent.apiKeyInput ?? ''} onChange={(event) => patchAgent(agent.id, { apiKeyInput: event.target.value })} placeholder={agent.keyHint || 'write-only key'} autoComplete="new-password" /></label>
              </div>
            </div>
            <div className="agent-card-actions">
              <button type="button" className={`toggle ${agent.enabled ? 'on' : ''}`} aria-label={agent.enabled ? `Disable ${agent.name}` : `Enable ${agent.name}`} onClick={() => patchAgent(agent.id, { enabled: !agent.enabled })}><span /></button>
              <button type="button" className="icon-mini" aria-label="Move up" disabled={index === 0} onClick={() => moveAgent(index, -1)}><ChevronUp size={14} /></button>
              <button type="button" className="icon-mini" aria-label="Move down" disabled={index === draft.length - 1} onClick={() => moveAgent(index, 1)}><ChevronDown size={14} /></button>
              <button type="button" className="icon-mini" aria-label="Remove agent" onClick={() => removeAgent(agent.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {draft.length === 0 && <div className="empty-state"><Bot size={26} /><strong>No AI agents yet</strong><span>Add an agent so the router has somewhere to send replies.</span></div>}
      </div>
      <div className="panel router-panel">
        <div className="toggle-setting"><div><strong>Auto-switch when quota runs out</strong><span>On rate limit, quota error, or timeout the router moves to the next enabled agent in the chain.</span></div><button type="button" className={`toggle ${draftFallback ? 'on' : ''}`} aria-label="Toggle auto-switch" onClick={() => { setDirty(true); setDraftFallback((value) => !value) }}><span /></button></div>
        <div className="router-order"><span>Fallback order</span><strong>{enabledDraft.map((agent) => agent.name || 'Untitled').join(' → ') || '—'}</strong></div>
      </div>
    </div>
  )
}

function TeamView({ setToast }: { setToast: (value: string) => void }) {
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/team').then(async (res) => {
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      if (active) setMembers(Array.isArray(data.members) ? data.members : [])
    }).catch(() => active && setMembers([])).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const addMember = async () => {
    const name = prompt('Nama anggota tim')
    const email = prompt('Email')
    const role = prompt('Role (admin/agent/support)') || 'agent'
    if (!name || !email) return
    try {
      const res = await fetch('/api/team', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, email, role }) })
      if (res.ok) {
        const data = await res.json()
        setMembers((m) => [...m, data.member])
        setToast('Anggota tim ditambahkan')
      } else setToast('Gagal menambahkan anggota')
    } catch { setToast('Gagal menambahkan anggota') }
  }

  return (
    <div className="secondary-layout">
      <div className="section-toolbar actions-only">
        <div className="toolbar-actions"><button className="button button-secondary" onClick={addMember}><Plus size={15} /> Tambah anggota</button></div>
      </div>
      <div className="knowledge-overview">
        <div className="knowledge-stat"><div className="knowledge-stat-icon blue"><UsersRound size={18} /></div><div><span>Total anggota</span><strong>{members.length}</strong><small>Tim support aktif</small></div></div>
        <div className="knowledge-stat"><div className="knowledge-stat-icon mint"><CheckCircle2 size={18} /></div><div><span>Admin</span><strong>{members.filter(m=>m.role==='admin').length}</strong></div></div>
        <div className="knowledge-stat"><div className="knowledge-stat-icon orange"><Bot size={18} /></div><div><span>Agent</span><strong>{members.filter(m=>m.role==='agent'||m.role==='support').length}</strong></div></div>
      </div>
      <div className="table-card panel">
        <div className="table-heading"><div><h3>Daftar tim</h3><span>Data diambil dari database</span></div></div>
        <div className="document-table">
          <div className="document-row document-head"><span>Nama</span><span>Email</span><span>Role</span><span>Status</span><span>Terakhir aktif</span><span /></div>
          {loading && <div className="document-row"><span>Memuat...</span></div>}
          {!loading && members.length === 0 && <div className="document-row"><span>Belum ada anggota tim</span></div>}
          {members.map((m) => (
            <div className="document-row" key={m.id}><div className="document-name"><strong>{m.name}</strong></div><span>{m.email}</span><span>{m.role}</span><span>{m.status||'active'}</span><span>{m.last_active||'-'}</span><button className="icon-button subtle"><MoreHorizontal size={17}/></button></div>
          ))}
        </div>
      </div>
    </div>
  )
}

type FontSizeOption = 'small' | 'medium' | 'large'

const FONT_SIZE_STORAGE_KEY = 'supportflow-font-size'

const fontSizeLabels: Record<FontSizeOption, string> = { small: 'Kecil', medium: 'Sedang', large: 'Besar' }

function applyFontSize(value: FontSizeOption) {
  document.documentElement.dataset.fontSize = value
  try { localStorage.setItem(FONT_SIZE_STORAGE_KEY, value) } catch { /* preference only */ }
}

function SettingsView({ setToast }: { setToast: (value: string) => void }) {
  const [settings, setSettings] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [fontSize, setFontSize] = useState<FontSizeOption>(() => {
    try {
      const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY)
      if (saved === 'small' || saved === 'medium' || saved === 'large') return saved
    } catch { /* fall through to default */ }
    return 'small'
  })

  const changeFontSize = (value: FontSizeOption) => {
    setFontSize(value)
    applyFontSize(value)
    setSettings((current: any) => ({ ...current, font_size: value }))
  }

  useEffect(() => {
    let active = true
    fetch('/api/settings').then(async (res) => {
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      if (active) setSettings(data.settings||{})
    }).catch(() => active && setSettings({})).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const save = async () => {
    try {
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ settings }) })
      if (res.ok) setToast('Pengaturan disimpan')
      else setToast('Gagal menyimpan')
    } catch { setToast('Gagal menyimpan') }
  }

  return (
    <div className="secondary-layout">
      <div className="section-toolbar actions-only"><div className="toolbar-actions"><button className="button button-primary" onClick={save}><Check size={15}/> Simpan</button></div></div>
      <div className="panel" style={{padding:16}}>
        <div className="table-heading" style={{borderBottom:'none', padding:0, marginBottom:16}}><div><h3>General Settings</h3><span>Data diambil & disimpan ke database</span></div></div>
        {loading ? <div>Memuat...</div> : <div className="config-form" style={{padding:0}}>
          <label>Workspace Name<input value={settings.workspace_name||''} onChange={e=>setSettings({...settings, workspace_name:e.target.value})}/></label>
          <label>Support Email<input value={settings.support_email||''} onChange={e=>setSettings({...settings, support_email:e.target.value})}/></label>
          <label>Company Name<input value={settings.company_name||''} onChange={e=>setSettings({...settings, company_name:e.target.value})}/></label>
        </div>}
      </div>
      <div className="panel" style={{padding:16, marginTop:12}}>
        <div className="table-heading" style={{borderBottom:'none', padding:0, marginBottom:16}}><div><h3>Channel Settings</h3></div></div>
        <div className="config-form" style={{padding:0}}>
          <label>WhatsApp Enabled<input value={settings.whatsapp_enabled||''} onChange={e=>setSettings({...settings, whatsapp_enabled:e.target.value})}/></label>
          <label>Webhook URL<input value={settings.webhook_url||''} onChange={e=>setSettings({...settings, webhook_url:e.target.value})}/></label>
        </div>
      </div>
      <div className="panel" style={{padding:16, marginTop:12}}>
        <div className="table-heading" style={{borderBottom:'none', padding:0, marginBottom:16}}><div><h3>Tampilan</h3><span>Atur ukuran font di seluruh halaman dashboard</span></div></div>
        <div className="config-form" style={{padding:0}}>
          <label>Ukuran font
            <div className="font-size-options" role="radiogroup" aria-label="Ukuran font">
              {(Object.keys(fontSizeLabels) as FontSizeOption[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={fontSize === option}
                  className={`font-size-option ${fontSize === option ? 'active' : ''}`}
                  onClick={() => changeFontSize(option)}
                >
                  <span className={`font-size-sample sample-${option}`}>Aa</span>
                  {fontSizeLabels[option]}
                </button>
              ))}
            </div>
          </label>
          <p className="setting-hint">Pilihan langsung diterapkan dan diingat di perangkat ini. Tekan <b>Simpan</b> untuk menyimpannya ke workspace.</p>
        </div>
      </div>
    </div>
  )
}

function MonitorDot() { return <span className="monitor-dot" /> }

function App() {
  const path = window.location.pathname
  const isCallbackRoute = path === '/manus-oauth/callback' || path === '/auth/callback'
  const isConversationRoute = /^\/app\/inbox\/.+/.test(path)
  const isPrivateRoute = path.startsWith('/app') || path === '/knowledge' || path === '/widget' || path === '/analytics'
  const [session, setSession] = useState<'loading' | 'authenticated' | 'anonymous'>('loading')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY)
      if (saved === 'small' || saved === 'medium' || saved === 'large') applyFontSize(saved)
    } catch { /* preference unavailable */ }
  }, [])

  useEffect(() => {
    if (!isPrivateRoute) {
      setSession('anonymous')
      return
    }
    fetch('/api/auth/session').then((response) => setSession(response.ok ? 'authenticated' : 'anonymous')).catch(() => setSession('anonymous'))
  }, [isPrivateRoute])

  useEffect(() => {
    if (isPrivateRoute && session === 'anonymous') window.location.assign(`/login?next=${encodeURIComponent(path)}`)
  }, [isPrivateRoute, path, session])

  if (isCallbackRoute) return <AuthCallbackPage />
  if (path === '/login') return <AuthPage mode="login" />
  if (path === '/register') return <AuthPage mode="register" />
  if (!isPrivateRoute) return <LandingPage />
  if (session === 'loading' || session === 'anonymous') return <div className="auth-callback"><div className="auth-callback-card"><div className="auth-card-icon"><Sparkles size={18} /></div><h1>SupportFlow</h1><p>{session === 'loading' ? 'Checking your workspace session…' : 'Redirecting to secure login…'}</p></div></div>
  if (isConversationRoute) return <ConversationPage path={path} />
  return <DashboardApp />
}

export default App
