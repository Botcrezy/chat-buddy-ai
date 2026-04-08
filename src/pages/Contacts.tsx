import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, UserPlus, Users, Phone, MessageSquare, Star, User, Brain } from "lucide-react";

const categories = [
  { label: "الكل", value: "all" },
  { label: "جديد", value: "new" },
  { label: "عميل دائم", value: "regular" },
  { label: "VIP", value: "vip" },
];

const categoryColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  regular: "bg-primary/10 text-primary",
  vip: "bg-yellow-100 text-yellow-700",
};

export default function Contacts() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newContact, setNewContact] = useState({ phone: "", name: "", category: "new", notes: "" });
  const { toast } = useToast();

  useEffect(() => { fetchContacts(); }, [activeCategory]);

  const fetchContacts = async () => {
    let q = supabase.from("contacts").select("*").order("last_message_at", { ascending: false });
    if (activeCategory !== "all") q = q.eq("category", activeCategory);
    const { data } = await q;
    setContacts(data || []);
  };

  const addContact = async () => {
    if (!newContact.phone) return;
    const { error } = await supabase.from("contacts").insert(newContact);
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    setNewContact({ phone: "", name: "", category: "new", notes: "" });
    setShowAdd(false);
    fetchContacts();
    toast({ title: "تمت الإضافة ✅" });
  };

  const filtered = contacts.filter((c) => {
    if (!search) return true;
    return c.name?.includes(search) || c.phone?.includes(search) || c.whatsapp_name?.includes(search);
  });

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">جهات الاتصال</h1>
          <p className="text-muted-foreground text-sm">إدارة عملاء الواتساب ({contacts.length} جهة)</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><UserPlus className="h-4 w-4" /> إضافة</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>إضافة جهة اتصال</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="space-y-1"><Label>رقم الهاتف</Label><Input value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} placeholder="966512345678" dir="ltr" /></div>
              <div className="space-y-1"><Label>الاسم</Label><Input value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>التصنيف</Label>
                <Select value={newContact.category} onValueChange={(v) => setNewContact({ ...newContact, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">جديد</SelectItem>
                    <SelectItem value="regular">عميل دائم</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>ملاحظات</Label><Textarea value={newContact.notes} onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })} /></div>
              <Button onClick={addContact} className="w-full">إضافة</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو رقم الهاتف..." className="pr-9 bg-muted/50 border-0" />
            </div>
            <div className="flex gap-1">
              {categories.map((c) => (
                <Button key={c.value} variant={activeCategory === c.value ? "default" : "ghost"} size="sm" className="text-xs rounded-full" onClick={() => setActiveCategory(c.value)}>
                  {c.label}
                </Button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><Users className="h-7 w-7 opacity-40" /></div>
              <p className="font-medium">لا توجد جهات اتصال</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((contact) => (
                <div key={contact.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors border">
                  <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {contact.whatsapp_avatar_url ? (
                      <img src={contact.whatsapp_avatar_url} className="h-full w-full object-cover" />
                    ) : contact.category === "vip" ? (
                      <Star className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <User className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{contact.whatsapp_name || contact.name || "بدون اسم"}</span>
                      <Badge variant="secondary" className={`text-[10px] ${categoryColors[contact.category] || ""}`}>{contact.category}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1" dir="ltr"><Phone className="h-3 w-3" /> {contact.phone}</span>
                      {contact.last_message_at && (
                        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {new Date(contact.last_message_at).toLocaleDateString("ar")}</span>
                      )}
                    </div>
                    {contact.summary && (
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 truncate">
                        <Brain className="h-3 w-3 shrink-0" /> {contact.summary}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
