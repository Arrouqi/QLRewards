import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import {
  Building2,
  TrendingUp,
  Clock,
  CheckCircle2,
  Scale,
  ShieldCheck,
  Archive,
  FileText,
  Tag,
  Send,
  BarChart3,
  Globe,
} from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface OverviewStats {
  merchantStats: {
    total: number;
    pending: number;
    moderation: number;
    created: number;
    licensing: number;
    licensed: number;
    archived: number;
  };
  dealStats: {
    total: number;
    pending: number;
    approved: number;
    archived: number;
  };
  recentMerchants: {
    id: string;
    companyName: string;
    brandName: string;
    status: string;
    createdAt: string;
  }[];
  recentDeals: {
    id: string;
    title: string;
    merchantName: string | null;
    status: string;
    createdAt: string;
  }[];
}

export default function Overview() {
  const [, setLocation] = useLocation();

  const { data: authData } = useQuery<{ role: string }>({
    queryKey: ["/api/auth/session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (!res.ok) return { role: "user" };
      return res.json();
    },
  });
  const isAdmin = authData?.role === "admin";

  const { data: stats, isLoading } = useQuery<OverviewStats>({
    queryKey: ["overview-stats"],
    queryFn: async () => {
      const res = await fetch(`/api/stats/overview`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { data: liveOffers } = useQuery<{ count: number }>({
    queryKey: ["live-offers-count"],
    queryFn: async () => {
      const res = await fetch("/api/es/offers/count", { credentials: "include" });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
  });

  const { data: liveMerchants } = useQuery<{ total: number }>({
    queryKey: ["live-merchants-count"],
    queryFn: async () => {
      const res = await fetch("/api/es/merchants?size=0", { credentials: "include" });
      if (!res.ok) return { total: 0 };
      return res.json();
    },
  });

  const getStatusBadge = (status: string, type: "merchant" | "deal" = "merchant") => {
    const styles: Record<string, string> = {
      pending: "bg-amber-100 text-amber-700",
      moderation: "bg-blue-100 text-blue-700",
      created: "bg-green-100 text-green-700",
      licensing: "bg-purple-100 text-purple-700",
      licensed: "bg-emerald-100 text-emerald-700",
      archived: "bg-slate-100 text-slate-700",
      approved: "bg-blue-100 text-blue-700",
    };
    const label = status === "approved" ? "Sent to Moderation"
      : status === "pending" && type === "merchant" ? "With Sales"
      : status === "pending" ? "Pending"
      : status.charAt(0).toUpperCase() + status.slice(1);
    return (
      <Badge className={styles[status] || "bg-slate-100 text-slate-600"} data-testid={`badge-status-${status}`}>
        {label}
      </Badge>
    );
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">Overview</h1>
          <p className="text-slate-500">Platform statistics and activity summary</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00426D]" />
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="border-l-4 border-l-[#00426D] cursor-help">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase">Merchant Requests</p>
                          <p className="text-2xl font-bold text-slate-900 mt-1" data-testid="text-total-merchants">{stats.merchantStats.total}</p>
                          <p className="text-xs text-slate-400 mt-1">Received</p>
                        </div>
                        <Building2 className="h-8 w-8 text-[#00426D]/20" />
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total merchant onboarding requests submitted through the portal (excluding archived)</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="border-l-4 border-l-emerald-500 cursor-help">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase">Deal Requests</p>
                          <p className="text-2xl font-bold text-slate-900 mt-1" data-testid="text-total-deals">{stats.dealStats.total}</p>
                          <p className="text-xs text-slate-400 mt-1">Received</p>
                        </div>
                        <Tag className="h-8 w-8 text-emerald-500/20" />
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total deal/offer requests submitted by the sales team through the portal</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="border-l-4 border-l-blue-500 cursor-help">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase">Live Merchants</p>
                          <p className="text-2xl font-bold text-slate-900 mt-1" data-testid="text-live-merchants">{liveMerchants?.total ?? "—"}</p>
                          <p className="text-xs text-slate-400 mt-1">On platform</p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-blue-500/20" />
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Active merchants currently live on the Qatar Living platform</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="border-l-4 border-l-purple-500 cursor-help">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase">Live Deals</p>
                          <p className="text-2xl font-bold text-slate-900 mt-1" data-testid="text-live-offers">{liveOffers?.count ?? "—"}</p>
                          <p className="text-xs text-slate-400 mt-1">On platform</p>
                        </div>
                        <Globe className="h-8 w-8 text-purple-500/20" />
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total offers currently live and visible on the Qatar Living platform</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-[#00426D]" />
                    Merchant Onboarding Pipeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: "With Sales", count: stats.merchantStats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
                      { label: "In Moderation", count: stats.merchantStats.moderation, icon: Send, color: "text-blue-600", bg: "bg-blue-50" },
                      { label: "Created", count: stats.merchantStats.created, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
                      { label: "Licensing", count: stats.merchantStats.licensing, icon: Scale, color: "text-purple-600", bg: "bg-purple-50" },
                      { label: "Licensed", count: stats.merchantStats.licensed, icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
                    ].map((item) => {
                      const Icon = item.icon;
                      const total = stats.merchantStats.total;
                      const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                      return (
                        <div key={item.label} className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${item.bg}`}>
                            <Icon className={`h-4 w-4 ${item.color}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-slate-700">{item.label}</span>
                              <span className="text-sm font-bold text-slate-900">{item.count}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${item.bg.replace("50", "400")}`}
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: item.color.replace("text-", "").includes("amber") ? "#d97706"
                                    : item.color.includes("blue") ? "#2563eb"
                                    : item.color.includes("green") ? "#16a34a"
                                    : item.color.includes("purple") ? "#9333ea"
                                    : item.color.includes("emerald") ? "#059669"
                                    : "#64748b"
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#00426D]" />
                    Deal Requests Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: "Pending", count: stats.dealStats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", barColor: "#d97706" },
                      { label: "Sent to Moderation", count: stats.dealStats.approved, icon: Send, color: "text-blue-600", bg: "bg-blue-50", barColor: "#2563eb" },
                    ].map((item) => {
                      const Icon = item.icon;
                      const allDeals = stats.dealStats.total;
                      const pct = allDeals > 0 ? Math.round((item.count / allDeals) * 100) : 0;
                      return (
                        <div key={item.label} className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${item.bg}`}>
                            <Icon className={`h-4 w-4 ${item.color}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-slate-700">{item.label}</span>
                              <span className="text-sm font-bold text-slate-900">{item.count}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full"
                                style={{ width: `${pct}%`, backgroundColor: item.barColor }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Separator className="my-4" />

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{stats.dealStats.total}</p>
                      <p className="text-xs text-slate-500">Total</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{stats.dealStats.approved}</p>
                      <p className="text-xs text-slate-500">Moderated</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-600">{stats.dealStats.pending}</p>
                      <p className="text-xs text-slate-500">Pending</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Recent Merchant Requests</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocation("/admin/merchants")}
                      className="text-[#00426D] text-xs"
                      data-testid="button-view-all-merchants"
                    >
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {stats.recentMerchants.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No merchant requests yet</p>
                  ) : (
                    <div className="space-y-3">
                      {stats.recentMerchants.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                          onClick={() => setLocation(`/admin/merchants/${m.id}`)}
                          data-testid={`recent-merchant-${m.id}`}
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-900">{m.companyName}</p>
                            <p className="text-xs text-slate-500">{m.brandName} · {format(new Date(m.createdAt), "dd MMM yyyy")}</p>
                          </div>
                          {getStatusBadge(m.status)}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Recent Deal Requests</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocation("/admin/dashboard")}
                      className="text-[#00426D] text-xs"
                      data-testid="button-view-all-deals"
                    >
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {stats.recentDeals.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No deal requests yet</p>
                  ) : (
                    <div className="space-y-3">
                      {stats.recentDeals.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                          onClick={() => setLocation(`/admin/deals/${d.id}`)}
                          data-testid={`recent-deal-${d.id}`}
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-900">{d.title}</p>
                            <p className="text-xs text-slate-500">{d.merchantName || "—"} · {format(new Date(d.createdAt), "dd MMM yyyy")}</p>
                          </div>
                          {getStatusBadge(d.status, "deal")}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
