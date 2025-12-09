import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { Deal } from "@shared/schema";

export default function AdminDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setLocation("/admin/login");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#00426D]">Admin Dashboard</h1>
            <p className="text-slate-500 mt-1">Manage all deal submissions</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setLocation("/admin/config")}
              data-testid="button-config"
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Categories
            </Button>
            <Button
              variant="outline"
              onClick={handleLogout}
              data-testid="button-logout"
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Deal Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                    No deals found
                  </TableCell>
                </TableRow>
              ) : (
                deals.map((deal) => (
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
                        variant={deal.status === "approved" ? "default" : "secondary"}
                        className={
                          deal.status === "approved"
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                        }
                      >
                        {deal.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(deal.createdAt), "MMM dd, yyyy")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
