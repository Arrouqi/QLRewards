import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Settings, LogOut, Menu, X, Building2, Store, BarChart3, Tag, Link2, MessageSquare, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import type { Permission } from "@/lib/permissions";

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  permission?: Permission;
  adminOnly?: boolean;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const queryClient = useQueryClient();
  const { can, role, username } = usePermissions();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      queryClient.clear();
      setLocation("/admin/login");
    } catch (error) {
      toast({ title: "Error", description: "Failed to logout", variant: "destructive" });
    }
  };

  const handleNavigation = (href: string) => {
    setLocation(href);
    setIsSidebarOpen(false);
  };

  const allMenuItems: MenuItem[] = [
    { label: "Overview", icon: BarChart3, href: "/admin/overview", permission: "overview.view" },
    { label: "Merchant Requests", icon: Building2, href: "/admin/merchants", permission: "merchants.view" },
    { label: "Deal Requests", icon: LayoutDashboard, href: "/admin/dashboard", permission: "deals.view" },
    { label: "Live Data", icon: Database, href: "/admin/live-data", permission: "live_data.view" },
    { label: "Feedbacks", icon: MessageSquare, href: "/admin/feedbacks", permission: "feedbacks.view" },
    { label: "Redirect Analytics", icon: Link2, href: "/admin/redirect-analytics", permission: "redirect_analytics.view", adminOnly: true },
  ];

  const menuItems = allMenuItems.filter((item) => {
    if (item.adminOnly && role !== "admin") return false;
    if (!item.permission) return true;
    return can(item.permission);
  });

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col md:flex-row">
      <div className="md:hidden bg-[#00426D] text-white p-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold">Qatar Living Deals</h1>
          <p className="text-xs text-white/60">Merchant Onboarding Portal</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="text-white hover:bg-white/10"
          data-testid="button-toggle-menu"
        >
          {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-[#00426D] text-white flex flex-col transform transition-transform duration-300 md:sticky md:top-0 md:h-screen md:transform-none",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 border-b border-white/10 hidden md:block">
          <h1 className="text-xl font-bold">Qatar Living Deals</h1>
          <p className="text-sm text-white/60 mt-1">Merchant Onboarding Portal</p>
        </div>

        <div className="md:hidden p-4 border-b border-white/10 flex justify-between items-center">
          <span className="font-bold">Menu</span>
          <Button variant="ghost" size="sm" onClick={() => setIsSidebarOpen(false)} className="text-white hover:bg-white/10">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const isActive = location === item.href || (item.href === "/admin/live-data" && (location === "/admin/existing-merchants" || location === "/admin/live-offers"));
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <button
                    onClick={() => handleNavigation(item.href)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left",
                      isActive ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-white/10">
          {username && (
            <div className="mb-3 px-2">
              <p className="text-sm text-white/60">Logged in as</p>
              <p className="text-white font-medium" data-testid="text-username">{username}</p>
              {role && <p className="text-xs text-white/40 capitalize mt-0.5" data-testid="text-role">{role}</p>}
            </div>
          )}
          {role === "admin" && (
            <button
              onClick={() => handleNavigation("/admin/settings")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left text-sm mb-1",
                location === "/admin/settings" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
              data-testid="nav-settings"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left text-sm text-white/70 hover:bg-white/10 hover:text-white"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
