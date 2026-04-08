import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Users, Bot, Wifi, TrendingUp, Clock } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const stats = [
  { title: "رسائل اليوم", value: "0", icon: MessageSquare, color: "text-primary" },
  { title: "عملاء نشطين", value: "0", icon: Users, color: "text-blue-500" },
  { title: "ردود AI", value: "0", icon: Bot, color: "text-purple-500" },
  { title: "حالة الاتصال", value: "غير متصل", icon: Wifi, color: "text-muted-foreground" },
];

const weeklyData = [
  { day: "السبت", messages: 0 },
  { day: "الأحد", messages: 0 },
  { day: "الاثنين", messages: 0 },
  { day: "الثلاثاء", messages: 0 },
  { day: "الأربعاء", messages: 0 },
  { day: "الخميس", messages: 0 },
  { day: "الجمعة", messages: 0 },
];

export default function Dashboard() {
  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <p className="text-muted-foreground text-sm">نظرة عامة على نشاط الواتساب</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <TrendingUp className="h-3 w-3 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            الرسائل الأسبوعية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="messages"
                  stroke="hsl(142, 70%, 35%)"
                  fill="hsl(142, 70%, 35%)"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            أحدث المحادثات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد محادثات بعد</p>
            <p className="text-xs mt-1">قم بربط الواتساب لبدء استقبال الرسائل</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
