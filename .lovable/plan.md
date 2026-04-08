
# خطة إصلاح مشكلة Baileys الحالية

## التشخيص المؤكد من اللوجات
المشكلة ليست من رابط Railway ولا من البورت:
- السيرفر يعمل ويرد على `/`
- تحديث الحالة إلى Supabase يعمل بنجاح
- Baileys يبدأ كل مرة بشكل طبيعي
- ثم يحدث:
```text
connecting -> close (code 0) -> reconnect
```
- لا يتم توليد QR نهائيًا

هذا النمط يدل غالبًا على أن السيرفر يحاول استكمال `auth_session` موجودة لكنها تالفة/غير صالحة، فيغلق الاتصال فورًا قبل إصدار QR جديد.

## ما سأعدّله

### 1) تقوية إدارة جلسة Baileys في `baileys-server/index.js`
- جعل مسار الجلسة configurable عبر متغير مثل `AUTH_DIR`
- إضافة log أوضح لمسار الجلسة وحالة وجود ملفات الاعتماد
- إضافة endpoint صريح مثل `/reset-session`
  - يمسح مجلد `auth_session`
  - يصفّر `qrCode`
  - يحدث الحالة إلى `disconnected`
  - ثم يعيد بدء الاتصال
- جعل `/logout` يعمل حتى لو `sock` غير موجود أو الاتصال مغلق
- إضافة logging أعمق لـ `lastDisconnect` بالكامل بدل `statusCode` فقط

### 2) منع حلقة الإغلاق الصامت
- عند `close` بدون QR ولمرات متكررة:
  - تسجيل أن الجلسة الحالية قد تكون تالفة
  - بعد عدد محاولات محدد يتم اقتراح reset session تلقائيًا في اللوج
- تحسين منطق `isConnecting` و cleanup عند restart/logout حتى لا تبقى socket قديمة أو listeners متراكمة

### 3) تحسين واجهة صفحة الاتصال `src/pages/Connection.tsx`
- إضافة زر واضح: `إعادة تعيين الجلسة`
- عرض تنبيه تشخيصي عندما تكون الحالة:
  - السيرفر online
  - WhatsApp disconnected
  - لا يوجد QR
  - ومحاولات reconnect مستمرة
- عرض آخر لوجات مختصرة داخل الصفحة بدل الاعتماد على فتح `/logs` خارجيًا
- شرح مباشر للمستخدم: “غالبًا توجد جلسة محفوظة تالفة على Railway”

### 4) تحسين إعدادات النشر
- تحديث `DEPLOYMENT_GUIDE.md` لشرح مهم جدًا:
  - إذا استعملت Railway Volume فالجلسة ستبقى محفوظة بين الـ deploys
  - لو تلفت الجلسة يجب مسحها من volume أو عبر `/reset-session`
  - لو لم يوجد volume فسيتم تسجيل الدخول من جديد عند كل redeploy
- توضيح مكان mount الصحيح للجلسة، مثل:
```text
/railway/data/auth_session
```
أو أي مسار ثابت تحدده متغيرات البيئة

### 5) تحسينات تشخيصية إضافية
- توسيع `/logs` لعرض آخر:
  - session dir
  - عدد ملفات الاعتماد
  - وقت آخر restart
  - عدد محاولات reconnect
- إضافة health response أوضح في `/`:
  - `auth_dir`
  - `has_auth_files`
  - `reconnect_attempts`
  - `last_connection_event`

## سبب أن هذا هو الحل الصحيح
الكود الحالي بالفعل:
- يحمّل auth state بنجاح
- يبدأ socket
- لكنه لا يصل أبدًا إلى `qr`
- ولا يصل إلى `open`

هذا يعني أن المشكلة قبل مرحلة QR نفسها، وغالبًا من جلسة محفوظة يحاول Baileys استئنافها ثم ترفضها WhatsApp أو تكون ملفاتها ناقصة/غير سليمة. لذلك إصلاح الواجهة وحده لن يكفي؛ المطلوب هو إصلاح دورة حياة الجلسة نفسها.

## خطوات التنفيذ
1. مراجعة واستكمال endpoints الحالية في `baileys-server/index.js`
2. إضافة reset-session flow آمن
3. تحسين logs و health diagnostics
4. تحديث `Connection.tsx` لإظهار السبب والحل من داخل اللوحة
5. تحديث `DEPLOYMENT_GUIDE.md` بخطوات Railway Volume و reset
6. بعد التطبيق: redeploy على Railway ثم تنفيذ reset session ثم انتظار QR

## ما ستفعله بعد التنفيذ
بعد رفع التعديلات:
1. افتح:
```text
https://mybotsity.up.railway.app/reset-session
```
أو من الزر داخل اللوحة
2. سيُمسح `auth_session`
3. السيرفر سيبدأ جلسة جديدة
4. يجب أن يظهر QR
5. تمسحه من واتساب
6. تتحول الحالة إلى `connected`

## ملاحظات تقنية
- `PORT` ليس هو سبب المشكلة؛ السيرفر reachable بالفعل
- `STATUS_URL` و Supabase integration يعملان
- السبب ليس من صفحة Lovable نفسها، بل من session lifecycle في سيرفر Baileys
- الإبقاء على الجلسة في root path `./auth_session` على Railway ليس مثاليًا؛ الأفضل مسار persistent معروف عبر env
