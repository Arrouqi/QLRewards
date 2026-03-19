import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { 
  Building2, 
  Send, 
  Archive, 
  Search,
  FileDown,
  Download,
  Pencil,
  MoreHorizontal,
  CheckCircle2,
  Undo2,
  Upload
} from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface Merchant {
  id: string;
  companyName: string;
  crNumber: string;
  brandName: string;
  address: string;
  contactPerson: string;
  email: string;
  phone: string;
  products: string[];
  businessCategories: string[];
  branches: string[];
  status: string;
  createdAt: string;
  crDocument?: string;
  establishmentCard?: string;
  tradeLicense?: string;
  menuPriceList?: string;
  merchantSignature?: string;
  merchantSignatoryName?: string;
  companyStamp?: string;
  signedContractUpload?: string;
  salesOrder?: string;
  deals?: any[];
}

export default function MerchantManagement() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const salesOrderFileRef = useRef<HTMLInputElement>(null);
  const [uploadingMerchantId, setUploadingMerchantId] = useState<string | null>(null);

  const handleSalesOrderUpload = async (merchantId: string, file: File) => {
    setUploadingMerchantId(merchantId);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await fetch(`/api/merchants/${merchantId}/sales-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ salesOrder: reader.result }),
          });
          if (!res.ok) throw new Error("Failed to upload sales order");
          toast({ title: "Sales order uploaded successfully" });
          queryClient.invalidateQueries({ queryKey: ["merchants"] });
        } catch {
          toast({ title: "Error uploading sales order", variant: "destructive" });
        } finally {
          setUploadingMerchantId(null);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingMerchantId(null);
      toast({ title: "Error reading file", variant: "destructive" });
    }
  };

  const { data: merchants = [], isLoading } = useQuery<Merchant[]>({
    queryKey: ["merchants"],
    queryFn: async () => {
      const res = await fetch("/api/merchants", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) {
          setLocation("/admin/login");
          throw new Error("Unauthorized");
        }
        throw new Error("Failed to fetch merchants");
      }
      return res.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/merchants/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["merchants"] });
      const messages: Record<string, string> = {
        moderation: "Forwarded to moderation",
        created: "Marked as Created",
        pending: "Moved back to Pending",
        archived: "Archived",
      };
      toast({ title: messages[variables.status] || "Status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Cannot proceed", description: error.message, variant: "destructive" });
    },
  });

  const filteredMerchants = merchants.filter((merchant) => {
    const matchesSearch =
      merchant.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      merchant.brandName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      merchant.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || merchant.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>;
      case "moderation":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">In Moderation</Badge>;
      case "created":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Created</Badge>;
      case "archived":
        return <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const statusCounts = {
    all: merchants.length,
    pending: merchants.filter((m) => m.status === "pending").length,
    moderation: merchants.filter((m) => m.status === "moderation").length,
    created: merchants.filter((m) => m.status === "created").length,
    archived: merchants.filter((m) => m.status === "archived").length,
  };

  return (
    <AdminLayout>
      <input
        type="file"
        ref={salesOrderFileRef}
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadingMerchantId) handleSalesOrderUpload(uploadingMerchantId, file);
          e.target.value = "";
        }}
        data-testid="input-sales-order-file-list"
      />
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Merchant Onboarding</h1>
          <p className="text-slate-500">Manage merchant applications</p>
        </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: "All", value: statusCounts.all, filter: "all" },
            { label: "Pending", value: statusCounts.pending, filter: "pending" },
            { label: "In Moderation", value: statusCounts.moderation, filter: "moderation" },
            { label: "Created", value: statusCounts.created, filter: "created" },
            { label: "Archived", value: statusCounts.archived, filter: "archived" },
          ].map((stat) => (
            <Card
              key={stat.filter}
              className={`cursor-pointer transition-all ${statusFilter === stat.filter ? "ring-2 ring-[#00426D]" : ""}`}
              onClick={() => setStatusFilter(stat.filter)}
            >
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-[#00426D]">{stat.value}</p>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by company name, brand, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
        </div>

        {/* Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : filteredMerchants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    No merchants found
                  </TableCell>
                </TableRow>
              ) : (
                filteredMerchants.map((merchant) => (
                  <TableRow 
                    key={merchant.id} 
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setLocation(`/admin/merchants/${merchant.id}`)}
                    data-testid={`row-merchant-${merchant.id}`}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{merchant.companyName}</p>
                        <p className="text-xs text-slate-500">CR: {merchant.crNumber}</p>
                      </div>
                    </TableCell>
                    <TableCell>{merchant.brandName}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{merchant.contactPerson}</p>
                        <p className="text-slate-500">{merchant.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {merchant.products?.slice(0, 2).map((p) => (
                          <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                        ))}
                        {merchant.products?.length > 2 && (
                          <Badge variant="secondary" className="text-xs">+{merchant.products.length - 2}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(merchant.status)}</TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {format(new Date(merchant.createdAt), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-actions-${merchant.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setLocation(`/admin/merchants/${merchant.id}/edit`)}
                            data-testid={`menu-edit-${merchant.id}`}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => window.open(`/merchant-success/${merchant.id}`, '_blank')}
                            data-testid={`menu-pdf-${merchant.id}`}
                          >
                            <FileDown className="h-4 w-4 mr-2" />
                            Download Agreement
                          </DropdownMenuItem>
                          {merchant.signedContractUpload && (
                            <DropdownMenuItem
                              onClick={() => {
                                const link = document.createElement("a");
                                link.href = merchant.signedContractUpload!;
                                link.download = `Signed_Contract_${merchant.companyName.replace(/\s+/g, '_')}.pdf`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              data-testid={`menu-signed-${merchant.id}`}
                            >
                              <Download className="h-4 w-4 mr-2 text-green-600" />
                              Download Signed Contract
                            </DropdownMenuItem>
                          )}
                          {merchant.salesOrder ? (
                            <DropdownMenuItem
                              onClick={() => {
                                const link = document.createElement("a");
                                link.href = merchant.salesOrder!;
                                link.download = `Sales_Order_${merchant.companyName.replace(/\s+/g, '_')}.pdf`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              data-testid={`menu-download-sales-order-${merchant.id}`}
                            >
                              <Download className="h-4 w-4 mr-2 text-purple-600" />
                              Download Sales Order
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => {
                                setUploadingMerchantId(merchant.id);
                                salesOrderFileRef.current?.click();
                              }}
                              data-testid={`menu-upload-sales-order-${merchant.id}`}
                            >
                              <Upload className="h-4 w-4 mr-2 text-purple-600" />
                              Upload Sales Order
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {merchant.status === "pending" && (
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: merchant.id, status: "moderation" })}
                              className="text-blue-600"
                              data-testid={`menu-forward-${merchant.id}`}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Forward to Moderation
                            </DropdownMenuItem>
                          )}
                          {merchant.status === "moderation" && (
                            <>
                              <DropdownMenuItem
                                onClick={() => updateStatusMutation.mutate({ id: merchant.id, status: "created" })}
                                className="text-green-600"
                                data-testid={`menu-created-${merchant.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Mark as Created
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateStatusMutation.mutate({ id: merchant.id, status: "pending" })}
                                className="text-amber-600"
                                data-testid={`menu-back-pending-${merchant.id}`}
                              >
                                <Undo2 className="h-4 w-4 mr-2" />
                                Move to Pending
                              </DropdownMenuItem>
                            </>
                          )}
                          {merchant.status === "archived" && (
                            <>
                              <DropdownMenuItem
                                onClick={() => updateStatusMutation.mutate({ id: merchant.id, status: "pending" })}
                                className="text-amber-600"
                                data-testid={`menu-restore-pending-${merchant.id}`}
                              >
                                <Undo2 className="h-4 w-4 mr-2" />
                                Restore to Pending
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateStatusMutation.mutate({ id: merchant.id, status: "moderation" })}
                                className="text-blue-600"
                                data-testid={`menu-restore-moderation-${merchant.id}`}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Restore to Moderation
                              </DropdownMenuItem>
                            </>
                          )}
                          {merchant.status !== "archived" && (
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: merchant.id, status: "archived" })}
                              className="text-slate-600"
                              data-testid={`menu-archive-${merchant.id}`}
                            >
                              <Archive className="h-4 w-4 mr-2" />
                              Archive
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AdminLayout>
  );
}
