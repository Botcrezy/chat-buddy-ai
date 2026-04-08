

# خطة شاملة: تحسين النظام بالكامل

## ملخص التغييرات المطلوبة

1. **تحديث هوية البوت** → اسمه "مرام"، مؤنث، تتكلم مصري عامي، تعمل في Sity Cloud
2. **تدريب البوت على بيانات Sity Cloud** الكاملة المرفقة
3. **إضافة علامة "يكتب الآن"** في واتساب قبل إرسال الرد
4. **دعم ربط أكثر من رقم واتساب** (Multi-profile)
5. **تحسين واجهة التدريب** بدعم رفع الصور
6. **إصلاح وتحسين لوحة التحكم**

---

## 1. تحديث هوية البوت وأسلوبه

### تعديل `supabase/functions/whatsapp-webhook/index.ts`
- تغيير System Prompt بالكامل:
  - الاسم: **مرام** (مؤنث)
  - الشركة: **Sity Cloud**
  - اللهجة: **مصرية عامية** ("إزيك"، "أهلاً بيك"، "تمام"، "إيه اللي تحب تعرفه؟")
  - تتحدث كشخص بشري حقيقي من فريق خدمة العملاء
  - ذكية في فهم الطلبات وتقترح حلول مناسبة
  - تشرح خدمات Sity Cloud تدريجياً حسب احتياج العميل
- تحديث `bot_settings` الافتراضي: `bot_name = "مرام"`

### إضافة بيانات Sity Cloud كـ Knowledge Base
- إدخال بيانات الشركة الكاملة المرفقة في جدول `knowledge_base` عبر SQL insert:
  - وصف المنصة العام
  - خدمات (Page Builder, Plugins, AI Assistant)
  - Sity Expert (Freelance platform)
  - البرامج التدريبية
  - نظام WhatsApp Bot ووصفه

---

## 2. علامة "يكتب الآن" (Typing Indicator)

### تعديل `baileys-server/index.js`
- قبل إرسال رد AI، إرسال `presenceSubscribe` + `sendPresenceUpdate('composing')` للعميل
- إضافة تأخير طبيعي (1-3 ثواني) لمحاكاة الكتابة البشرية
- بعد الإرسال، إرسال `sendPresenceUpdate('paused')`

```text
العميل يرسل رسالة
  → Webhook يعالج ويرد بـ ai_reply
  → Baileys يرسل "composing" للعميل
  → انتظار 1-3 ثواني
  → إرسال الرد الفعلي
  → إرسال "paused"
```

---

## 3. دعم أكثر من رقم واتساب (Multi-Profile)

### Migration جديدة
- إضافة جدول `whatsapp_profiles`:
  ```sql
  CREATE TABLE whatsapp_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    server_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    phone_number TEXT,
    status TEXT DEFAULT 'disconnected',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );
  ```
- RLS policy للأدمن فقط

### تعديل `src/pages/Connection.tsx`
- عرض قائمة بالأرقام/البروفايلات المربوطة
- إمكانية إضافة بروفايل جديد (اسم + رابط سيرفر)
- كل بروفايل يعرض حالته (متصل/غير متصل) وQR Code الخاص به
- زر تعيين كافتراضي

### تعديل `src/components/AppSidebar.tsx`
- إضافة selector للبروفايل النشط في الـ sidebar header

---

## 4. تحسين واجهة التدريب (رفع صور)

### Migration: إنشاء Storage Bucket
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge-media', 'knowledge-media', true);
```
مع RLS policies للرفع والقراءة.

### تعديل `src/pages/BotSettings.tsx`
- في تبويب "المعرفة": إضافة حقل رفع صورة عند اختيار نوع "صورة"
- استخدام Supabase Storage لرفع الصور
- عرض الصور المرفوعة كـ thumbnails في قائمة العناصر
- تحسين النموذج ليكون أوضح وأسهل

---

## 5. إصلاح وتحسين لوحة التحكم

### تعديل `src/pages/Dashboard.tsx`
- إضافة بطاقة "البروفايلات المتصلة" تعرض عدد الأرقام النشطة
- تحسين عرض الإحصائيات مع أرقام ديناميكية حقيقية
- تحسين التصميم العام والـ spacing
- إضافة إحصائية "نسبة ردود AI الناجحة"

### تعديل `src/components/AppSidebar.tsx`
- تحديث اسم النظام من "واتساب بوت" إلى "Sity Cloud Bot"
- إضافة لوجو Sity Cloud

---

## ترتيب التنفيذ

1. **Migration**: جدول `whatsapp_profiles` + Storage bucket
2. **Webhook**: تحديث System Prompt (مرام + مصري + Sity Cloud)
3. **Knowledge Base Data**: إدخال بيانات Sity Cloud
4. **Baileys Server**: إضافة typing indicator
5. **Connection Page**: دعم multi-profile
6. **BotSettings**: رفع صور في التدريب
7. **Dashboard + Sidebar**: تحسين UI

## الملفات المتأثرة
- `supabase/migrations/` - جدول جديد + storage bucket
- `supabase/functions/whatsapp-webhook/index.ts` - system prompt جديد
- `baileys-server/index.js` - typing indicator
- `src/pages/Connection.tsx` - multi-profile UI
- `src/pages/BotSettings.tsx` - رفع صور
- `src/pages/Dashboard.tsx` - تحسين UI
- `src/components/AppSidebar.tsx` - branding + profile selector

