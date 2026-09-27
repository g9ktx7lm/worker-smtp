<div align="center">

# 📧 SukaPedia Email Worker

**Cloudflare Worker untuk kirim email transaksional (OTP & reset password) via SMTP**

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/license-Internal-red.svg)](#-lisensi)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()

Solusi bypass blokir port SMTP (25/465/587) yang umum diterapkan provider hosting VPS.
Flask cukup panggil HTTP GET — Worker yang urus koneksi SMTP di edge network Cloudflare.

</div>

---

## 📑 Daftar Isi

- [✨ Fitur](#-fitur)
- [🚀 Quick Start](#-quick-start)
- [📦 Environment Variables](#-environment-variables)
- [🔐 Kredensial Gmail (App Password)](#-kredensial-gmail-app-password)
- [🛰️ API Reference](#️-api-reference)
- [📨 Format Response](#-format-response)
- [💡 Contoh Penggunaan](#-contoh-penggunaan)
- [🐍 Integrasi Flask](#-integrasi-flask)
- [🛠️ Troubleshooting](#️-troubleshooting)
- [🔒 Keamanan](#-keamanan)
- [⚠️ Batasan](#️-batasan)
- [📁 Struktur Repo](#-struktur-repo)
- [📝 Changelog](#-changelog)
- [📄 Lisensi](#-lisensi)

---

## ✨ Fitur

- ✅ **Bypass blokir port SMTP** — pakai TCP Socket Cloudflare, bebas dari firewall VPS
- ✅ **Template HTML siap pakai** — OTP & Reset Password sudah tertanam di Worker
- ✅ **Auth via `api_key`** — dari env, bukan hardcoded
- ✅ **Semua endpoint `GET`** — tinggal buka URL atau `fetch()` biasa
- ✅ **Zero dependency** — tidak perlu `npm install`, pure JavaScript
- ✅ **Response konsisten** — `{ status, message, error }` di semua endpoint
- ✅ **Support port 465 (TLS) & 587 (STARTTLS)** — auto-detect

---

## 🚀 Quick Start

### 1. Deploy Worker via Cloudflare Dashboard

1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Create Worker**
2. Beri nama, misal `sukapedia-email`
3. Klik **Deploy** (terima template default dulu)
4. Klik **Edit code** → **hapus semua isi editor** → paste isi [`worker.js`](./worker.js)
5. Klik **Deploy**

### 2. Set Environment Variables

Masuk ke **Settings → Variables and Secrets**, tambahkan variabel berikut.
Lihat [`.env.example`](./.env.example) untuk template lengkap dengan komentar.

| Nama | Tipe | Wajib | Contoh |
|------|------|:-----:|--------|
| `API_KEY` | **Secret** | ✅ | `api_key` |
| `SMTP_HOST` | Text | ✅ | `smtp.gmail.com` |
| `SMTP_PORT` | Text | ✅ | `465` |
| `SMTP_USER` | Text | ✅ | `email_anda@gmail.com` |
| `SMTP_PASSWORD` | **Secret** | ✅ | `abcdefghijklmnop` |
| `SMTP_FROM` | Text | ✅ | `SukaPedia <email_anda@gmail.com>` |
| `BRAND_NAME` | Text | ⚪ | `SukaPedia` |

Setelah semua ditambah, klik **Deploy** ulang.

### 3. Verifikasi

```bash
curl "https://sukapedia-email.<username>.workers.dev/health"
```

Harus balas:

```json
{ "status": true, "message": "Worker aktif", "error": "" }
```

### 4. Kirim Email Pertama

```bash
curl "https://sukapedia-email.<username>.workers.dev/api/send-otp?api_key=<API_KEY>&email=emailkamu@gmail.com&otp=123456"
```

---

## 📦 Environment Variables

### Variabel Utama

| Nama | Tipe | Wajib | Default | Keterangan |
|------|------|:-----:|:-------:|------------|
| `API_KEY` | Secret | ✅ | – | Kunci autentikasi. Generate dengan `openssl rand -hex 32`. |
| `SMTP_HOST` | Text | ✅ | – | Host SMTP (lihat tabel provider). |
| `SMTP_PORT` | Text | ✅ | `465` | Port SMTP. |
| `SMTP_USER` | Text | ✅ | – | Username SMTP. |
| `SMTP_PASSWORD` | Secret | ✅ | – | Password SMTP / App Password. |
| `SMTP_FROM` | Text | ✅ | = `SMTP_USER` | Alamat pengirim. |
| `BRAND_NAME` | Text | ⚪ | `SukaPedia` | Nama brand di footer email. |

### Pilihan Port SMTP

| Port | Mode | Catatan |
|:----:|------|---------|
| `465` | Implicit TLS | **Rekomendasi** — paling stabil |
| `587` | STARTTLS | Alternatif |
| `25` | Plain | Jarang, biasanya diblokir |
| `2525` | STARTTLS | Khusus Mailgun & Brevo |

### Config per Provider

<details>
<summary><b>📮 Gmail (klik untuk buka)</b></summary>

```env
API_KEY=api_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=email_anda@gmail.com
SMTP_PASSWORD=smtp_password_kamu
SMTP_FROM=SukaPedia <email_anda@gmail.com>
BRAND_NAME=SukaPedia
```

**Limit**: ~500 email/hari.
</details>

<details>
<summary><b>📮 Brevo (klik untuk buka)</b></summary>

```env
API_KEY=api_key
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=nama@email.com
SMTP_PASSWORD=brevo-smtp-key
SMTP_FROM=SukaPedia <noreply@email_anda>
BRAND_NAME=SukaPedia
```

**Limit**: 300 email/hari gratis.
</details>

<details>
<summary><b>📮 Mailgun (klik untuk buka)</b></summary>

```env
API_KEY=api_key
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=465
SMTP_USER=postmaster@email_anda
SMTP_PASSWORD=mailgun-smtp-password
SMTP_FROM=SukaPedia <noreply@email_anda>
BRAND_NAME=SukaPedia
```

Wajib verifikasi domain (SPF/DKIM).
</details>

<details>
<summary><b>📮 SendGrid (klik untuk buka)</b></summary>

```env
API_KEY=api_key
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxxxxxxxxxxxxxxxxxxxxx
SMTP_FROM=SukaPedia <noreply@email_anda>
BRAND_NAME=SukaPedia
```

**Catatan**: `SMTP_USER` **harus literal** `apikey`.
</details>

### Daftar Host SMTP Populer

| Provider | Host |
|----------|------|
| Gmail / Google Workspace | `smtp.gmail.com` |
| Brevo | `smtp-relay.brevo.com` |
| Mailgun | `smtp.mailgun.org` |
| SendGrid | `smtp.sendgrid.net` |
| Mailjet | `in-v3.mailjet.com` |
| Zoho | `smtp.zoho.com` |
| Outlook / Office 365 | `smtp.office365.com` |
| Yahoo | `smtp.mail.yahoo.com` |

### Env untuk Flask

| Nama | Contoh | Keterangan |
|------|--------|------------|
| `EMAIL_WORKER_URL` | `https://sukapedia-email.<user>.workers.dev` | URL Worker (tanpa trailing slash). |
| `EMAIL_WORKER_KEY` | `api_key` | **Harus sama** dengan `API_KEY` Worker. |

---

## 🔐 Kredensial Gmail (App Password)

Gmail **menolak** password akun biasa untuk SMTP sejak 2022. Wajib **App Password**.

1. **Aktifkan 2-Step Verification**
   → https://myaccount.google.com/security

2. **Generate App Password**
   → https://myaccount.google.com/apppasswords
   → Pilih app: **Mail** → device: **Other** → isi `SukaPedia`
   → Copy 16 karakter (misal `abcd efgh ijkl mnop`)

3. **Hapus semua spasi** → `abcdefghijklmnop`
   → Paste sebagai `SMTP_PASSWORD` (tipe **Secret**)

4. **Deploy ulang** Worker

> ⚠️ App Password hanya muncul **sekali**. Kalau hilang, generate ulang.

---

## 🛰️ API Reference

Semua endpoint pakai **HTTP `GET`**.

| Endpoint | Auth | Fungsi |
|----------|:----:|--------|
| `/` atau `/health` | ❌ | Cek Worker hidup |
| `/api/send-otp` | ✅ | Kirim OTP dengan template |
| `/api/send-password` | ✅ | Kirim password baru dengan template |
| `/api/send-custom` | ✅ | Kirim email bebas |

### `GET /api/send-otp`

| Param | Wajib | Format | Keterangan |
|-------|:-----:|--------|------------|
| `api_key` | ✅ | String | Harus sama dengan env `API_KEY` |
| `email` | ✅ | Email | Penerima |
| `otp` | ✅ | 4–8 digit | Kode OTP |

**Template**: HTML dengan heading "Kode Verifikasi", kotak besar berisi OTP, info berlaku 5 menit.

### `GET /api/send-password`

| Param | Wajib | Format | Keterangan |
|-------|:-----:|--------|------------|
| `api_key` | ✅ | String | Harus sama dengan env `API_KEY` |
| `email` | ✅ | Email | Penerima |
| `password` | ✅ | String | Password baru |

**Template**: HTML dengan heading "Password Baru", kotak berisi password, arahan ubah di menu Profile.

### `GET /api/send-custom`

| Param | Wajib | Format | Keterangan |
|-------|:-----:|--------|------------|
| `api_key` | ✅ | String | Harus sama dengan env `API_KEY` |
| `email` | ✅ | Email | Penerima |
| `subject` | ✅ | String | Subjek email |
| `html` | salah satu | HTML | Body HTML |
| `text` | salah satu | String | Body plain-text |

---

## 📨 Format Response

Semua response (sukses / gagal) selalu:

```json
{
  "status": true,
  "message": "Kode OTP berhasil dikirim ke user@example.com",
  "error": ""
}
```

| Field | Tipe | Keterangan |
|-------|------|------------|
| `status` | Boolean | `true` = sukses, `false` = gagal |
| `message` | String | Pesan deskriptif |
| `error` | String | Detail error teknis (`""` jika sukses) |

### Contoh

**✅ Sukses**
```json
{ "status": true, "message": "Kode OTP berhasil dikirim ke user@example.com", "error": "" }
```

**❌ Auth gagal**
```json
{ "status": false, "message": "Autentikasi gagal", "error": "api_key tidak valid" }
```

**❌ SMTP gagal**
```json
{ "status": false, "message": "Gagal mengirim kode OTP", "error": "SMTP expected 235, got: [\"535-5.7.8 Username and Password not accepted\"]" }
```

**❌ Parameter kurang**
```json
{ "status": false, "message": "Parameter email & otp wajib", "error": "Missing: email/otp" }
```

### HTTP Status Code

| Code | Arti |
|:----:|------|
| `200` | Sukses |
| `400` | Parameter kurang / format salah |
| `401` | `api_key` salah / tidak ada |
| `404` | Endpoint tidak ditemukan |
| `500` | Error internal (SMTP gagal, env kurang, dsb) |

---

## 💡 Contoh Penggunaan

### cURL

```bash
# Kirim OTP
curl "https://sukapedia-email.<username>.workers.dev/api/send-otp?api_key=<API_KEY>&email=user@example.com&otp=123456"

# Kirim Password
curl "https://sukapedia-email.<username>.workers.dev/api/send-password?api_key=<API_KEY>&email=user@example.com&password=Ab3xyz123"

# Kirim Custom
curl "https://sukapedia-email.<username>.workers.dev/api/send-custom?api_key=<API_KEY>&email=user@example.com&subject=Halo&text=Ini+pesan+tes"
```

### JavaScript (Browser)

```javascript
const WORKER  = 'https://sukapedia-email.<username>.workers.dev';
const API_KEY = 'api_key';

async function kirimOtp(email, otp) {
  const url = new URL(`${WORKER}/api/send-otp`);
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('email', email);
  url.searchParams.set('otp', otp);

  const res  = await fetch(url.toString());
  const data = await res.json();

  if (!data.status) {
    console.error('Gagal:', data.message, data.error);
    return false;
  }
  console.log('Sukses:', data.message);
  return true;
}

kirimOtp('user@example.com', '123456');
```

### Python (Requests — sync)

```python
import requests

WORKER  = 'https://sukapedia-email.<username>.workers.dev'
API_KEY = 'api_key'

def kirim_otp(email: str, otp: str):
    r = requests.get(f'{WORKER}/api/send-otp', params={
        'api_key': API_KEY,
        'email': email,
        'otp': otp,
    }, timeout=30)
    return r.json()
```

### Python (aiohttp — async)

```python
import aiohttp

WORKER  = 'https://sukapedia-email.<username>.workers.dev'
API_KEY = 'api_key'

async def kirim_otp(email: str, otp: str):
    params = {'api_key': API_KEY, 'email': email, 'otp': otp}
    async with aiohttp.ClientSession() as s:
        async with s.get(f'{WORKER}/api/send-otp', params=params) as r:
            return await r.json()
```

### PHP

```php
<?php
function kirimOtp($email, $otp) {
    $worker = "https://sukapedia-email.<username>.workers.dev";
    $apiKey = "api_key";

    $url = $worker . "/api/send-otp?" . http_build_query([
        'api_key' => $apiKey,
        'email'   => $email,
        'otp'     => $otp,
    ]);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $res = curl_exec($ch);
    curl_close($ch);

    return json_decode($res, true);
}
```

---

## 🐍 Integrasi Flask

### 1. Ganti `app/modules/web/otpmail.py`

Tidak perlu lagi `aiosmtplib` atau template HTML di Python.

```python
import os
import aiohttp

EMAIL_WORKER_URL = os.getenv("EMAIL_WORKER_URL")
EMAIL_WORKER_KEY = os.getenv("EMAIL_WORKER_KEY")


async def _get_worker(path: str, params: dict) -> dict:
    """Panggil Worker, kembalikan dict {status, message, error}."""
    if not EMAIL_WORKER_URL or not EMAIL_WORKER_KEY:
        return {
            "status": False,
            "message": "Konfigurasi email worker belum diset",
            "error": "EMAIL_WORKER_URL / EMAIL_WORKER_KEY kosong",
        }

    timeout = aiohttp.ClientTimeout(total=30)
    params  = {**params, "api_key": EMAIL_WORKER_KEY}

    try:
        async with aiohttp.ClientSession(timeout=timeout) as s:
            async with s.get(f"{EMAIL_WORKER_URL}{path}", params=params) as r:
                return await r.json()
    except Exception as e:
        return {
            "status": False,
            "message": "Gagal menghubungi email worker",
            "error": str(e),
        }


async def send_otp_email(email: str, otp: str) -> dict:
    return await _get_worker("/api/send-otp", {"email": email, "otp": otp})


async def send_password_email(email: str, password: str) -> dict:
    return await _get_worker("/api/send-password", {"email": email, "password": password})
```

### 2. Update `.env` Flask

```env
EMAIL_WORKER_URL=https://sukapedia-email.<username>.workers.dev
EMAIL_WORKER_KEY=api_key
```

### 3. Update `forgot_password`

```python
async def forgot_password(email: str):
    email = (email or "").strip()

    if not is_valid_email(email):
        return {'status': False, 'message': 'Format email tidak valid'}

    async with aiosqlite.connect(database_user) as db:
        async with db.execute(
            "SELECT password FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1",
            (email,)
        ) as cursor:
            row = await cursor.fetchone()

    if not row:
        return {'status': False, 'message': 'Email tidak ditemukan'}

    password_lama = row[0]
    new_password  = generate_password()

    # 1) Update password di DB
    result = await edit_password_v2(email, new_password)
    if not result.get("status"):
        return result

    # 2) Kirim email via Worker
    mail_result = await send_password_email(email, new_password)
    if not mail_result.get("status"):
        # Rollback password kalau email gagal
        async with aiosqlite.connect(database_user) as db:
            await db.execute(
                "UPDATE users SET password = ? WHERE LOWER(email) = LOWER(?)",
                (password_lama, email)
            )
            await db.commit()
        return {
            'status': False,
            'message': mail_result.get('message', 'Gagal mengirim email'),
        }

    return {'status': True, 'message': 'Password baru berhasil dikirim ke email'}
```

---

## 🛠️ Troubleshooting

### Cek Worker Hidup

```bash
curl "https://<worker-url>/health"
```

### Error Umum

| Response Error | Penyebab | Fix |
|----------------|----------|-----|
| `api_key tidak valid` | API key ≠ env | Cek env Worker & Flask |
| `API_KEY belum diset` | Env kosong | Set di Settings → Variables |
| `SMTP env belum lengkap` | Salah satu SMTP env kosong | Lengkapi env Worker |
| `SMTP expected 220` | Tidak bisa konek SMTP | Cek `SMTP_HOST` & `SMTP_PORT` |
| `SMTP expected 235` | Auth gagal | Gmail: pakai **App Password** |
| `SMTP expected 250` | `SMTP_FROM` ≠ `SMTP_USER` | Gmail: wajib sama |
| `SMTP connection closed` | Provider tutup koneksi | Coba port 465 ↔ 587 |
| `Endpoint tidak ditemukan` | Path salah | Cek `/api/send-otp` dsb |

### Debug

1. Cloudflare Dashboard → **Workers** → pilih Worker → **Logs**
2. Cari `send-otp error:`, `send-password error:`, `send-custom error:`
3. Untuk log historis, aktifkan **Workers Logs** (butuh Workers Paid)

### Diagnostik VPS

```bash
nc -zv -w 5 smtp.gmail.com 465
nc -zv -w 5 smtp.gmail.com 587
nc -zv -w 5 google.com 443
```

Jika port 443 OK tapi 465/587 timeout → **provider blokir SMTP**, Worker solusinya.

---

## 🔒 Keamanan

### Wajib

- ✅ `API_KEY` set sebagai **Secret** (bukan Text)
- ✅ `SMTP_PASSWORD` set sebagai **Secret**
- ✅ Jangan taruh `API_KEY` di frontend / HTML / repo publik
- ✅ Jangan share URL lengkap dengan `api_key` di chat/log publik

### Rekomendasi

- 🔄 **Rotasi `API_KEY` berkala** — ganti di Worker → Deploy → update Flask
- 🛡️ **Cloudflare WAF** — whitelist IP Flask jika perlu
- ⏱️ **Rate Limiting Rules** — cegah abuse (mis. 10 req/menit per IP)
- 📊 **Monitoring** — aktifkan Workers Logs + Notifications

### Kalau `api_key` Bocor

1. Settings → Variables and Secrets → edit `API_KEY`
2. Klik **Deploy**
3. Update `.env` Flask
4. Restart Flask

---

## ⚠️ Batasan

| Batasan | Nilai |
|---------|-------|
| Free plan request | 100.000 / hari |
| Free plan CPU time | 10 ms / request |
| Paid plan CPU time | 30 detik / request |
| TCP socket | Hanya bisa `connect()` |
| SMTP mode | Hanya `AUTH LOGIN` |
| Bulk email | ❌ Tidak disarankan (>1000/hari) |

> Worker pakai **SMTP inline** (menunggu email terkirim sebelum response). Untuk OTP & reset password, ini yang diinginkan — biar bisa rollback kalau email gagal.

---

## 📝 Changelog

### v1.0.0 — Rilis Awal

- Endpoint: `/health`, `/api/send-otp`, `/api/send-password`, `/api/send-custom`
- Auth via `api_key` dari env
- Template HTML OTP & password terpusat di Worker
- Response format: `{ status, message, error }`
- Support port 465 (implicit TLS) & 587 (STARTTLS)
- Zero dependency — pure JavaScript

---

## 📄 Lisensi

Internal SukaPedia. Tidak untuk distribusi publik.

---

<div align="center">

**Made with ❤️ for SukaPedia.id**

</div>