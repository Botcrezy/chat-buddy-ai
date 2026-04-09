

# خطة تطوير شاملة: تحسين التصميم + تحديث AI + إشعارات الأدمن

## ملخص التغييرات

1. تحسين تصميم لوحة التحكم (Light Mode قوي ومميز)
2. تحديث السايدبار والهيدر
3. تغيير نموذج AI إلى `google/gemma-4-31b-it:free` عبر OpenRouter
4. منع إيموجي في ردود البوت
5. إشعار الأدمن على واتساب (+201152956791) عند طلب دعم بشري
6. تحسين صفحة التدريب (رفع صور + تعديل بيانات موجودة)

---

## 1. تحسين التصميم (Light Mode)

### تعديل `src/index.css`
- تحديث ألوان Light mode لتكون أكثر حيوية واحترافية
- خلفية أفتح، ظلال أنعم، ألوان primary أقوى
- تحسين sidebar colors للـ light mode

### تعديل `src/components/AppSidebar.tsx`
- تصميم جديد للسايدبار: لوجو أوضح، spacing أفضل، hover effects
- إضافة footer بمعلومات الإصدار

### تعديل `src/components/AppLayout.tsx`
- تحسين الهيدر: عرض حالة الاتصال ديناميكياً
- تحسين spacing و typography

### تعديل `src/pages/Dashboard.tsx`
- كروت إحصائيات بتصميم أنظف
- ألوان gradient محسنة
- تحسين الشارت والمحادثات الأخيرة

---

## 2. تغيير نموذج AI + منع إيموجي + إشعار الأدمن

### تعديل `supabase/functions/whatsapp-webhook/index.ts`

**النموذج**: تغيير من Lovable AI Gateway إلى OpenRouter مع `google/gemma-4-31b-it:free`
- استخدام `OPENROUTER_API_KEY` (موجود بالفعل في secrets)
- URL: `https://openrouter.ai/api/v1/chat/completions`

**منع إيموجي**: إضافة تعليمة صريحة في system prompt:
- "ممنوع تماماً استخدام أي إيموجي أو رموز تعبيرية في الردود"

**إشعار الأدمن**: عند اكتشاف طلب دعم بشري أو تحويل للموظف:
- إرسال رسالة واتساب للرقم +201152956791 عبر Baileys server `/send` endpoint
- الرسالة تتضمن اسم العميل ورقمه وملخص المشكلة

**ملاحظة**: النموذج `google/gemma-4-31b-it:free` مجاني من OpenRouter لكنه قد يكون أبطأ وأضعف من Gemini 2.5 Flash. لو حبيت أداء أقوى يمكن نرجع لـ Lovable AI.

---

## 3. تحسين صفحة التدريب

### تعديل `src/pages/BotSettings.tsx`
- إضافة زر "تعديل" لكل عنصر في قاعدة المعرفة (edit mode)
- تحسين واجهة رفع الصور بـ preview
- عرض الصور المرفوعة كـ thumbnails
- Storage bucket `knowledge-media` موجود بالفعل

---

## 4. تحسين Baileys Server

### تعديل `baileys-server/index.js`
- لا تغييرات كبيرة - فقط التأكد من endpoint `/send` يعمل للإشعارات

---

## ترتيب التنفيذ

1. تحديث `src/index.css` - ألوان light mode
2. تحديث `AppSidebar.tsx` + `AppLayout.tsx` - تصميم جديد
3. تحديث `Dashboard.tsx` - تصميم محسن
4. تحديث `whatsapp-webhook/index.ts` - OpenRouter + no emoji + admin notification
5. تحديث `BotSettings.tsx` - تعديل بيانات التدريب + تحسين UI
6. Deploy webhook

## الملفات المتأثرة
- `src/index.css`
- `src/components/AppSidebar.tsx`
- `src/components/AppLayout.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/BotSettings.tsx`
- `supabase/functions/whatsapp-webhook/index.ts`

