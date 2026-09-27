import { connect } from 'cloudflare:sockets';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/* ============================================================
 *  RESPONSE HELPER
 * ============================================================ */

function ok(message, status = 200) {
  return new Response(
    JSON.stringify({ status: true, message, error: '' }, null, 2),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

function fail(message, error = '', httpStatus = 400) {
  return new Response(
    JSON.stringify({ status: false, message, error: error || '' }, null, 2),
    {
      status: httpStatus,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

/* ============================================================
 *  HTML TEMPLATES
 * ============================================================ */

function otpTemplate(brand, otp) {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:30px 15px;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:500px;margin:auto;padding:30px;background:#fff;border-radius:12px;text-align:center;">
    <h2 style="margin:0 0 10px;font-size:24px;">Kode Verifikasi</h2>
    <p style="margin:0 0 25px;color:#666;font-size:15px;">Gunakan kode berikut untuk melanjutkan proses verifikasi.</p>
    <div style="display:inline-block;padding:15px 25px;background:#f0f0f0;border-radius:10px;font-size:36px;font-weight:bold;letter-spacing:10px;color:#111;">
      ${otp}
    </div>
    <p style="margin:25px 0 5px;color:#777;font-size:14px;">Kode OTP berlaku selama <b>5 menit</b>.</p>
    <p style="margin:0;color:#999;font-size:13px;">Jangan berikan kode ini kepada siapa pun.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:25px 0;">
    <p style="margin:0;color:#aaa;font-size:12px;">${brand}</p>
  </div>
</body></html>`;
}

function passwordTemplate(brand, password) {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:30px 15px;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:500px;margin:auto;padding:30px;background:#fff;border-radius:12px;text-align:center;">
    <h2 style="margin:0 0 10px;font-size:24px;">Password Baru</h2>
    <p style="margin:0 0 25px;color:#666;font-size:15px;">Berikut adalah password baru untuk akun kamu.</p>
    <div style="display:inline-block;padding:15px 25px;background:#f0f0f0;border-radius:10px;font-size:24px;font-weight:bold;letter-spacing:3px;color:#111;">
      ${password}
    </div>
    <p style="margin:25px 0 5px;color:#777;font-size:14px;">Silakan login dan ubah password di menu Profile.</p>
    <p style="margin:15px 0 0;color:#999;font-size:13px;">Jangan berikan password ini kepada siapa pun.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:25px 0;">
    <p style="margin:0;color:#aaa;font-size:12px;">${brand}</p>
  </div>
</body></html>`;
}

/* ============================================================
 *  SMTP CLIENT (TCP Socket — tanpa library)
 * ============================================================ */

function b64(str) {
  const bytes = encoder.encode(str);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function wrap76(str) {
  return (str.match(/.{1,76}/g) || [str]).join('\r\n');
}

function extractEmail(str) {
  const m = str.match(/<([^>]+)>/);
  return (m ? m[1] : str).trim();
}

class SMTPClient {
  constructor({ host, port, user, pass }) {
    this.host = host;
    this.port = port;
    this.user = user;
    this.pass = pass;
    this.buffer = '';
    this.socket = null;
    this.reader = null;
    this.writer = null;
  }

  async connect() {
    const useStartTls = this.port !== 465;
    this.socket = connect(
      { hostname: this.host, port: this.port },
      { secureTransport: useStartTls ? 'starttls' : 'on' }
    );
    await this.socket.opened;
    this.writer = this.socket.writable.getWriter();
    this.reader = this.socket.readable.getReader();
  }

  async upgradeTls() {
    try { this.reader.releaseLock(); } catch {}
    try { this.writer.releaseLock(); } catch {}
    this.socket = this.socket.startTls();
    await this.socket.opened;
    this.writer = this.socket.writable.getWriter();
    this.reader = this.socket.readable.getReader();
    this.buffer = '';
  }

  async readLine() {
    while (true) {
      const idx = this.buffer.indexOf('\r\n');
      if (idx !== -1) {
        const line = this.buffer.slice(0, idx);
        this.buffer = this.buffer.slice(idx + 2);
        return line;
      }
      const { value, done } = await this.reader.read();
      if (done) throw new Error('SMTP connection closed unexpectedly');
      this.buffer += decoder.decode(value, { stream: true });
    }
  }

  async readResponse() {
    const lines = [];
    while (true) {
      const line = await this.readLine();
      lines.push(line);
      if (line.length < 4 || line[3] !== '-') break;
    }
    return lines;
  }

  async write(data) {
    await this.writer.write(encoder.encode(data));
  }

  async cmd(command) {
    await this.write(command + '\r\n');
    return this.readResponse();
  }

  expect(res, code) {
    const last = res[res.length - 1];
    if (!last || !last.startsWith(code)) {
      throw new Error(`SMTP expected ${code}, got: ${JSON.stringify(res)}`);
    }
  }

  async send({ from, to, subject, html, text }) {
    await this.connect();

    // Greeting
    let res = await this.readResponse();
    this.expect(res, '220');

    // EHLO
    res = await this.cmd(`EHLO ${this.host}`);
    this.expect(res, '250');

    // STARTTLS untuk port != 465
    if (this.port !== 465) {
      res = await this.cmd('STARTTLS');
      this.expect(res, '220');
      await this.upgradeTls();
      res = await this.cmd(`EHLO ${this.host}`);
      this.expect(res, '250');
    }

    // AUTH LOGIN
    res = await this.cmd('AUTH LOGIN');
    this.expect(res, '334');
    res = await this.cmd(b64(this.user));
    this.expect(res, '334');
    res = await this.cmd(b64(this.pass));
    this.expect(res, '235');

    // Envelope
    const fromAddr = extractEmail(from);
    const toAddr   = extractEmail(to);

    res = await this.cmd(`MAIL FROM:<${fromAddr}>`);
    this.expect(res, '250');
    res = await this.cmd(`RCPT TO:<${toAddr}>`);
    this.expect(res, '250');
    res = await this.cmd('DATA');
    this.expect(res, '354');

    // Body
    const boundary = '----=_Part_' + Math.random().toString(36).slice(2);
    const subjectEncoded = '=?UTF-8?B?' + b64(subject) + '?=';

    const parts = [];
    parts.push(`From: ${from}`);
    parts.push(`To: ${to}`);
    parts.push(`Subject: ${subjectEncoded}`);
    parts.push('MIME-Version: 1.0');
    parts.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    parts.push('');

    if (text) {
      parts.push(`--${boundary}`);
      parts.push('Content-Type: text/plain; charset="UTF-8"');
      parts.push('Content-Transfer-Encoding: base64');
      parts.push('');
      parts.push(wrap76(b64(text)));
    }
    if (html) {
      parts.push(`--${boundary}`);
      parts.push('Content-Type: text/html; charset="UTF-8"');
      parts.push('Content-Transfer-Encoding: base64');
      parts.push('');
      parts.push(wrap76(b64(html)));
    }
    parts.push(`--${boundary}--`);
    parts.push('');

    let message = parts.join('\r\n').replace(/^\./gm, '..');

    await this.write(message + '\r\n.\r\n');
    res = await this.readResponse();
    this.expect(res, '250');

    // QUIT
    try { await this.cmd('QUIT'); } catch {}
    try { await this.socket.close(); } catch {}

    return true;
  }
}

/* ============================================================
 *  HELPERS
 * ============================================================ */

function checkAuth(url, env) {
  if (!env.API_KEY) return { ok: false, error: 'API_KEY belum diset di env Worker' };
  const key = url.searchParams.get('api_key') || '';
  if (key !== env.API_KEY) return { ok: false, error: 'api_key tidak valid' };
  return { ok: true };
}

function renderHtmlText(template) {
  return template
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSmtpConfig(env) {
  const cfg = {
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT || '465', 10),
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
    from: env.SMTP_FROM || env.SMTP_USER,
  };
  if (!cfg.host || !cfg.user || !cfg.pass) {
    return { ok: false, error: 'SMTP env belum lengkap (SMTP_HOST/USER/PASSWORD)' };
  }
  return { ok: true, cfg };
}

/* ============================================================
 *  MAIN HANDLER — semua endpoint GET
 * ============================================================ */

export default {
  async fetch(request, env) {
    const url   = new URL(request.url);
    const path  = url.pathname;
    const brand = env.BRAND_NAME || 'SukaPedia';

    // Health check (tanpa auth)
    if (path === '/' || path === '/health') {
      return ok('Worker aktif');
    }

    // Auth check
    const auth = checkAuth(url, env);
    if (!auth.ok) {
      return fail('Autentikasi gagal', auth.error, 401);
    }

    // SMTP config
    const smtp = getSmtpConfig(env);
    if (!smtp.ok) {
      return fail('Konfigurasi SMTP bermasalah', smtp.error, 500);
    }
    const { host, port, user, pass, from } = smtp.cfg;

    // ---------- GET /api/send-otp ----------
    if (path === '/api/send-otp') {
      const email = (url.searchParams.get('email') || '').trim();
      const otp   = (url.searchParams.get('otp')   || '').trim();

      if (!email || !otp) {
        return fail('Parameter email & otp wajib', 'Missing: email/otp', 400);
      }
      if (!/^\d{4,8}$/.test(otp)) {
        return fail('Format OTP tidak valid', 'OTP harus 4-8 digit angka', 400);
      }

      const html = otpTemplate(brand, otp);
      const text = renderHtmlText(html);

      try {
        const client = new SMTPClient({ host, port, user, pass });
        await client.send({
          from, to: email,
          subject: 'Kode Verifikasi',
          html, text,
        });
        return ok(`Kode OTP berhasil dikirim ke ${email}`, 200);
      } catch (err) {
        console.error('send-otp error:', err);
        return fail('Gagal mengirim kode OTP', err.message || String(err), 500);
      }
    }

    // ---------- GET /api/send-password ----------
    if (path === '/api/send-password') {
      const email    = (url.searchParams.get('email')    || '').trim();
      const password = (url.searchParams.get('password') || '').trim();

      if (!email || !password) {
        return fail('Parameter email & password wajib', 'Missing: email/password', 400);
      }

      const html = passwordTemplate(brand, password);
      const text = renderHtmlText(html);

      try {
        const client = new SMTPClient({ host, port, user, pass });
        await client.send({
          from, to: email,
          subject: 'Password Baru',
          html, text,
        });
        return ok(`Password baru berhasil dikirim ke ${email}`, 200);
      } catch (err) {
        console.error('send-password error:', err);
        return fail('Gagal mengirim password baru', err.message || String(err), 500);
      }
    }

    // ---------- GET /api/send-custom ----------
    if (path === '/api/send-custom') {
      const email   = (url.searchParams.get('email')   || '').trim();
      const subject = (url.searchParams.get('subject') || '').trim();
      const html    = (url.searchParams.get('html')    || '').trim();
      const text    = (url.searchParams.get('text')    || '').trim();

      if (!email || !subject || (!html && !text)) {
        return fail(
          'Parameter tidak lengkap',
          'Wajib: email, subject, dan salah satu html/text',
          400
        );
      }

      try {
        const client = new SMTPClient({ host, port, user, pass });
        await client.send({
          from, to: email,
          subject,
          html: html || `<pre>${text}</pre>`,
          text: text || renderHtmlText(html),
        });
        return ok(`Email berhasil dikirim ke ${email}`, 200);
      } catch (err) {
        console.error('send-custom error:', err);
        return fail('Gagal mengirim email', err.message || String(err), 500);
      }
    }

    return fail('Endpoint tidak ditemukan', `Unknown path: ${path}`, 404);
  },
};