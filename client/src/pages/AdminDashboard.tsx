import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import {
  Search, ChevronLeft, ChevronRight, Trash2, FileDown, Send,
  ArrowUpDown, ArrowUp, ArrowDown, Pencil, ExternalLink, Archive, Download, Loader2,
} from "lucide-react";
import { exportToExcel } from "@/lib/export";
import type { Deal } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import type { DealSummary } from "@shared/schema";

const ITEMS_PER_PAGE = 10;

type StatusFilter = "all" | "pending" | "approved" | "created" | "licensing" | "published" | "archived";
type SortField = "title" | "merchantName" | "category" | "dealType" | "status" | "createdAt";
type SortDirection = "asc" | "desc";

const STATUS_PIPELINE = ["pending", "approved", "created", "licensing", "published"] as const;

const STATUS_LABELS: Record<string, string> = {
  pending: "With Sales",
  approved: "In Moderation",
  created: "Created",
  licensing: "Licensing",
  published: "Published",
  archived: "Archived",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-blue-100 text-blue-700 border-blue-200",
  created: "bg-green-100 text-green-700 border-green-200",
  licensing: "bg-purple-100 text-purple-700 border-purple-200",
  published: "bg-emerald-100 text-emerald-700 border-emerald-200",
  archived: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function AdminDashboard() {
  const { toast } = useToast();
  const { can } = usePermissions();
  const [, setLocation] = useLocation();
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [dealToArchive, setDealToArchive] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/deals", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch deals for export");
      const allDeals: Deal[] = await res.json();
      const query = searchQuery.toLowerCase();
      const matchesFilter = (d: Deal) => {
        const matchesSearch =
          d.title.toLowerCase().includes(query) ||
          d.category.toLowerCase().includes(query) ||
          d.dealType.toLowerCase().includes(query) ||
          d.status.toLowerCase().includes(query) ||
          (d.merchantName?.toLowerCase().includes(query) ?? false);
        const matchesStatus = statusFilter === "all" || d.status === statusFilter;
        return matchesSearch && matchesStatus;
      };
      const rows = allDeals.filter(matchesFilter).map((d) => ({
        "Merchant Name": d.merchantName || "",
        "Merchant Email": d.merchantEmail || "",
        "Merchant Phone": d.merchantPhone || "",
        "Title": d.title || "",
        "Title (Arabic)": d.titleAr || "",
        "Category": d.category || "",
        "Sub Category": d.subCategory || "",
        "Offer Type": d.dealType || "",
        "Duration": d.duration || "",
        "Redemption": d.redemption || "",
        "Limit Per User": d.limitPerUser || "",
        "Original Price (QAR)": d.originalPrice || "",
        "Discount %": d.discountPercentage || "",
        "Discounted Price (QAR)": d.discountedPrice || "",
        "Estimated Savings (QAR)": d.estimatedSavings || "",
        "Estimated Savings Note": d.estimatedSavingsNote || "",
        "Estimated Savings Note (Arabic)": d.estimatedSavingsNoteAr || "",
        "Description": d.description || "",
        "Description (Arabic)": d.descriptionAr || "",
        "Branches": (d.branches || []).join(", "),
        "Claim Rules": (d.claimRules || []).join(" | "),
        "General Rules": (d.generalRules || []).join(" | "),
        "Other Rules": d.otherRules || "",
        "Specific Days": d.specificDays ? (d.days || []).join(", ") : "All days",
        "Offer Start Date": d.offerStartDate || "",
        "Offer End Date": d.offerEndDate || "",
        "Status": STATUS_LABELS[d.status] || d.status,
        "Submitted At": d.createdAt ? format(new Date(d.createdAt), "yyyy-MM-dd HH:mm") : "",
      }));
      if (rows.length === 0) {
        toast({ title: "Nothing to export", description: "No deal submissions match the current filter." });
        return;
      }
      exportToExcel(rows, `Deal_Submissions_${statusFilter}_${format(new Date(), "yyyyMMdd")}`);
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not export deals",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    checkAuthAndFetchDeals();
  }, []);

  const checkAuthAndFetchDeals = async () => {
    try {
      const authResponse = await fetch("/api/auth/session", { credentials: "include" });
      if (!authResponse.ok) {
        setLocation("/admin/login");
        return;
      }
      const session = await authResponse.json();
      setUserRole(session.role || "");

      const dealsResponse = await fetch("/api/deals/summary", { credentials: "include" });
      if (!dealsResponse.ok) throw new Error("Failed to fetch deals");
      setDeals(await dealsResponse.json());
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch deals",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === "asc"
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const statusOrder: Record<string, number> = {
    pending: 0, approved: 1, created: 2, licensing: 3, published: 4, archived: 5,
  };

  const filteredDeals = deals
    .filter((deal) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        deal.title.toLowerCase().includes(query) ||
        deal.category.toLowerCase().includes(query) ||
        deal.dealType.toLowerCase().includes(query) ||
        deal.status.toLowerCase().includes(query) ||
        (deal.merchantName?.toLowerCase().includes(query) ?? false);
      const matchesStatus = statusFilter === "all" || deal.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (a.status === "archived" && b.status !== "archived") return 1;
      if (a.status !== "archived" && b.status === "archived") return -1;
      let comparison = 0;
      switch (sortField) {
        case "title": comparison = a.title.localeCompare(b.title); break;
        case "merchantName": comparison = (a.merchantName || "").localeCompare(b.merchantName || ""); break;
        case "category": comparison = a.category.localeCompare(b.category); break;
        case "dealType": comparison = a.dealType.localeCompare(b.dealType); break;
        case "status": comparison = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9); break;
        case "createdAt": comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  const statusCounts: Record<StatusFilter, number> = {
    all: deals.length,
    pending: deals.filter(d => d.status === "pending").length,
    approved: deals.filter(d => d.status === "approved").length,
    created: deals.filter(d => d.status === "created").length,
    licensing: deals.filter(d => d.status === "licensing").length,
    published: deals.filter(d => d.status === "published").length,
    archived: deals.filter(d => d.status === "archived").length,
  };

  const handleArchiveClick = (dealId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDealToArchive(dealId);
    setArchiveDialogOpen(true);
  };

  const handleArchiveConfirm = async () => {
    if (!dealToArchive) return;
    try {
      const response = await fetch(`/api/deals/${dealToArchive}/archive`, {
        method: "PATCH", credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to archive deal");
      }
      toast({ title: "Archived", description: "Deal has been archived." });
      await checkAuthAndFetchDeals();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to archive deal", variant: "destructive" });
    } finally {
      setArchiveDialogOpen(false);
      setDealToArchive(null);
    }
  };

  const handleDeleteClick = (dealId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDealToDelete(dealId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!dealToDelete) return;
    try {
      const response = await fetch(`/api/deals/${dealToDelete}`, {
        method: "DELETE", credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete deal");
      }
      toast({ title: "Deleted", description: "Deal permanently deleted." });
      await checkAuthAndFetchDeals();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to delete deal", variant: "destructive" });
    } finally {
      setDeleteDialogOpen(false);
      setDealToDelete(null);
    }
  };

  const handleStatusChange = async (dealId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/deals/${dealId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update status");
      }
      await checkAuthAndFetchDeals();
      toast({ title: "Status updated", description: `Moved to ${STATUS_LABELS[newStatus] || newStatus}` });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to update status", variant: "destructive" });
    }
  };

  const totalPages = Math.ceil(filteredDeals.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedDeals = filteredDeals.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const pendingDealsOnPage = paginatedDeals.filter(d => d.status === "pending");
  const allPendingSelected = pendingDealsOnPage.length > 0 && pendingDealsOnPage.every(d => selectedDeals.has(d.id));

  const toggleSelectAll = () => {
    const newSelected = new Set(selectedDeals);
    if (allPendingSelected) {
      pendingDealsOnPage.forEach(d => newSelected.delete(d.id));
    } else {
      pendingDealsOnPage.forEach(d => newSelected.add(d.id));
    }
    setSelectedDeals(newSelected);
  };

  const toggleSelectDeal = (dealId: string, checked: boolean) => {
    const newSelected = new Set(selectedDeals);
    if (checked) newSelected.add(dealId);
    else newSelected.delete(dealId);
    setSelectedDeals(newSelected);
  };

  const handleBulkApprove = async () => {
    if (selectedDeals.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const response = await fetch("/api/deals/bulk-approve", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dealIds: Array.from(selectedDeals) }),
      });
      if (!response.ok) throw new Error("Failed to approve deals");
      const result = await response.json();
      toast({ title: "Success", description: `${result.count} deals sent to moderation` });
      setSelectedDeals(new Set());
      await checkAuthAndFetchDeals();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to approve deals", variant: "destructive" });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "With Sales" },
    { key: "approved", label: "In Moderation" },
    { key: "created", label: "Created" },
    { key: "licensing", label: "Licensing" },
    { key: "published", label: "Published" },
    { key: "archived", label: "Archived" },
  ];

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-slate-500">Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  const canArchive = userRole === "admin" || userRole === "moderation" || can("deals.archive" as any);

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-[#00426D]">Deal Requests</h1>
              <p className="text-slate-500 text-sm md:text-base mt-1">Manage all deal submissions</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleExportExcel}
                disabled={isExporting}
                data-testid="button-export-deals-excel"
              >
                {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Export to Excel
              </Button>
              <Button
                onClick={() => window.open("/create-deal", "_blank")}
                className="bg-[#00426D] hover:bg-[#003356]"
                data-testid="button-deal-form"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Deal Form
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {filterTabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={cn(
                "px-3 md:px-4 py-2 rounded-lg font-medium text-xs md:text-sm transition-colors",
                statusFilter === key
                  ? "bg-[#00426D] text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              )}
              data-testid={`filter-${key}`}
            >
              {label} ({statusCounts[key]})
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search deals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              <div className="flex items-center gap-3">
                {selectedDeals.size > 0 && (
                  <Button
                    onClick={handleBulkApprove}
                    disabled={isBulkProcessing}
                    className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
                    data-testid="button-bulk-approve"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isBulkProcessing ? "Processing..." : `Send to Moderation (${selectedDeals.size})`}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allPendingSelected}
                      onCheckedChange={toggleSelectAll}
                      disabled={pendingDealsOnPage.length === 0}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>
                    <button onClick={() => handleSort("title")} className="flex items-center font-medium hover:text-[#00426D] transition-colors" data-testid="sort-title">
                      Title {getSortIcon("title")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => handleSort("merchantName")} className="flex items-center font-medium hover:text-[#00426D] transition-colors" data-testid="sort-merchant">
                      Merchant {getSortIcon("merchantName")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => handleSort("category")} className="flex items-center font-medium hover:text-[#00426D] transition-colors" data-testid="sort-category">
                      Category {getSortIcon("category")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => handleSort("dealType")} className="flex items-center font-medium hover:text-[#00426D] transition-colors" data-testid="sort-dealtype">
                      Deal Type {getSortIcon("dealType")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => handleSort("status")} className="flex items-center font-medium hover:text-[#00426D] transition-colors" data-testid="sort-status">
                      Status {getSortIcon("status")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => handleSort("createdAt")} className="flex items-center font-medium hover:text-[#00426D] transition-colors" data-testid="sort-created">
                      Created Date {getSortIcon("createdAt")}
                    </button>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDeals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                      {searchQuery || statusFilter !== "all" ? "No deals match your filters" : "No deals found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedDeals.map((deal) => {
                    return (
                      <TableRow
                        key={deal.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => {
                          if (deal.status === "pending" || deal.status === "approved") {
                            window.open(`/admin/deals/${deal.id}/view`, "_blank");
                          } else {
                            window.open(`/admin/deals/${deal.id}`, "_blank");
                          }
                        }}
                        data-testid={`row-deal-${deal.id}`}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {deal.status === "pending" ? (
                            <Checkbox
                              checked={selectedDeals.has(deal.id)}
                              onCheckedChange={(checked) => toggleSelectDeal(deal.id, !!checked)}
                              data-testid={`checkbox-deal-${deal.id}`}
                            />
                          ) : null}
                        </TableCell>
                        <TableCell className="font-medium">{deal.title}</TableCell>
                        <TableCell>{deal.merchantName || "-"}</TableCell>
                        <TableCell>{deal.category}</TableCell>
                        <TableCell className="capitalize">{deal.dealType}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("text-xs font-medium", STATUS_BADGE_CLASS[deal.status] || "bg-slate-100 text-slate-600")}
                          >
                            {STATUS_LABELS[deal.status] || deal.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(deal.createdAt), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); window.open(`/admin/deals/${deal.id}`, "_blank"); }}
                              className="text-slate-500 hover:text-slate-700"
                              data-testid={`button-edit-${deal.id}`}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); window.open(`/admin/deals/${deal.id}/print`, "_blank"); }}
                              className="text-slate-500 hover:text-slate-700"
                              data-testid={`button-pdf-${deal.id}`}
                              title="Download PDF"
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>

                            {deal.status !== "archived" && (
                              <Select
                                value={deal.status}
                                onValueChange={(val) => handleStatusChange(deal.id, val)}
                              >
                                <SelectTrigger
                                  className="h-7 w-[130px] text-xs border-slate-200 bg-white"
                                  data-testid={`select-status-${deal.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent onClick={(e) => e.stopPropagation()}>
                                  {STATUS_PIPELINE.map((s) => (
                                    <SelectItem key={s} value={s} className="text-xs">
                                      {STATUS_LABELS[s]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            {deal.status !== "archived" && canArchive && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleArchiveClick(deal.id, e)}
                                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                data-testid={`button-archive-${deal.id}`}
                                title="Archive"
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            )}

                            {deal.status === "archived" && userRole === "admin" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleDeleteClick(deal.id, e)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                data-testid={`button-delete-${deal.id}`}
                                title="Permanently Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-slate-200 gap-4">
              <div className="text-sm text-slate-500 text-center sm:text-left">
                Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, filteredDeals.length)} of {filteredDeals.length}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) page = i + 1;
                    else if (currentPage <= 3) page = i + 1;
                    else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                    else page = currentPage - 2 + i;
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className={currentPage === page ? "bg-[#00426D]" : ""}
                        data-testid={`button-page-${page}`}
                      >
                        {page}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this deal?</AlertDialogTitle>
            <AlertDialogDescription>
              The deal will be moved to the archived list and removed from active pipelines. You can still view it under the Archived filter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveConfirm} className="bg-slate-600 hover:bg-slate-700">
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete This Deal?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this deal from the database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
