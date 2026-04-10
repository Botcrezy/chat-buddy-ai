
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '50mb' }));

// CORS for dashboard access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const PORT = process.env.PORT || 3001;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const STATUS_URL = process.env.STATUS_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const AUTH_DIR = process.env.AUTH_DIR || './auth_session';

let sock = null;
let qrCode = null;
let isConnecting = false;
let reconnectAttempts = 0;
let lastConnectionEvent = null;
let lastRestartTime = null;
let startTime = Date.now();

// In-memory log buffer for remote debugging
const logBuffer = [];
const MAX_LOGS = 200;

function addLog(level, message, data = null) {
  const entry = {
    time: new Date().toISOString(),
    level,
    message,
    ...(data && { data: typeof data === 'object' ? JSON.stringify(data).slice(0, 500) : data }),
  };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOGS) logBuffer.shift();
  console[level === 'error' ? 'error' : 'log'](`[${level.toUpperCase()}] ${message}`, data || '');
}

const logger = pino({ level: 'info' });

function getAuthInfo() {
  try {
    const exists = fs.existsSync(AUTH_DIR);
    const files = exists ? fs.readdirSync(AUTH_DIR) : [];
    const hasCreds = files.includes('creds.json');
    return { exists, fileCount: files.length, hasCreds, path: AUTH_DIR };
  } catch {
    return { exists: false, fileCount: 0, hasCreds: false, path: AUTH_DIR };
  }
}

function cleanupSocket() {
  if (global._presenceInterval) { clearInterval(global._presenceInterval); global._presenceInterval = null; }
  if (sock) {
    try {
      sock.ev.removeAllListeners('connection.update');
      sock.ev.removeAllListeners('messages.upsert');
      sock.ev.removeAllListeners('creds.update');
      sock.end();
    } catch {}
    sock = null;
  }
  isConnecting = false;
}

async function updateStatus(data) {
  if (!STATUS_URL) {
    addLog('warn', 'STATUS_URL not configured, skipping status update');
    return;
  }
  try {
    const res = await fetch(STATUS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ session_id: 'default', ...data }),
    });
    addLog('info', `Status update: ${data.status}`, { httpStatus: res.status });
  } catch (e) {
    addLog('error', 'Failed to update status', e.message);
  }
}

async function sendWebhook(data) {
  if (!WEBHOOK_URL) {
    addLog('warn', 'WEBHOOK_URL not configured');
    return null;
  }
  try {
    addLog('info', `📤 Sending webhook for phone: ${data.phone}`);
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(data),
    });
    const responseText = await res.text();
    addLog('info', `📥 Webhook response: ${res.status} - ${responseText.slice(0, 300)}`);
    try {
      return JSON.parse(responseText);
    } catch {
      addLog('error', 'Webhook response not JSON', responseText.slice(0, 200));
      return null;
    }
  } catch (e) {
    addLog('error', 'Webhook error', e.message);
    return null;
  }
}

// Typing indicator helper
async function sendTypingIndicator(jid, durationMs = 2000) {
  try {
    await sock.presenceSubscribe(jid);
    await sock.sendPresenceUpdate('composing', jid);
    await new Promise(r => setTimeout(r, durationMs));
    await sock.sendPresenceUpdate('paused', jid);
  } catch (e) {
    addLog('warn', 'Typing indicator error', e.message);
  }
}

let noQrAttempts = 0;

async function startSocket() {
  if (isConnecting) {
    addLog('warn', 'Already connecting, skipping duplicate startSocket call');
    return;
  }
  isConnecting = true;
  reconnectAttempts++;
  noQrAttempts++;
  const authInfo = getAuthInfo();
  addLog('info', '🔄 Starting WhatsApp socket...', { authInfo, attempt: reconnectAttempts, noQrAttempts });
  await updateStatus({ status: 'starting', qr_code: null });

  // Auto-reset after 3 attempts without ever getting a QR
  if (noQrAttempts > 3) {
    addLog('warn', `⚠️ ${noQrAttempts} attempts without QR. Clearing session and retrying fresh...`);
    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      addLog('info', '🗑️ Auto-cleared auth_session for fresh start');
    } catch (e) {
      addLog('error', 'Failed to auto-clear session', e.message);
    }
    noQrAttempts = 0;
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    addLog('info', 'Auth state loaded', { authDir: AUTH_DIR, hasCredsFile: getAuthInfo().hasCreds });

    let version;
    try {
      const versionInfo = await fetchLatestBaileysVersion();
      version = versionInfo.version;
      addLog('info', `Using WhatsApp version: ${version.join('.')}`);
    } catch (e) {
      version = [2, 3000, 1015901307];
      addLog('warn', `Failed to fetch latest version, using fallback: ${version.join('.')}`, e.message);
    }

    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      printQRInTerminal: true,
      generateHighQualityLinkPreview: true,
      browser: Browsers.ubuntu('WhatsApp Bot'),
      syncFullHistory: false,
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 250,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      lastConnectionEvent = { connection, time: new Date().toISOString(), hasQR: !!qr };

      const disconnectError = lastDisconnect?.error;
      const statusCode = (disconnectError instanceof Boom)
        ? disconnectError.output.statusCode
        : (disconnectError?.output?.statusCode || 0);

      addLog('info', 'Connection update', {
        connection,
        hasQR: !!qr,
        statusCode,
        errorMessage: disconnectError?.message || null,
      });

      if (qr) {
        qrCode = qr;
        reconnectAttempts = 0;
        noQrAttempts = 0;
        addLog('info', '📱 QR Code generated - scan with WhatsApp');

        try {
          const QRCode = require('qrcode');
          const qrDataUrl = await QRCode.toDataURL(qr);
          await updateStatus({ status: 'waiting_qr', qr_code: qrDataUrl });
        } catch (qrErr) {
          addLog('error', 'QR code generation failed', qrErr.message);
        }
      }

      if (connection === 'close') {
        isConnecting = false;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        addLog('info', `Connection closed. Code: ${statusCode}, Reconnecting: ${shouldReconnect}, Attempts: ${reconnectAttempts}`, {
          errorMessage: disconnectError?.message,
          errorStack: disconnectError?.stack?.slice(0, 300),
        });
        await updateStatus({ status: 'disconnected' });

        if (shouldReconnect) {
          const delay = Math.min(5000 * Math.pow(1.5, reconnectAttempts - 1), 30000);
          addLog('info', `Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts})...`);
          setTimeout(startSocket, delay);
        } else {
          addLog('warn', '⚠️ Logged out! Use /reset-session to clear and re-scan QR');
        }
      }

      if (connection === 'open') {
        isConnecting = false;
        qrCode = null;
        reconnectAttempts = 0;
        const phoneNumber = sock.user?.id?.split(':')[0] || '';
        addLog('info', `✅ Connected! Phone: ${phoneNumber}`);

        // Set presence to "available" so contacts see us online
        try {
          await sock.sendPresenceUpdate('available');
          addLog('info', '🟢 Presence set to available (online)');
        } catch (e) {
          addLog('warn', 'Failed to set presence', e.message);
        }

        // Keep-alive: periodically send "available" presence every 5 minutes
        if (global._presenceInterval) clearInterval(global._presenceInterval);
        global._presenceInterval = setInterval(async () => {
          try {
            if (sock?.user) await sock.sendPresenceUpdate('available');
          } catch {}
        }, 5 * 60 * 1000);

        await updateStatus({
          status: 'connected',
          phone_number: phoneNumber,
          qr_code: null,
        });
      }
    });

    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (msg.key.fromMe) continue;
        if (!msg.message) continue;

        const remoteJid = msg.key.remoteJid || '';
        // Skip group messages
        if (remoteJid.includes('@g.us')) continue;
        // Extract clean phone number from any JID format (@s.whatsapp.net, @lid, etc.)
        const phone = remoteJid.split('@')[0] || '';
        if (!phone) continue;

        addLog('info', `📞 JID: ${remoteJid}, Phone: ${phone}`);

        const pushName = msg.pushName || '';

        let profilePicUrl = null;
        try {
          profilePicUrl = await sock.profilePictureUrl(msg.key.remoteJid, 'image');
        } catch { }

        let whatsappAbout = '';
        try {
          const status = await sock.fetchStatus(msg.key.remoteJid);
          whatsappAbout = status?.status || '';
        } catch { }

        let textContent = '';
        let mediaUrl = null;
        let mediaType = null;

        if (msg.message.conversation) {
          textContent = msg.message.conversation;
        } else if (msg.message.extendedTextMessage) {
          textContent = msg.message.extendedTextMessage.text;
        } else if (msg.message.imageMessage) {
          textContent = msg.message.imageMessage.caption || '';
          mediaType = 'image';
          try {
            const { downloadMediaMessage } = require('@whiskeysockets/baileys');
            const buffer = await downloadMediaMessage(msg, 'buffer', {});
            mediaUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
          } catch (e) {
            addLog('error', 'Media download error', e.message);
          }
        } else if (msg.message.documentMessage) {
          textContent = msg.message.documentMessage.caption || msg.message.documentMessage.fileName || '';
          mediaType = 'document';
        } else if (msg.message.audioMessage) {
          mediaType = 'audio';
          try {
            const { downloadMediaMessage } = require('@whiskeysockets/baileys');
            const buffer = await downloadMediaMessage(msg, 'buffer', {});
            mediaUrl = `data:audio/ogg;base64,${buffer.toString('base64')}`;
            addLog('info', `🎤 Audio downloaded: ${buffer.length} bytes`);
          } catch (e) {
            addLog('error', 'Audio download error', e.message);
            textContent = 'رسالة صوتية';
          }
        } else if (msg.message.videoMessage) {
          textContent = msg.message.videoMessage.caption || '';
          mediaType = 'video';
        }

        if (!textContent && !mediaType) continue;

        addLog('info', `📩 Message from ${pushName} (${phone}): ${textContent || `[${mediaType}]`}`);

        const result = await sendWebhook({
          phone,
          name: pushName,
          message: textContent,
          whatsapp_message_id: msg.key.id,
          push_name: pushName,
          profile_pic_url: profilePicUrl,
          whatsapp_about: whatsappAbout,
          media_url: mediaUrl,
          media_type: mediaType,
        });

        if (result?.ai_reply || result?.ai_media_url) {
          try {
            // Show "typing..." indicator before sending
            const typingDuration = 1000 + Math.random() * 2000; // 1-3 seconds
            await sendTypingIndicator(msg.key.remoteJid, typingDuration);

            // Send image first if present
            if (result.ai_media_url) {
              try {
                await sock.sendMessage(msg.key.remoteJid, {
                  image: { url: result.ai_media_url },
                  caption: result.ai_reply || '',
                });
                addLog('info', `🖼️ AI Image + Reply sent to ${phone}`);
              } catch (imgErr) {
                addLog('error', 'Image send failed, sending text only', imgErr.message);
                if (result.ai_reply) {
                  await sock.sendMessage(msg.key.remoteJid, { text: result.ai_reply });
                }
              }
            } else if (result.ai_reply) {
              await sock.sendMessage(msg.key.remoteJid, { text: result.ai_reply });
              addLog('info', `🤖 AI Reply sent to ${phone}`);
            }
          } catch (e) {
            addLog('error', 'Send reply error', e.message);
          }
        }
      }
    });

  } catch (err) {
    isConnecting = false;
    addLog('error', '❌ startSocket() crashed', err.message);
    await updateStatus({ status: 'error', qr_code: null });
    addLog('info', 'Retrying in 15s after crash...');
    setTimeout(startSocket, 15000);
  }
}

// API: Send message
app.post('/send', async (req, res) => {
  try {
    const { phone, message, media_url, media_type } = req.body;
    if (!phone || (!message && !media_url)) {
      return res.status(400).json({ error: 'phone and (message or media_url) required' });
    }
    const jid = `${phone}@s.whatsapp.net`;

    // Show typing before sending
    await sendTypingIndicator(jid, 1000);

    if (media_type === 'image' && media_url) {
      await sock.sendMessage(jid, { image: { url: media_url }, caption: message || '' });
    } else {
      await sock.sendMessage(jid, { text: message });
    }
    res.json({ success: true });
  } catch (e) {
    addLog('error', 'Send API error', e.message);
    res.status(500).json({ error: e.message });
  }
});

// API: Broadcast messages
app.post('/broadcast', async (req, res) => {
  try {
    const { recipients, message, media_url, media_type } = req.body;
    if (!recipients || !message) {
      return res.status(400).json({ error: 'recipients and message required' });
    }
    const results = [];
    for (const phone of recipients) {
      try {
        const jid = `${phone}@s.whatsapp.net`;
        if (media_type === 'image' && media_url) {
          await sock.sendMessage(jid, { image: { url: media_url }, caption: message });
        } else {
          await sock.sendMessage(jid, { text: message });
        }
        results.push({ phone, status: 'sent' });
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
      } catch (e) {
        results.push({ phone, status: 'failed', error: e.message });
      }
    }
    res.json({ success: true, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API: Get status
app.get('/status', (req, res) => {
  const uptimeSeconds = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  res.json({
    connected: sock?.user ? true : false,
    phone: sock?.user?.id?.split(':')[0] || null,
    qr: qrCode || null,
    connecting: isConnecting,
    uptime: uptimeSeconds,
    uptime_formatted: `${hours}h ${minutes}m`,
    reconnect_attempts: reconnectAttempts,
    last_connection_event: lastConnectionEvent,
  });
});

// API: Get logs (remote debugging)
app.get('/logs', (req, res) => {
  const authInfo = getAuthInfo();
  res.json({
    logs: logBuffer.slice(-50),
    diagnostics: {
      auth_dir: AUTH_DIR,
      auth_files: authInfo.fileCount,
      has_creds: authInfo.hasCreds,
      reconnect_attempts: reconnectAttempts,
      last_connection_event: lastConnectionEvent,
      last_restart: lastRestartTime,
      uptime: process.uptime(),
    },
  });
});

// API: Reset session (clear auth and reconnect)
app.post('/reset-session', async (req, res) => {
  try {
    addLog('info', '🗑️ Reset session requested via API');
    cleanupSocket();
    qrCode = null;
    reconnectAttempts = 0;

    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      addLog('info', `Deleted auth directory: ${AUTH_DIR}`);
    }

    await updateStatus({ status: 'disconnected', qr_code: null, phone_number: null });
    lastRestartTime = new Date().toISOString();

    setTimeout(startSocket, 2000);
    res.json({ success: true, message: 'Session cleared. Reconnecting in 2s...' });
  } catch (e) {
    addLog('error', 'Reset session error', e.message);
    res.status(500).json({ error: e.message });
  }
});

// API: Restart connection
app.post('/restart', async (req, res) => {
  try {
    addLog('info', '🔄 Restart requested via API');
    cleanupSocket();
    lastRestartTime = new Date().toISOString();
    setTimeout(startSocket, 2000);
    res.json({ success: true, message: 'Restarting...' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API: Logout
app.post('/logout', async (req, res) => {
  try {
    if (sock) {
      try { await sock.logout(); } catch {}
    }
    cleanupSocket();
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    await updateStatus({ status: 'disconnected', qr_code: null, phone_number: null });
    qrCode = null;
    reconnectAttempts = 0;
    res.json({ success: true });
    setTimeout(startSocket, 2000);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Health check
app.get('/', (req, res) => {
  const authInfo = getAuthInfo();
  res.json({
    status: 'running',
    connected: !!sock?.user,
    connecting: isConnecting,
    uptime: process.uptime(),
    logs_count: logBuffer.length,
    auth_dir: AUTH_DIR,
    has_auth_files: authInfo.hasCreds,
    auth_file_count: authInfo.fileCount,
    reconnect_attempts: reconnectAttempts,
    last_connection_event: lastConnectionEvent,
  });
});

app.listen(PORT, () => {
  addLog('info', `🚀 Baileys server running on port ${PORT}`);
  addLog('info', `Auth directory: ${AUTH_DIR}`);
  startTime = Date.now();
  startSocket();

  // Self-ping every 4 minutes to prevent Railway from sleeping
  setInterval(async () => {
    try {
      await fetch(`http://localhost:${PORT}/`, { signal: AbortSignal.timeout(5000) });
      addLog('info', '🏓 Self-ping OK');
    } catch (e) {
      addLog('warn', 'Self-ping failed', e.message);
    }
  }, 4 * 60 * 1000);
});
