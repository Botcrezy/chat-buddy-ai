import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Wifi, WifiOff, RefreshCw, QrCode, Smartphone, Loader2, Server,
  RotateCcw, Activity, Trash2, AlertTriangle, Plus, Star, StarOff,
} from "lucide-react";

interface WhatsAppProfile {
  id: string;
  name: string;
  server_url: string;
  is_active: boolean;
  is_default: boolean;
  phone_number: string | null;
  status: string;
}

export default function Connection() {
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<WhatsAppProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<WhatsAppProfile | null>(null);
  const [serverStatus, setServerStatus] = useState<"unknown" | "online" | "offline">("unknown");
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [restarting, setRestarting] = useState(false);
  const [resettingSession, setResettingSession] = useState(false);

  // New profile dialog
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: "", server_url: "" });

  // Legacy server URL from bot_settings
  const [legacyServerUrl, setLegacyServerUrl] = useState("");

  useEffect(() => {
    fetchProfiles();
    supabase.from("bot_settings").select("baileys_server_url").limit(1).single().then(({ data }) => {
      if (data?.baileys_server_url) setLegacyServerUrl(data.baileys_server_url);
    });
  }, []);

  const fetchProfiles = async () => {
    const { data } = await supabase.from("whatsapp_profiles" as any).select("*").order("created_at", { ascending: true });
    const profileList = (data as any[] || []) as WhatsAppProfile[];
    setProfiles(profileList);
    if (!selectedProfile && profileList.length > 0) {
      setSelectedProfile(profileList.find(p => p.is_default) || profileList[0]);
    }
  };

  const serverUrl = selectedProfile?.server_url || legacyServerUrl;

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

  const checkServer = useCallback(async () => {
    if (!serverUrl) { setServerStatus("unknown"); return; }
    try {
      const url = serverUrl.replace(/\/$/, "");
      const [healthRes, logsRes] = await Promise.all([
        fetch(url, { signal: AbortSignal.timeout(5000) }),
        fetch(`${url}/logs`, { signal: AbortSignal.timeout(5000) }).catch(() => null),
      ]);
      const healthData = await healthRes.json();
      setServerStatus("online");
      setServerInfo(healthData);

      if (logsRes?.ok) {
        const logsData = await logsRes.json();
        setRecentLogs((logsData.logs || []).slice(-5));
      }
    } catch {
      setServerStatus("offline");
      setServerInfo(null);
      setRecentLogs([]);
    }
  }, [serverUrl]);

  useEffect(() => {
    fetchStatus();
    checkServer();
    const interval = setInterval(() => { fetchStatus(); checkServer(); }, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus, checkServer]);

  const isConnected = session?.status === "connected";
  const isWaitingQR = session?.status === "waiting_qr";
  const isStarting = session?.status === "starting";

  const addProfile = async () => {
    if (!newProfile.name || !newProfile.server_url) return;
    const isFirst = profiles.length === 0;
    await supabase.from("whatsapp_profiles" as any).insert({
      name: newProfile.name,
      server_url: newProfile.server_url,
      is_default: isFirst,
    } as any);
    setNewProfile({ name: "", server_url: "" });
    setShowAddProfile(false);
    fetchProfiles();
    toast({ title: "تم إضافة البروفايل ✅" });
  };

  const setDefaultProfile = async (id: string) => {
    await supabase.from("whatsapp_profiles" as any).update({ is_default: false } as any).neq("id", id);
    await supabase.from("whatsapp_profiles" as any).update({ is_default: true } as any).eq("id", id);
    // Also update bot_settings with the new default server URL
    const profile = profiles.find(p => p.id === id);
    if (profile) {
      const { data: bs } = await supabase.from("bot_settings").select("id").limit(1).single();
      if (bs) await supabase.from("bot_settings").update({ baileys_server_url: profile.server_url } as any).eq("id", bs.id);
    }
    fetchProfiles();
    toast({ title: "تم تعيين البروفايل الافتراضي ⭐" });
  };

  const deleteProfile = async (id: string) => {
    await supabase.from("whatsapp_profiles" as any).delete().eq("id", id);
    if (selectedProfile?.id === id) setSelectedProfile(null);
    fetchProfiles();
    toast({ title: "تم حذف البروفايل 🗑️" });
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

  const resetSession = async () => {
    if (!serverUrl) return;
    setResettingSession(true);
    try {
      const res = await fetch(`${serverUrl.replace(/\/$/, "")}/reset-session`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم مسح الجلسة وإعادة الاتصال 🗑️✅" });
      } else {
        toast({ title: "فشل مسح الجلسة", variant: "destructive" });
      }
    } catch {
      toast({ title: "فشل الاتصال بالسيرفر ❌", variant: "destructive" });
    }
    setResettingSession(false);
  };

  const statusBadge = () => {
    if (isConnected) return <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-200"><div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />متصل</Badge>;
    if (isWaitingQR) return <Badge className="gap-1 bg-amber-500/15 text-amber-600 border-amber-200"><div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />بانتظار QR</Badge>;
    if (isStarting) return <Badge className="gap-1 bg-blue-500/15 text-blue-600 border-blue-200"><Loader2 className="h-3 w-3 animate-spin" />جاري البدء</Badge>;
    return <Badge variant="secondary" className="gap-1"><div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />غير متصل</Badge>;
  };

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">اتصال واتساب</h1>
          <p className="text-muted-foreground text-sm">إدارة أرقام واتساب المربوطة بالنظام</p>
        </div>
        <Dialog open={showAddProfile} onOpenChange={setShowAddProfile}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 rounded-xl"><Plus className="h-4 w-4" /> إضافة رقم</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>إضافة رقم واتساب جديد</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label className="font-semibold">اسم البروفايل</Label>
                <Input value={newProfile.name} onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })} placeholder="مثال: رقم المبيعات" className="bg-muted/30" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold">رابط السيرفر</Label>
                <Input value={newProfile.server_url} onChange={(e) => setNewProfile({ ...newProfile, server_url: e.target.value })} placeholder="https://your-server.up.railway.app" dir="ltr" className="bg-muted/30 font-mono text-sm" />
              </div>
              <Button onClick={addProfile} className="w-full rounded-xl gap-2"><Plus className="h-4 w-4" /> إضافة</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Profiles List */}
      {profiles.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Smartphone className="h-4.5 w-4.5 text-primary" />
              </div>
              الأرقام المربوطة ({profiles.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className={`p-3 rounded-2xl border cursor-pointer transition-all ${selectedProfile?.id === profile.id ? "border-primary bg-primary/5 shadow-sm" : "hover:bg-muted/50"}`}
                onClick={() => setSelectedProfile(profile)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${selectedProfile?.id === profile.id ? "bg-primary/15" : "bg-muted"}`}>
                      <Smartphone className={`h-5 w-5 ${selectedProfile?.id === profile.id ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold">{profile.name}</p>
                        {profile.is_default && <Badge className="text-[10px] bg-amber-500/15 text-amber-600 border-amber-200">افتراضي</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono" dir="ltr">{profile.phone_number || profile.server_url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!profile.is_default && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setDefaultProfile(profile.id); }} title="تعيين كافتراضي">
                        <StarOff className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                    {profile.is_default && <Star className="h-4 w-4 text-amber-500 mx-1" />}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); deleteProfile(profile.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Server Status for selected profile */}
      {serverUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center"><Server className="h-4 w-4 text-primary" /></div>
              السيرفر {selectedProfile?.name || ""}
              {serverStatus === "online" && <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-200 text-xs">متصل</Badge>}
              {serverStatus === "offline" && <Badge variant="destructive" className="text-xs">غير متصل</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg font-mono" dir="ltr">
              {serverUrl}
              {serverInfo && ` | uptime: ${Math.floor(serverInfo.uptime || 0)}s | connected: ${String(serverInfo.connected)}`}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={restartServer} disabled={restarting} className="gap-1">
                {restarting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                إعادة تشغيل
              </Button>
              <Button variant="outline" size="sm" onClick={resetSession} disabled={resettingSession} className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10">
                {resettingSession ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                إعادة تعيين الجلسة
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
      )}

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

      {/* Recent Logs */}
      {recentLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> آخر الأحداث
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 font-mono text-xs max-h-40 overflow-y-auto" dir="ltr">
              {recentLogs.map((log, i) => (
                <div key={i} className={`p-1.5 rounded ${log.level === 'error' ? 'bg-destructive/10 text-destructive' : log.level === 'warn' ? 'bg-amber-500/10 text-amber-700' : 'bg-muted/30 text-muted-foreground'}`}>
                  <span className="opacity-60">{log.time?.slice(11, 19)}</span> {log.message}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
