import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Plus, Send, Users, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  sending: "جاري الإرسال",
  completed: "مكتمل",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sending: "bg-yellow-100 text-yellow-700",
  completed: "bg-primary/10 text-primary",
};

export default function Broadcast() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", content: "", target_category: "all" });

  useEffect(() => { fetchCampaigns(); }, []);

  const fetchCampaigns = async () => {
    const { data } = await supabase
      .from("broadcast_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    setCampaigns(data || []);
  };

  const createCampaign = async () => {
    if (!form.title || !form.content) return;
    await supabase.from("broadcast_campaigns").insert(form);
    setForm({ title: "", content: "", target_category: "all" });
    setShowCreate(false);
    fetchCampaigns();
    toast({ title: "تم إنشاء الحملة ✅" });
  };

  const sendCampaign = async (id: string) => {
    setSending(id);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      await fetch(`https://${projectId}.supabase.co/functions/v1/broadcast-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ campaign_id: id }),
      });
      toast({ title: "تم بدء الإرسال ✅" });
      fetchCampaigns();
    } catch {
      toast({ title: "خطأ في الإرسال", variant: "destructive" });
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الرسائل الجماعية</h1>
          <p className="text-muted-foreground text-sm">إرسال رسائل لمجموعة من العملاء</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-1"><Plus className="h-4 w-4" /> حملة جديدة</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>إنشاء حملة جديدة</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="space-y-1">
                <Label>عنوان الحملة</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عرض خاص - رمضان" />
              </div>
              <div className="space-y-1">
                <Label>محتوى الرسالة</Label>
                <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={4} placeholder="مرحباً {name}! لدينا عرض خاص..." />
              </div>
              <div className="space-y-1">
                <Label>الفئة المستهدفة</Label>
                <Select value={form.target_category} onValueChange={(v) => setForm({ ...form, target_category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع العملاء</SelectItem>
                    <SelectItem value="new">عملاء جدد</SelectItem>
                    <SelectItem value="regular">عملاء دائمين</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createCampaign} className="w-full">إنشاء الحملة</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Megaphone className="h-7 w-7 opacity-40" />
            </div>
            <p className="font-medium">لا توجد حملات</p>
            <p className="text-xs mt-1">أنشئ حملة رسائل جماعية جديدة</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{c.title}</h3>
                      <Badge className={`text-[10px] ${statusColors[c.status]}`}>{statusLabels[c.status]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{c.content}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.total_recipients} مستلم</span>
                      <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-primary" /> {c.sent_count} تم</span>
                      {c.failed_count > 0 && (
                        <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-destructive" /> {c.failed_count} فشل</span>
                      )}
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(c.created_at).toLocaleDateString("ar")}</span>
                    </div>
                    {c.status === "sending" && c.total_recipients > 0 && (
                      <div className="mt-3">
                        <Progress value={(c.sent_count / c.total_recipients) * 100} className="h-2" />
                        <p className="text-[10px] text-muted-foreground mt-1">{Math.round((c.sent_count / c.total_recipients) * 100)}% مكتمل</p>
                      </div>
                    )}
                  </div>
                  {c.status === "draft" && (
                    <Button
                      onClick={() => sendCampaign(c.id)}
                      disabled={sending === c.id}
                      className="gap-1 shrink-0"
                    >
                      {sending === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      إرسال
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
