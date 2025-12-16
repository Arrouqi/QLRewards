import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Search, ChevronLeft, ChevronRight, Trash2, FileDown, Send, ArrowUpDown, ArrowUp, ArrowDown, Filter, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";
import { cn } from "@/lib/utils";
import type { Deal } from "@shared/schema";

const ITEMS_PER_PAGE = 10;
type StatusFilter = "all" | "pending" | "approved" | "archived";
type SortField = "title" | "merchantName" | "category" | "dealType" | "status" | "createdAt";
type SortDirection = "asc" | "desc";

interface AdminUserSafe {
  id: string;
  username: string;
  role: string;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [assignedToFilter, setAssignedToFilter] = useState<string>("all");
  const [adminUsers, setAdminUsers] = useState<AdminUserSafe[]>([]);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [dealToRemove, setDealToRemove] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndFetchDeals();
  }, []);

  const checkAuthAndFetchDeals = async () => {
    try {
      const authResponse = await fetch("/api/auth/session");
      if (!authResponse.ok) {
        setLocation("/admin/login");
        return;
      }

      const [dealsResponse, adminUsersResponse] = await Promise.all([
        fetch("/api/deals"),
        fetch("/api/admin-users"),
      ]);

      if (!dealsResponse.ok) {
        throw new Error("Failed to fetch deals");
      }

      const data = await dealsResponse.json();
      setDeals(data);

      if (adminUsersResponse.ok) {
        const users = await adminUsersResponse.json();
        setAdminUsers(users);
      }
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
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
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
      const matchesAssignedTo = 
        assignedToFilter === "all" || 
        (assignedToFilter === "unassigned" && !deal.assignedTo) ||
        deal.assignedTo === assignedToFilter;
      return matchesSearch && matchesStatus && matchesAssignedTo;
    })
    .sort((a, b) => {
      // Always put archived deals at the end
      if (a.status === "archived" && b.status !== "archived") return 1;
      if (a.status !== "archived" && b.status === "archived") return -1;
      
      let comparison = 0;
      
      switch (sortField) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "merchantName":
          comparison = (a.merchantName || "").localeCompare(b.merchantName || "");
          break;
        case "category":
          comparison = a.category.localeCompare(b.category);
          break;
        case "dealType":
          comparison = a.dealType.localeCompare(b.dealType);
          break;
        case "status":
          const statusOrder: Record<string, number> = { pending: 0, approved: 1, archived: 2 };
          comparison = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
          break;
        case "createdAt":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });

  const statusCounts = {
    all: deals.length,
    pending: deals.filter(d => d.status === "pending").length,
    approved: deals.filter(d => d.status === "approved").length,
    archived: deals.filter(d => d.status === "archived").length,
  };

  const handleRemoveClick = (dealId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDealToRemove(dealId);
    setRemoveDialogOpen(true);
  };

  const handleRemoveConfirm = async () => {
    if (!dealToRemove) return;
    try {
      const response = await fetch(`/api/deals/${dealToRemove}/archive`, { method: "PATCH" });
      if (!response.ok) throw new Error("Failed to remove deal");
      toast({ title: "Success", description: "Deal removed successfully" });
      await checkAuthAndFetchDeals();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to remove deal", variant: "destructive" });
    } finally {
      setRemoveDialogOpen(false);
      setDealToRemove(null);
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
    if (checked) {
      newSelected.add(dealId);
    } else {
      newSelected.delete(dealId);
    }
    setSelectedDeals(newSelected);
  };

  const handleBulkApprove = async () => {
    if (selectedDeals.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const response = await fetch("/api/deals/bulk-approve", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
  }, [searchQuery, statusFilter, assignedToFilter]);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-slate-500">Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-xl md:text-2xl font-bold text-[#00426D]">Deal Requests</h1>
          <p className="text-slate-500 text-sm md:text-base mt-1">Manage all deal submissions</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {(["all", "pending", "approved", "archived"] as StatusFilter[]).map((status) => {
            const displayLabel = status === "approved" ? "Sent to Moderation" : status.charAt(0).toUpperCase() + status.slice(1);
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "px-3 md:px-4 py-2 rounded-lg font-medium text-xs md:text-sm transition-colors",
                  statusFilter === status
                    ? "bg-[#00426D] text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                )}
                data-testid={`filter-${status}`}
              >
                {displayLabel} ({statusCounts[status]})
              </button>
            );
          })}
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
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <Select value={assignedToFilter} onValueChange={setAssignedToFilter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-assigned-filter">
                      <SelectValue placeholder="Filter by assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Assignees</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {adminUsers.map((user) => (
                        <SelectItem key={user.id} value={user.username}>
                          {user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                  <button
                    onClick={() => handleSort("title")}
                    className="flex items-center font-medium hover:text-[#00426D] transition-colors"
                    data-testid="sort-title"
                  >
                    Title
                    {getSortIcon("title")}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("merchantName")}
                    className="flex items-center font-medium hover:text-[#00426D] transition-colors"
                    data-testid="sort-merchant"
                  >
                    Merchant
                    {getSortIcon("merchantName")}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("category")}
                    className="flex items-center font-medium hover:text-[#00426D] transition-colors"
                    data-testid="sort-category"
                  >
                    Category
                    {getSortIcon("category")}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("dealType")}
                    className="flex items-center font-medium hover:text-[#00426D] transition-colors"
                    data-testid="sort-dealtype"
                  >
                    Deal Type
                    {getSortIcon("dealType")}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("status")}
                    className="flex items-center font-medium hover:text-[#00426D] transition-colors"
                    data-testid="sort-status"
                  >
                    Status
                    {getSortIcon("status")}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("createdAt")}
                    className="flex items-center font-medium hover:text-[#00426D] transition-colors"
                    data-testid="sort-created"
                  >
                    Created Date
                    {getSortIcon("createdAt")}
                  </button>
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedDeals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                    {searchQuery || statusFilter !== "all" || assignedToFilter !== "all" ? "No deals match your filters" : "No deals found"}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedDeals.map((deal) => (
                  <TableRow
                    key={deal.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => window.open(`/admin/deals/${deal.id}`, '_blank')}
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
                        variant="secondary"
                        className={cn(
                          deal.status === "approved" && "bg-green-100 text-green-800 hover:bg-green-100",
                          deal.status === "pending" && "bg-blue-100 text-blue-800 hover:bg-blue-100",
                          deal.status === "archived" && "bg-slate-100 text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {deal.status === "approved" ? "Sent to Moderation" : deal.status === "pending" ? "Pending" : deal.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(deal.createdAt), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/admin/deals/${deal.id}`, '_blank');
                          }}
                          className="text-slate-500 hover:text-slate-700"
                          data-testid={`button-edit-${deal.id}`}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/admin/deals/${deal.id}/print`, '_blank');
                          }}
                          className="text-slate-500 hover:text-slate-700"
                          data-testid={`button-pdf-${deal.id}`}
                          title="Download PDF"
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        {deal.status !== "archived" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleRemoveClick(deal.id, e)}
                            className="text-red-500 hover:text-red-700"
                            data-testid={`button-remove-${deal.id}`}
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
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
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
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

      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to remove this deal?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will mark the deal as removed. It will no longer appear in the active deals list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveConfirm} className="bg-red-600 hover:bg-red-700">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
