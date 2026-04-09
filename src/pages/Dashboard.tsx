import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Users, Bot, Wifi, WifiOff, TrendingUp, Clock, Brain, Database, Smartphone } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const [stats, setStats] = useState({ messages: 0, contacts: 0, aiReplies: 0, connected: false, knowledgeItems: 0, memories: 0, profiles: 0 });
  const [recentConversations, setRecentConversations] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [messagesRes, contactsRes, aiRes, sessionRes, convRes, kbRes, memRes, profilesRes] = await Promise.all([
        supabase.from("messages").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("sender_type", "ai").gte("created_at", today.toISOString()),
        supabase.from("whatsapp_sessions").select("status").order("updated_at", { ascending: false }).limit(1).single(),
        supabase.from("conversations").select("*, contacts(name, phone, whatsapp_name, whatsapp_avatar_url)").order("last_message_at", { ascending: false }).limit(5),
        supabase.from("knowledge_base" as any).select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("customer_memory").select("id", { count: "exact", head: true }),
        supabase.from("whatsapp_profiles" as any).select("id", { count: "exact", head: true }),
      ]);

      setStats({
        messages: messagesRes.count || 0,
        contacts: contactsRes.count || 0,
        aiReplies: aiRes.count || 0,
        connected: sessionRes.data?.status === "connected",
        knowledgeItems: (kbRes as any).count || 0,
        memories: memRes.count || 0,
        profiles: (profilesRes as any).count || 0,
      });
      setRecentConversations(convRes.data || []);

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);

      const { data: weekMessages } = await supabase
        .from("messages")
        .select("created_at, sender_type")
        .gte("created_at", weekStart.toISOString())
        .order("created_at", { ascending: true });

      if (weekMessages && weekMessages.length > 0) {
        const dayMap: Record<number, { messages: number; ai: number }> = {};
        for (let i = 0; i < 7; i++) {
          const d = new Date();
          d.setDate(d.getDate() - 6 + i);
          dayMap[d.getDay()] = { messages: 0, ai: 0 };
        }
        for (const msg of weekMessages) {
          const dayIndex = new Date(msg.created_at).getDay();
          if (dayMap[dayIndex]) {
            dayMap[dayIndex].messages++;
            if (msg.sender_type === "ai") dayMap[dayIndex].ai++;
          }
        }
        const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
        const chartData = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date();
          d.setDate(d.getDate() - 6 + i);
          const idx = d.getDay();
          chartData.push({ day: dayNames[idx], messages: dayMap[idx]?.messages || 0, ai: dayMap[idx]?.ai || 0 });
        }
        setWeeklyData(chartData);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    { title: "رسائل اليوم", value: stats.messages, icon: MessageSquare, color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "جهات الاتصال", value: stats.contacts, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "ردود مرام", value: stats.aiReplies, icon: Bot, color: "text-violet-600", bg: "bg-violet-50" },
    { title: "حالة الاتصال", value: stats.connected ? "متصل" : "غير متصل", icon: stats.connected ? Wifi : WifiOff, color: stats.connected ? "text-emerald-600" : "text-muted-foreground", bg: stats.connected ? "bg-emerald-50" : "bg-muted" },
    { title: "قاعدة المعرفة", value: stats.knowledgeItems, icon: Database, color: "text-amber-600", bg: "bg-amber-50" },
    { title: "الأرقام المربوطة", value: stats.profiles, icon: Smartphone, color: "text-pink-600", bg: "bg-pink-50" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">لوحة التحكم</h1>
          <p className="text-muted-foreground text-xs mt-0.5">Sity Cloud Bot - نظام خدمة العملاء الذكي</p>
        </div>
        <Badge variant={stats.connected ? "default" : "secondary"} className="gap-1.5 px-3 py-1 rounded-full text-[11px]">
          <div className={`h-1.5 w-1.5 rounded-full ${stats.connected ? "bg-primary-foreground animate-pulse" : "bg-muted-foreground"}`} />
          {stats.connected ? "أونلاين" : "أوفلاين"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {statCards.map((stat) => (
          <Card key={stat.title} className="border shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-extrabold leading-tight">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{stat.title}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm flex items-center gap-2 font-bold">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            الرسائل الأسبوعية
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="msgG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(142, 65%, 38%)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="hsl(142, 65%, 38%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="aiG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(262, 60%, 50%)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(262, 60%, 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(220, 12%, 90%)", fontSize: 12, direction: "rtl" }} />
                <Area type="monotone" dataKey="messages" stroke="hsl(142, 65%, 38%)" fill="url(#msgG)" strokeWidth={2} name="الرسائل" />
                <Area type="monotone" dataKey="ai" stroke="hsl(262, 60%, 50%)" fill="url(#aiG)" strokeWidth={2} name="ردود مرام" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm flex items-center gap-2 font-bold">
            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
            أحدث المحادثات
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {recentConversations.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-sm">لا توجد محادثات بعد</p>
              <p className="text-xs mt-0.5">قم بربط الواتساب لبدء استقبال الرسائل</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentConversations.map((conv: any) => {
                const cName = conv.contacts?.whatsapp_name || conv.contacts?.name || conv.contacts?.phone;
                const cAvatar = conv.contacts?.whatsapp_avatar_url;
                return (
                  <div key={conv.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {cAvatar ? <img src={cAvatar} className="h-full w-full object-cover" /> : <Users className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[13px] truncate">{cName}</p>
                      <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                        {conv.is_ai_active && <Bot className="h-3 w-3 shrink-0 text-primary" />}
                        {conv.last_message || "بدون رسائل"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-muted-foreground">
                        {conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                      {conv.unread_count > 0 && (
                        <Badge className="h-5 min-w-5 flex items-center justify-center rounded-full text-[10px] px-1.5">{conv.unread_count}</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
