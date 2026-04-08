import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Wifi, WifiOff, RefreshCw, QrCode, Smartphone, Loader2 } from "lucide-react";

export default function Connection() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStatus(); }, []);

  const fetchStatus = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_sessions")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    setSession(data);
    setLoading(false);
  };

  const isConnected = session?.status === "connected";

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">اتصال واتساب</h1>
        <p className="text-muted-foreground text-sm">ربط حساب واتساب بالنظام عبر QR Code</p>
      </div>

      <Card className={isConnected ? "border-primary/30 bg-primary/5" : ""}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${isConnected ? "bg-primary/15" : "bg-muted"}`}>
              {loading ? (
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              ) : isConnected ? (
                <Wifi className="h-7 w-7 text-primary" />
              ) : (
                <WifiOff className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">حالة الاتصال</h3>
                <Badge variant={isConnected ? "default" : "secondary"} className="gap-1">
                  <div className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-primary-foreground animate-pulse" : "bg-muted-foreground"}`} />
                  {isConnected ? "متصل" : "غير متصل"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {isConnected
                  ? `متصل بالرقم ${session?.phone_number || ""}`
                  : "يرجى مسح QR Code لربط الواتساب"}
              </p>
              {isConnected && session?.connected_at && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  آخر اتصال: {new Date(session.connected_at).toLocaleString("ar")}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={fetchStatus} className="gap-1 shrink-0">
              <RefreshCw className="h-4 w-4" /> تحديث
            </Button>
          </div>
        </CardContent>
      </Card>

      {!isConnected && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-lg flex items-center justify-center gap-2">
              <QrCode className="h-5 w-5 text-primary" /> مسح QR Code
            </CardTitle>
            <CardDescription>افتح واتساب → الإعدادات → الأجهزة المرتبطة → ربط جهاز</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            {session?.qr_code ? (
              <div className="p-4 bg-white rounded-2xl shadow-lg">
                <img src={session.qr_code} alt="QR Code" className="h-64 w-64" />
              </div>
            ) : (
              <div className="h-64 w-64 rounded-2xl border-2 border-dashed border-primary/20 flex items-center justify-center bg-muted/20">
                <div className="text-center text-muted-foreground">
                  <QrCode className="h-16 w-16 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">QR Code سيظهر هنا</p>
                  <p className="text-xs mt-1">يتطلب تشغيل سيرفر Baileys</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center"><Smartphone className="h-4 w-4 text-primary" /></div>
            خطوات الربط
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4 text-sm">
            {[
              "شغل سيرفر Baileys على VPS خارجي (Oracle Free Tier)",
              "أدخل عنوان السيرفر في صفحة الإعدادات",
              "سيظهر QR Code تلقائياً في هذه الصفحة",
              "افتح واتساب على هاتفك → الإعدادات",
              "اختر \"الأجهزة المرتبطة\" ثم \"ربط جهاز\"",
              "امسح QR Code الظاهر على الشاشة",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm">
                  {i + 1}
                </span>
                <span className="pt-1">{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
