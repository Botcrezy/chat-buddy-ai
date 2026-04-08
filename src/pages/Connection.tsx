import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Wifi, WifiOff, RefreshCw, QrCode, Smartphone, Loader2, Server, RotateCcw, ExternalLink, Activity } from "lucide-react";

export default function Connection() {
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [serverUrl, setServerUrl] = useState("");
  const [serverStatus, setServerStatus] = useState<"unknown" | "online" | "offline">("unknown");
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [restarting, setRestarting] = useState(false);
  const [savingUrl, setSavingUrl] = useState(false);

  // Load server URL from bot_settings
  useEffect(() => {
    supabase.from("bot_settings").select("baileys_server_url").limit(1).single().then(({ data }) => {
      if (data?.baileys_server_url) setServerUrl(data.baileys_server_url);
    });
  }, []);

  const fetchStatus = useCallback(async () => {
    const { data } = await supabase
      .from("whatsapp_sessions")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    setSession(data);
    setLoading(false);
  }, []);

  // Check server health directly
  const checkServer = useCallback(async () => {
    if (!serverUrl) { setServerStatus("unknown"); return; }
    try {
      const url = serverUrl.replace(/\/$/, "");
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      setServerStatus("online");
      setServerInfo(data);
    } catch {
      setServerStatus("offline");
      setServerInfo(null);
    }
  }, [serverUrl]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    fetchStatus();
    checkServer();
    const interval = setInterval(() => {
      fetchStatus();
      checkServer();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus, checkServer]);

  const isConnected = session?.status === "connected";
  const isWaitingQR = session?.status === "waiting_qr";
  const isStarting = session?.status === "starting";

  const saveServerUrl = async () => {
    setSavingUrl(true);
    const { data } = await supabase.from("bot_settings").select("id").limit(1).single();
    if (data) {
      await supabase.from("bot_settings").update({ baileys_server_url: serverUrl } as any).eq("id", data.id);
    }
    toast({ title: "تم حفظ عنوان السيرفر ✅" });
    setSavingUrl(false);
    checkServer();
  };

  const restartServer = async () => {
    if (!serverUrl) return;
    setRestarting(true);
    try {
      await fetch(`${serverUrl.replace(/\/$/, "")}/restart`, { method: "POST" });
      toast({ title: "تم إرسال طلب إعادة التشغيل 🔄" });
    } catch {
      toast({ title: "فشل الاتصال بالسيرفر ❌", variant: "destructive" });
    }
    setRestarting(false);
  };

  const statusBadge = () => {
    if (isConnected) return <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-200"><div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />متصل</Badge>;
    if (isWaitingQR) return <Badge className="gap-1 bg-amber-500/15 text-amber-600 border-amber-200"><div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />بانتظار QR</Badge>;
    if (isStarting) return <Badge className="gap-1 bg-blue-500/15 text-blue-600 border-blue-200"><Loader2 className="h-3 w-3 animate-spin" />جاري البدء</Badge>;
    return <Badge variant="secondary" className="gap-1"><div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />غير متصل</Badge>;
  };

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">اتصال واتساب</h1>
        <p className="text-muted-foreground text-sm">ربط حساب واتساب بالنظام عبر QR Code</p>
      </div>

      {/* Server URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center"><Server className="h-4 w-4 text-primary" /></div>
            عنوان السيرفر
            {serverStatus === "online" && <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-200 text-xs">متصل</Badge>}
            {serverStatus === "offline" && <Badge variant="destructive" className="text-xs">غير متصل</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="https://your-server.up.railway.app"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              dir="ltr"
              className="font-mono text-sm"
            />
            <Button onClick={saveServerUrl} disabled={savingUrl} size="sm" className="shrink-0">
              {savingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
            </Button>
          </div>
          {serverInfo && (
            <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg font-mono" dir="ltr">
              uptime: {Math.floor(serverInfo.uptime || 0)}s | connected: {String(serverInfo.connected)} | logs: {serverInfo.logs_count || 0}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={restartServer} disabled={restarting || !serverUrl} className="gap-1">
              {restarting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              إعادة تشغيل
            </Button>
            {serverUrl && (
              <Button variant="outline" size="sm" asChild className="gap-1">
                <a href={`${serverUrl.replace(/\/$/, "")}/logs`} target="_blank" rel="noopener noreferrer">
                  <Activity className="h-3 w-3" /> عرض اللوجات
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Connection Status */}
      <Card className={isConnected ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20" : ""}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${isConnected ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-muted"}`}>
              {loading ? (
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              ) : isConnected ? (
                <Wifi className="h-7 w-7 text-emerald-600" />
              ) : (
                <WifiOff className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">حالة الواتساب</h3>
                {statusBadge()}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {isConnected && `متصل بالرقم ${session?.phone_number || ""}`}
                {isWaitingQR && "QR Code جاهز - امسحه من واتساب"}
                {isStarting && "جاري تهيئة الاتصال..."}
                {!isConnected && !isWaitingQR && !isStarting && "يرجى تشغيل السيرفر ومسح QR Code"}
              </p>
              {isConnected && session?.connected_at && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  آخر اتصال: {new Date(session.connected_at).toLocaleString("ar")}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchStatus(); }} className="gap-1 shrink-0">
              <RefreshCw className="h-4 w-4" /> تحديث
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* QR Code */}
      {!isConnected && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-lg flex items-center justify-center gap-2">
              <QrCode className="h-5 w-5 text-primary" /> مسح QR Code
            </CardTitle>
            <CardDescription>
              {isWaitingQR ? "امسح الكود أدناه من تطبيق واتساب" : "افتح واتساب → الإعدادات → الأجهزة المرتبطة → ربط جهاز"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            {session?.qr_code ? (
              <div className="p-4 bg-white rounded-2xl shadow-lg border">
                <img src={session.qr_code} alt="QR Code" className="h-64 w-64" />
                <p className="text-center text-xs text-muted-foreground mt-2">يتم التحديث تلقائياً كل 5 ثوانٍ</p>
              </div>
            ) : (
              <div className="h-64 w-64 rounded-2xl border-2 border-dashed border-primary/20 flex items-center justify-center bg-muted/20">
                <div className="text-center text-muted-foreground">
                  {isStarting ? (
                    <>
                      <Loader2 className="h-16 w-16 mx-auto mb-3 animate-spin opacity-40" />
                      <p className="text-sm font-medium">جاري تحميل QR Code...</p>
                    </>
                  ) : (
                    <>
                      <QrCode className="h-16 w-16 mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-medium">QR Code سيظهر هنا</p>
                      <p className="text-xs mt-1">تأكد أن السيرفر شغال</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Steps */}
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
              "شغل سيرفر Baileys على Railway أو VPS",
              "أدخل عنوان السيرفر أعلاه واضغط حفظ",
              "سيظهر QR Code تلقائياً",
              "افتح واتساب → الإعدادات → الأجهزة المرتبطة",
              "اضغط \"ربط جهاز\" وامسح QR Code",
              "ستتحول الحالة إلى \"متصل\" تلقائياً",
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
