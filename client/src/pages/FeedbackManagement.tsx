import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, Eye, MessageSquare, Loader2, Filter, ExternalLink, BarChart3, ListOrdered, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import FeedbackOverview from "@/components/FeedbackOverview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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

interface Feedback {
  id: string;
  feedbackType: string;
  status: string;
  shopperName: string | null;
  merchantName: string | null;
  merchantLocation: string | null;
  visitDate: string | null;
  productServiceQuality: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  mystery_shopper: "Mystery Shopper",
  merchant_referral: "Merchant Referral",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  new: "default",
  reviewed: "secondary",
  archived: "outline",
};

export default function FeedbackManagement() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // simple debounce
  useMemo(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (typeFilter !== "all") p.set("type", typeFilter);
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
    return p.toString();
  }, [typeFilter, statusFilter, debouncedSearch]);

  const { data: feedbacks, isLoading } = useQuery<Feedback[]>({
    queryKey: ["/api/feedbacks", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/feedbacks${queryString ? `?${queryString}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) {
          setLocation("/admin/login");
          return [];
        }
        throw new Error("Failed to load feedbacks");
      }
      return res.json();
    },
  });

  const { data: session } = useQuery<{ role?: string }>({
    queryKey: ["/api/auth/session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
  });
  const isAdmin = session?.role === "admin";

  type SortKey = "feedbackType" | "shopperName" | "merchantName" | "merchantLocation" | "visitDate" | "status" | "createdAt";
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/feedbacks/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedbacks"] });
      toast({ title: "Submission deleted" });
    },
    onError: () => {
      toast({ title: "Could not delete submission", variant: "destructive" });
    },
  });

  const [tab, setTab] = useState<"analytics" | "submissions">("submissions");
  const [overviewType, setOverviewType] = useState<"mystery_shopper" | "merchant_referral">("mystery_shopper");

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">
              Feedbacks
            </h1>
            <p className="text-sm text-muted-foreground">
              Review submissions from mystery shoppers and merchant referral participants.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {tab === "submissions" && (
              <div className="text-sm text-muted-foreground" data-testid="text-total-count">
                Total: <strong>{feedbacks?.length ?? 0}</strong>
              </div>
            )}
            <Button
              onClick={() => window.open("/feedback", "_blank")}
              className="bg-[#00426D] hover:bg-[#003356]"
              data-testid="button-feedback-form"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Feedback Form
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "analytics" | "submissions")}>
          <TabsList className="h-11 w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              value="submissions"
              className="relative h-11 rounded-none border-b-2 border-transparent px-5 text-sm font-medium text-muted-foreground data-[state=active]:border-[#00426D] data-[state=active]:text-[#00426D] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              data-testid="tab-submissions"
            >
              <ListOrdered className="mr-2 h-4 w-4" />
              Submissions
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="relative h-11 rounded-none border-b-2 border-transparent px-5 text-sm font-medium text-muted-foreground data-[state=active]:border-[#00426D] data-[state=active]:text-[#00426D] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              data-testid="tab-analytics"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Showing:</span>
              <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setOverviewType("mystery_shopper")}
                  className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                    overviewType === "mystery_shopper"
                      ? "bg-[#00426D] text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid="button-overview-mystery"
                >
                  Mystery Shopper
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewType("merchant_referral")}
                  className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                    overviewType === "merchant_referral"
                      ? "bg-[#00426D] text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid="button-overview-referral"
                >
                  Merchant Referral
                </button>
              </div>
            </div>
            <FeedbackOverview type={overviewType} />
          </TabsContent>

          <TabsContent value="submissions" className="mt-4 space-y-4">

        {/* Filters */}
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-[240px] flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Search
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by shopper, merchant, or location..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="mystery_shopper">Mystery Shopper</SelectItem>
                  <SelectItem value="merchant_referral">Merchant Referral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(typeFilter !== "all" || statusFilter !== "all" || search) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setTypeFilter("all");
                  setStatusFilter("all");
                  setSearch("");
                }}
                data-testid="button-clear-filters"
              >
                <Filter className="mr-2 h-4 w-4" />
                Clear
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !feedbacks || feedbacks.length === 0 ? (
              <div className="py-16 text-center">
                <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground" data-testid="text-no-feedbacks">
                  No feedbacks found.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {(
                      [
                        { key: "feedbackType", label: "Type" },
                        { key: "shopperName", label: "Shopper" },
                        { key: "merchantName", label: "Merchant" },
                        { key: "merchantLocation", label: "Location" },
                        { key: "visitDate", label: "Visit Date" },
                        { key: "status", label: "Status" },
                        { key: "createdAt", label: "Submitted" },
                      ] as { key: SortKey; label: string }[]
                    ).map(({ key, label }) => (
                      <TableHead
                        key={key}
                        className="cursor-pointer select-none hover:text-foreground"
                        onClick={() => handleSort(key)}
                        data-testid={`th-sort-${key}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {label}
                          {sortKey === key ? (
                            sortDir === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 text-primary" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/40" />
                          )}
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...(feedbacks || [])].sort((a, b) => {
                    const av = (a[sortKey] ?? "") as string;
                    const bv = (b[sortKey] ?? "") as string;
                    const cmp = av.localeCompare(bv);
                    return sortDir === "asc" ? cmp : -cmp;
                  }).map((f) => (
                    <TableRow key={f.id} data-testid={`row-feedback-${f.id}`}>
                      <TableCell>
                        <Badge variant="outline">{TYPE_LABEL[f.feedbackType] || f.feedbackType}</Badge>
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`text-shopper-${f.id}`}>
                        {f.shopperName || "—"}
                      </TableCell>
                      <TableCell data-testid={`text-merchant-${f.id}`}>{f.merchantName || "—"}</TableCell>
                      <TableCell>{f.merchantLocation || "—"}</TableCell>
                      <TableCell>{f.visitDate || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[f.status] || "secondary"} className="capitalize">
                          {f.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(f.createdAt), "MMM d, yyyy h:mm a")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLocation(`/admin/feedbacks/${f.id}`)}
                            data-testid={`button-view-${f.id}`}
                          >
                            <Eye className="mr-1 h-3.5 w-3.5" />
                            View
                          </Button>
                          {isAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  data-testid={`button-delete-${f.id}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete this submission?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the submission from{" "}
                                    <strong>{f.shopperName || "this respondent"}</strong> and all associated
                                    comments. This cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive hover:bg-destructive/90"
                                    onClick={() => deleteMutation.mutate(f.id)}
                                    disabled={deleteMutation.isPending}
                                  >
                                    {deleteMutation.isPending ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : null}
                                    Delete permanently
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
