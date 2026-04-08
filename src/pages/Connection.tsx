import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, RefreshCw, QrCode, Smartphone, CheckCircle2 } from "lucide-react";

export default function Connection() {
  const isConnected = false;

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">اتصال واتساب</h1>
        <p className="text-muted-foreground text-sm">ربط حساب واتساب بالنظام عبر QR Code</p>
      </div>

      {/* Status Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={`h-14 w-14 rounded-full flex items-center justify-center ${
              isConnected ? "bg-primary/15" : "bg-muted"
            }`}>
              {isConnected ? (
                <Wifi className="h-7 w-7 text-primary" />
              ) : (
                <WifiOff className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">حالة الاتصال</h3>
                <Badge variant={isConnected ? "default" : "secondary"}>
                  {isConnected ? "متصل" : "غير متصل"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {isConnected
                  ? "الواتساب متصل ويعمل بشكل طبيعي"
                  : "يرجى مسح QR Code لربط الواتساب"}
              </p>
            </div>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 ml-1" /> تحديث
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* QR Code Card */}
      {!isConnected && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-lg flex items-center justify-center gap-2">
              <QrCode className="h-5 w-5 text-primary" /> مسح QR Code
            </CardTitle>
            <CardDescription>
              افتح واتساب على هاتفك → الإعدادات → الأجهزة المرتبطة → ربط جهاز
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <div className="h-64 w-64 rounded-2xl border-2 border-dashed border-primary/30 flex items-center justify-center bg-muted/30">
              <div className="text-center text-muted-foreground">
                <QrCode className="h-16 w-16 mx-auto mb-3 opacity-30" />
                <p className="text-sm">QR Code سيظهر هنا</p>
                <p className="text-xs mt-1">يتطلب تشغيل سيرفر Baileys</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" /> خطوات الربط
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            {[
              "شغل سيرفر Baileys على VPS خارجي (Oracle Free Tier)",
              "أدخل عنوان السيرفر في إعدادات النظام",
              "سيظهر QR Code تلقائياً في هذه الصفحة",
              "افتح واتساب على هاتفك واذهب للإعدادات",
              "اختر 'الأجهزة المرتبطة' ثم 'ربط جهاز'",
              "امسح QR Code الظاهر على الشاشة",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
