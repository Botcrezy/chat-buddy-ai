# 🚀 دليل نشر سيرفر Baileys على Railway

## الخيار 1: Railway (الأسهل والأسرع)

### الخطوة 1: إنشاء حساب Railway
1. اذهب إلى [railway.app](https://railway.app)
2. سجل دخول بحساب GitHub
3. الخطة المجانية تعطيك 500 ساعة تشغيل شهرياً

### الخطوة 2: رفع السيرفر
1. انسخ مجلد `baileys-server` كاملاً لمستودع GitHub جديد
2. في Railway: **New Project → Deploy from GitHub repo**
3. اختر المستودع

### الخطوة 3: إعداد المتغيرات
في Railway → Settings → Variables، أضف:

```
SUPABASE_URL = https://mobxdcedtckzvusazdjg.supabase.co
SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vYnhkY2VkdGNrenZ1c2F6ZGpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MzExMzgsImV4cCI6MjA5MDMwNzEzOH0.rlPEvd8zCstQea4dP07QgIcupG539qRyeU-5i9IW2MY
WEBHOOK_URL = https://mobxdcedtckzvusazdjg.supabase.co/functions/v1/whatsapp-webhook
STATUS_URL = https://mobxdcedtckzvusazdjg.supabase.co/functions/v1/whatsapp-status
PORT = 3001
```

### الخطوة 4: تشغيل
Railway سيبني ويشغل تلقائياً. ستحصل على URL مثل:
```
https://your-project.up.railway.app
```

### الخطوة 5: ربط مع اللوحة
1. افتح لوحة التحكم → الإعدادات
2. ادخل عنوان السيرفر: `https://your-project.up.railway.app`
3. اذهب لصفحة "اتصال واتساب"
4. سيظهر QR Code - امسحه بتطبيق واتساب

---

## الخيار 2: VPS مجاني (Oracle Cloud)

### الخطوة 1: إنشاء VPS
1. اذهب إلى [cloud.oracle.com](https://cloud.oracle.com)
2. أنشئ حساب (بطاقة ائتمان للتحقق فقط - مجاني تماماً)
3. Compute → Create Instance:
   - Shape: **VM.Standard.E2.1.Micro** (مجاني دائماً)
   - Image: **Ubuntu 22.04**
   - SSH Key: أنشئ مفتاح SSH

### الخطوة 2: إعداد السيرفر
```bash
# اتصل بالـ VPS
ssh ubuntu@YOUR_VPS_IP

# تثبيت Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# تثبيت PM2
sudo npm install -g pm2

# تثبيت Git
sudo apt-get install -y git
```

### الخطوة 3: رفع الكود
```bash
# انسخ المجلد للسيرفر
git clone https://github.com/YOUR_USER/baileys-server.git
cd baileys-server

# تثبيت المكتبات
npm install
```

### الخطوة 4: إعداد المتغيرات
```bash
cp .env.example .env
nano .env
# عدل القيم حسب مشروعك
```

### الخطوة 5: التشغيل مع PM2
```bash
# تشغيل
pm2 start index.js --name baileys-server

# التشغيل التلقائي عند إعادة تشغيل السيرفر
pm2 startup
pm2 save

# مراقبة اللوجات
pm2 logs baileys-server
```

### الخطوة 6: فتح البورت
```bash
# في Oracle Cloud Console:
# Networking → Virtual Cloud Networks → Security Lists
# أضف Ingress Rule:
# Source: 0.0.0.0/0
# Port: 3001
# Protocol: TCP

# أو على السيرفر:
sudo iptables -I INPUT -p tcp --dport 3001 -j ACCEPT
sudo netfilter-persistent save
```

### الخطوة 7: ربط مع اللوحة
1. افتح لوحة التحكم → الإعدادات
2. ادخل عنوان السيرفر: `http://YOUR_VPS_IP:3001`

---

## 📱 مسح QR Code

1. افتح **واتساب** على هاتفك
2. اذهب إلى **الإعدادات** ← **الأجهزة المرتبطة**
3. اضغط **ربط جهاز**
4. امسح **QR Code** الظاهر في صفحة "اتصال واتساب"
5. ✅ تم الربط!

---

## 🔧 استكشاف الأخطاء

### QR Code لا يظهر
- تأكد أن السيرفر يعمل: `pm2 status`
- تأكد من المتغيرات: `cat .env`
- راجع اللوجات: `pm2 logs baileys-server`

### الاتصال ينقطع
- Baileys يعيد الاتصال تلقائياً
- إذا استمر: `pm2 restart baileys-server`

### الرسائل لا تصل للوحة
- تأكد من `WEBHOOK_URL` صحيح
- تأكد من `SUPABASE_ANON_KEY` صحيح
- راجع Edge Function logs في Supabase Dashboard

---

## 📡 API Endpoints

| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/` | Health check |
| GET | `/status` | حالة الاتصال |
| POST | `/send` | إرسال رسالة |
| POST | `/broadcast` | إرسال جماعي |
| POST | `/restart` | إعادة اتصال |
| POST | `/logout` | تسجيل خروج |

### مثال إرسال رسالة:
```bash
curl -X POST http://YOUR_SERVER:3001/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "966512345678", "message": "مرحباً!"}'
```
