import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Settings, LogOut, FileText, Users, Menu, X, FolderCog, Mail, Building2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: session } = useQuery({
    queryKey: ["/api/auth/session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (!res.ok) return { role: "user" };
      return res.json();
    },
  });

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      queryClient.clear();
      setLocation("/admin/login");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  const handleNavigation = (href: string) => {
    setLocation(href);
    setIsSidebarOpen(false);
  };

  const menuItems = [
    {
      label: "Merchant Onboarding",
      icon: Building2,
      href: "/admin/merchants",
    },
    {
      label: "Deal Requests",
      icon: LayoutDashboard,
      href: "/admin/dashboard",
    },
    ...(session?.role === "admin" ? [
      {
        label: "Merchants",
        icon: Store,
        href: "/admin/existing-merchants",
      },
      {
        label: "Category Management",
        icon: FolderCog,
        href: "/admin/config",
      },
      {
        label: "Terms Management",
        icon: FileText,
        href: "/admin/terms",
      },
      {
        label: "User Management",
        icon: Users,
        href: "/admin/users",
      },
      {
        label: "Settings",
        icon: Mail,
        href: "/admin/settings",
      },
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col md:flex-row">
      <div className="md:hidden bg-[#00426D] text-white p-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold">Qatar Living Deals</h1>
          <p className="text-xs text-white/60">Admin Portal</p>
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
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-[#00426D] text-white flex flex-col transform transition-transform duration-300 md:relative md:transform-none",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 border-b border-white/10 hidden md:block">
          <h1 className="text-xl font-bold">Qatar Living Deals</h1>
          <p className="text-sm text-white/60 mt-1">Admin Portal</p>
        </div>

        <div className="md:hidden p-4 border-b border-white/10 flex justify-between items-center">
          <span className="font-bold">Menu</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSidebarOpen(false)}
            className="text-white hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <button
                    onClick={() => handleNavigation(item.href)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left",
                      isActive
                        ? "bg-white/20 text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
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
          {session?.username && (
            <div className="mb-3 px-2">
              <p className="text-sm text-white/60">Logged in as</p>
              <p className="text-white font-medium" data-testid="text-username">{session.username}</p>
            </div>
          )}
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
            data-testid="button-logout"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
