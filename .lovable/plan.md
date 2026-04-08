

# تشخيص وإصلاح مشكلة اتصال سيرفر Baileys

## التشخيص

السيرفر على Railway **شغال فعلاً** ويستجيب:
- `https://bot-production-5d5e.up.railway.app/` → `{"status":"running","connected":false}`
- السيرفر يرسل تحديثات الحالة لـ Supabase بنجاح (200 OK) كل 5 ثواني
- حالة الـ WhatsApp في قاعدة البيانات: `"disconnected"` مع `qr_code: null`

**المشكلة**: السيرفر في حلقة إعادة اتصال - الـ socket يفتح ويُغلق فوراً بدون توليد QR code. هذا غالباً بسبب واحد من:
1. مشكلة في مكتبة Baileys مع بيئة Railway
2. عدم وجود error handling كافي فتظهر كأنها crash loop صامتة

## الحل

### 1. تحسين سيرفر Baileys (baileys-server/index.js)
- إضافة try/catch شامل حول `startSocket()` مع logging تفصيلي
- إضافة endpoint `/logs` لعرض آخر 50 سطر log من الذاكرة (مفيد للتشخيص من بعيد)
- إضافة delay أطول قبل إعادة المحاولة (10 ثواني بدل 5)
- إضافة حالة `"starting"` عند بدء الاتصال حتى نعرف إنه بيحاول
- إصلاح: لا يمسح QR code عند إغلاق الاتصال (يبقى متاح للمسح)

### 2. تحسين صفحة الاتصال (Connection.tsx)
- إضافة **Auto-refresh** كل 5 ثواني لجلب حالة QR تلقائياً
- إضافة **زر إعادة تشغيل** يستدعي `/restart` على سيرفر Railway
- عرض حالة السيرفر مباشرة (متصل بالسيرفر / لا) بجانب حالة الواتساب
- إضافة حقل إدخال عنوان السيرفر مباشرة في صفحة الاتصال

### 3. ربط صفحة الإعدادات (SettingsPage.tsx)
- حفظ عنوان السيرفر في `bot_settings` (إضافة عمود `baileys_server_url`)
- استخدام العنوان المحفوظ في صفحة الاتصال

### 4. Migration بسيطة
- إضافة عمود `baileys_server_url` في جدول `bot_settings`

## ترتيب التنفيذ

1. Migration: إضافة `baileys_server_url` لـ bot_settings
2. تحديث `baileys-server/index.js` (error handling + /logs endpoint)
3. تحديث `Connection.tsx` (auto-refresh + restart + server URL)
4. تحديث `SettingsPage.tsx` (حفظ server URL)

## ملاحظة مهمة

بعد التنفيذ، ستحتاج تعمل **Redeploy** على Railway بالكود الجديد. ممكن تعمل كده بعمل push جديد للـ GitHub repo المربوط بـ Railway.

