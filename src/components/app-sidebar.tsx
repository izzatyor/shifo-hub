import { Link, useRouterState } from "@tanstack/react-router";
import {
  BedDouble,
  BarChart3,
  Building2,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Stethoscope,
  Users,
  Wallet,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Rol } from "@/hooks/useAuth";

type Item = {
  title: string;
  url: "/dashboard" | "/dashboard/bemorlar" | "/dashboard/palatalar" | "/dashboard/shifokorlar" | "/dashboard/tolovlar" | "/dashboard/hisobot" | "/dashboard/klinikalar";
  icon: typeof Users;
  rollar: Rol[];
};

const BARCHA: Rol[] = ["super_admin", "admin", "doktor", "qabul", "kassa", "rahbar"];

const ITEMS: Item[] = [
  { title: "Bosh sahifa", url: "/dashboard", icon: LayoutDashboard, rollar: BARCHA },
  {
    title: "Bemorlar",
    url: "/dashboard/bemorlar",
    icon: Users,
    rollar: ["super_admin", "admin", "doktor", "qabul", "kassa", "rahbar"],
  },
  {
    title: "Palatalar",
    url: "/dashboard/palatalar",
    icon: BedDouble,
    rollar: ["super_admin", "admin", "qabul", "rahbar"],
  },
  {
    title: "Shifokorlar",
    url: "/dashboard/shifokorlar",
    icon: Stethoscope,
    rollar: ["super_admin", "admin", "qabul", "rahbar"],
  },
  {
    title: "To'lovlar",
    url: "/dashboard/tolovlar",
    icon: Wallet,
    rollar: ["super_admin", "admin", "kassa", "rahbar"],
  },
  {
    title: "Hisobot",
    url: "/dashboard/hisobot",
    icon: BarChart3,
    rollar: ["super_admin", "admin", "rahbar"],
  },
  {
    title: "Klinikalar",
    url: "/dashboard/klinikalar",
    icon: Building2,
    rollar: ["super_admin"],
  },
];

export function AppSidebar({
  rollar,
  fullName,
  email,
  onChiqish,
}: {
  rollar: Rol[];
  fullName: string | null;
  email: string | null;
  onChiqish: () => void;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const korinadigan = ITEMS.filter((i) => i.rollar.some((r) => rollar.includes(r)));
  const items = korinadigan.length > 0 ? korinadigan : ITEMS.slice(0, 1);

  const isActive = (url: string) =>
    url === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(url);

  const bosh = (fullName ?? email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl brand-gradient">
            <HeartPulse className="size-5" />
          </span>
          {!collapsed && (
            <span className="text-sm font-semibold leading-tight tracking-tight">
              Soliha
              <br />
              Shifoxonasi
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Menyu</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-3 rounded-xl">
                      <item.icon className="size-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-secondary/60 p-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {bosh}
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{fullName ?? "Foydalanuvchi"}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          )}
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onChiqish} tooltip="Chiqish" className="rounded-xl">
              <LogOut className="size-4" />
              {!collapsed && <span>Chiqish</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
