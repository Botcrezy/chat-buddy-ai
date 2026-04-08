import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Send, Bot, User, Paperclip, MessageSquare,
  ArrowRight, UserCheck, CheckCheck, X, Brain, Image,
} from "lucide-react";

const statusFilters = [
  { label: "الكل", value: "all" },
  { label: "جديد", value: "new" },
  { label: "مفتوح", value: "open" },
  { label: "بانتظار", value: "waiting" },
  { label: "مغلق", value: "closed" },
];

const statusColors: Record<string, string> = {
  new: "bg-blue-500",
  open: "bg-primary",
  waiting: "bg-yellow-500",
  closed: "bg-muted-foreground",
};

export default function Inbox() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConv, setSelectedConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [customerMemory, setCustomerMemory] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => { fetchConversations(); }, [activeFilter]);
  useEffect(() => {
    if (selectedConv) {
      fetchMessages(selectedConv.id);
      fetchMemory(selectedConv.contact_id);
    }
  }, [selectedConv]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchConversations = async () => {
    let query = supabase
      .from("conversations")
      .select("*, contacts(name, phone, avatar_url, category, whatsapp_name, whatsapp_avatar_url, summary)")
      .order("last_message_at", { ascending: false });
    if (activeFilter !== "all") query = query.eq("status", activeFilter);
    const { data } = await query;
    setConversations(data || []);
  };

  const fetchMessages = async (convId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    setMessages(data || []);
  };

  const fetchMemory = async (contactId: string) => {
    const { data } = await supabase
      .from("customer_memory")
      .select("*")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(15);
    setCustomerMemory(data || []);
  };

  const handleSend = async () => {
    if (!message.trim() || !selectedConv) return;
    setSending(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/send-message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ conversation_id: selectedConv.id, content: message }),
        }
      );
      if (response.ok) {
        setMessage("");
        fetchMessages(selectedConv.id);
        fetchConversations();
      }
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const toggleAI = async () => {
    if (!selectedConv) return;
    await supabase
      .from("conversations")
      .update({ is_ai_active: !selectedConv.is_ai_active })
      .eq("id", selectedConv.id);
    setSelectedConv({ ...selectedConv, is_ai_active: !selectedConv.is_ai_active });
    toast({ title: selectedConv.is_ai_active ? "تم إيقاف الرد التلقائي" : "تم تفعيل الرد التلقائي" });
  };

  const filtered = conversations.filter((c) => {
    if (!search) return true;
    return c.contacts?.name?.includes(search) || c.contacts?.phone?.includes(search) || c.contacts?.whatsapp_name?.includes(search);
  });

  const contactName = selectedConv?.contacts?.whatsapp_name || selectedConv?.contacts?.name || selectedConv?.contacts?.phone;
  const contactAvatar = selectedConv?.contacts?.whatsapp_avatar_url || selectedConv?.contacts?.avatar_url;

  return (
    <div className="flex h-[calc(100vh-3.5rem)]" dir="rtl">
      {/* Conversations List */}
      <div className={`${selectedConv ? "hidden md:flex" : "flex"} w-full md:w-80 lg:w-96 border-l flex-col bg-card shrink-0`}>
        <div className="p-3 border-b space-y-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث في المحادثات..." className="pr-9 text-sm bg-muted/50 border-0" />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {statusFilters.map((f) => (
              <Button key={f.value} variant={activeFilter === f.value ? "default" : "ghost"} size="sm" className="text-xs shrink-0 rounded-full h-8" onClick={() => setActiveFilter(f.value)}>
                {f.label}
              </Button>
            ))}
          </div>
        </div>
        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><MessageSquare className="h-7 w-7 opacity-40" /></div>
              <p className="text-sm font-medium">لا توجد محادثات</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((conv) => {
                const cName = conv.contacts?.whatsapp_name || conv.contacts?.name || conv.contacts?.phone;
                const cAvatar = conv.contacts?.whatsapp_avatar_url;
                return (
                  <button key={conv.id} className={`w-full text-right p-3 hover:bg-muted/50 transition-colors flex items-center gap-3 ${selectedConv?.id === conv.id ? "bg-muted/70" : ""}`} onClick={() => setSelectedConv(conv)}>
                    <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0 relative overflow-hidden">
                      {cAvatar ? <img src={cAvatar} className="h-full w-full object-cover" /> : <User className="h-5 w-5 text-primary" />}
                      <div className={`absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-card ${statusColors[conv.status]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm truncate">{cName}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          {conv.is_ai_active && <Bot className="h-3 w-3 shrink-0" />}
                          {conv.last_message || "بدون رسائل"}
                        </span>
                        {conv.unread_count > 0 && (
                          <Badge className="h-5 min-w-5 flex items-center justify-center rounded-full text-[10px] px-1.5">{conv.unread_count}</Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className={`${selectedConv ? "flex" : "hidden md:flex"} flex-1 flex-col`}>
        {!selectedConv ? (
          <div className="flex-1 flex items-center justify-center bg-muted/20">
            <div className="text-center text-muted-foreground">
              <div className="h-24 w-24 rounded-3xl bg-primary/5 flex items-center justify-center mx-auto mb-5">
                <MessageSquare className="h-12 w-12 text-primary/30" />
              </div>
              <h3 className="font-bold text-xl mb-2">واتساب بوت</h3>
              <p className="text-sm">اختر محادثة من القائمة للبدء</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b flex items-center justify-between px-4 bg-card">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedConv(null)}>
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => setShowProfile(!showProfile)}>
                  {contactAvatar ? <img src={contactAvatar} className="h-full w-full object-cover" /> : <User className="h-5 w-5 text-primary" />}
                </div>
                <div className="cursor-pointer" onClick={() => setShowProfile(!showProfile)}>
                  <p className="font-semibold text-sm">{contactName}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {selectedConv.is_ai_active ? <><Bot className="h-3 w-3" /> رد تلقائي</> : <><UserCheck className="h-3 w-3" /> رد يدوي</>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setShowProfile(!showProfile)}>
                  <Brain className="h-4 w-4" />
                </Button>
                <Button variant={selectedConv.is_ai_active ? "default" : "outline"} size="sm" onClick={toggleAI} className="text-xs gap-1">
                  <Bot className="h-3.5 w-3.5" />
                  {selectedConv.is_ai_active ? "AI مفعّل" : "تفعيل AI"}
                </Button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Messages */}
              <ScrollArea className="flex-1 p-4" style={{ backgroundColor: "hsl(var(--whatsapp-chat-bg))" }}>
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground text-xs py-4">لا توجد رسائل بعد</div>
                ) : (
                  <div className="space-y-2 max-w-3xl mx-auto">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.direction === "out" ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm shadow-sm ${msg.direction === "out" ? "bg-[hsl(var(--message-out))] rounded-tl-md" : "bg-[hsl(var(--message-in))] rounded-tr-md"}`}>
                          {msg.sender_type !== "customer" && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                              {msg.sender_type === "ai" ? <Bot className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                              {msg.sender_type === "ai" ? "AI" : "موظف"}
                            </div>
                          )}
                          {msg.media_url && msg.media_type === "image" && (
                            <img src={msg.media_url} className="rounded-lg mb-1 max-w-full max-h-60 object-cover" />
                          )}
                          {msg.media_url && msg.media_type !== "image" && (
                            <a href={msg.media_url} target="_blank" rel="noopener" className="flex items-center gap-1 text-primary underline text-xs mb-1">
                              <Paperclip className="h-3 w-3" /> ملف مرفق
                            </a>
                          )}
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(msg.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {msg.direction === "out" && <CheckCheck className="h-3 w-3 text-primary" />}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Customer Profile Sidebar */}
              {showProfile && (
                <div className="w-72 border-r bg-card overflow-y-auto shrink-0 hidden lg:block">
                  <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="font-semibold text-sm">بيانات العميل</h3>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowProfile(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="p-4 text-center border-b">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2 overflow-hidden">
                      {contactAvatar ? <img src={contactAvatar} className="h-full w-full object-cover" /> : <User className="h-8 w-8 text-primary" />}
                    </div>
                    <p className="font-semibold">{contactName}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">{selectedConv.contacts?.phone}</p>
                    {selectedConv.contacts?.category && (
                      <Badge variant="secondary" className="mt-2 text-[10px]">{selectedConv.contacts.category}</Badge>
                    )}
                  </div>
                  {selectedConv.contacts?.summary && (
                    <div className="p-4 border-b">
                      <p className="text-xs font-semibold mb-1 text-muted-foreground">ملخص AI</p>
                      <p className="text-xs">{selectedConv.contacts.summary}</p>
                    </div>
                  )}
                  <div className="p-4">
                    <p className="text-xs font-semibold mb-2 text-muted-foreground flex items-center gap-1">
                      <Brain className="h-3 w-3" /> ذاكرة العميل ({customerMemory.length})
                    </p>
                    {customerMemory.length === 0 ? (
                      <p className="text-xs text-muted-foreground">لا توجد بيانات محفوظة</p>
                    ) : (
                      <div className="space-y-2">
                        {customerMemory.map((m) => (
                          <div key={m.id} className="p-2 rounded-lg bg-muted/50 text-xs">
                            <div className="flex items-center gap-1 mb-0.5">
                              <Badge variant="secondary" className="text-[9px] px-1 h-4">{m.memory_type}</Badge>
                            </div>
                            <p className="font-medium">{m.key}</p>
                            <p className="text-muted-foreground">{m.value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t p-3 flex items-center gap-2 bg-card">
              <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="اكتب رسالة..."
                className="flex-1 bg-muted/50 border-0 rounded-full"
              />
              <Button size="icon" className="shrink-0 rounded-full" disabled={!message.trim() || sending} onClick={handleSend}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
