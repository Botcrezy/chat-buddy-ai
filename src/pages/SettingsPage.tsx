import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Settings, Clock, Bell, Globe } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <p className="text-muted-foreground text-sm">إعدادات النظام العامة</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> أوقات العمل
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>بداية العمل</Label>
              <Input type="time" defaultValue="09:00" />
            </div>
            <div className="space-y-2">
              <Label>نهاية العمل</Label>
              <Input type="time" defaultValue="17:00" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>رسالة خارج أوقات العمل</Label>
            <Textarea
              defaultValue="شكراً لتواصلك. نحن خارج أوقات العمل حالياً، سنرد عليك في أقرب وقت."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> الإشعارات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <Label>إشعارات الرسائل الجديدة</Label>
              <p className="text-xs text-muted-foreground">إشعار عند وصول رسالة جديدة</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <Label>إشعارات فشل AI</Label>
              <p className="text-xs text-muted-foreground">إشعار عندما لا يستطيع البوت الرد</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <Label>إشعارات انقطاع الاتصال</Label>
              <p className="text-xs text-muted-foreground">إشعار عند فقدان اتصال الواتساب</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> عنوان سيرفر Baileys
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>عنوان URL للسيرفر الخارجي</Label>
            <Input placeholder="https://your-vps-ip:3001" dir="ltr" />
            <p className="text-xs text-muted-foreground">عنوان سيرفر Baileys الذي يشغل اتصال الواتساب</p>
          </div>
          <Button>حفظ الإعدادات</Button>
        </CardContent>
      </Card>
    </div>
  );
}
