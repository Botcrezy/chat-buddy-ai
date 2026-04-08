import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, UserPlus, Download, Upload, Users } from "lucide-react";

const categories = [
  { label: "الكل", value: "all" },
  { label: "جديد", value: "new" },
  { label: "عميل دائم", value: "regular" },
  { label: "VIP", value: "vip" },
];

export default function Contacts() {
  const [activeCategory, setActiveCategory] = useState("all");

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">جهات الاتصال</h1>
          <p className="text-muted-foreground text-sm">إدارة عملاء الواتساب</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 ml-1" /> استيراد
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 ml-1" /> تصدير
          </Button>
          <Button size="sm">
            <UserPlus className="h-4 w-4 ml-1" /> إضافة
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="بحث بالاسم أو رقم الهاتف..." className="pr-9" />
            </div>
            <div className="flex gap-1">
              {categories.map((c) => (
                <Button
                  key={c.value}
                  variant={activeCategory === c.value ? "default" : "ghost"}
                  size="sm"
                  className="text-xs"
                  onClick={() => setActiveCategory(c.value)}
                >
                  {c.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد جهات اتصال بعد</p>
            <p className="text-xs mt-1">سيتم إضافة العملاء تلقائياً عند استقبال رسائل</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
