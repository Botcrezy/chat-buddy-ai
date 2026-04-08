

# خطة شاملة: تحسين الذكاء الاصطناعي + تطوير واجهة المستخدم

## ملخص المشاكل الحالية
1. **الذكاء الاصطناعي ضعيف** - يستخدم نموذج `stepfun/step-3.5-flash:free` (مجاني وضعيف جداً) عبر OpenRouter
2. **بيانات التدريب محدودة** - فقط سؤال/جواب بسيط، بدون دعم لتدريب مفصل بالصور والملفات
3. **واجهة المستخدم** تحتاج تحسين شامل

---

## الجزء الأول: تحسين الذكاء الاصطناعي

### 1. تغيير نموذج AI إلى نموذج أقوى
- استبدال `stepfun/step-3.5-flash:free` بنموذج `google/gemini-2.5-flash` عبر Lovable AI Gateway
- سيتم استخدام `LOVABLE_API_KEY` الموجود بالفعل في Supabase secrets
- تغيير endpoint من OpenRouter إلى `https://ai.gateway.lovable.dev/v1/chat/completions`
- زيادة `max_tokens` من 500 إلى 1000 للردود الأكثر تفصيلاً

### 2. تطوير نظام التدريب (Knowledge Base)
- إضافة جدول جديد `knowledge_base` يدعم أنواع متعددة من البيانات:
  - `text` - نصوص تدريبية حرة (وصف منتجات، سياسات، أسعار...)
  - `image` - صور مع وصف (منتجات، كتالوج...)
  - `faq` - أسئلة وأجوبة (الموجود حالياً)
  - `document` - مستندات نصية كاملة
- كل عنصر يحتوي: `title`, `content`, `category`, `media_url`, `media_type`, `data_type`
- الأدمن يقدر يضيف بيانات مفصلة عن الشركة والمنتجات مع الصور

### 3. تحسين System Prompt والسياق
- بناء system prompt أذكى يستخدم كل بيانات التدريب الجديدة
- إرسال وصف الصور للـ AI مع السياق حتى يقدر يرد ويرسل صور للعملاء
- تحسين استخراج الذاكرة التلقائي من المحادثات
- إضافة تعليمات للبوت لإرسال روابط صور المنتجات عند الطلب

### 4. دعم إرسال الصور من البوت
- عندما يسأل العميل عن منتج، البوت يبحث في `knowledge_base` عن صور مرتبطة
- يضيف رابط الصورة في الرد حتى Baileys يرسلها كصورة فعلية
- تعديل webhook ليدعم إرجاع `media_url` مع الرد

---

## الجزء الثاني: تحسين واجهة المستخدم

### 5. تحسين لوحة التحكم (Dashboard)
- تصميم أنظف مع بطاقات إحصائية محسنة
- إضافة مؤشرات أداء البوت (نسبة الردود الناجحة، متوسط وقت الرد)
- تحسين الرسم البياني الأسبوعي

### 6. تحسين صفحة إعدادات البوت
- تبويب جديد "قاعدة المعرفة" بدل التدريب البسيط
- نموذج إضافة بيانات يدعم: نص حر + صور + تصنيفات
- عرض البيانات بشكل بطاقات مع معاينة الصور
- إمكانية رفع صور المنتجات مع وصف مفصل

### 7. تحسين الخطوط والتصميم العام
- استخدام خط Cairo بشكل أفضل مع أوزان متنوعة
- تحسين spacing والألوان
- تحسين responsive للموبايل

---

## التفاصيل التقنية

### Migration جديدة
```sql
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  data_type TEXT DEFAULT 'text', -- text, image, faq, document
  media_url TEXT,
  media_type TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```
مع RLS policy للأدمن.

### تعديل `whatsapp-webhook/index.ts`
- تغيير API endpoint إلى Lovable AI Gateway
- استخدام `LOVABLE_API_KEY` بدل `OPENROUTER_API_KEY`
- جلب بيانات من `knowledge_base` + `training_data`
- إضافة منطق إرسال الصور مع ردود البوت
- تحسين system prompt ليكون أذكى وأكثر تفصيلاً

### تعديل `baileys-server/index.js`
- دعم إرسال صور عند وجود `media_url` في رد الـ webhook

### الملفات المتأثرة
1. `supabase/migrations/` - جدول knowledge_base جديد
2. `supabase/functions/whatsapp-webhook/index.ts` - تحسين AI + knowledge base
3. `baileys-server/index.js` - دعم إرسال صور من ردود AI
4. `src/pages/BotSettings.tsx` - واجهة knowledge base جديدة
5. `src/pages/Dashboard.tsx` - تحسين التصميم
6. `src/pages/Inbox.tsx` - تحسينات طفيفة
7. `src/integrations/supabase/types.ts` - أنواع الجدول الجديد

## ترتيب التنفيذ
1. Migration: إنشاء جدول knowledge_base
2. تحديث webhook: تغيير AI model + knowledge base integration
3. تحديث baileys-server: دعم إرسال صور
4. تحديث BotSettings: واجهة knowledge base
5. تحديث Dashboard: تحسين التصميم
6. تحديث الأنواع في types.ts

