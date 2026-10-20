/*! supportflow-widget v1.0.0 — SupportFlow chat widget (vanilla JS, zero dependencies) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.SupportFlowWidget = factory()
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'

  // Katalog endpoint yang bisa dipilih saat instalasi (harus sinkron dengan bin/cli.js).
  var CATALOG = [
    { id: 'chat', method: 'POST', path: '/api/chat/public', label: 'Chat AI (kirim & terima pesan)', enables: 'Mengirim dan menerima pesan' },
    { id: 'history', method: 'GET', path: '/api/chat/public/history', label: 'Riwayat percakapan', enables: 'Memuat riwayat saat widget dibuka' },
    { id: 'conversations', method: 'GET', path: '/api/conversations', label: 'Status percakapan (handoff)', enables: 'Menampilkan status handoff ke manusia' },
    { id: 'health', method: 'GET', path: '/api/health', label: 'Health check backend', enables: 'Indikator status server di header' }
  ]

  var HOST_ID = 'sfw-root'
  var STORAGE_PREFIX = 'sfw-conversation-'

  var DEFAULTS = {
    baseUrl: '',
    conversationId: '',
    title: 'SupportFlow',
    accentColor: '#4263eb',
    position: 'right',
    greeting: 'Hi! Ada yang bisa kami bantu?',
    endpoints: '*' // '*' = semua endpoint, atau array id dari CATALOG
  }

  function generateConversationId() {
    return 'sfw-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  }

  function resolveConversationId(configured) {
    if (configured) return configured
    try {
      var stored = window.localStorage.getItem(STORAGE_PREFIX + 'id')
      if (stored) return stored
      var created = generateConversationId()
      window.localStorage.setItem(STORAGE_PREFIX + 'id', created)
      return created
    } catch (error) {
      return generateConversationId()
    }
  }

  function normalizeEndpoints(value) {
    if (value === undefined || value === null || value === '*' || value === 'all') return '*'
    var list = Array.isArray(value) ? value : [value]
    var valid = list
      .map(function (id) { return String(id).trim() })
      .filter(function (id) { return CATALOG.some(function (entry) { return entry.id === id }) })
    return valid.length ? valid : '*'
  }

  function normalizeConfig(config) {
    var merged = Object.assign({}, DEFAULTS, config || {})
    merged.baseUrl = String(merged.baseUrl || '').replace(/\/+$/, '')
    merged.conversationId = resolveConversationId(merged.conversationId)
    merged.endpoints = normalizeEndpoints(merged.endpoints)
    if (!merged.baseUrl) throw new Error('SupportFlowWidget: baseUrl wajib diisi (contoh: https://api.example.com)')
    return merged
  }

  function isAllowed(config, endpointId) {
    if (config.endpoints === '*') return true
    return config.endpoints.indexOf(endpointId) !== -1
  }

  function catalogPath(endpointId) {
    var entry = CATALOG.find(function (item) { return item.id === endpointId })
    if (!entry) throw new Error('SupportFlowWidget: endpoint tidak dikenal: ' + endpointId)
    return entry.path
  }

  async function request(config, endpointId, options) {
    if (!isAllowed(config, endpointId)) {
      var error = new Error('Endpoint "' + endpointId + '" tidak diaktifkan saat instalasi')
      error.code = 'ENDPOINT_DISABLED'
      throw error
    }
    var response = await fetch(config.baseUrl + catalogPath(endpointId), options)
    var payload = null
    try { payload = await response.json() } catch (error) { /* non-JSON body */ }
    if (!response.ok) {
      var failure = new Error((payload && (payload.error || payload.message)) || 'Request gagal (' + response.status + ')')
      failure.status = response.status
      throw failure
    }
    return payload
  }

  var CSS = [
    ':host { all: initial; }',
    '.sfw-root { display: contents; }',
    '.sfw-launcher { position: fixed; bottom: 24px; width: 56px; height: 56px; border-radius: 50%; border: 0; display: grid; place-items: center; background: var(--sfw-accent); color: #fff; cursor: pointer; box-shadow: 0 10px 26px color-mix(in srgb, var(--sfw-accent) 40%, transparent); transition: transform .18s ease, box-shadow .18s ease; z-index: 2147483000; }',
    '.sfw-launcher:hover { transform: translateY(-3px); }',
    '.sfw-launcher:focus-visible { outline: 3px solid color-mix(in srgb, var(--sfw-accent) 35%, transparent); outline-offset: 2px; }',
    '.sfw-launcher svg { width: 24px; height: 24px; }',
    '.sfw-panel { position: fixed; bottom: 92px; width: min(360px, calc(100vw - 32px)); height: min(540px, calc(100vh - 130px)); display: flex; flex-direction: column; background: #fff; border: 1px solid #dfe5df; border-radius: 16px; overflow: hidden; box-shadow: 0 24px 60px rgba(30, 42, 34, .24); z-index: 2147483001; opacity: 0; transform: translateY(14px) scale(.98); pointer-events: none; transition: opacity .22s cubic-bezier(.22,1,.36,1), transform .22s cubic-bezier(.22,1,.36,1); font-family: Manrope, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; color: #191b1d; }',
    '.sfw-panel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }',
    '.sfw-pos-right .sfw-launcher, .sfw-pos-right .sfw-panel { right: 24px; }',
    '.sfw-pos-left .sfw-launcher, .sfw-pos-left .sfw-panel { left: 24px; }',
    '.sfw-head { display: flex; align-items: center; gap: 10px; padding: 14px; background: var(--sfw-accent); color: #fff; }',
    '.sfw-logo { width: 30px; height: 30px; border-radius: 9px; background: rgba(255,255,255,.22); display: grid; place-items: center; flex: 0 0 auto; }',
    '.sfw-logo svg { width: 16px; height: 16px; }',
    '.sfw-head-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }',
    '.sfw-head-copy strong { font-size: 13px; letter-spacing: -.2px; }',
    '.sfw-head-copy span { font-size: 10px; color: rgba(255,255,255,.8); display: flex; align-items: center; gap: 5px; }',
    '.sfw-status-dot { width: 6px; height: 6px; border-radius: 50%; background: #9fe8c9; display: inline-block; }',
    '.sfw-status-dot.off { background: #ffd2a8; }',
    '.sfw-close { border: 0; background: transparent; color: #fff; font-size: 20px; line-height: 1; cursor: pointer; padding: 2px 6px; }',
    '.sfw-body { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding: 14px 12px; background: #fafbfa; }',
    '.sfw-msg { max-width: 85%; font-size: 12.5px; line-height: 1.5; padding: 9px 11px; border-radius: 4px 12px 12px 12px; color: #5f6862; background: #eef1ed; white-space: pre-wrap; word-break: break-word; }',
    '.sfw-msg.user { align-self: flex-end; color: #fff; background: var(--sfw-accent); border-radius: 12px 4px 12px 12px; }',
    '.sfw-msg.system { align-self: center; max-width: 95%; background: #fff7ed; color: #a05f34; border: 1px solid #f3ddc7; font-size: 11px; text-align: center; }',
    '.sfw-typing { display: flex; align-items: center; gap: 4px; padding: 10px 12px; background: #eef1ed; border-radius: 12px; align-self: flex-start; }',
    '.sfw-typing i { width: 5px; height: 5px; border-radius: 50%; background: var(--sfw-accent); animation: sfw-bounce 1s infinite ease-in-out; }',
    '.sfw-typing i:nth-child(2) { animation-delay: .15s; }',
    '.sfw-typing i:nth-child(3) { animation-delay: .3s; }',
    '@keyframes sfw-bounce { 0%, 80%, 100% { transform: translateY(0); opacity: .45; } 40% { transform: translateY(-3px); opacity: 1; } }',
    '.sfw-inputbar { display: flex; gap: 8px; align-items: center; padding: 10px; border-top: 1px solid #e9ece8; background: #fff; }',
    '.sfw-inputbar input { flex: 1; min-width: 0; border: 1px solid #e3e8e2; background: #fbfcfb; border-radius: 8px; padding: 10px 11px; font-size: 12.5px; color: #37413a; outline: none; }',
    '.sfw-inputbar input:focus { border-color: var(--sfw-accent); background: #fff; }',
    '.sfw-inputbar input:disabled { background: #f2f4f1; color: #9aa39c; cursor: not-allowed; }',
    '.sfw-send { border: 0; width: 38px; height: 38px; border-radius: 8px; display: grid; place-items: center; background: var(--sfw-accent); color: #fff; cursor: pointer; flex: 0 0 auto; }',
    '.sfw-send:disabled { opacity: .5; cursor: wait; }',
    '.sfw-send svg { width: 16px; height: 16px; }',
    '.sfw-foot { padding: 8px 12px 11px; background: #fff; border-top: 1px solid #f0f2ef; color: #a4aaa5; font-size: 9.5px; text-align: center; }',
    '@media (max-width: 480px) { .sfw-panel { bottom: 84px; } .sfw-launcher { bottom: 16px; width: 50px; height: 50px; } .sfw-pos-right .sfw-launcher, .sfw-pos-right .sfw-panel { right: 16px; } .sfw-pos-left .sfw-launcher, .sfw-pos-left .sfw-panel { left: 16px; } }',
    '@media (prefers-reduced-motion: reduce) { .sfw-panel, .sfw-launcher { transition: none; } .sfw-typing i { animation: none; } }'
  ].join('')

  var ICONS = {
    launcher: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z"/></svg>'
  }

  function el(tag, className, inner) {
    var node = document.createElement(tag)
    if (className) node.className = className
    if (inner !== undefined) node.innerHTML = inner
    return node
  }

  function createWidget(inputConfig) {
    var config = normalizeConfig(inputConfig)
    var existing = document.getElementById(HOST_ID)
    if (existing) existing.remove()

    var host = el('div')
    host.id = HOST_ID
    var shadow = host.attachShadow({ mode: 'open' })
    var style = document.createElement('style')
    style.textContent = CSS
    shadow.appendChild(style)

    var state = {
      open: false,
      pending: false,
      historyLoaded: false,
      handoff: false,
      destroyed: false,
      messages: []
    }
    var canChat = isAllowed(config, 'chat')
    state.messages.push(canChat
      ? { role: 'assistant', content: config.greeting }
      : { role: 'system', content: 'Chat belum diaktifkan pada instalasi ini — endpoint /api/chat/public tidak dipilih saat instalasi. Jalankan ulang "supportflow-widget init" untuk memilihnya.' })

    var launcher = el('button', 'sfw-launcher', ICONS.launcher)
    launcher.type = 'button'
    launcher.setAttribute('aria-label', 'Buka chat support')
    launcher.setAttribute('aria-expanded', 'false')

    var head = el('div', 'sfw-head')
    var logo = el('div', 'sfw-logo', ICONS.spark)
    var headCopy = el('div', 'sfw-head-copy')
    var headTitle = el('strong', '', config.title)
    var headStatus = el('span', '')
    var statusDot = el('i', 'sfw-status-dot off')
    var statusText = el('em', '', isAllowed(config, 'health') ? 'Memeriksa server…' : 'Usually replies instantly')
    statusText.style.fontStyle = 'normal'
    headStatus.appendChild(statusDot)
    headStatus.appendChild(statusText)
    headCopy.appendChild(headTitle)
    headCopy.appendChild(headStatus)
    var closeBtn = el('button', 'sfw-close', '×')
    closeBtn.type = 'button'
    closeBtn.setAttribute('aria-label', 'Tutup chat')
    head.appendChild(logo)
    head.appendChild(headCopy)
    head.appendChild(closeBtn)

    var body = el('div', 'sfw-body')
    body.setAttribute('aria-live', 'polite')

    var inputbar = el('div', 'sfw-inputbar')
    var input = document.createElement('input')
    input.type = 'text'
    input.placeholder = canChat ? 'Tulis pesan…' : 'Chat nonaktif (endpoint belum dipilih)'
    input.setAttribute('aria-label', 'Pesan chat')
    if (!canChat) input.disabled = true
    var sendBtn = el('button', 'sfw-send', ICONS.send)
    sendBtn.type = 'button'
    sendBtn.setAttribute('aria-label', 'Kirim pesan')
    if (!canChat) sendBtn.disabled = true
    inputbar.appendChild(input)
    inputbar.appendChild(sendBtn)

    var foot = el('div', 'sfw-foot', 'Powered by SupportFlow AI')

    var panel = el('div', 'sfw-panel')
    panel.appendChild(head)
    panel.appendChild(body)
    panel.appendChild(inputbar)
    panel.appendChild(foot)

    var rootWrap = el('div', 'sfw-root ' + (config.position === 'left' ? 'sfw-pos-left' : 'sfw-pos-right'))
    rootWrap.appendChild(panel)
    rootWrap.appendChild(launcher)
    shadow.appendChild(rootWrap)

    function render() {
      body.innerHTML = ''
      state.messages.forEach(function (entry) {
        body.appendChild(el('div', 'sfw-msg ' + (entry.role === 'user' ? 'user' : entry.role === 'system' ? 'system' : ''), escapeHtml(entry.content)))
      })
      if (state.pending) {
        var typing = el('div', 'sfw-typing', '<i></i><i></i><i></i>')
        body.appendChild(typing)
      }
      body.scrollTop = body.scrollHeight
    }

    function updateStatus() {
      statusText.textContent = state.handoff ? 'Terhubung ke tim manusia' : statusText.textContent
      foot.textContent = state.handoff ? 'A human agent will join shortly' : 'Powered by SupportFlow AI'
    }

    function setOpen(next) {
      state.open = next
      panel.classList.toggle('open', next)
      launcher.setAttribute('aria-expanded', String(next))
      if (next) {
        if (!state.historyLoaded && isAllowed(config, 'history')) {
          state.historyLoaded = true
          loadHistory()
        }
        if (isAllowed(config, 'conversations')) checkHandoff()
        if (canChat) input.focus()
      }
    }

    async function loadHistory() {
      try {
        var payload = await request(config, 'history', { method: 'GET' })
        if (state.destroyed || !payload || !Array.isArray(payload.messages) || !payload.messages.length) return
        state.messages = payload.messages
          .filter(function (m) { return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' })
          .map(function (m) { return { role: m.role, content: m.content } })
        if (!state.messages.length) state.messages = [{ role: 'assistant', content: config.greeting }]
        render()
      } catch (error) { /* riwayat opsional */ }
    }

    async function checkHandoff() {
      try {
        var payload = await request(config, 'conversations', { method: 'GET' })
        if (state.destroyed || !payload || !Array.isArray(payload.data)) return
        var match = payload.data.find(function (row) { return row.id === config.conversationId })
        if (match && match.status === 'HUMAN_HANDOFF') {
          state.handoff = true
          updateStatus()
        }
      } catch (error) { /* status opsional */ }
    }

    async function checkHealth() {
      if (!isAllowed(config, 'health')) {
        statusDot.classList.remove('off')
        statusText.textContent = 'Usually replies instantly'
        return
      }
      try {
        await request(config, 'health', { method: 'GET' })
        statusDot.classList.remove('off')
        if (!state.handoff) statusText.textContent = 'Server aktif · biasanya balas instan'
      } catch (error) {
        statusDot.classList.add('off')
        if (!state.handoff) statusText.textContent = 'Server tidak terjangkau'
      }
    }

    async function send() {
      var text = input.value.trim()
      if (!text || state.pending || !canChat) return
      state.messages.push({ role: 'user', content: text })
      input.value = ''
      state.pending = true
      render()
      sendBtn.disabled = true
      try {
        var payload = await request(config, 'chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            conversationId: config.conversationId,
            messages: state.messages
              .filter(function (m) { return m.role === 'user' || m.role === 'assistant' })
              .slice(-12)
          })
        })
        if (!payload || typeof payload.message !== 'string') throw new Error('Balasan AI tidak valid')
        state.messages.push({ role: 'assistant', content: payload.message })
        if (payload.status === 'HUMAN_HANDOFF') {
          state.handoff = true
          updateStatus()
        }
      } catch (error) {
        var notice = error && error.code === 'ENDPOINT_DISABLED'
          ? error.message
          : 'Maaf, terjadi gangguan saat menghubungi server. (' + (error && error.message ? error.message : 'error') + ')'
        state.messages.push({ role: 'system', content: notice })
      } finally {
        state.pending = false
        if (!state.destroyed) sendBtn.disabled = false
        render()
      }
    }

    launcher.addEventListener('click', function () { setOpen(!state.open) })
    closeBtn.addEventListener('click', function () { setOpen(false) })
    sendBtn.addEventListener('click', function () { void send() })
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { event.preventDefault(); void send() }
    })

    var api = {
      config: config,
      open: function () { setOpen(true) },
      close: function () { setOpen(false) },
      toggle: function () { setOpen(!state.open) },
      isAllowed: function (endpointId) { return isAllowed(config, endpointId) },
      destroy: function () {
        state.destroyed = true
        host.remove()
      }
    }
    host.__sfw_api = api
    render()
    checkHealth()
    return { host: host, api: api }
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function init(config) {
    var run = function () {
      var created = createWidget(config)
      document.body.appendChild(created.host)
      return created.api
    }
    if (typeof document === 'undefined') throw new Error('SupportFlowWidget: init hanya bisa dijalankan di browser')
    if (document.body) return run()
    return new Promise(function (resolve) {
      document.addEventListener('DOMContentLoaded', function () { resolve(run()) }, { once: true })
    })
  }

  function maybeAutoInit() {
    try {
      var auto = root.SUPPORTFLOW_WIDGET_CONFIG
      if (auto && typeof document !== 'undefined' && !document.getElementById(HOST_ID)) init(auto)
    } catch (error) {
      console.error('[supportflow-widget]', error)
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybeAutoInit)
    else maybeAutoInit()
  }

  return { init: init, CATALOG: CATALOG, version: '1.0.0' }
})
