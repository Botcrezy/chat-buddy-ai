const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3001;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const STATUS_URL = process.env.STATUS_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

let sock = null;
let qrCode = null;

const logger = pino({ level: 'info' });

async function updateStatus(data) {
  try {
    await fetch(STATUS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ session_id: 'default', ...data }),
    });
  } catch (e) {
    console.error('Failed to update status:', e.message);
  }
}

async function sendWebhook(data) {
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (e) {
    console.error('Webhook error:', e.message);
    return null;
  }
}

async function startSocket() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_session');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    printQRInTerminal: true,
    generateHighQualityLinkPreview: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCode = qr;
      console.log('📱 QR Code generated - scan with WhatsApp');

      // Convert QR to data URL for frontend display
      const QRCode = require('qrcode');
      const qrDataUrl = await QRCode.toDataURL(qr);

      await updateStatus({ status: 'waiting_qr', qr_code: qrDataUrl });
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
        : true;

      console.log('Connection closed. Reconnecting:', shouldReconnect);
      await updateStatus({ status: 'disconnected', qr_code: null });

      if (shouldReconnect) {
        setTimeout(startSocket, 5000);
      }
    }

    if (connection === 'open') {
      qrCode = null;
      const phoneNumber = sock.user?.id?.split(':')[0] || '';
      console.log('✅ Connected! Phone:', phoneNumber);

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

      const phone = msg.key.remoteJid?.replace('@s.whatsapp.net', '') || '';
      if (!phone || phone.includes('@g.us')) continue; // Skip groups

      const pushName = msg.pushName || '';

      // Get profile picture
      let profilePicUrl = null;
      try {
        profilePicUrl = await sock.profilePictureUrl(msg.key.remoteJid, 'image');
      } catch { }

      // Get status/about
      let whatsappAbout = '';
      try {
        const status = await sock.fetchStatus(msg.key.remoteJid);
        whatsappAbout = status?.status || '';
      } catch { }

      // Extract message content
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
        // Download and convert to base64
        try {
          const { downloadMediaMessage } = require('@whiskeysockets/baileys');
          const buffer = await downloadMediaMessage(msg, 'buffer', {});
          mediaUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        } catch (e) {
          console.error('Media download error:', e.message);
        }
      } else if (msg.message.documentMessage) {
        textContent = msg.message.documentMessage.caption || msg.message.documentMessage.fileName || '';
        mediaType = 'document';
      } else if (msg.message.audioMessage) {
        mediaType = 'audio';
      } else if (msg.message.videoMessage) {
        textContent = msg.message.videoMessage.caption || '';
        mediaType = 'video';
      }

      if (!textContent && !mediaType) continue;

      console.log(`📩 Message from ${pushName} (${phone}): ${textContent || `[${mediaType}]`}`);

      // Send to webhook
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

      // If AI replied, send the reply back
      if (result?.ai_reply) {
        try {
          await sock.sendMessage(msg.key.remoteJid, { text: result.ai_reply });
          console.log(`🤖 AI Reply sent to ${phone}`);
        } catch (e) {
          console.error('Send reply error:', e.message);
        }
      }
    }
  });
}

// API: Send message
app.post('/send', async (req, res) => {
  try {
    const { phone, message, media_url, media_type } = req.body;
    if (!phone || (!message && !media_url)) {
      return res.status(400).json({ error: 'phone and (message or media_url) required' });
    }

    const jid = `${phone}@s.whatsapp.net`;

    if (media_type === 'image' && media_url) {
      await sock.sendMessage(jid, {
        image: { url: media_url },
        caption: message || '',
      });
    } else {
      await sock.sendMessage(jid, { text: message });
    }

    res.json({ success: true });
  } catch (e) {
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
        // Random delay 2-5 seconds between messages
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
  res.json({
    connected: sock?.user ? true : false,
    phone: sock?.user?.id?.split(':')[0] || null,
    qr: qrCode || null,
  });
});

// API: Restart connection
app.post('/restart', async (req, res) => {
  try {
    if (sock) {
      sock.end();
    }
    await startSocket();
    res.json({ success: true, message: 'Restarting...' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API: Logout
app.post('/logout', async (req, res) => {
  try {
    await sock?.logout();
    fs.rmSync('./auth_session', { recursive: true, force: true });
    await updateStatus({ status: 'disconnected', qr_code: null, phone_number: null });
    res.json({ success: true });
    setTimeout(startSocket, 2000);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'running', connected: !!sock?.user });
});

app.listen(PORT, () => {
  console.log(`🚀 Baileys server running on port ${PORT}`);
  startSocket();
});
