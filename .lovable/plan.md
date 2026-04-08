

# إصلاح مشكلة عدم توليد QR Code في Baileys

## التشخيص الدقيق

من بيانات السيرفر:
```text
has_auth_files: false    ← لا توجد جلسة محفوظة أصلاً
auth_file_count: 0       ← مجلد فاضي
connecting: false        ← توقف عن المحاولة
reconnect_attempts: 2    ← حاول مرتين وفشل
last_event: close, hasQR: false  ← يُغلق فوراً بدون QR
```

**السبب الحقيقي**: الكود يستخدم Baileys v6 (`^6.7.16`) لكن بصيغة API قديمة. في الإصدار 6:
- `browser` يجب أن يستخدم `Browsers` helper بدل array يدوي
- `fetchLatestBaileysVersion()` قد يرجع إصدار غير متوافق
- الاتصال يُغلق فوراً (code 0) لأن WhatsApp ترفض الـ handshake

## التعديلات المطلوبة

### 1. إصلاح `baileys-server/index.js` - تكوين الاتصال

```text
التغييرات الرئيسية:
```

- استيراد `Browsers` من Baileys واستخدامه بدل array يدوي:
  ```js
  browser: Browsers.ubuntu('WhatsApp Bot')
  ```
- إزالة `fetchLatestBaileysVersion()` واستخدام إصدار ثابت معروف يعمل، أو تركه بدون version (Baileys يختار تلقائياً)
- إضافة خيارات اتصال إضافية:
  ```js
  syncFullHistory: false
  markOnlineOnConnect: false
  connectTimeoutMs: 60000
  ```
- تحسين error handling: طباعة الخطأ الكامل عند الإغلاق بدل code فقط
- إضافة `retryRequestDelayMs` لتجنب rate limiting

### 2. إصلاح منطق إعادة المحاولة

- حالياً الـ auto-reset يتحقق من `authInfo.hasCreds` - لكن لما الملفات فاضية مش هيعمل reset
- تغيير المنطق: بعد 3 محاولات بدون QR (بغض النظر عن وجود ملفات)، يمسح المجلد ويبدأ من جديد
- إضافة exponential backoff بدل delay ثابت (10s, 20s, 40s...)

### 3. تحديث `baileys-server/package.json`

- تثبيت إصدار Baileys محدد بدل `^6.7.16` (مثلاً `6.7.9` المعروف بالاستقرار)
- أو النزول لإصدار 6.6.x الأكثر استقراراً

## ترتيب التنفيذ

1. تعديل `baileys-server/index.js` (إصلاح makeWASocket config + retry logic)
2. تعديل `baileys-server/package.json` (تثبيت إصدار Baileys)

## بعد التنفيذ

1. ارفع الملفات الجديدة على GitHub
2. Railway سيعمل redeploy تلقائياً
3. السيرفر سيبدأ بالإعدادات الصحيحة
4. يجب أن يظهر QR Code خلال ثوانٍ

