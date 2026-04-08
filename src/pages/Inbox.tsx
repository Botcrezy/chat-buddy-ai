import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Send,
  Bot,
  User,
  MoreVertical,
  Paperclip,
  Smile,
  MessageSquare,
  Filter,
} from "lucide-react";

const statusFilters = [
  { label: "الكل", value: "all" },
  { label: "جديد", value: "new" },
  { label: "مفتوح", value: "open" },
  { label: "مغلق", value: "closed" },
];

export default function Inbox() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  return (
    <div className="flex h-[calc(100vh-3.5rem)]" dir="rtl">
      {/* Conversations List */}
      <div className="w-full md:w-80 lg:w-96 border-l flex flex-col bg-card shrink-0">
        <div className="p-3 border-b space-y-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث في المحادثات..." className="pr-9 text-sm" />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {statusFilters.map((f) => (
              <Button
                key={f.value}
                variant={activeFilter === f.value ? "default" : "ghost"}
                size="sm"
                className="text-xs shrink-0"
                onClick={() => setActiveFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="text-center py-16 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">لا توجد محادثات</p>
            <p className="text-xs mt-1">الرسائل الواردة ستظهر هنا</p>
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="hidden md:flex flex-1 flex-col">
        {!selectedConversation ? (
          <div className="flex-1 flex items-center justify-center bg-muted/30">
            <div className="text-center text-muted-foreground">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-10 w-10 text-primary/40" />
              </div>
              <h3 className="font-semibold text-lg mb-1">واتساب بوت</h3>
              <p className="text-sm">اختر محادثة للبدء أو انتظر رسائل جديدة</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b flex items-center justify-between px-4 bg-card">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">العميل</p>
                  <p className="text-xs text-muted-foreground">متصل</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon">
                  <Bot className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" style={{ backgroundColor: "hsl(var(--whatsapp-chat-bg))" }}>
              <div className="text-center text-muted-foreground text-xs py-4">لا توجد رسائل</div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-3 flex items-center gap-2 bg-card">
              <Button variant="ghost" size="icon" className="shrink-0">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="اكتب رسالة..."
                className="flex-1"
              />
              <Button variant="ghost" size="icon" className="shrink-0">
                <Smile className="h-4 w-4" />
              </Button>
              <Button size="icon" className="shrink-0" disabled={!message.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
