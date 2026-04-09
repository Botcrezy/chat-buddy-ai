import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Bell, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function AppLayout() {
  const { user, isAdmin, signOut } = useAuth();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      const { data } = await supabase
        .from("whatsapp_sessions")
        .select("status")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();
      setConnected(data?.status === "connected");
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full" dir="rtl">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card/80 backdrop-blur-sm px-4 shrink-0 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-muted/60">
                {connected ? (
                  <Wifi className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="text-[11px] font-medium text-muted-foreground">
                  {connected ? "متصل" : "غير متصل"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {isAdmin && (
                <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full font-bold">
                  أدمن
                </Badge>
              )}
              <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
                <Bell className="h-4 w-4" />
              </Button>
              <div className="h-6 w-px bg-border mx-1" />
              <span className="text-[11px] text-muted-foreground hidden sm:inline font-medium">{user?.email}</span>
              <Button variant="ghost" size="icon" onClick={signOut} title="تسجيل الخروج" className="h-9 w-9 rounded-full">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-muted/20">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
