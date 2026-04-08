import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, Brain, Zap, MessageSquare, Plus, Trash2, TestTube,
  Send, BookOpen, Save, Loader2, RefreshCw, Clock, UserCog,
} from "lucide-react";

export default function BotSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [trainingData, setTrainingData] = useState<any[]>([]);
  const [quickReplies, setQuickReplies] = useState<any[]>([]);
  const [followupRules, setFollowupRules] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [testing, setTesting] = useState(false);

  const [newQ, setNewQ] = useState({ question: "", answer: "", category: "general" });
  const [newQR, setNewQR] = useState({ title: "", content: "", category: "general" });
  const [newRule, setNewRule] = useState({ name: "", trigger_type: "no_reply", delay_hours: 24, message_template: "", target_category: "all" });
  const [showAddTraining, setShowAddTraining] = useState(false);
  const [showAddReply, setShowAddReply] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [s, t, q, f] = await Promise.all([
      supabase.from("bot_settings").select("*").limit(1).single(),
      supabase.from("training_data").select("*").order("created_at", { ascending: false }),
      supabase.from("quick_replies").select("*").order("usage_count", { ascending: false }),
      supabase.from("followup_rules").select("*").order("created_at", { ascending: false }),
    ]);
    setSettings(s.data);
    setTrainingData(t.data || []);
    setQuickReplies(q.data || []);
    setFollowupRules(f.data || []);
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    await supabase.from("bot_settings").update(settings).eq("id", settings.id);
    toast({ title: "تم حفظ الإعدادات ✅" });
    setSaving(false);
  };

  const addTraining = async () => {
    if (!newQ.question || !newQ.answer) return;
    await supabase.from("training_data").insert(newQ);
    setNewQ({ question: "", answer: "", category: "general" });
    setShowAddTraining(false);
    fetchAll();
    toast({ title: "تمت الإضافة ✅" });
  };

  const deleteTraining = async (id: string) => {
    await supabase.from("training_data").delete().eq("id", id);
    fetchAll();
  };

  const addQuickReply = async () => {
    if (!newQR.title || !newQR.content) return;
    await supabase.from("quick_replies").insert(newQR);
    setNewQR({ title: "", content: "", category: "general" });
    setShowAddReply(false);
    fetchAll();
    toast({ title: "تمت الإضافة ✅" });
  };

  const deleteQuickReply = async (id: string) => {
    await supabase.from("quick_replies").delete().eq("id", id);
    fetchAll();
  };

  const addFollowupRule = async () => {
    if (!newRule.name || !newRule.message_template) return;
    await supabase.from("followup_rules").insert(newRule);
    setNewRule({ name: "", trigger_type: "no_reply", delay_hours: 24, message_template: "", target_category: "all" });
    setShowAddRule(false);
    fetchAll();
    toast({ title: "تمت الإضافة ✅" });
  };

  const toggleRule = async (id: string, active: boolean) => {
    await supabase.from("followup_rules").update({ is_active: !active }).eq("id", id);
    fetchAll();
  };

  const deleteRule = async (id: string) => {
    await supabase.from("followup_rules").delete().eq("id", id);
    fetchAll();
  };

  const testBot = async () => {
    if (!testMessage.trim()) return;
    setTesting(true);
    setTestResponse("");
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/whatsapp-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ phone: "test_user", name: "اختبار", message: testMessage }),
      });
      const data = await res.json();
      setTestResponse(data.ai_reply || "لم يتم الحصول على رد");
    } catch {
      setTestResponse("حدث خطأ في الاختبار");
    } finally {
      setTesting(false);
    }
  };

  const personalities = [
    { label: "فريق المبيعات", value: "أنت عضو في فريق المبيعات. أسلوبك ودود ومقنع. تهتم بعرض المنتجات والخدمات وإقناع العميل بالشراء. تستخدم أسلوب محادثة طبيعي." },
    { label: "الدعم الفني", value: "أنت عضو في فريق الدعم الفني. أسلوبك صبور ومتعاون. تساعد العملاء في حل مشاكلهم التقنية بشكل واضح ومبسط." },
    { label: "خدمة العملاء", value: "أنت عضو في فريق خدمة العملاء. أسلوبك مهذب واحترافي. تجيب على الاستفسارات العامة وتوجه العملاء." },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">إعدادات البوت</h1>
        <p className="text-muted-foreground text-sm">تخصيص الرد التلقائي والذكاء الاصطناعي</p>
      </div>

      <Tabs defaultValue="general" dir="rtl">
        <TabsList className="grid grid-cols-5 w-full md:w-auto md:inline-grid bg-muted/50">
          <TabsTrigger value="general" className="text-xs gap-1"><Bot className="h-3.5 w-3.5" /> عام</TabsTrigger>
          <TabsTrigger value="training" className="text-xs gap-1"><Brain className="h-3.5 w-3.5" /> التدريب</TabsTrigger>
          <TabsTrigger value="quick" className="text-xs gap-1"><Zap className="h-3.5 w-3.5" /> ردود</TabsTrigger>
          <TabsTrigger value="followup" className="text-xs gap-1"><RefreshCw className="h-3.5 w-3.5" /> متابعة</TabsTrigger>
          <TabsTrigger value="test" className="text-xs gap-1"><TestTube className="h-3.5 w-3.5" /> اختبار</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/10">
                <div>
                  <Label className="font-semibold text-base">الرد التلقائي</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">تفعيل الرد بالذكاء الاصطناعي</p>
                </div>
                <Switch checked={settings?.auto_reply_enabled ?? true} onCheckedChange={(v) => setSettings({ ...settings, auto_reply_enabled: v })} />
              </div>
              <div className="space-y-2">
                <Label>اسم البوت</Label>
                <Input value={settings?.bot_name || ""} onChange={(e) => setSettings({ ...settings, bot_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>شخصية البوت</Label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {personalities.map((p) => (
                    <Button key={p.label} variant={settings?.personality === p.value ? "default" : "outline"} size="sm" className="text-xs gap-1" onClick={() => setSettings({ ...settings, personality: p.value })}>
                      <UserCog className="h-3 w-3" /> {p.label}
                    </Button>
                  ))}
                </div>
                <Textarea rows={4} value={settings?.personality || ""} onChange={(e) => setSettings({ ...settings, personality: e.target.value })} className="resize-none" />
              </div>
              <div className="space-y-2">
                <Label>رسالة الترحيب</Label>
                <Input value={settings?.welcome_message || ""} onChange={(e) => setSettings({ ...settings, welcome_message: e.target.value })} />
              </div>
              <Button onClick={saveSettings} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ التغييرات
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center"><Brain className="h-4 w-4 text-primary" /></div>
                    بيانات التدريب
                  </CardTitle>
                  <CardDescription>أضف أسئلة وأجوبة لتدريب البوت ({trainingData.length} عنصر)</CardDescription>
                </div>
                <Dialog open={showAddTraining} onOpenChange={setShowAddTraining}>
                  <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> إضافة</Button></DialogTrigger>
                  <DialogContent dir="rtl">
                    <DialogHeader><DialogTitle>إضافة بيانات تدريب</DialogTitle></DialogHeader>
                    <div className="space-y-3 mt-2">
                      <div className="space-y-1"><Label>التصنيف</Label><Input value={newQ.category} onChange={(e) => setNewQ({ ...newQ, category: e.target.value })} /></div>
                      <div className="space-y-1"><Label>السؤال</Label><Textarea value={newQ.question} onChange={(e) => setNewQ({ ...newQ, question: e.target.value })} /></div>
                      <div className="space-y-1"><Label>الجواب</Label><Textarea value={newQ.answer} onChange={(e) => setNewQ({ ...newQ, answer: e.target.value })} /></div>
                      <Button onClick={addTraining} className="w-full">إضافة</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {trainingData.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><BookOpen className="h-7 w-7 opacity-40" /></div>
                  <p className="font-medium">لا توجد بيانات تدريب</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {trainingData.map((item) => (
                    <div key={item.id} className="p-3 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <Badge variant="secondary" className="text-[10px] mb-1">{item.category}</Badge>
                          <p className="text-sm font-medium">س: {item.question}</p>
                          <p className="text-xs text-muted-foreground mt-1">ج: {item.answer}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-destructive" onClick={() => deleteTraining(item.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quick" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center"><Zap className="h-4 w-4 text-primary" /></div>
                    ردود جاهزة
                  </CardTitle>
                  <CardDescription>{quickReplies.length} رد جاهز</CardDescription>
                </div>
                <Dialog open={showAddReply} onOpenChange={setShowAddReply}>
                  <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> إضافة</Button></DialogTrigger>
                  <DialogContent dir="rtl">
                    <DialogHeader><DialogTitle>إضافة رد جاهز</DialogTitle></DialogHeader>
                    <div className="space-y-3 mt-2">
                      <div className="space-y-1"><Label>العنوان</Label><Input value={newQR.title} onChange={(e) => setNewQR({ ...newQR, title: e.target.value })} /></div>
                      <div className="space-y-1"><Label>المحتوى</Label><Textarea value={newQR.content} onChange={(e) => setNewQR({ ...newQR, content: e.target.value })} /></div>
                      <div className="space-y-1"><Label>التصنيف</Label><Input value={newQR.category} onChange={(e) => setNewQR({ ...newQR, category: e.target.value })} /></div>
                      <Button onClick={addQuickReply} className="w-full">إضافة</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {quickReplies.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><MessageSquare className="h-7 w-7 opacity-40" /></div>
                  <p className="font-medium">لا توجد ردود جاهزة</p>
                </div>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {quickReplies.map((qr) => (
                    <div key={qr.id} className="p-3 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{qr.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{qr.content}</p>
                          <Badge variant="secondary" className="text-[10px] mt-2">{qr.category}</Badge>
                        </div>
                        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-destructive" onClick={() => deleteQuickReply(qr.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followup" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center"><RefreshCw className="h-4 w-4 text-primary" /></div>
                    المتابعة التلقائية
                  </CardTitle>
                  <CardDescription>قواعد لمتابعة العملاء تلقائياً ({followupRules.length} قاعدة)</CardDescription>
                </div>
                <Dialog open={showAddRule} onOpenChange={setShowAddRule}>
                  <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> إضافة</Button></DialogTrigger>
                  <DialogContent dir="rtl">
                    <DialogHeader><DialogTitle>إضافة قاعدة متابعة</DialogTitle></DialogHeader>
                    <div className="space-y-3 mt-2">
                      <div className="space-y-1"><Label>اسم القاعدة</Label><Input value={newRule.name} onChange={(e) => setNewRule({ ...newRule, name: e.target.value })} placeholder="متابعة بعد يوم" /></div>
                      <div className="space-y-1">
                        <Label>نوع المتابعة</Label>
                        <Select value={newRule.trigger_type} onValueChange={(v) => setNewRule({ ...newRule, trigger_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no_reply">عدم رد العميل</SelectItem>
                            <SelectItem value="periodic">دورية</SelectItem>
                            <SelectItem value="after_purchase">بعد شراء</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1"><Label>التأخير (ساعات)</Label><Input type="number" value={newRule.delay_hours} onChange={(e) => setNewRule({ ...newRule, delay_hours: Number(e.target.value) })} /></div>
                      <div className="space-y-1"><Label>قالب الرسالة</Label><Textarea value={newRule.message_template} onChange={(e) => setNewRule({ ...newRule, message_template: e.target.value })} placeholder="مرحباً {name}، تابعنا معاك..." /></div>
                      <div className="space-y-1">
                        <Label>الفئة المستهدفة</Label>
                        <Select value={newRule.target_category} onValueChange={(v) => setNewRule({ ...newRule, target_category: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">الكل</SelectItem>
                            <SelectItem value="new">جديد</SelectItem>
                            <SelectItem value="regular">عميل دائم</SelectItem>
                            <SelectItem value="vip">VIP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={addFollowupRule} className="w-full">إضافة</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {followupRules.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><Clock className="h-7 w-7 opacity-40" /></div>
                  <p className="font-medium">لا توجد قواعد متابعة</p>
                  <p className="text-xs mt-1">أنشئ قواعد لمتابعة العملاء تلقائياً</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {followupRules.map((rule) => (
                    <div key={rule.id} className="p-3 rounded-xl border bg-muted/30">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{rule.name}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {rule.trigger_type === "no_reply" ? "عدم رد" : rule.trigger_type === "periodic" ? "دورية" : "بعد شراء"}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">{rule.delay_hours} ساعة</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Switch checked={rule.is_active} onCheckedChange={() => toggleRule(rule.id, rule.is_active)} />
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteRule(rule.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{rule.message_template}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center"><TestTube className="h-4 w-4 text-primary" /></div>
                اختبار البوت
              </CardTitle>
              <CardDescription>جرب البوت قبل تشغيله على الواتساب</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border bg-[hsl(var(--whatsapp-chat-bg))] p-4 mb-4 min-h-[200px] space-y-3">
                {!testResponse && !testing && <p className="text-center text-sm text-muted-foreground pt-16">ابدأ بإرسال رسالة لاختبار البوت</p>}
                {testMessage && (testResponse || testing) && (
                  <div className="flex justify-end">
                    <div className="bg-white px-3 py-2 rounded-2xl rounded-tr-md text-sm max-w-[80%] shadow-sm">{testMessage}</div>
                  </div>
                )}
                {testing && (
                  <div className="flex justify-start">
                    <div className="bg-[hsl(var(--message-out))] px-3 py-2 rounded-2xl rounded-tl-md text-sm shadow-sm"><Loader2 className="h-4 w-4 animate-spin" /></div>
                  </div>
                )}
                {testResponse && (
                  <div className="flex justify-start">
                    <div className="bg-[hsl(var(--message-out))] px-3 py-2 rounded-2xl rounded-tl-md text-sm max-w-[80%] shadow-sm">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1"><Bot className="h-3 w-3" /> AI</div>
                      {testResponse}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Input value={testMessage} onChange={(e) => setTestMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && testBot()} placeholder="اكتب رسالة اختبارية..." className="flex-1 bg-muted/50 border-0 rounded-full" />
                <Button onClick={testBot} disabled={!testMessage.trim() || testing} className="rounded-full gap-1"><Send className="h-4 w-4" /> إرسال</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
