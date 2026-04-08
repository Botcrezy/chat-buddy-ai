import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Users, Bot, Wifi, WifiOff, TrendingUp, Clock, ArrowUpRight, Brain, Database, Sparkles, Smartphone } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";

const weekDaysInit = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

export default function Dashboard() {
  const [stats, setStats] = useState({ messages: 0, contacts: 0, aiReplies: 0, connected: false, knowledgeItems: 0, memories: 0, profiles: 0 });
  const [recentConversations, setRecentConversations] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState(weekDaysInit.map(d => ({ day: d, messages: 0, ai: 0 })));

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

      // Fetch weekly data
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
    { title: "رسائل اليوم", value: stats.messages.toString(), icon: MessageSquare, gradient: "from-emerald-500/15 to-green-500/5", iconColor: "text-emerald-600" },
    { title: "جهات الاتصال", value: stats.contacts.toString(), icon: Users, gradient: "from-blue-500/15 to-cyan-500/5", iconColor: "text-blue-600" },
    { title: "ردود مرام", value: stats.aiReplies.toString(), icon: Bot, gradient: "from-violet-500/15 to-purple-500/5", iconColor: "text-violet-600" },
    { title: "حالة الاتصال", value: stats.connected ? "متصل" : "غير متصل", icon: stats.connected ? Wifi : WifiOff, gradient: stats.connected ? "from-emerald-500/15 to-green-500/5" : "from-gray-500/10 to-gray-500/5", iconColor: stats.connected ? "text-emerald-600" : "text-muted-foreground" },
    { title: "قاعدة المعرفة", value: stats.knowledgeItems.toString(), icon: Database, gradient: "from-amber-500/15 to-orange-500/5", iconColor: "text-amber-600" },
    { title: "الأرقام المربوطة", value: stats.profiles.toString(), icon: Smartphone, gradient: "from-pink-500/15 to-rose-500/5", iconColor: "text-pink-600" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">لوحة التحكم</h1>
            <p className="text-muted-foreground text-sm">Sity Cloud Bot - نظام خدمة العملاء الذكي</p>
          </div>
        </div>
        <Badge variant={stats.connected ? "default" : "secondary"} className="gap-1.5 px-3 py-1.5 rounded-full">
          <div className={`h-2 w-2 rounded-full ${stats.connected ? "bg-primary-foreground animate-pulse" : "bg-muted-foreground"}`} />
          {stats.connected ? "متصل" : "غير متصل"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground/30" />
              </div>
              <p className="text-2xl md:text-3xl font-extrabold tracking-tight">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2 font-bold">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <TrendingUp className="h-4.5 w-4.5 text-primary" />
            </div>
            الرسائل الأسبوعية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="msgGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(142, 70%, 35%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(142, 70%, 35%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" className="text-xs" tick={{ fontSize: 11 }} />
                <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 16, border: "1px solid hsl(140, 15%, 88%)", fontSize: 13, direction: "rtl" }} />
                <Area type="monotone" dataKey="messages" stroke="hsl(142, 70%, 35%)" fill="url(#msgGradient)" strokeWidth={2.5} name="الرسائل" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2 font-bold">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Clock className="h-4.5 w-4.5 text-primary" />
            </div>
            أحدث المحادثات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentConversations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-8 w-8 opacity-40" />
              </div>
              <p className="font-bold text-base mb-1">لا توجد محادثات بعد</p>
              <p className="text-xs">قم بربط الواتساب لبدء استقبال الرسائل</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentConversations.map((conv: any) => {
                const cName = conv.contacts?.whatsapp_name || conv.contacts?.name || conv.contacts?.phone;
                const cAvatar = conv.contacts?.whatsapp_avatar_url;
                return (
                  <div key={conv.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center shrink-0 overflow-hidden">
                      {cAvatar ? <img src={cAvatar} className="h-full w-full object-cover" /> : <Users className="h-5 w-5 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{cName}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        {conv.is_ai_active && <Bot className="h-3 w-3 shrink-0" />}
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
