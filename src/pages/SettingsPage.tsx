import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Clock, Bell, Globe, Save, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("bot_settings").select("*").limit(1).single().then(({ data }) => setSettings(data));
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    await supabase.from("bot_settings").update({
      working_hours_start: settings.working_hours_start,
      working_hours_end: settings.working_hours_end,
      off_hours_message: settings.off_hours_message,
      baileys_server_url: settings.baileys_server_url,
    } as any).eq("id", settings.id);
    toast({ title: "تم حفظ الإعدادات ✅" });
    setSaving(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <p className="text-muted-foreground text-sm">إعدادات النظام العامة</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center"><Clock className="h-4 w-4 text-primary" /></div>
            أوقات العمل
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/10 border border-green-500/30">
            <div>
              <Label className="font-medium text-green-700">🟢 البوت يعمل 24 ساعة متواصلة</Label>
              <p className="text-xs text-muted-foreground">مرام أونلاين دايماً وبترد على العملاء في أي وقت</p>
            </div>
            <Switch checked disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center"><Globe className="h-4 w-4 text-primary" /></div>
            عنوان سيرفر Baileys
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>عنوان URL للسيرفر الخارجي</Label>
            <Input
              placeholder="https://your-server.up.railway.app"
              dir="ltr"
              className="font-mono text-sm"
              value={settings?.baileys_server_url || ""}
              onChange={(e) => setSettings({ ...settings, baileys_server_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">عنوان سيرفر Baileys الذي يشغل اتصال الواتساب</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center"><Bell className="h-4 w-4 text-primary" /></div>
            الإشعارات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "إشعارات الرسائل الجديدة", desc: "إشعار عند وصول رسالة جديدة" },
            { label: "إشعارات فشل AI", desc: "إشعار عندما لا يستطيع البوت الرد" },
            { label: "إشعارات انقطاع الاتصال", desc: "إشعار عند فقدان اتصال الواتساب" },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border">
              <div>
                <Label className="font-medium">{item.label}</Label>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch defaultChecked />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        حفظ الإعدادات
      </Button>
    </div>
  );
}
