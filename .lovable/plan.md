

# خطة بناء نظام إدارة رسائل واتساب مع AI

## الهيكل العام

```text
┌─────────────────────────────────────────────┐
│           Admin Dashboard (Lovable)          │
│  Dashboard │ Inbox │ AI Bot │ Contacts │ QR  │
└──────────────────┬──────────────────────────┘
                   │ Webhooks / API
┌──────────────────▼──────────────────────────┐
│     External VPS (Oracle Free Tier)          │
│  Baileys (WhatsApp) ←→ Node.js Server       │
│  AI Engine (Lovable AI Gateway)              │
└─────────────────────────────────────────────┘
```

## ملاحظة تقنية مهمة

Baileys تحتاج Node.js server يشتغل 24/7. Lovable بيبني frontend فقط. الحل:
- **لوحة التحكم (Dashboard)**: تتبني هنا في Lovable بالكامل
- **سيرفر Baileys**: يتشغل على VPS مجاني (Oracle Free Tier) ويتواصل مع اللوحة عبر Edge Functions
- **AI**: يستخدم Lovable AI Gateway (مجاني) عبر Edge Function
- **Database**: Supabase PostgreSQL (متصل بالفعل)

---

## المرحلة 1: قاعدة البيانات

إنشاء الجداول التالية في Supabase:

- **whatsapp_sessions** - حالة اتصال الواتساب (session_id, status, phone_number, qr_code, connected_at)
- **contacts** - جهات الاتصال (phone, name, category, notes, last_message_at)
- **conversations** - المحادثات (contact_id, status [new/open/closed/waiting], assigned_to, is_ai_active)
- **messages** - الرسائل (conversation_id, content, direction [in/out], sender_type [customer/ai/agent], timestamp)
- **bot_settings** - إعدادات البوت (bot_name, personality, auto_reply_enabled, welcome_message, working_hours)
- **training_data** - بيانات تدريب AI (category, question, answer)
- **quick_replies** - ردود جاهزة (title, content, category)

مع RLS policies مناسبة (admin فقط يقدر يوصل للبيانات).

---

## المرحلة 2: لوحة التحكم (Frontend)

### Layout
- Sidebar عربي RTL مع أيقونات للتنقل
- ألوان خضراء (ثيم واتساب)
- متجاوب مع الموبايل

### الصفحات:

**1. Dashboard (الرئيسية)**
- إحصائيات: رسائل اليوم، عملاء نشطين، معدل رد AI، حالة الاتصال
- رسم بياني للرسائل (أسبوعي)
- أحدث المحادثات

**2. Inbox (المحادثات)**
- قائمة محادثات على اليسار مع بحث وفلاتر
- نافذة شات على اليمين (شكل واتساب)
- إمكانية الرد يدوي
- زر تحويل من AI لموظف والعكس
- علامات ملونة (VIP، شكوى، استفسار)

**3. AI Bot Settings (إعدادات البوت)**
- تشغيل/إيقاف الرد التلقائي
- إضافة بيانات تدريب (سؤال وجواب)
- تعديل شخصية البوت
- ردود جاهزة ذكية
- اختبار البوت من اللوحة

**4. Contacts (جهات الاتصال)**
- جدول بالعملاء مع بحث وتصنيفات
- صفحة تفاصيل كل عميل مع سجل محادثاته
- استيراد/تصدير CSV

**5. WhatsApp Connection (الاتصال)**
- عرض QR Code
- حالة الاتصال (متصل/غير متصل)
- زر إعادة اتصال
- معلومات الرقم المتصل

**6. Settings (الإعدادات)**
- رسالة ترحيب
- أوقات العمل
- إعدادات الإشعارات

---

## المرحلة 3: Edge Functions

**1. `whatsapp-webhook`** - يستقبل الرسائل من سيرفر Baileys ويخزنها في DB
**2. `ai-reply`** - يستخدم Lovable AI Gateway للرد على الرسائل بناءً على training data
**3. `send-message`** - يبعت رسالة للعميل عبر سيرفر Baileys
**4. `whatsapp-status`** - يجيب حالة الاتصال و QR code من السيرفر الخارجي

---

## المرحلة 4: سيرفر Baileys الخارجي (VPS)

هذا الجزء يتشغل خارج Lovable على VPS مجاني. هنوفر لك الكود الكامل:
- اتصال Baileys مع QR code
- webhook يبعت الرسائل الجديدة لـ Edge Function
- API لاستقبال أوامر الإرسال من اللوحة
- session management

---

## ترتيب التنفيذ

1. إنشاء جداول قاعدة البيانات + RLS
2. بناء Layout + Sidebar + Routing
3. صفحة Dashboard بإحصائيات
4. صفحة Inbox (المحادثات) 
5. صفحة AI Bot Settings + Training Data
6. صفحة Contacts
7. صفحة WhatsApp Connection (QR)
8. Edge Functions (webhook, ai-reply, send-message)
9. صفحة Settings
10. كود سيرفر Baileys الخارجي

---

## التقنيات المستخدمة (كلها مجانية)

| المكون | التقنية |
|--------|---------|
| Frontend | React + Tailwind (Lovable) |
| Database | Supabase PostgreSQL (متصل) |
| AI | Lovable AI Gateway |
| WhatsApp | Baileys على VPS خارجي |
| Auth | Supabase Auth (موجود) |
| Hosting VPS | Oracle Cloud Free Tier |

