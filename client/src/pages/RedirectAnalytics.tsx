import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  RefreshCw,
  Download,
  Trash2,
  TrendingUp,
  Users,
  Smartphone,
  Apple,
  Monitor,
  Link2,
} from "lucide-react";

type Bucket = { key: string; count: number };
type DayBucket = { day: string; count: number; uniqueVisitors: number };

interface Stats {
  total: number;
  uniqueVisitors: number;
  byPlatform: Bucket[];
  byOutcome: Bucket[];
  byBrowser: Bucket[];
  byOs: Bucket[];
  byDevice: Bucket[];
  byReferrer: Bucket[];
  byDay: DayBucket[];
}

interface LogRow {
  id: string;
  visitorId: string | null;
  platform: string | null;
  outcome: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  referrer: string | null;
  pagePath: string | null;
  createdAt: string;
}

const COLORS = ["#00426D", "#e8b84b", "#1a73e8", "#34a853", "#ea4335", "#9c27b0", "#ff9800", "#607d8b"];

const RANGE_OPTIONS = [
  { label: "Last 24 hours", value: "1" },
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
  { label: "All time", value: "0" },
];

const PLATFORM_LABEL: Record<string, string> = {
  ios: "iOS",
  android: "Android",
  desktop: "Desktop",
};

const OUTCOME_LABEL: Record<string, string> = {
  app_attempt: "Opened in App",
  store: "Sent to App Store",
  web: "Sent to Website",
};

function prettifyBucket(items: Bucket[], labels?: Record<string, string>) {
  return items.map((b) => ({
    name: labels?.[b.key] ?? b.key ?? "(unknown)",
    value: b.count,
  }));
}

export default function RedirectAnalytics() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [range, setRange] = useState("7");

  const { data: authData } = useQuery<{ role: string }>({
    queryKey: ["/api/auth/session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (!res.ok) return { role: "user" };
      return res.json();
    },
  });

  const isAdmin = authData?.role === "admin";

  const sinceParam = range === "0" ? "" : `?sinceDays=${range}`;

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery<Stats>({
    queryKey: ["/api/admin/redirect-logs/stats", range],
    queryFn: async () => {
      const res = await fetch(`/api/admin/redirect-logs/stats${sinceParam}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: isAdmin,
  });

  const {
    data: logs,
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = useQuery<LogRow[]>({
    queryKey: ["/api/admin/redirect-logs", range],
    queryFn: async () => {
      const res = await fetch(`/api/admin/redirect-logs${sinceParam}${sinceParam ? "&" : "?"}limit=500`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    enabled: isAdmin,
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/redirect-logs", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to clear logs");
    },
    onSuccess: () => {
      toast({ title: "Logs cleared", description: "All redirect tracking data has been deleted." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/redirect-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/redirect-logs/stats"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to clear logs", variant: "destructive" });
    },
  });

  const exportCsv = () => {
    if (!logs || logs.length === 0) {
      toast({ title: "Nothing to export", variant: "destructive" });
      return;
    }
    const headers = ["createdAt", "visitorId", "platform", "outcome", "browser", "os", "device", "ipAddress", "referrer", "pagePath", "userAgent"];
    const escape = (v: any) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const rows = logs.map((l) => headers.map((h) => escape((l as any)[h])).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `redirect-logs-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const platformPie = useMemo(() => prettifyBucket(stats?.byPlatform || [], PLATFORM_LABEL), [stats]);
  const outcomePie = useMemo(() => prettifyBucket(stats?.byOutcome || [], OUTCOME_LABEL), [stats]);
  const devicePie = useMemo(() => prettifyBucket(stats?.byDevice || []), [stats]);

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="p-6">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Admin access required.</p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  const platformCounts = (key: string) =>
    stats?.byPlatform.find((b) => b.key === key)?.count ?? 0;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#00426D]" data-testid="text-page-title">
              Redirect Analytics
            </h1>
            <p className="text-sm text-muted-foreground">
              Hits on the <code className="bg-muted px-1 rounded">/ql-deals</code> deep-link landing page.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-[180px]" data-testid="select-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} data-testid={`option-range-${o.value}`}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchStats();
                refetchLogs();
              }}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} data-testid="button-export">
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm("Delete ALL redirect tracking logs? This cannot be undone.")) {
                  clearMutation.mutate();
                }
              }}
              disabled={clearMutation.isPending}
              data-testid="button-clear"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>

        {statsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#00426D]" />
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <KpiCard icon={TrendingUp} label="Total Hits" value={stats?.total ?? 0} testId="kpi-total" />
              <KpiCard icon={Users} label="Unique Visitors" value={stats?.uniqueVisitors ?? 0} testId="kpi-unique" />
              <KpiCard icon={Apple} label="iOS" value={platformCounts("ios")} testId="kpi-ios" />
              <KpiCard icon={Smartphone} label="Android" value={platformCounts("android")} testId="kpi-android" />
              <KpiCard icon={Monitor} label="Desktop" value={platformCounts("desktop")} testId="kpi-desktop" />
            </div>

            {/* Hits over time */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hits Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {(stats?.byDay?.length ?? 0) === 0 ? (
                  <EmptyState message="No data in this range yet." />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={stats!.byDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <ReTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" name="Hits" stroke="#00426D" strokeWidth={2} />
                      <Line type="monotone" dataKey="uniqueVisitors" name="Unique Visitors" stroke="#e8b84b" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Pies */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <PieCard title="By Platform" data={platformPie} testId="chart-platform" />
              <PieCard title="By Outcome" data={outcomePie} testId="chart-outcome" />
              <PieCard title="By Device Type" data={devicePie} testId="chart-device" />
            </div>

            {/* Bars */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BarCard title="Top Browsers" data={stats?.byBrowser || []} testId="chart-browser" />
              <BarCard title="Top Operating Systems" data={stats?.byOs || []} testId="chart-os" />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Top Referrers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(stats?.byReferrer?.length ?? 0) === 0 ? (
                  <EmptyState message="No referrers recorded." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Referrer</TableHead>
                        <TableHead className="text-right w-32">Hits</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats!.byReferrer.slice(0, 15).map((r, i) => (
                        <TableRow key={i} data-testid={`row-referrer-${i}`}>
                          <TableCell className="font-mono text-xs break-all">{r.key || "(direct / none)"}</TableCell>
                          <TableCell className="text-right">{r.count.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Raw log table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Raw Hits {logs ? <span className="text-muted-foreground font-normal text-sm">({logs.length} most recent)</span> : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[#00426D]" />
              </div>
            ) : !logs || logs.length === 0 ? (
              <EmptyState message="No hits yet. Visit /ql-deals to generate one." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Browser</TableHead>
                      <TableHead>OS</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Visitor ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l) => (
                      <TableRow key={l.id} data-testid={`row-log-${l.id}`}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {format(new Date(l.createdAt), "MMM d, HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{PLATFORM_LABEL[l.platform || ""] || l.platform || "—"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge>{OUTCOME_LABEL[l.outcome || ""] || l.outcome || "—"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{l.browser || "—"}</TableCell>
                        <TableCell className="text-xs">{l.os || "—"}</TableCell>
                        <TableCell className="text-xs capitalize">{l.device || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{l.ipAddress || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {l.visitorId ? l.visitorId.slice(0, 8) + "…" : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  testId,
}: {
  icon: any;
  label: string;
  value: number;
  testId: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-[#00426D]/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-[#00426D]" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold text-[#00426D]" data-testid={testId}>
            {value.toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function PieCard({ title, data, testId }: { title: string; data: { name: string; value: number }[]; testId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState message="No data." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart data-testid={testId}>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label={(e: any) => `${e.name} (${e.value})`}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <ReTooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function BarCard({ title, data, testId }: { title: string; data: Bucket[]; testId: string }) {
  const top = data.slice(0, 8).map((b) => ({ name: b.key || "(unknown)", count: b.count }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <EmptyState message="No data." />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={top} data-testid={testId}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <ReTooltip />
              <Bar dataKey="count" fill="#00426D" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground text-center py-8">{message}</p>;
}
