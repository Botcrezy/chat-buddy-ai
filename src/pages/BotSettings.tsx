import { useState, useEffect, useRef } from "react";
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
  Database, Image, FileText, HelpCircle, Sparkles, Upload, Pencil, X,
} from "lucide-react";

export default function BotSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [trainingData, setTrainingData] = useState<any[]>([]);
  const [quickReplies, setQuickReplies] = useState<any[]>([]);
  const [followupRules, setFollowupRules] = useState<any[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [testing, setTesting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newQ, setNewQ] = useState({ question: "", answer: "", category: "general" });
  const [newQR, setNewQR] = useState({ title: "", content: "", category: "general" });
  const [newRule, setNewRule] = useState({ name: "", trigger_type: "no_reply", delay_hours: 24, message_template: "", target_category: "all" });
  const [newKB, setNewKB] = useState({ title: "", content: "", category: "general", data_type: "text", media_url: "", media_type: "" });
  const [showAddTraining, setShowAddTraining] = useState(false);
  const [showAddReply, setShowAddReply] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [showAddKB, setShowAddKB] = useState(false);
  const [editingKB, setEditingKB] = useState<any>(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [s, t, q, f, k] = await Promise.all([
      supabase.from("bot_settings").select("*").limit(1).single(),
      supabase.from("training_data").select("*").order("created_at", { ascending: false }),
      supabase.from("quick_replies").select("*").order("usage_count", { ascending: false }),
      supabase.from("followup_rules").select("*").order("created_at", { ascending: false }),
      supabase.from("knowledge_base" as any).select("*").order("created_at", { ascending: false }),
    ]);
    setSettings(s.data);
    setTrainingData(t.data || []);
    setQuickReplies(q.data || []);
    setFollowupRules(f.data || []);
    setKnowledgeBase((k.data as any[]) || []);
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from("knowledge-media").upload(fileName, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("knowledge-media").getPublicUrl(fileName);
      setNewKB({ ...newKB, media_url: urlData.publicUrl, media_type: "image" });
      toast({ title: "تم رفع الصورة ✅" });
    } catch (err: any) {
      toast({ title: "فشل رفع الصورة ❌", description: err.message, variant: "destructive" });
    }
    setUploading(false);
  };

  const addKnowledgeItem = async () => {
    if (!newKB.title || !newKB.content) return;
    await supabase.from("knowledge_base" as any).insert(newKB as any);
    setNewKB({ title: "", content: "", category: "general", data_type: "text", media_url: "", media_type: "" });
    setShowAddKB(false);
    fetchAll();
    toast({ title: "تمت الإضافة لقاعدة المعرفة ✅" });
  };

  const deleteKnowledgeItem = async (id: string) => {
    await supabase.from("knowledge_base" as any).delete().eq("id", id);
    fetchAll();
  };

  const toggleKnowledgeItem = async (id: string, active: boolean) => {
    await supabase.from("knowledge_base" as any).update({ is_active: !active } as any).eq("id", id);
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
    { label: "مرام - خدمة العملاء", value: "أنتِ مرام، عضوة في فريق خدمة العملاء في Sity Cloud. بتتكلمي بالمصري العامي بشكل ودود واحترافي. بتفهمي طلبات العملاء وبتساعديهم ياخدوا القرار الصح." },
    { label: "فريق المبيعات", value: "أنتِ مرام من فريق المبيعات في Sity Cloud. أسلوبك ودود ومقنع. بتهتمي بعرض المنتجات والخدمات وإقناع العميل. بتتكلمي مصري عامي." },
    { label: "الدعم الفني", value: "أنتِ مرام من فريق الدعم الفني في Sity Cloud. أسلوبك صبور ومتعاون. بتساعدي العملاء يحلوا مشاكلهم التقنية بشكل واضح ومبسط. بتتكلمي مصري عامي." },
  ];

  const dataTypeIcons: Record<string, any> = {
    text: FileText,
    image: Image,
    faq: HelpCircle,
    document: BookOpen,
  };

  const dataTypeLabels: Record<string, string> = {
    text: "نص",
    image: "صورة",
    faq: "سؤال وجواب",
    document: "مستند",
  };

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">إعدادات البوت</h1>
          <p className="text-muted-foreground text-sm">تخصيص مرام - مساعدة Sity Cloud الذكية</p>
        </div>
      </div>

      <Tabs defaultValue="general" dir="rtl">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full bg-muted/50 h-auto p-1 gap-1">
          <TabsTrigger value="general" className="text-xs gap-1 py-2"><Bot className="h-3.5 w-3.5" /> عام</TabsTrigger>
          <TabsTrigger value="knowledge" className="text-xs gap-1 py-2"><Database className="h-3.5 w-3.5" /> المعرفة</TabsTrigger>
          <TabsTrigger value="training" className="text-xs gap-1 py-2"><Brain className="h-3.5 w-3.5" /> تدريب</TabsTrigger>
          <TabsTrigger value="quick" className="text-xs gap-1 py-2"><Zap className="h-3.5 w-3.5" /> ردود</TabsTrigger>
          <TabsTrigger value="followup" className="text-xs gap-1 py-2"><RefreshCw className="h-3.5 w-3.5" /> متابعة</TabsTrigger>
          <TabsTrigger value="test" className="text-xs gap-1 py-2"><TestTube className="h-3.5 w-3.5" /> اختبار</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4 mt-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-l from-primary/5 to-primary/10 border border-primary/10">
                <div>
                  <Label className="font-bold text-base">الرد التلقائي بالذكاء الاصطناعي</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">يستخدم Google Gemini للرد الاحترافي</p>
                </div>
                <Switch checked={settings?.auto_reply_enabled ?? true} onCheckedChange={(v) => setSettings({ ...settings, auto_reply_enabled: v })} />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">اسم البوت</Label>
                <Input value={settings?.bot_name || ""} onChange={(e) => setSettings({ ...settings, bot_name: e.target.value })} className="bg-muted/30" placeholder="مرام" />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">شخصية البوت</Label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {personalities.map((p) => (
                    <Button key={p.label} variant={settings?.personality === p.value ? "default" : "outline"} size="sm" className="text-xs gap-1 rounded-full" onClick={() => setSettings({ ...settings, personality: p.value })}>
                      <UserCog className="h-3 w-3" /> {p.label}
                    </Button>
                  ))}
                </div>
                <Textarea rows={4} value={settings?.personality || ""} onChange={(e) => setSettings({ ...settings, personality: e.target.value })} className="resize-none bg-muted/30" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-semibold">رسالة الترحيب</Label>
                  <Input value={settings?.welcome_message || ""} onChange={(e) => setSettings({ ...settings, welcome_message: e.target.value })} className="bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold">رسالة خارج الدوام</Label>
                  <Input value={settings?.off_hours_message || ""} onChange={(e) => setSettings({ ...settings, off_hours_message: e.target.value })} className="bg-muted/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-semibold flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> بداية الدوام</Label>
                  <Input type="time" value={settings?.working_hours_start || "09:00"} onChange={(e) => setSettings({ ...settings, working_hours_start: e.target.value })} className="bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> نهاية الدوام</Label>
                  <Input type="time" value={settings?.working_hours_end || "17:00"} onChange={(e) => setSettings({ ...settings, working_hours_end: e.target.value })} className="bg-muted/30" />
                </div>
              </div>
              <Button onClick={saveSettings} disabled={saving} className="gap-2 w-full md:w-auto rounded-xl">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ التغييرات
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Knowledge Base */}
        <TabsContent value="knowledge" className="space-y-4 mt-4">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <Database className="h-4.5 w-4.5 text-primary" />
                    </div>
                    قاعدة المعرفة
                  </CardTitle>
                  <CardDescription>درّب مرام على بيانات شركتك بالتفصيل ({knowledgeBase.length} عنصر)</CardDescription>
                </div>
                <Dialog open={showAddKB} onOpenChange={setShowAddKB}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1 rounded-xl"><Plus className="h-4 w-4" /> إضافة</Button>
                  </DialogTrigger>
                  <DialogContent dir="rtl" className="max-w-lg">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" /> إضافة لقاعدة المعرفة</DialogTitle></DialogHeader>
                    <div className="space-y-4 mt-2">
                      <div className="space-y-1.5">
                        <Label className="font-semibold">نوع البيانات</Label>
                        <Select value={newKB.data_type} onValueChange={(v) => setNewKB({ ...newKB, data_type: v })}>
                          <SelectTrigger className="bg-muted/30"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">📝 نص تدريبي</SelectItem>
                            <SelectItem value="image">🖼️ صورة منتج</SelectItem>
                            <SelectItem value="faq">❓ سؤال وجواب</SelectItem>
                            <SelectItem value="document">📄 مستند</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="font-semibold">{newKB.data_type === "faq" ? "السؤال" : "العنوان"}</Label>
                        <Input value={newKB.title} onChange={(e) => setNewKB({ ...newKB, title: e.target.value })} className="bg-muted/30" placeholder={newKB.data_type === "faq" ? "ما هي أسعاركم؟" : "وصف المنتج أو الخدمة"} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="font-semibold">{newKB.data_type === "faq" ? "الجواب" : "المحتوى"}</Label>
                        <Textarea rows={4} value={newKB.content} onChange={(e) => setNewKB({ ...newKB, content: e.target.value })} className="bg-muted/30 resize-none" placeholder="اكتب المحتوى التفصيلي هنا..." />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="font-semibold">التصنيف</Label>
                        <Input value={newKB.category} onChange={(e) => setNewKB({ ...newKB, category: e.target.value })} className="bg-muted/30" placeholder="منتجات، خدمات، أسعار..." />
                      </div>
                      {(newKB.data_type === "image") && (
                        <div className="space-y-1.5">
                          <Label className="font-semibold">صورة المنتج</Label>
                          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" className="gap-2 flex-1 rounded-xl" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                              {uploading ? "جاري الرفع..." : "رفع صورة"}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">أو أدخل رابط مباشر:</p>
                          <Input value={newKB.media_url} onChange={(e) => setNewKB({ ...newKB, media_url: e.target.value, media_type: "image" })} className="bg-muted/30" placeholder="https://example.com/product.jpg" dir="ltr" />
                          {newKB.media_url && (
                            <div className="mt-2 rounded-xl overflow-hidden border bg-muted/20">
                              <img src={newKB.media_url} className="w-full h-32 object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                            </div>
                          )}
                        </div>
                      )}
                      <Button onClick={addKnowledgeItem} className="w-full rounded-xl gap-2">
                        <Plus className="h-4 w-4" /> إضافة لقاعدة المعرفة
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {knowledgeBase.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mx-auto mb-4">
                    <Database className="h-8 w-8 opacity-40" />
                  </div>
                  <p className="font-bold text-base mb-1">قاعدة المعرفة فارغة</p>
                  <p className="text-xs max-w-sm mx-auto">أضف بيانات شركتك ومنتجاتك وخدماتك لتدريب مرام على الرد باحترافية</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {knowledgeBase.map((item: any) => {
                    const TypeIcon = dataTypeIcons[item.data_type] || FileText;
                    return (
                      <div key={item.id} className={`p-4 rounded-2xl border transition-all hover:shadow-sm ${item.is_active ? "bg-card" : "bg-muted/40 opacity-60"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex gap-3 flex-1 min-w-0">
                            {item.media_url && item.data_type === "image" ? (
                              <div className="h-14 w-14 rounded-xl overflow-hidden border shrink-0">
                                <img src={item.media_url} className="h-full w-full object-cover" />
                              </div>
                            ) : (
                              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <TypeIcon className="h-5 w-5 text-primary" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="secondary" className="text-[10px]">{dataTypeLabels[item.data_type] || item.data_type}</Badge>
                                <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                              </div>
                              <p className="text-sm font-bold truncate">{item.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.content}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Switch checked={item.is_active} onCheckedChange={() => toggleKnowledgeItem(item.id, item.is_active)} />
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteKnowledgeItem(item.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Training Data */}
        <TabsContent value="training" className="space-y-4 mt-4">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center"><Brain className="h-4.5 w-4.5 text-primary" /></div>
                    بيانات التدريب
                  </CardTitle>
                  <CardDescription>أسئلة وأجوبة سريعة ({trainingData.length} عنصر)</CardDescription>
                </div>
                <Dialog open={showAddTraining} onOpenChange={setShowAddTraining}>
                  <DialogTrigger asChild><Button size="sm" className="gap-1 rounded-xl"><Plus className="h-4 w-4" /> إضافة</Button></DialogTrigger>
                  <DialogContent dir="rtl">
                    <DialogHeader><DialogTitle>إضافة بيانات تدريب</DialogTitle></DialogHeader>
                    <div className="space-y-3 mt-2">
                      <div className="space-y-1"><Label>التصنيف</Label><Input value={newQ.category} onChange={(e) => setNewQ({ ...newQ, category: e.target.value })} className="bg-muted/30" /></div>
                      <div className="space-y-1"><Label>السؤال</Label><Textarea value={newQ.question} onChange={(e) => setNewQ({ ...newQ, question: e.target.value })} className="bg-muted/30" /></div>
                      <div className="space-y-1"><Label>الجواب</Label><Textarea value={newQ.answer} onChange={(e) => setNewQ({ ...newQ, answer: e.target.value })} className="bg-muted/30" /></div>
                      <Button onClick={addTraining} className="w-full rounded-xl">إضافة</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {trainingData.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><BookOpen className="h-7 w-7 opacity-40" /></div>
                  <p className="font-bold">لا توجد بيانات تدريب</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {trainingData.map((item) => (
                    <div key={item.id} className="p-3 rounded-xl border bg-card hover:shadow-sm transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <Badge variant="secondary" className="text-[10px] mb-1">{item.category}</Badge>
                          <p className="text-sm font-bold">س: {item.question}</p>
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

        {/* Quick Replies */}
        <TabsContent value="quick" className="space-y-4 mt-4">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center"><Zap className="h-4.5 w-4.5 text-primary" /></div>
                    ردود جاهزة
                  </CardTitle>
                  <CardDescription>{quickReplies.length} رد جاهز</CardDescription>
                </div>
                <Dialog open={showAddReply} onOpenChange={setShowAddReply}>
                  <DialogTrigger asChild><Button size="sm" className="gap-1 rounded-xl"><Plus className="h-4 w-4" /> إضافة</Button></DialogTrigger>
                  <DialogContent dir="rtl">
                    <DialogHeader><DialogTitle>إضافة رد جاهز</DialogTitle></DialogHeader>
                    <div className="space-y-3 mt-2">
                      <div className="space-y-1"><Label>العنوان</Label><Input value={newQR.title} onChange={(e) => setNewQR({ ...newQR, title: e.target.value })} className="bg-muted/30" /></div>
                      <div className="space-y-1"><Label>المحتوى</Label><Textarea value={newQR.content} onChange={(e) => setNewQR({ ...newQR, content: e.target.value })} className="bg-muted/30" /></div>
                      <div className="space-y-1"><Label>التصنيف</Label><Input value={newQR.category} onChange={(e) => setNewQR({ ...newQR, category: e.target.value })} className="bg-muted/30" /></div>
                      <Button onClick={addQuickReply} className="w-full rounded-xl">إضافة</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {quickReplies.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><MessageSquare className="h-7 w-7 opacity-40" /></div>
                  <p className="font-bold">لا توجد ردود جاهزة</p>
                </div>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {quickReplies.map((qr) => (
                    <div key={qr.id} className="p-3 rounded-xl border bg-card hover:shadow-sm transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold">{qr.title}</p>
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

        {/* Follow-up Rules */}
        <TabsContent value="followup" className="space-y-4 mt-4">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center"><RefreshCw className="h-4.5 w-4.5 text-primary" /></div>
                    المتابعة التلقائية
                  </CardTitle>
                  <CardDescription>قواعد لمتابعة العملاء تلقائياً ({followupRules.length} قاعدة)</CardDescription>
                </div>
                <Dialog open={showAddRule} onOpenChange={setShowAddRule}>
                  <DialogTrigger asChild><Button size="sm" className="gap-1 rounded-xl"><Plus className="h-4 w-4" /> إضافة</Button></DialogTrigger>
                  <DialogContent dir="rtl">
                    <DialogHeader><DialogTitle>إضافة قاعدة متابعة</DialogTitle></DialogHeader>
                    <div className="space-y-3 mt-2">
                      <div className="space-y-1"><Label>اسم القاعدة</Label><Input value={newRule.name} onChange={(e) => setNewRule({ ...newRule, name: e.target.value })} placeholder="متابعة بعد يوم" className="bg-muted/30" /></div>
                      <div className="space-y-1">
                        <Label>نوع المتابعة</Label>
                        <Select value={newRule.trigger_type} onValueChange={(v) => setNewRule({ ...newRule, trigger_type: v })}>
                          <SelectTrigger className="bg-muted/30"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no_reply">عدم رد العميل</SelectItem>
                            <SelectItem value="periodic">دورية</SelectItem>
                            <SelectItem value="after_purchase">بعد شراء</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1"><Label>التأخير (ساعات)</Label><Input type="number" value={newRule.delay_hours} onChange={(e) => setNewRule({ ...newRule, delay_hours: Number(e.target.value) })} className="bg-muted/30" /></div>
                      <div className="space-y-1"><Label>قالب الرسالة</Label><Textarea value={newRule.message_template} onChange={(e) => setNewRule({ ...newRule, message_template: e.target.value })} placeholder="مرحباً {name}، تابعنا معاك..." className="bg-muted/30" /></div>
                      <div className="space-y-1">
                        <Label>الفئة المستهدفة</Label>
                        <Select value={newRule.target_category} onValueChange={(v) => setNewRule({ ...newRule, target_category: v })}>
                          <SelectTrigger className="bg-muted/30"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">الكل</SelectItem>
                            <SelectItem value="new">جديد</SelectItem>
                            <SelectItem value="regular">عميل دائم</SelectItem>
                            <SelectItem value="vip">VIP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={addFollowupRule} className="w-full rounded-xl">إضافة</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {followupRules.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><Clock className="h-7 w-7 opacity-40" /></div>
                  <p className="font-bold">لا توجد قواعد متابعة</p>
                  <p className="text-xs mt-1">أنشئ قواعد لمتابعة العملاء تلقائياً</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {followupRules.map((rule) => (
                    <div key={rule.id} className="p-3 rounded-xl border bg-card">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{rule.name}</span>
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

        {/* Test Bot */}
        <TabsContent value="test" className="space-y-4 mt-4">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center"><TestTube className="h-4.5 w-4.5 text-primary" /></div>
                اختبار مرام
              </CardTitle>
              <CardDescription>جرب مرام قبل تشغيلها على الواتساب</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border bg-[hsl(var(--whatsapp-chat-bg))] p-4 mb-4 min-h-[200px] space-y-3">
                {!testResponse && !testing && <p className="text-center text-sm text-muted-foreground pt-16">ابدأ بإرسال رسالة لاختبار مرام</p>}
                {testMessage && (testResponse || testing) && (
                  <div className="flex justify-end">
                    <div className="bg-white px-3 py-2 rounded-2xl rounded-tr-md text-sm max-w-[80%] shadow-sm">{testMessage}</div>
                  </div>
                )}
                {testing && (
                  <div className="flex justify-start">
                    <div className="bg-[hsl(var(--message-out))] px-3 py-2 rounded-2xl rounded-tl-md text-sm shadow-sm">
                      <span className="text-xs text-muted-foreground">مرام بتكتب...</span>
                      <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
                    </div>
                  </div>
                )}
                {testResponse && (
                  <div className="flex justify-start">
                    <div className="bg-[hsl(var(--message-out))] px-3 py-2 rounded-2xl rounded-tl-md text-sm max-w-[80%] shadow-sm">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1"><Bot className="h-3 w-3" /> مرام</div>
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
