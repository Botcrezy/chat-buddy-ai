import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Brain,
  Zap,
  MessageSquare,
  Plus,
  Trash2,
  TestTube,
  Send,
  BookOpen,
} from "lucide-react";

export default function BotSettings() {
  const [autoReply, setAutoReply] = useState(true);
  const [testMessage, setTestMessage] = useState("");

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">إعدادات البوت</h1>
        <p className="text-muted-foreground text-sm">تخصيص سلوك الرد التلقائي والذكاء الاصطناعي</p>
      </div>

      <Tabs defaultValue="general" dir="rtl">
        <TabsList className="grid grid-cols-4 w-full md:w-auto md:inline-grid">
          <TabsTrigger value="general" className="text-xs">عام</TabsTrigger>
          <TabsTrigger value="training" className="text-xs">التدريب</TabsTrigger>
          <TabsTrigger value="quick" className="text-xs">ردود جاهزة</TabsTrigger>
          <TabsTrigger value="test" className="text-xs">اختبار</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" /> إعدادات عامة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <Label className="font-semibold">الرد التلقائي</Label>
                  <p className="text-xs text-muted-foreground">تفعيل الرد التلقائي بالذكاء الاصطناعي</p>
                </div>
                <Switch checked={autoReply} onCheckedChange={setAutoReply} />
              </div>

              <div className="space-y-2">
                <Label>اسم البوت</Label>
                <Input defaultValue="مساعد الشركة" />
              </div>

              <div className="space-y-2">
                <Label>شخصية البوت</Label>
                <Textarea
                  rows={4}
                  defaultValue="أنت مساعد ذكي ومهذب للشركة. ترد على استفسارات العملاء بشكل احترافي وودود."
                />
              </div>

              <div className="space-y-2">
                <Label>رسالة الترحيب</Label>
                <Input defaultValue="مرحباً بك! كيف يمكنني مساعدتك اليوم؟" />
              </div>

              <Button className="w-full md:w-auto">حفظ التغييرات</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" /> بيانات التدريب
                  </CardTitle>
                  <CardDescription>أضف أسئلة وأجوبة لتدريب البوت</CardDescription>
                </div>
                <Button size="sm">
                  <Plus className="h-4 w-4 ml-1" /> إضافة
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد بيانات تدريب بعد</p>
                <p className="text-xs mt-1">أضف أسئلة وأجوبة ليتعلم منها البوت</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quick" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" /> ردود جاهزة
                  </CardTitle>
                  <CardDescription>قوالب ردود سريعة يستخدمها البوت</CardDescription>
                </div>
                <Button size="sm">
                  <Plus className="h-4 w-4 ml-1" /> إضافة
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد ردود جاهزة بعد</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TestTube className="h-5 w-5 text-primary" /> اختبار البوت
              </CardTitle>
              <CardDescription>جرب البوت قبل تشغيله على الواتساب</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border bg-muted/30 p-4 mb-4 min-h-[200px]">
                <p className="text-center text-sm text-muted-foreground">ابدأ بإرسال رسالة لاختبار البوت</p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="اكتب رسالة اختبارية..."
                  className="flex-1"
                />
                <Button disabled={!testMessage.trim()}>
                  <Send className="h-4 w-4 ml-1" /> إرسال
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
