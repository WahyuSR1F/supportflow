/**
 * Knowledge Base resmi — satu-satunya sumber jawaban CS AI.
 * Edit konten di sini; system prompt dibangun otomatis dari data ini.
 */

export type KnowledgeSection = { title: string; items: string[] }

export const knowledgeSections: KnowledgeSection[] = [
  {
    title: 'JAM OPERASIONAL & KONTAK',
    items: [
      'Jam Operasional Layanan CS: Senin - Jumat (08:00 - 17:00 WIB).',
      'Email Dukungan: support@perusahaan.com',
    ],
  },
  {
    title: 'AKUN & LOGIN',
    items: [
      "Lupa Kata Sandi: Pengguna bisa klik 'Lupa Password' di halaman login, lalu periksa email untuk link reset password.",
      'Ubah Profil: Buka menu Pengaturan Akun > Edit Profil.',
    ],
  },
  {
    title: 'PEMBAYARAN & LANGGANAN',
    items: [
      'Metode Pembayaran: Transfer Bank (VA), QRIS, E-Wallet (Gopay, OVO, ShopeePay), dan Kartu Kredit.',
      'Kebijakan Refund: Pengembalian dana hanya bisa diproses maksimal 1x24 jam setelah transaksi jika terjadi kegagalan sistem.',
    ],
  },
  {
    title: 'MASALAH TEKNIS UMUM',
    items: [
      'Aplikasi Error / Blank: Sarankan pengguna untuk clear cache browser, update aplikasi ke versi terbaru, atau pastikan koneksi internet stabil.',
    ],
  },
]

export const escalationRules = [
  'Kamu WAJIB memanggil tool/fungsi `escalateToHuman` apabila mengalami salah satu kondisi berikut:',
  '- Pertanyaan pengguna TIDAK TERSEDIA atau TIDAK BISA dijawab menggunakan Knowledge Base di atas.',
  '- Pengguna secara eksplisit meminta berbicara dengan manusia, CS, admin, atau operator.',
  '- Pengguna mengalami masalah transaksi/pembayaran khusus yang membutuhkan pengecekan database internal.',
  '- Pengguna menyampaikan keluhan serius atau frustrasi berulang.',
  '',
  'Saat memanggil `escalateToHuman`, informasikan secara singkat dan sopan kepada pengguna bahwa percakapan sedang dihubungkan ke tim Customer Service kami.',
].join('\n')

const knowledgeBlock = knowledgeSections
  .map((section, index) => `${index + 1}. ${section.title}:\n   - ${section.items.join('\n   - ')}`)
  .join('\n')

export const systemPrompt = `Kamu adalah Customer Service AI resmi untuk [Nama Perusahaan/Aplikasi].
Tugas utamamu adalah membantu pengguna menjawab pertanyaan seputar layanan, produk, dan masalah teknis ringan berdasarkan Knowledge Base resmi di bawah ini.

==================================================
KNOWLEDGE BASE (DOKUMEN REFERENSI RESMI):
==================================================
${knowledgeBlock}

==================================================
ATURAN & PERILAKU UTAMA:
==================================================
1. Gaya Bahasa: Ramah, sopan, profesional, dan gunakan Bahasa Indonesia yang jelas serta mudah dipahami.
2. Batasan Informasi: Jawab HANYA menggunakan informasi yang ada pada KNOWLEDGE BASE di atas.
3. Larangan Murni: DILARANG mengarang jawaban (hallucination), memberikan estimasi yang tidak tercantum, atau memberikan janji teknis di luar dokumen ini.
4. Instruksi Handover / Escalation:
${escalationRules}`

export const HANDOFF_ACKNOWLEDGEMENT =
  'Baik, percakapan kamu sedang saya hubungkan ke tim Customer Service kami. Mohon ditunggu sebentar, ya.'

export const OUT_OF_SCOPE_HANDOFF =
  'Mohon maaf, pertanyaan Anda berada di luar cakupan pengetahuan saya. Percakapan ini akan saya hubungkan ke tim Customer Service kami untuk dibantu lebih lanjut. Terima kasih atas pengertiannya.'

export const HANDOFF_MARKER = '[[ESCALATE_TO_HUMAN]]'

/**
 * Deteksi sisi server (fallback deterministik) untuk kondisi eskalasi.
 * LLM tetap bisa memicu handoff lewat marker [[ESCALATE_TO_HUMAN]] di jawabannya.
 */
const escalationPatterns = [
  /bicara\s+(dengan\s+)?(manusia|cs|customer\s*service|admin|operator|orang)/i,
  /sambung(kan)?\s+(ke\s+)?(cs|admin|operator|agen|agent)/i,
  /mau\s+hubungi\s+(cs|admin|operator|agen|agent)/i,
  /chat\s+dengan\s+(cs|admin|manusia)/i,
  /ke\s+manusia/i,
  /human\s+(agent|support)/i,
  /speak\s+to\s+(a\s+)?(human|agent)/i,
  /komplain/i,
  /kecewa|kesal|marah|frustrasi|unfa?h?un?fa?h?/i,
  /dana\s+(tidak\s+)?(masuk|dipotong)/i,
  /uang\s+(tidak\s+)?(masuk|dipotong)/i,
  /refund\s+(belum|gagal|ditolak)/i,
  /transaksi\s+(gagal|dobel|ganda)/i,
  /terpotong\s+(dua\s+kali|2\s*kali)/i,
]

export const isEscalationRequest = (text: string) => escalationPatterns.some((pattern) => pattern.test(text))

/**
 * Mesin jawab deterministik dari Knowledge Base — dipakai saat LLM tidak tersedia.
 * Mengembalikan null jika pertanyaan tidak tercakup KB (→ harus di-escalate).
 */
const kbAnswerRules: Array<{ patterns: RegExp[]; answer: string }> = [
  {
    patterns: [/^(hai|halo|hi|hello|hallo|pagi|siang|sore|malam|assalamualaikum)\b/i],
    answer: 'Halo! Selamat datang di layanan Customer Service kami. Ada yang bisa dibantu seputar akun, pembayaran, atau masalah teknis?',
  },
  {
    patterns: [/jam\s+(operasional|buka|kerja|layanan)/, /(buka|aktif)\s+jam/, /operasional/, /hari\s+(apa\s+)?(saja\s+)?buka/],
    answer: 'Jam operasional layanan CS kami adalah Senin - Jumat, pukul 08:00 - 17:00 WIB.',
  },
  {
    patterns: [/email|kontak|cara hubung/i],
    answer: 'Anda dapat menghubungi kami melalui email support@perusahaan.com (Senin - Jumat, 08:00 - 17:00 WIB).',
  },
  {
    patterns: [/lupa\s+(password|kata\s+sandi|sandi)/, /reset\s+password/, /ganti\s+password/, /tidak\s+bisa\s+login.*password/],
    answer: "Untuk lupa kata sandi: klik 'Lupa Password' di halaman login, lalu periksa email Anda untuk membuka link reset password.",
  },
  {
    patterns: [/ubah\s+profil|edit\s+profil|ganti\s+profil|update\s+profil|ganti\s+(nama|foto)/i],
    answer: 'Untuk mengubah profil: buka menu Pengaturan Akun > Edit Profil.',
  },
  {
    patterns: [/metode\s+pembayaran|cara\s+bayar|bisa\s+bayar|pembayaran\s+(apa|gimana|bagaimana)|qris|gopay|ovo|shopeepay|kartu\s+kredit|transfer\s+bank|\bva\b|virtual\s+account/i],
    answer: 'Metode pembayaran yang tersedia: Transfer Bank (VA), QRIS, E-Wallet (Gopay, OVO, ShopeePay), dan Kartu Kredit.',
  },
  {
    patterns: [/refund|pengembalian\s+dana|dana\s+kembali|uang\s+kembali/i],
    answer: 'Kebijakan refund: pengembalian dana hanya bisa diproses maksimal 1x24 jam setelah transaksi jika terjadi kegagalan sistem.',
  },
  {
    patterns: [/\berror\b|blank|layar\s+(putih|kosong)|tidak\s+bisa\s+(buka|akses)|aplikasi\s+(nge?bug|macet|tidak\s+merespons)/i],
    answer: 'Untuk aplikasi error/blank: silakan clear cache browser, update aplikasi ke versi terbaru, dan pastikan koneksi internet stabil.',
  },
]

export const answerFromKnowledgeBase = (text: string): string | null => {
  for (const rule of kbAnswerRules) {
    if (rule.patterns.some((pattern) => pattern.test(text))) return rule.answer
  }
  return null
}
