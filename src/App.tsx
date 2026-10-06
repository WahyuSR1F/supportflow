import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
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
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  LockKeyhole,
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
  UploadCloud,
  UserRound,
  UsersRound,
  Zap,
} from 'lucide-react'
import { AuthCallbackPage, AuthPage, LandingPage } from './Marketing'
import './styles.css'

type NavItem = 'Inbox' | 'Knowledge base' | 'Widget' | 'Analytics'
type Channel = 'WhatsApp' | 'Instagram' | 'Web chat'
type ConversationStatus = 'AI active' | 'Needs handoff' | 'Agent controlled' | 'Resolved'
type MessageKind = 'customer' | 'ai' | 'agent'

type Message = {
  from: MessageKind
  text: string
  time: string
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

function StatusBadge({ status }: { status: ConversationStatus }) {
  const className = status.toLowerCase().replaceAll(' ', '-')
  return (
    <span className={`status-badge ${className}`}>
      <span className="status-dot" />
      {status}
    </span>
  )
}

function Avatar({ conversation, size = 'md' }: { conversation: Conversation; size?: 'sm' | 'md' | 'lg' }) {
  return <div className={`avatar ${conversation.avatar} avatar-${size}`}>{conversation.initials}</div>
}

function DashboardApp() {
  const path = window.location.pathname
  const initialNav: NavItem = path.includes('knowledge') ? 'Knowledge base' : path.includes('widget') ? 'Widget' : path.includes('analytics') ? 'Analytics' : 'Inbox'
  const [activeNav, setActiveNav] = useState<NavItem>(initialNav)
  const [conversations, setConversations] = useState(initialConversations)
  const [documents, setDocuments] = useState(initialDocuments)
  const [selectedId, setSelectedId] = useState('mira')
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'All' | ConversationStatus>('All')
  const [composer, setComposer] = useState('')
  const [widgetOpen, setWidgetOpen] = useState(false)
  const [toast, setToast] = useState('')

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? conversations[0]
  const filteredConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      const matchesQuery = `${conversation.name} ${conversation.preview} ${conversation.channel}`.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFilter = filter === 'All' || conversation.status === filter
      return matchesQuery && matchesFilter
    })
  }, [conversations, filter, searchQuery])

  const navigate = (item: NavItem) => {
    setActiveNav(item)
    const route = item === 'Inbox' ? '/app' : item === 'Knowledge base' ? '/app/knowledge' : item === 'Widget' ? '/app/widget' : '/app/analytics'
    window.history.replaceState({}, '', route)
  }

  const updateSelectedStatus = (status: ConversationStatus, message: string) => {
    setConversations((current) => current.map((conversation) => conversation.id === selected.id ? { ...conversation, status } : conversation))
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }

  const sendMessage = () => {
    if (!composer.trim()) return
    setConversations((current) => current.map((conversation) => conversation.id === selected.id ? {
      ...conversation,
      status: 'Agent controlled',
      preview: composer.trim(),
      time: 'now',
      messages: [...conversation.messages, { from: 'agent', text: composer.trim(), time: '09:48' }],
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
    <div className="app-shell">
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
          <NavButton icon={<LayoutDashboard size={17} />} label="Overview" onClick={() => setToast('Overview is coming next')} />
          <NavButton icon={<Inbox size={17} />} label="Inbox" active={activeNav === 'Inbox'} count="12" onClick={() => navigate('Inbox')} />
          <NavButton icon={<Database size={17} />} label="Knowledge base" active={activeNav === 'Knowledge base'} onClick={() => navigate('Knowledge base')} />
          <NavButton icon={<Code2 size={17} />} label="Widget" active={activeNav === 'Widget'} onClick={() => navigate('Widget')} />
          <NavButton icon={<BarChart3 size={17} />} label="Analytics" active={activeNav === 'Analytics'} onClick={() => navigate('Analytics')} />
          <div className="nav-label nav-label-spaced">Manage</div>
          <NavButton icon={<UsersRound size={17} />} label="Team" onClick={() => setToast('Team settings are coming next')} />
          <NavButton icon={<Settings2 size={17} />} label="Settings" onClick={() => setToast('Settings are coming next')} />
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
          <div className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> TODAY · WEDNESDAY, 17 APR</div><h1>{activeNav === 'Inbox' ? 'Inbox' : activeNav}</h1><p>{activeNav === 'Inbox' ? 'Stay ahead of every customer conversation.' : activeNav === 'Knowledge base' ? 'Keep the AI grounded in your latest support knowledge.' : activeNav === 'Widget' ? 'Give every visitor a fast, human-feeling answer.' : 'See how your support system is performing.'}</p></div>
            <div className="heading-actions"><button className="button button-secondary" onClick={() => setWidgetOpen(true)}><PanelRight size={16} /> Preview widget</button><button className="button button-primary" onClick={() => activeNav === 'Knowledge base' ? addDocument() : setToast('New conversation flow started')}><Plus size={16} /> {activeNav === 'Knowledge base' ? 'Add document' : 'New conversation'}</button></div>
          </div>

          <div className="metric-row">
            <MetricCard label="Open conversations" value="128" trend="+14.8%" trendLabel="vs last week" icon={<Inbox size={16} />} tone="blue" />
            <MetricCard label="AI resolution rate" value="72.4%" trend="+6.2%" trendLabel="vs last week" icon={<Sparkles size={16} />} tone="mint" />
            <MetricCard label="Avg. first response" value="38s" trend="−12s" trendLabel="faster this week" icon={<Clock3 size={16} />} tone="orange" />
            <MetricCard label="Needs attention" value="12" trend="4 urgent" trendLabel="right now" icon={<AlertTriangle size={16} />} tone="lilac" />
          </div>

          {activeNav === 'Inbox' && <InboxView selected={selected} conversations={filteredConversations} selectedId={selectedId} searchQuery={searchQuery} setSearchQuery={setSearchQuery} filter={filter} setFilter={setFilter} setSelectedId={setSelectedId} composer={composer} setComposer={setComposer} sendMessage={sendMessage} updateSelectedStatus={updateSelectedStatus} />}
          {activeNav === 'Knowledge base' && <KnowledgeView documents={documents} addDocument={addDocument} setToast={setToast} />}
          {activeNav === 'Widget' && <WidgetView widgetOpen={widgetOpen} setWidgetOpen={setWidgetOpen} setToast={setToast} />}
          {activeNav === 'Analytics' && <AnalyticsView />}
        </div>
      </main>

      {widgetOpen && activeNav !== 'Widget' && <WidgetOverlay onClose={() => setWidgetOpen(false)} />}
      {toast && <div className="toast"><CheckCircle2 size={17} /> {toast}</div>}
    </div>
  )
}

function NavButton({ icon, label, active, count, onClick }: { icon: React.ReactNode; label: string; active?: boolean; count?: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{count && <em>{count}</em>}</button>
}

function MetricCard({ label, value, trend, trendLabel, icon, tone }: { label: string; value: string; trend: string; trendLabel: string; icon: React.ReactNode; tone: string }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small><b className={tone === 'orange' || tone === 'lilac' ? 'neutral-trend' : ''}>{trend}</b> {trendLabel}</small></div><ArrowUpRight className="metric-arrow" size={15} /></div>
}

function InboxView({ selected, conversations, selectedId, searchQuery, setSearchQuery, filter, setFilter, setSelectedId, composer, setComposer, sendMessage, updateSelectedStatus }: { selected: Conversation; conversations: Conversation[]; selectedId: string; searchQuery: string; setSearchQuery: (value: string) => void; filter: 'All' | ConversationStatus; setFilter: (value: 'All' | ConversationStatus) => void; setSelectedId: (value: string) => void; composer: string; setComposer: (value: string) => void; sendMessage: () => void; updateSelectedStatus: (status: ConversationStatus, message: string) => void }) {
  return <div className="inbox-layout">
    <section className="conversation-panel panel">
      <div className="panel-heading"><div><h2>Conversations</h2><span className="heading-count">128 open</span></div><button className="icon-button subtle" aria-label="Filter conversations"><SlidersHorizontal size={17} /></button></div>
      <div className="search-field"><Search size={16} /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" /><kbd>⌘ K</kbd></div>
      <div className="filter-row"><FilterChip label="All" active={filter === 'All'} count="128" onClick={() => setFilter('All')} /><FilterChip label="Needs handoff" active={filter === 'Needs handoff'} count="12" onClick={() => setFilter('Needs handoff')} /><FilterChip label="Unread" active={false} count="6" onClick={() => setFilter('All')} /></div>
      <div className="conversation-list">{conversations.map((conversation) => <ConversationRow key={conversation.id} conversation={conversation} active={conversation.id === selectedId} onClick={() => setSelectedId(conversation.id)} />)}{conversations.length === 0 && <div className="empty-state"><Search size={24} /><strong>No conversations found</strong><span>Try a different search or filter.</span></div>}</div>
      <div className="list-footer"><span>Showing {conversations.length} of 128</span><button>View all <ArrowUpRight size={13} /></button></div>
    </section>

    <section className="thread-panel panel">
      <div className="thread-header"><div className="contact-summary"><Avatar conversation={selected} size="lg" /><div><div className="contact-name-row"><h2>{selected.name}</h2><span className="verified-mark"><Check size={11} /></span></div><div className="contact-meta"><ChannelIcon channel={selected.channel} small /> <span>{selected.channel}</span><i /> <span>{selected.location}</span></div></div></div><div className="thread-actions"><StatusBadge status={selected.status} /><button className="icon-button subtle" aria-label="More conversation actions"><MoreHorizontal size={18} /></button></div></div>
      {selected.status === 'Needs handoff' && <div className="handoff-banner"><div className="handoff-banner-icon"><AlertTriangle size={17} /></div><div><strong>Human handoff recommended</strong><span>Confidence dropped below 70% for this answer. An agent should review before sending.</span></div><button onClick={() => updateSelectedStatus('Agent controlled', 'You took over the conversation')}>Take over <ArrowUpRight size={14} /></button></div>}
      <div className="thread-body"><div className="date-divider"><span>Today</span></div>{selected.messages.map((message, index) => <MessageBubble key={`${selected.id}-${index}`} message={message} conversation={selected} />)}<TypingIndicator /></div>
      <div className="reply-assistant"><div className="assistant-title"><div className="assistant-label"><div className="sparkle-icon"><Sparkles size={15} /></div><strong>AI suggested reply</strong><span>grounded in 3 sources</span></div><div className="confidence-chip"><span>Confidence</span><strong>{selected.confidence}%</strong></div></div><p>{selected.id === 'mira' ? 'I can help with that. Address changes may be possible before your order ships. Let me check the order status and I’ll confirm the next step for you.' : selected.id === 'noah' ? 'I’m checking the payment authorizations now. I’ll confirm whether one of the charges is only a temporary hold and update you shortly.' : 'Here’s a clear answer based on the latest support policy. I can also connect you with a specialist if you need help with anything else.'}</p><div className="source-row"><span><FileText size={13} /> Shipping & delivery policy</span><span><FileCheck2 size={13} /> Order support playbook</span><button aria-label="Refresh suggestion"><RefreshCw size={14} /></button></div><div className="assistant-actions"><button className="button button-primary small" onClick={() => setComposer(selected.id === 'mira' ? 'I can help with that. Address changes may be possible before your order ships. Let me check the order status and I’ll confirm the next step for you.' : 'I’m checking the payment authorizations now. I’ll confirm the next step and update you shortly.')}><Sparkles size={14} /> Use reply</button><button className="button button-ghost small" onClick={() => setComposer('')}>Edit response</button></div></div>
      <div className="composer"><div className="composer-top"><span className="composer-mode"><Bot size={14} /> {selected.status === 'Agent controlled' ? 'Agent reply' : 'AI assisted reply'} <ChevronDown size={13} /></span><span className="composer-hint">Press ⌘ + Enter to send</span></div><textarea value={composer} onChange={(event) => setComposer(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) sendMessage() }} placeholder="Write a reply…" aria-label="Write a reply" /><div className="composer-bottom"><div className="composer-tools"><button aria-label="Attach file"><Paperclip size={16} /></button><button aria-label="Add emoji"><span className="emoji-dot">☺</span></button><span>External reply</span></div><button className="send-button" onClick={sendMessage}><Send size={15} /> Send reply</button></div></div>
    </section>

    <aside className="context-panel">
      <div className="context-header"><div><span className="eyebrow compact">CONVERSATION CONTEXT</span><h2>Customer details</h2></div><button className="icon-button subtle" aria-label="Close context panel"><PanelRight size={17} /></button></div>
      <div className="customer-card"><Avatar conversation={selected} size="md" /><div><strong>{selected.name}</strong><span>{selected.customerType}</span></div><button className="icon-button subtle" aria-label="Customer actions"><MoreHorizontal size={17} /></button></div>
      <div className="detail-grid"><div><span>Location</span><strong>{selected.location}</strong></div><div><span>First response</span><strong>{selected.firstResponse}</strong></div><div><span>Sentiment</span><strong className={`sentiment ${selected.sentiment.toLowerCase().replaceAll(' ', '-')}`}>{selected.sentiment}</strong></div><div><span>Last seen</span><strong>Just now</strong></div></div>
      <div className="context-section"><div className="section-title"><span>Tags</span><button className="text-button"><Plus size={13} /> Add</button></div><div className="tag-row">{selected.tags.map((tag) => <span className="tag" key={tag}><Tag size={11} /> {tag}</span>)}</div></div>
      <div className="context-section"><div className="section-title"><span>Handoff control</span><span className="live-label"><span className="live-pulse" /> Live</span></div><div className="control-card"><div className="control-line"><div className="control-icon blue"><Bot size={15} /></div><div><strong>AI handling</strong><span>{selected.status === 'Agent controlled' ? 'Paused by agent' : selected.status === 'Resolved' ? 'Thread resolved' : 'Active on this thread'}</span></div><div className={`toggle ${selected.status !== 'Agent controlled' && selected.status !== 'Resolved' ? 'on' : ''}`}><span /></div></div><div className="control-divider" /><div className="control-line"><div className="control-icon orange"><Headphones size={15} /></div><div><strong>Human handoff</strong><span>{selected.status === 'Needs handoff' ? 'Recommended · 62% confidence' : 'Available to team'}</span></div><button className="assign-button" onClick={() => updateSelectedStatus(selected.status === 'Agent controlled' ? 'AI active' : 'Agent controlled', selected.status === 'Agent controlled' ? 'Conversation returned to AI' : 'You took over the conversation')}>{selected.status === 'Agent controlled' ? 'Return to AI' : 'Take over'}</button></div></div></div>
      <div className="context-section"><div className="section-title"><span>Knowledge used</span><button className="icon-button tiny" aria-label="View knowledge sources"><ArrowUpRight size={14} /></button></div><div className="knowledge-list"><KnowledgeSource label="Shipping & delivery policy" score="0.86" /><KnowledgeSource label="Order support playbook" score="0.78" /><KnowledgeSource label="Customer care handbook" score="0.71" /></div></div>
      <div className="context-footer"><ShieldCheck size={15} /><span>AI replies are restricted to approved workspace sources.</span></div>
    </aside>
  </div>
}

function FilterChip({ label, active, count, onClick }: { label: string; active: boolean; count: string; onClick: () => void }) {
  return <button className={`filter-chip ${active ? 'active' : ''}`} onClick={onClick}>{label}<span>{count}</span></button>
}

function ConversationRow({ conversation, active, onClick }: { conversation: Conversation; active: boolean; onClick: () => void }) {
  return <button className={`conversation-row ${active ? 'active' : ''}`} onClick={onClick}><Avatar conversation={conversation} size="sm" /><div className="conversation-row-main"><div className="conversation-topline"><strong>{conversation.name}</strong><time>{conversation.time}</time></div><div className="conversation-preview">{conversation.preview}</div><div className="conversation-bottomline"><span className={`channel-label ${conversation.channel.toLowerCase().replaceAll(' ', '-')}`}><ChannelIcon channel={conversation.channel} small /> {conversation.channel}</span><StatusBadge status={conversation.status} /></div></div>{conversation.unread > 0 && <span className="unread-count">{conversation.unread}</span>}</button>
}

function MessageBubble({ message, conversation }: { message: Message; conversation: Conversation }) {
  const isCustomer = message.from === 'customer'
  return <div className={`message-row ${isCustomer ? 'customer' : 'outbound'}`}><div className="message-avatar">{isCustomer ? <Avatar conversation={conversation} size="sm" /> : message.from === 'ai' ? <div className="mini-ai"><Bot size={14} /></div> : <div className="mini-agent">AR</div>}</div><div className="message-content"><div className="message-meta"><strong>{isCustomer ? conversation.name : message.from === 'ai' ? 'SupportFlow AI' : 'Ayunda · agent'}</strong><time>{message.time}</time>{message.from === 'ai' && <span className="ai-label"><Sparkles size={11} /> AI</span>}</div><div className={`message-bubble ${isCustomer ? 'customer-bubble' : message.from === 'ai' ? 'ai-bubble' : 'agent-bubble'}`}>{message.text}</div></div></div>
}

function TypingIndicator() {
  return <div className="typing-row"><div className="mini-ai"><Bot size={14} /></div><div className="typing-bubble"><span /><span /><span /></div><small>AI is ready with context</small></div>
}

function KnowledgeSource({ label, score }: { label: string; score: string }) {
  return <div className="knowledge-source"><div className="source-doc"><FileText size={14} /></div><div><strong>{label}</strong><span>Relevant passage · {score}</span></div><ChevronRight size={14} /></div>
}

function KnowledgeView({ documents, addDocument, setToast }: { documents: KnowledgeDocument[]; addDocument: () => void; setToast: (value: string) => void }) {
  return <div className="secondary-layout"><div className="section-toolbar"><div><span className="eyebrow compact">GROUNDING LAYER</span><h2>Knowledge base</h2><p>4 documents · 241 indexed chunks · synced to the AI response engine</p></div><div className="toolbar-actions"><button className="button button-secondary" onClick={() => setToast('Index is healthy · last sync 2m ago')}><RefreshCw size={15} /> Re-index all</button><button className="button button-primary" onClick={addDocument}><UploadCloud size={15} /> Add document</button></div></div><div className="knowledge-overview"><div className="knowledge-stat"><div className="knowledge-stat-icon blue"><Database size={18} /></div><div><span>Indexed content</span><strong>241</strong><small>chunks available to AI</small></div></div><div className="knowledge-stat"><div className="knowledge-stat-icon mint"><CheckCircle2 size={18} /></div><div><span>Retrieval quality</span><strong>92.8%</strong><small>top-3 relevance score</small></div></div><div className="knowledge-stat"><div className="knowledge-stat-icon orange"><Clock3 size={18} /></div><div><span>Last sync</span><strong>2m ago</strong><small>all systems operational</small></div></div></div><div className="table-card panel"><div className="table-heading"><div><h3>Source documents</h3><span>Only approved workspace documents can ground an AI reply.</span></div><button className="icon-button subtle"><SlidersHorizontal size={17} /></button></div><div className="document-table"><div className="document-row document-head"><span>Name</span><span>Type</span><span>Updated</span><span>Chunks</span><span>Status</span><span /></div>{documents.map((document) => <div className="document-row" key={document.name}><div className="document-name"><div className="document-icon"><FileText size={16} /></div><div><strong>{document.name}</strong><span>{document.size}</span></div></div><span className="file-type">{document.type}</span><span>{document.updated}</span><span>{document.chunks}</span><span className={`index-status ${document.status.toLowerCase()}`}><span className="status-dot" /> {document.status}</span><button className="icon-button subtle" aria-label={`More actions for ${document.name}`}><MoreHorizontal size={17} /></button></div>)}</div></div></div>
}

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

  return <div className="secondary-layout"><div className="section-toolbar"><div><span className="eyebrow compact">CUSTOMER-FACING SURFACE</span><h2>Web chat widget</h2><p>Configured for Northstar Goods · English · AI + human handoff</p></div><div className="toolbar-actions"><button className="button button-secondary" onClick={() => setToast('Embed snippet copied to clipboard')}><Copy size={15} /> Copy embed code</button><button className="button button-primary" onClick={() => setWidgetOpen(!widgetOpen)}><Eye size={15} /> {widgetOpen ? 'Hide preview' : 'Open preview'}</button></div></div><div className="widget-layout"><div className="widget-config panel"><div className="table-heading"><div><h3>Widget configuration</h3><span>Give visitors a clear path to a helpful answer.</span></div><div className="configured-pill"><Check size={13} /> Published</div></div><div className="config-form"><label>Widget name<input defaultValue="Northstar concierge" /></label><label>Welcome message<textarea defaultValue="Hi there — how can we help today?" /></label><div className="config-split"><label>Accent color<div className="color-input"><span className="color-swatch" /> #4263EB <ChevronDown size={14} /></div></label><label>Human handoff<div className="select-input">Enabled <ChevronDown size={14} /></div></label></div><div className="toggle-setting"><div><strong>Show AI confidence</strong><span>Let agents see the grounding signal before sending.</span></div><div className="toggle on"><span /></div></div><div className="toggle-setting"><div><strong>Collect contact details</strong><span>Ask for email when the visitor requests a human.</span></div><div className="toggle on"><span /></div></div><button className="button button-primary full" onClick={() => setToast('Widget settings saved')}>Save widget settings</button></div></div><div className="widget-preview-card panel"><div className="preview-label"><span><MonitorDot /> Live preview</span><span className="preview-status"><span className="live-pulse" /> Published</span></div><div className="browser-frame"><div className="browser-top"><span /><span /><span /><small>northstar-goods.com</small></div><div className="browser-page"><div className="fake-site-nav"><strong>northstar</strong><span>New arrivals</span><span>Collections</span><span>About</span><span className="fake-cart">Bag (2)</span></div><div className="fake-hero"><span>SPRING / SUMMER 24</span><strong>Everyday objects,<br />made considered.</strong><button>Explore collection <ArrowUpRight size={13} /></button></div><div className="widget-launcher" onClick={() => setWidgetOpen(!widgetOpen)}><MessageCircle size={20} /></div>{widgetOpen && <div className="widget-mini"><div className="widget-mini-head"><div className="widget-logo"><Sparkles size={14} /></div><div><strong>Northstar concierge</strong><span>{widgetHandoff ? 'Terhubung ke tim Customer Service' : 'Usually replies instantly'}</span></div><button onClick={() => setWidgetOpen(false)}>×</button></div><div className="widget-mini-body" aria-live="polite">{widgetMessages.map((message, index) => <div className={`mini-chat ${message.role === 'user' ? 'outgoing' : 'incoming'}`} key={`${message.role}-${index}`}>{message.content}</div>)}{widgetPending && <div className="typing-indicator"><span /><span /><span /><em>AI is typing…</em></div>}</div><div className="widget-mini-input"><input value={widgetMessage} onChange={(event) => setWidgetMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void sendWidgetMessage() }} placeholder={widgetPending ? 'AI is typing…' : 'Write a message…'} aria-label="Widget message" disabled={widgetPending} /><button onClick={() => void sendWidgetMessage()} aria-label="Send widget message" disabled={widgetPending}><Send size={14} /></button></div></div>}</div></div></div></div></div>
}

function AnalyticsView() {
  return <div className="secondary-layout"><div className="section-toolbar"><div><span className="eyebrow compact">WEEKLY PULSE</span><h2>Support analytics</h2><p>Performance across 4 channels and 6 agents · Apr 11–17, 2024</p></div><div className="toolbar-actions"><button className="button button-secondary"><Clock3 size={15} /> Last 7 days <ChevronDown size={14} /></button><button className="button button-primary"><ArrowUpRight size={15} /> Export report</button></div></div><div className="analytics-grid"><div className="chart-card panel"><div className="chart-heading"><div><h3>Conversation volume</h3><span>1,284 total conversations</span></div><div className="chart-legend"><span><i className="legend-dot blue-dot" /> Incoming</span><span><i className="legend-dot mint-dot" /> Resolved</span></div></div><div className="chart-area"><div className="y-labels"><span>240</span><span>180</span><span>120</span><span>60</span><span>0</span></div><div className="bars">{[58, 74, 48, 86, 66, 92, 78].map((height, index) => <div className="bar-group" key={index}><div className="bar-stack"><span className="bar incoming" style={{ height: `${height}%` }} /><span className="bar resolved" style={{ height: `${Math.max(18, height - 22)}%` }} /></div><small>{['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'][index]}</small></div>)}</div></div></div><div className="performance-card panel"><div className="chart-heading"><div><h3>AI performance</h3><span>Last 7 days</span></div><Sparkles size={18} color="#4263eb" /></div><div className="performance-score"><strong>72.4%</strong><span>AI resolution rate</span><div className="score-line"><span style={{ width: '72.4%' }} /></div></div><div className="performance-row"><span><span className="signal-dot green" /> Resolved by AI</span><strong>930</strong></div><div className="performance-row"><span><span className="signal-dot orange" /> Human handoff</span><strong>186</strong></div><div className="performance-row"><span><span className="signal-dot gray" /> Unresolved</span><strong>168</strong></div><button className="text-button full-text">View resolution breakdown <ArrowUpRight size={14} /></button></div><div className="channel-card panel"><div className="chart-heading"><div><h3>Channel mix</h3><span>By conversations</span></div><MoreHorizontal size={18} /></div><div className="donut-wrap"><div className="donut"><div>1,284<strong>total</strong></div></div><div className="channel-legend"><span><i className="legend-dot blue-dot" /> WhatsApp <b>48%</b></span><span><i className="legend-dot purple-dot" /> Instagram <b>31%</b></span><span><i className="legend-dot mint-dot" /> Web chat <b>21%</b></span></div></div></div></div></div>
}

function WidgetOverlay({ onClose }: { onClose: () => void }) {
  return <div className="overlay" onClick={onClose}><div className="overlay-widget" onClick={(event) => event.stopPropagation()}><div className="overlay-widget-head"><div className="widget-logo"><Sparkles size={15} /></div><div><strong>Northstar concierge</strong><span>Usually replies instantly</span></div><button onClick={onClose} aria-label="Close widget">×</button></div><div className="overlay-widget-body"><div className="mini-chat incoming">Hi there — how can we help today?</div><div className="mini-chat outgoing">Can I change my delivery address?</div><div className="mini-chat incoming">I can help check that. Let me look up your order details.</div></div><div className="overlay-widget-input">Write a message… <Send size={15} /></div><div className="overlay-widget-footer"><LockKeyhole size={12} /> Powered by SupportFlow AI</div></div></div>
}

function MonitorDot() { return <span className="monitor-dot" /> }

function App() {
  const path = window.location.pathname
  const isCallbackRoute = path === '/manus-oauth/callback' || path === '/auth/callback'
  const isPrivateRoute = path.startsWith('/app') || path === '/knowledge' || path === '/widget' || path === '/analytics'
  const [session, setSession] = useState<'loading' | 'authenticated' | 'anonymous'>('loading')

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
  return <DashboardApp />
}

export default App
