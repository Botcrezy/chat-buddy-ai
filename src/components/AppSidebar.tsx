import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  Users,
  Wifi,
  Settings,
  Megaphone,
  Cloud,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "لوحة التحكم", url: "/", icon: LayoutDashboard },
  { title: "المحادثات", url: "/inbox", icon: MessageSquare },
  { title: "جهات الاتصال", url: "/contacts", icon: Users },
  { title: "رسائل جماعية", url: "/broadcast", icon: Megaphone },
];

const settingsItems = [
  { title: "إعدادات البوت", url: "/bot-settings", icon: Bot },
  { title: "اتصال واتساب", url: "/connection", icon: Wifi },
  { title: "الإعدادات", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon" side="right" className="border-l-0 border-r">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 shadow-lg shadow-sidebar-primary/20">
            <Cloud className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h2 className="text-sm font-bold text-sidebar-foreground tracking-tight">Sity Cloud Bot</h2>
              <p className="text-[10px] text-sidebar-foreground/50">نظام خدمة العملاء الذكي</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] font-bold uppercase tracking-wider px-3 mb-1">القائمة الرئيسية</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} className="rounded-xl h-10 transition-all duration-200">
                    <NavLink to={item.url} end={item.url === "/"} activeClassName="bg-sidebar-accent text-sidebar-primary font-bold">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span className="text-[13px]">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-2">
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] font-bold uppercase tracking-wider px-3 mb-1">الإعدادات</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} className="rounded-xl h-10 transition-all duration-200">
                    <NavLink to={item.url} activeClassName="bg-sidebar-accent text-sidebar-primary font-bold">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span className="text-[13px]">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2">
            <div className="h-2 w-2 rounded-full bg-sidebar-primary animate-pulse" />
            <span className="text-[10px] text-sidebar-foreground/40">v2.0 — مرام أونلاين 24/7</span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
