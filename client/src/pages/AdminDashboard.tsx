import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Search, ChevronLeft, ChevronRight, Database, Archive } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";
import { cn } from "@/lib/utils";
import type { Deal } from "@shared/schema";

const ITEMS_PER_PAGE = 10;
type StatusFilter = "all" | "pending" | "approved" | "archived";

export default function AdminDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSeeding, setIsSeeding] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

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

      const dealsResponse = await fetch("/api/deals");
      if (!dealsResponse.ok) {
        throw new Error("Failed to fetch deals");
      }

      const data = await dealsResponse.json();
      setDeals(data);
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

  const handleSeedDeals = async () => {
    setIsSeeding(true);
    try {
      const response = await fetch("/api/seed-deals", { method: "POST" });
      if (!response.ok) {
        throw new Error("Failed to seed deals");
      }
      const result = await response.json();
      toast({
        title: "Success",
        description: `Created ${result.count} sample deals`,
      });
      await checkAuthAndFetchDeals();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to seed deals",
        variant: "destructive",
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const filteredDeals = deals.filter((deal) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      deal.title.toLowerCase().includes(query) ||
      deal.category.toLowerCase().includes(query) ||
      deal.dealType.toLowerCase().includes(query) ||
      deal.status.toLowerCase().includes(query);
    const matchesStatus = statusFilter === "all" || deal.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: deals.length,
    pending: deals.filter(d => d.status === "pending").length,
    approved: deals.filter(d => d.status === "approved").length,
    archived: deals.filter(d => d.status === "archived").length,
  };

  const handleArchive = async (dealId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/deals/${dealId}/archive`, { method: "PATCH" });
      if (!response.ok) throw new Error("Failed to archive deal");
      toast({ title: "Success", description: "Deal archived successfully" });
      await checkAuthAndFetchDeals();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to archive deal", variant: "destructive" });
    }
  };

  const totalPages = Math.ceil(filteredDeals.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedDeals = filteredDeals.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

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
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#00426D]">Deal Requests</h1>
            <p className="text-slate-500 mt-1">Manage all deal submissions</p>
          </div>
          <Button
            onClick={handleSeedDeals}
            disabled={isSeeding}
            className="bg-[#F47920] hover:bg-[#E06910]"
            data-testid="button-seed-deals"
          >
            <Database className="h-4 w-4 mr-2" />
            {isSeeding ? "Creating..." : "Add Sample Deals"}
          </Button>
        </div>

        <div className="flex gap-2 mb-4">
          {(["all", "pending", "approved", "archived"] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-4 py-2 rounded-lg font-medium text-sm transition-colors",
                statusFilter === status
                  ? "bg-[#00426D] text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              )}
              data-testid={`filter-${status}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)} ({statusCounts[status]})
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by title, category, type, or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Deal Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedDeals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                    {searchQuery || statusFilter !== "all" ? "No deals match your filters" : "No deals found"}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedDeals.map((deal) => (
                  <TableRow
                    key={deal.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setLocation(`/admin/deals/${deal.id}`)}
                    data-testid={`row-deal-${deal.id}`}
                  >
                    <TableCell className="font-mono text-sm">
                      {deal.id.substring(0, 8)}
                    </TableCell>
                    <TableCell className="font-medium">{deal.title}</TableCell>
                    <TableCell>{deal.category}</TableCell>
                    <TableCell className="capitalize">{deal.dealType}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          deal.status === "approved" && "bg-green-100 text-green-800 hover:bg-green-100",
                          deal.status === "pending" && "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
                          deal.status === "archived" && "bg-slate-100 text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {deal.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(deal.createdAt), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>
                      {deal.status !== "archived" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleArchive(deal.id, e)}
                          className="text-slate-500 hover:text-slate-700"
                          data-testid={`button-archive-${deal.id}`}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <div className="text-sm text-slate-500">
                Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, filteredDeals.length)} of {filteredDeals.length} results
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
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
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
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
