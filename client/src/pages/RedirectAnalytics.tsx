import { useState, useMemo, useCallback } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  ChevronLeft,
  ChevronRight,
  BarChart3,
  List,
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

interface LogsResponse {
  rows: LogRow[];
  total: number;
  page: number;
  pageSize: number;
}

const COLORS = ["#00426D", "#e8b84b", "#1a73e8", "#34a853", "#ea4335", "#9c27b0", "#ff9800", "#607d8b"];

const RANGE_OPTIONS = [
  { label: "Last 24 hours", value: "1" },
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
  { label: "All time", value: "0" },
];

const LINK_OPTIONS = [
  { label: "Deals link", value: "deals", paths: "/ql-deals", target: "the Deals / Rewards screen" },
  { label: "Home link", value: "home", paths: "/ql-home", target: "the app home / main website" },
  { label: "Deals link (mobile only)", value: "deals-mobile", paths: "/ql-deals-mobile", target: "the Deals / Rewards screen (desktop → Apple App Store)" },
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
  const [linkType, setLinkType] = useState("deals");
  const [logsPage, setLogsPage] = useState(1);

  const currentLink = LINK_OPTIONS.find((o) => o.value === linkType) ?? LINK_OPTIONS[0];

  const { data: authData } = useQuery<{ role: string }>({
    queryKey: ["/api/auth/session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (!res.ok) return { role: "user" };
      return res.json();
    },
  });

  const isAdmin = authData?.role === "admin";

  const buildParams = (extra?: Record<string, string>) => {
    const params = new URLSearchParams();
    if (range !== "0") params.set("sinceDays", range);
    params.set("linkType", linkType);
    if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v);
    return params;
  };

  const statsKey = ["/api/admin/redirect-logs/stats", range, linkType];
  const logsKey = ["/api/admin/redirect-logs", range, linkType, logsPage];

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery<Stats>({
    queryKey: statsKey,
    queryFn: async () => {
      const res = await fetch(`/api/admin/redirect-logs/stats?${buildParams()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: isAdmin,
  });

  const {
    data: logsData,
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = useQuery<LogsResponse>({
    queryKey: logsKey,
    queryFn: async () => {
      const params = buildParams({ page: String(logsPage) });
      const res = await fetch(`/api/admin/redirect-logs?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    enabled: isAdmin,
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/redirect-logs", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to clear logs");
    },
    onSuccess: () => {
      toast({ title: "Logs cleared", description: "All redirect tracking data has been deleted." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/redirect-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/redirect-logs/stats"] });
      setLogsPage(1);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to clear logs", variant: "destructive" });
    },
  });

  const handleRangeChange = useCallback((val: string) => {
    setRange(val);
    setLogsPage(1);
  }, []);

  const handleLinkChange = useCallback((val: string) => {
    setLinkType(val);
    setLogsPage(1);
  }, []);

  const handleRefresh = useCallback(() => {
    refetchStats();
    refetchLogs();
  }, [refetchStats, refetchLogs]);

  const exportCsv = useCallback(async () => {
    try {
      const params = buildParams();
      const res = await fetch(`/api/admin/redirect-logs/export?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const allRows: LogRow[] = await res.json();
      if (allRows.length === 0) {
        toast({ title: "Nothing to export", variant: "destructive" });
        return;
      }
      const headers = ["createdAt", "visitorId", "platform", "outcome", "browser", "os", "device", "ipAddress", "referrer", "pagePath", "userAgent"];
      const escape = (v: any) => {
        if (v == null) return "";
        const s = String(v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      };
      const rows = allRows.map((l) => headers.map((h) => escape((l as any)[h])).join(","));
      const csv = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `redirect-logs-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `Exported ${allRows.length} records` });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  }, [range, linkType, toast]);

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

  const totalPages = logsData ? Math.ceil(logsData.total / logsData.pageSize) : 0;

  const filterBar = (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={linkType} onValueChange={handleLinkChange}>
        <SelectTrigger className="w-[150px]" data-testid="select-link">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LINK_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value} data-testid={`option-link-${o.value}`}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={range} onValueChange={handleRangeChange}>
        <SelectTrigger className="w-[160px]" data-testid="select-range">
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
      <Button variant="outline" size="sm" onClick={handleRefresh} data-testid="button-refresh">
        <RefreshCw className="h-4 w-4 mr-1" />
        Refresh
      </Button>
      <Button variant="outline" size="sm" onClick={exportCsv} data-testid="button-export">
        <Download className="h-4 w-4 mr-1" />
        Export CSV
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={clearMutation.isPending} data-testid="button-clear">
            {clearMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
            Clear
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all redirect logs?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete ALL redirect tracking data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => clearMutation.mutate()}
            >
              Delete all logs
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#00426D]" data-testid="text-page-title">
              Redirect Analytics
            </h1>
            <p className="text-sm text-muted-foreground">
              Hits on the <code className="bg-muted px-1 rounded">{currentLink.paths}</code> deep-link landing page &mdash; opens {currentLink.target}.
            </p>
          </div>
          {filterBar}
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="mb-2">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="h-4 w-4 mr-1.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="logs" data-testid="tab-logs">
              <List className="h-4 w-4 mr-1.5" />
              Logs
              {logsData ? (
                <span className="ml-1.5 text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
                  {logsData.total.toLocaleString()}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW TAB ── */}
          <TabsContent value="overview" className="space-y-6 mt-0">
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
          </TabsContent>

          {/* ── LOGS TAB ── */}
          <TabsContent value="logs" className="space-y-4 mt-0">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <CardTitle className="text-base">
                  Raw Hit Logs
                  {logsData ? (
                    <span className="ml-2 text-muted-foreground font-normal text-sm">
                      {logsData.total.toLocaleString()} total &mdash; page {logsData.page} of {totalPages || 1}
                    </span>
                  ) : null}
                </CardTitle>
                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={logsPage <= 1}
                      onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                      data-testid="button-logs-prev"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground px-1 min-w-[60px] text-center">
                      {logsPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={logsPage >= totalPages}
                      onClick={() => setLogsPage((p) => Math.min(totalPages, p + 1))}
                      data-testid="button-logs-next"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {logsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-[#00426D]" />
                  </div>
                ) : !logsData || logsData.rows.length === 0 ? (
                  <EmptyState message={`No hits yet. Visit ${currentLink.paths} to generate one.`} />
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="whitespace-nowrap">When</TableHead>
                            <TableHead>Platform</TableHead>
                            <TableHead>Outcome</TableHead>
                            <TableHead>Browser</TableHead>
                            <TableHead>OS</TableHead>
                            <TableHead>Device</TableHead>
                            <TableHead>IP</TableHead>
                            <TableHead>Visitor ID</TableHead>
                            <TableHead>Referrer</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logsData.rows.map((l) => (
                            <TableRow key={l.id} data-testid={`row-log-${l.id}`}>
                              <TableCell className="whitespace-nowrap text-xs">
                                {format(new Date(l.createdAt), "MMM d, yyyy HH:mm:ss")}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {PLATFORM_LABEL[l.platform || ""] || l.platform || "—"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className="text-xs">
                                  {OUTCOME_LABEL[l.outcome || ""] || l.outcome || "—"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs max-w-[120px] truncate">{l.browser || "—"}</TableCell>
                              <TableCell className="text-xs">{l.os || "—"}</TableCell>
                              <TableCell className="text-xs capitalize">{l.device || "—"}</TableCell>
                              <TableCell className="text-xs font-mono">{l.ipAddress || "—"}</TableCell>
                              <TableCell className="text-xs font-mono">
                                {l.visitorId ? l.visitorId.slice(0, 8) + "…" : "—"}
                              </TableCell>
                              <TableCell className="text-xs max-w-[160px] truncate font-mono">
                                {l.referrer || "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Bottom pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-4 border-t mt-2">
                        <p className="text-xs text-muted-foreground">
                          Showing {(logsPage - 1) * logsData.pageSize + 1}–
                          {Math.min(logsPage * logsData.pageSize, logsData.total)} of{" "}
                          {logsData.total.toLocaleString()} records
                        </p>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={logsPage <= 1}
                            onClick={() => setLogsPage(1)}
                            data-testid="button-logs-first"
                          >
                            First
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={logsPage <= 1}
                            onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-sm px-2">
                            Page {logsPage} of {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={logsPage >= totalPages}
                            onClick={() => setLogsPage((p) => Math.min(totalPages, p + 1))}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={logsPage >= totalPages}
                            onClick={() => setLogsPage(totalPages)}
                            data-testid="button-logs-last"
                          >
                            Last
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
        <div className="h-10 w-10 rounded-lg bg-[#00426D]/10 flex items-center justify-center shrink-0">
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
