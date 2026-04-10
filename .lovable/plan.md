

# تحليل مشكلة انقطاع اتصال واتساب + خطة الحل

## التشخيص - ليه البوت بيفصل؟

بعد مراجعة اللوجات والكود، لقيت **5 أسباب رئيسية**:

### 1. Railway بيمسح ملفات الجلسة عند كل Restart
Railway لما بيعمل restart أو redeploy، مجلد `auth_session` بيتمسح لأنه مش persistent storage. يعني كل مرة لازم تمسح QR من جديد.

### 2. إصدار واتساب ثابت (Hardcoded)
في الكود: `version: [2, 3000, 1033893291]` - ده إصدار ثابت ممكن يبقى قديم ويسبب handshake failures. Baileys عنده طريقة تجيب أحدث إصدار تلقائي.

### 3. Reconnect Delay كبير جداً
الـ exponential backoff بيوصل لـ 120 ثانية (دقيقتين) - ده كتير. لو فصل، بيفضل واقف وقت طويل قبل ما يحاول يرجع.

### 4. مفيش Health Check يمنع Railway من النوم
Railway ممكن ينيّم السيرفر لو مفيش traffic. محتاج self-ping كل فترة.

### 5. Socket cleanup مش كامل
لما الاتصال بيقفل، الـ presence interval بيفضل شغال وممكن يعمل errors.

---

## خطة الحل

### الخطوة 1: تحسين baileys-server/index.js
- **إزالة الإصدار الثابت** واستخدام `fetchLatestBaileysVersion()` لجلب أحدث إصدار تلقائي
- **تقليل Reconnect Delay** من max 120s إلى max 30s، مع backoff أسرع
- **إضافة Self-Ping** كل 4 دقائق لمنع Railway من إنهاء السيرفر
- **تنظيف الـ presence interval** عند الـ disconnect
- **إضافة error handling أفضل** في الـ connection.update handler
- **إضافة WebSocket keepAliveIntervalMs** في إعدادات makeWASocket

### الخطوة 2: إضافة Volume على Railway (تعليمات يدوية)
هتحتاج تضيف **Persistent Volume** على Railway عشان ملفات الجلسة متتمسحش:
- في Railway Dashboard → Settings → Volumes
- أضف volume على path: `/app/auth_session`
- كده حتى لو Railway عمل restart، الجلسة هتفضل محفوظة

### الخطوة 3: تحسين Dashboard (Connection.tsx)
- إضافة **Auto-reconnect button** لما السيرفر يكون متصل بس واتساب مش متصل
- عرض **سبب الانقطاع** في الواجهة بدل مجرد "غير متصل"
- إضافة **مؤشر uptime** واضح

---

## التفاصيل التقنية

### ملف: `baileys-server/index.js`
```text
التغييرات:
1. استبدال version الثابت بـ fetchLatestBaileysVersion()
2. تقليل max reconnect delay من 120s لـ 30s  
3. إضافة keepAliveIntervalMs: 30000 في إعدادات الـ socket
4. إضافة self-ping interval كل 4 دقائق
5. تنظيف presence interval في cleanupSocket()
6. إضافة retryRequestDelayMs: 250 (أسرع)
```

### ملف: `src/pages/Connection.tsx`
```text
التغييرات:
1. عرض uptime بشكل أوضح (ساعات ودقائق مش ثواني)
2. عرض عدد محاولات الـ reconnect
3. إضافة تنبيه لما السيرفر يكون شغال بس واتساب مفصول
```

---

## ملاحظة مهمة
بعد ما أعدّل الملفات، هتحتاج:
1. **ترفع `baileys-server/index.js` الجديد** على Railway
2. **تضيف Volume** من Railway Dashboard على path `/app/auth_session`
3. **تمسح QR Code** مرة واحدة بعد التحديث

