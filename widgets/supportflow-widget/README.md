# supportflow-widget

Widget chat SupportFlow berupa **vanilla JS + script tag** (zero dependency, Shadow DOM — CSS tidak bentrok dengan project tujuan), plus **CLI instalasi interaktif** yang menanyakan endpoint mana yang boleh dipakai widget.

## Instalasi ke project lain

```bash
npm install supportflow-widget        # atau: pnpm add supportflow-widget
npx supportflow-widget init
```

Saat `init`, kamu akan ditanya:

1. **Base URL backend** SupportFlow (contoh: `https://api.example.com`)
2. **Conversation ID** (kosongkan = dibuat otomatis + disimpan di localStorage)
3. **Judul widget** & **warna aksen** (HEX)
4. **Endpoint: semua atau pilih tertentu** — balas `1` untuk semua endpoint, `2` untuk memilih per nomor:

   | # | Endpoint | Method | Fungsi di widget |
   |---|----------|--------|------------------|
   | 1 | `/api/chat/public` | POST | Mengirim & menerima pesan |
   | 2 | `/api/chat/public/history` | GET | Memuat riwayat saat dibuka |
   | 3 | `/api/conversations` | GET | Status handoff ke manusia |
   | 4 | `/api/health` | GET | Indikator status server |

Hasilnya: **`supportflow-widget.config.json`** di folder project + snippet embed yang dicetak ke terminal. Endpoint yang tidak dipilih **ditolak di runtime** oleh widget (input nonaktif / fitur disembunyikan), bukan hanya disembunyikan dari config.

### Mode non-interaktif (CI)

```bash
npx supportflow-widget init --yes --base-url=https://api.example.com --endpoints=chat,history
```

## Pemakaian

### Script tag (HTML apa pun)

```html
<script src="https://unpkg.com/supportflow-widget/src/widget.js"></script>
<script>
  window.SUPPORTFLOW_WIDGET_CONFIG = { "baseUrl": "https://api.example.com", "conversationId": "demo-1", "title": "SupportFlow", "accentColor": "#4263eb", "endpoints": "*" }
</script>
```

Konfigurasi lewat `window.SUPPORTFLOW_WIDGET_CONFIG` akan auto-init saat DOM siap. Alternatif: panggil manual.

### JS (React / Vue / Next.js / dll.)

```js
const SupportFlowWidget = require('supportflow-widget')
// atau: import SupportFlowWidget from 'supportflow-widget'

SupportFlowWidget.init({
  baseUrl: 'https://api.example.com',
  conversationId: 'demo-1',
  title: 'SupportFlow',
  accentColor: '#4263eb',
  endpoints: ['chat', 'history']   // '*' = semua
})
```

`init()` mengembalikan `{ open, close, toggle, destroy, isAllowed, config }`.

## Endpoint tertentu ≠ hanya config

`endpoints` adalah **allowlist runtime**:

- `'*'` → semua endpoint katalog diizinkan.
- `['chat']` → widget menolak `history`/`conversations`/`health` (tidak pernah di-fetch).
- Tanpa `chat` → input pesan nonaktif dan widget menampilkan pesan system yang menjelaskan alasannya.

## Server backend

Endpoint publik widget sudah mengirim header CORS (`WIDGET_ALLOWED_ORIGINS`, default `*`; bisa diisi daftar origin dipisah koma di `.env`). Endpoint auth **tidak** dibuka CORS-nya.

## Demo lokal

```bash
node demo/serve.js     # http://localhost:8080/demo/index.html
```

(Kebutuhan backend di `http://localhost:3000`.)

## Struktur

```
supportflow-widget/
├── package.json          # bin: supportflow-widget
├── bin/cli.js            # CLI interaktif init
├── src/widget.js         # widget vanilla UMD (browser + require)
├── demo/                 # halaman contoh lintas origin
└── README.md
```
