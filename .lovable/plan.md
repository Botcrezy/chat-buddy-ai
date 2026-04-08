# خطة تطوير شاملة للنظام - ميزات متقدمة

## ملخص

تحسين النظام بإضافة: ذاكرة عملاء قوية، قراءة بروفايل الواتساب، دعم الصور والميديا، رسائل جماعية (Broadcast)، متابعة تلقائية للعملاء، وشخصية بوت بشرية متقدمة. مع شرح تفصيلي لنشر سيرفر Baileys.

---

## المرحلة 1: قاعدة البيانات - جداول جديدة

### جدول `customer_memory` - ذاكرة العملاء

```sql
- contact_id (uuid, FK → contacts)
- memory_type: 'preference' | 'complaint' | 'interest' | 'order' | 'note'
- key (text) -- مثل "المنتج المفضل"
- value (text) -- مثل "باقة بريميوم"
- extracted_from_message_id (uuid, nullable)
- created_by: 'ai' | 'agent'
```

### جدول `broadcast_campaigns` - الرسائل الجماعية

```sql
- title, content, media_url, media_type
- target_category (text) -- فلتر الفئة المستهدفة
- status: 'draft' | 'sending' | 'completed'
- total_recipients, sent_count, failed_count
- scheduled_at (nullable), sent_at
```

### جدول `broadcast_recipients` - تفاصيل الإرسال

```sql
- campaign_id, contact_id
- status: 'pending' | 'sent' | 'failed'
- sent_at, error_message
```

### جدول `followup_rules` - قواعد المتابعة التلقائية

```sql
- name, trigger_type: 'no_reply' | 'after_purchase' | 'periodic'
- delay_hours (int), message_template (text)
- is_active (boolean), target_category
```

### تعديل جدول `contacts`

- إضافة: `whatsapp_name`, `whatsapp_about`, `whatsapp_avatar_url`, `summary` (ملخص AI للعميل)

### تعديل جدول `messages`

- التأكد من دعم `media_url` و `media_type` (موجودين بالفعل)

---

## المرحلة 2: Edge Function - `whatsapp-webhook` محسّن

التغييرات الرئيسية:

1. **استقبال بيانات البروفايل** من Baileys (الاسم، الصورة، الحالة) وتخزينها في contacts
2. **استقبال الصور والملفات** - حفظ media_url و media_type في الرسائل
3. **ذاكرة عملاء ذكية** - بعد كل رد AI، يستخرج معلومات مهمة من المحادثة ويحفظها في `customer_memory`
4. **System Prompt محسّن** يشمل:
  - شخصية البوت (مبيعات/دعم فني) بأسلوب بشري طبيعي
  - ذاكرة العميل السابقة كاملة
  - ملخص العميل
  - تعليمات عدم إظهار أنه بوت
  - تاريخ المحادثة (آخر 50 رسالة بدل 20)

### System Prompt المحسّن:

```
أنت {bot_name}، أحد أعضاء فريق {personality}.
لا تقل أبداً أنك ذكاء اصطناعي أو بوت.
رد كأنك شخص حقيقي بأسلوب طبيعي ودود.

معلومات عن العميل {contact_name}:
- {customer_memory entries}
- ملخص: {contact.summary}

بيانات الشركة: {training_data}
ردود جاهزة: {quick_replies}

إذا سُئلت عن شيء لا تعرفه: قل "خليني أتأكد من الزملاء وأرجعلك"
```

---

## المرحلة 3: Edge Function جديدة - `broadcast-send`

- تستقبل campaign_id
- تجلب العملاء المستهدفين (حسب الفلتر)
- تبعت الرسائل عبر سيرفر Baileys واحدة واحدة مع delay
- تحدّث حالة كل recipient

---

## المرحلة 4: Edge Function جديدة - `followup-check`

- يتم استدعاؤها دورياً (Cron أو من Baileys server)
- تفحص العملاء اللي محتاجين متابعة حسب `followup_rules`
- تبعت رسائل المتابعة تلقائياً

---

## المرحلة 5: Frontend - صفحات جديدة ومحسّنة

### 1. صفحة Inbox محسّنة

- عرض صور الميديا في الشات
- زر إرفاق صورة/ملف
- لوحة جانبية لبيانات العميل (بروفايل واتساب + ذاكرة + ملخص)

### 2. صفحة Broadcast جديدة

- إنشاء حملة رسائل جماعية
- اختيار الفئة المستهدفة
- إرفاق صورة
- متابعة حالة الإرسال (progress bar)

### 3. صفحة Contacts محسّنة

- عرض صورة البروفايل من واتساب
- عرض ملخص AI للعميل
- عرض ذاكرة العميل (تفضيلاته، اهتماماته)

### 4. صفحة Bot Settings محسّنة

- إضافة تبويب "المتابعة التلقائية" لإعداد followup_rules
- إضافة تبويب "الشخصيات" لاختيار نوع الشخصية (مبيعات/دعم/عام)

### 5. إضافة رابط Broadcast في الـ Sidebar

---

## المرحلة 6: تحديث سيرفر Baileys

إضافة في `baileys-server/index.js`:

1. **إرسال بيانات البروفايل** مع كل رسالة (pushName, profilePicUrl, status)
2. **استقبال الصور** وتحويلها لـ base64 أو رفعها وإرسال الرابط
3. **API endpoint `/broadcast**` لاستقبال أوامر الإرسال الجماعي مع delay بين الرسائل
4. **Cron job** لاستدعاء `followup-check` كل ساعة

---

## المرحلة 7: شرح تفصيلي لنشر سيرفر Baileys

سيتم إنشاء ملف `DEPLOYMENT_GUIDE.md` شامل يتضمن:

1. **إنشاء  مجاني** على reilway(خطوة بخطوة)
2. **رفع الكود**
3. **ضبط المتغيرات**: ملف `.env` مع:
  - `SUPABASE_URL` و `SUPABASE_ANON_KEY`
  - `WEBHOOK_URL` = `https://mobxdcedtckzvusazdjg.supabase.co/functions/v1/whatsapp-webhook`
  - `STATUS_URL` = `https://mobxdcedtckzvusazdjg.supabase.co/functions/v1/whatsapp-status`
4. **التشغيل**
5. **الربط من اللوحة**: إدخال `http://reilway.api.com` في صفحة الإعدادات
6. **مسح QR Code** من صفحة الاتصال

---

## ترتيب التنفيذ

1. Migration: جداول جديدة + تعديل contacts
2. تحديث `whatsapp-webhook` (بروفايل + ذاكرة + prompt محسّن + ميديا)
3. إنشاء `broadcast-send` edge function
4. إنشاء `followup-check` edge function
5. تحديث Inbox (ميديا + لوحة عميل جانبية)
6. إنشاء صفحة Broadcast
7. تحديث Contacts + Bot Settings
8. تحديث كود Baileys server
9. إنشاء DEPLOYMENT_GUIDE.md