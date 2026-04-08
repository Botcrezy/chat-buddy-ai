import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Users, Bot, Wifi, WifiOff, TrendingUp, Clock, ArrowUpRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";

const weekDays = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

export default function Dashboard() {
  const [stats, setStats] = useState({ messages: 0, contacts: 0, aiReplies: 0, connected: false });
  const [recentConversations, setRecentConversations] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState(weekDays.map(d => ({ day: d, messages: 0 })));

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [messagesRes, contactsRes, aiRes, sessionRes, convRes] = await Promise.all([
        supabase.from("messages").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("sender_type", "ai").gte("created_at", today.toISOString()),
        supabase.from("whatsapp_sessions").select("status").order("updated_at", { ascending: false }).limit(1).single(),
        supabase.from("conversations").select("*, contacts(name, phone)").order("last_message_at", { ascending: false }).limit(5),
      ]);

      setStats({
        messages: messagesRes.count || 0,
        contacts: contactsRes.count || 0,
        aiReplies: aiRes.count || 0,
        connected: sessionRes.data?.status === "connected",
      });
      setRecentConversations(convRes.data || []);
    };
    fetchStats();
  }, []);

  const statCards = [
    { title: "رسائل اليوم", value: stats.messages.toString(), icon: MessageSquare, color: "bg-primary/10 text-primary" },
    { title: "جهات الاتصال", value: stats.contacts.toString(), icon: Users, color: "bg-blue-500/10 text-blue-500" },
    { title: "ردود AI", value: stats.aiReplies.toString(), icon: Bot, color: "bg-purple-500/10 text-purple-500" },
    { title: "حالة الاتصال", value: stats.connected ? "متصل" : "غير متصل", icon: stats.connected ? Wifi : WifiOff, color: stats.connected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">لوحة التحكم</h1>
          <p className="text-muted-foreground text-sm">نظرة عامة على نشاط الواتساب</p>
        </div>
        <Badge variant={stats.connected ? "default" : "secondary"} className="gap-1">
          <div className={`h-2 w-2 rounded-full ${stats.connected ? "bg-primary-foreground animate-pulse" : "bg-muted-foreground"}`} />
          {stats.connected ? "متصل" : "غير متصل"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="overflow-hidden">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground/40" />
              </div>
              <p className="text-2xl md:text-3xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
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
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(140, 15%, 88%)", fontSize: 13, direction: "rtl" }} />
                <Area type="monotone" dataKey="messages" stroke="hsl(142, 70%, 35%)" fill="url(#msgGradient)" strokeWidth={2.5} name="الرسائل" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            أحدث المحادثات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentConversations.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="h-8 w-8 opacity-40" />
              </div>
              <p className="font-medium">لا توجد محادثات بعد</p>
              <p className="text-xs mt-1">قم بربط الواتساب لبدء استقبال الرسائل</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentConversations.map((conv: any) => (
                <div key={conv.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{conv.contacts?.name || conv.contacts?.phone}</p>
                    <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">{conv.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
