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
  Upload,
  ShieldCheck,
  Scale,
  Trash2,
  AlertTriangle,
  ExternalLink,
  Hash
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  submittedBy?: string;
  offersCreated?: number;
  dealCount?: number;
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
  const [offersDialogMerchant, setOffersDialogMerchant] = useState<Merchant | null>(null);
  const [offersDialogValue, setOffersDialogValue] = useState<number>(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [merchantToDelete, setMerchantToDelete] = useState<Merchant | null>(null);
  const [statusConfirmDialog, setStatusConfirmDialog] = useState<{
    merchant: Merchant;
    targetStatus: string;
    title: string;
    description: string;
  } | null>(null);

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

  const { data: authData } = useQuery<{ role: string }>({
    queryKey: ["/api/auth/session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (!res.ok) return { role: "user" };
      return res.json();
    },
  });

  const userRole = authData?.role || "user";
  const isAdmin = userRole === "admin";
  const isSales = userRole === "sales";
  const isModeration = userRole === "moderation";

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
      setStatusConfirmDialog(null);
      const messages: Record<string, string> = {
        moderation: "Forwarded to moderation",
        created: "Marked as Created",
        pending: "Moved back to With Sales",
        archived: "Archived",
        licensing: "Moved to Licensing",
        licensed: "Marked as Licensed",
      };
      toast({ title: messages[variables.status] || "Status updated" });
    },
    onError: (error: any) => {
      setStatusConfirmDialog(null);
      toast({ title: "Cannot proceed", description: error.message, variant: "destructive" });
    },
  });

  const confirmStatusChange = (merchant: Merchant, targetStatus: string) => {
    const statusLabels: Record<string, string> = {
      pending: "With Sales",
      moderation: "In Moderation",
      created: "Created",
      licensing: "Licensing",
      licensed: "Licensed",
      archived: "Archived",
    };
    const currentLabel = statusLabels[merchant.status] || merchant.status;
    const targetLabel = statusLabels[targetStatus] || targetStatus;
    const isArchive = targetStatus === "archived";
    setStatusConfirmDialog({
      merchant,
      targetStatus,
      title: isArchive ? "Archive Merchant?" : `Change Status: ${currentLabel} → ${targetLabel}?`,
      description: isArchive
        ? `Are you sure you want to archive "${merchant.companyName}" (${merchant.brandName})? You can restore it later from the Archived tab.`
        : `Are you sure you want to move "${merchant.companyName}" (${merchant.brandName}) from "${currentLabel}" to "${targetLabel}"?`,
    });
  };

  const deleteMerchantMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/merchants/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete merchant");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchants"] });
      toast({ title: "Merchant permanently deleted" });
      setDeleteDialogOpen(false);
      setMerchantToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: "Cannot delete", description: error.message, variant: "destructive" });
    },
  });

  const filteredMerchants = merchants.filter((merchant) => {
    if (!isAdmin && merchant.status === "archived") return false;
    if (isModeration && merchant.status === "pending") return false;

    const matchesSearch =
      merchant.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      merchant.brandName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      merchant.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === "all") {
      return matchesSearch && merchant.status !== "archived";
    }
    
    const matchesStatus = merchant.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">With Sales</Badge>;
      case "moderation":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">In Moderation</Badge>;
      case "created":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Created</Badge>;
      case "licensing":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Licensing</Badge>;
      case "licensed":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Licensed</Badge>;
      case "archived":
        return <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const statusCounts = {
    all: merchants.filter((m) => m.status !== "archived").length,
    pending: merchants.filter((m) => m.status === "pending").length,
    moderation: merchants.filter((m) => m.status === "moderation").length,
    created: merchants.filter((m) => m.status === "created").length,
    licensing: merchants.filter((m) => m.status === "licensing").length,
    licensed: merchants.filter((m) => m.status === "licensed").length,
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Merchant Requests</h1>
              <p className="text-slate-500">Manage merchant requests</p>
            </div>
            <Button
              onClick={() => window.open("/", "_blank")}
              className="bg-[#00426D] hover:bg-[#003356]"
              data-testid="button-merchant-form"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Merchant Form
            </Button>
          </div>
        </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
          {[
            { label: "All", value: statusCounts.all, filter: "all" },
            ...(!isModeration ? [{ label: "With Sales", value: statusCounts.pending, filter: "pending" }] : []),
            { label: "In Moderation", value: statusCounts.moderation, filter: "moderation" },
            { label: "Created", value: statusCounts.created, filter: "created" },
            { label: "Licensing", value: statusCounts.licensing, filter: "licensing" },
            { label: "Licensed", value: statusCounts.licensed, filter: "licensed" },
          ].map((stat) => (
            <Card
              key={stat.filter}
              className={`cursor-pointer transition-all ${statusFilter === stat.filter ? "ring-2 ring-[#00426D]" : ""}`}
              onClick={() => setStatusFilter(stat.filter)}
              data-testid={`card-filter-${stat.filter}`}
            >
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-[#00426D]">{stat.value}</p>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {isAdmin && (
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setStatusFilter("archived")}
              className={`text-xs text-slate-400 hover:text-slate-600 transition-colors ${statusFilter === "archived" ? "text-slate-600 underline" : ""}`}
              data-testid="link-archived"
            >
              <Archive className="h-3 w-3 inline mr-1" />
              Archived ({statusCounts.archived})
            </button>
          </div>
        )}

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
                <TableHead>Offers</TableHead>
                <TableHead>Submitted By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : filteredMerchants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-500">
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
                    <TableCell>
                      <span className="text-sm font-medium text-slate-600" data-testid={`text-offers-${merchant.id}`}>
                        {merchant.offersCreated || merchant.dealCount || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {merchant.submittedBy || "—"}
                    </TableCell>
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
                          {!(isSales && merchant.status !== "pending") && (
                            <DropdownMenuItem
                              onClick={() => setLocation(`/admin/merchants/${merchant.id}/edit`)}
                              data-testid={`menu-edit-${merchant.id}`}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          )}
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
                            !(isSales && merchant.status !== "pending") && (
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
                            )
                          )}
                          {!(isSales && merchant.status !== "pending") && (
                            <DropdownMenuItem
                              onClick={() => {
                                setOffersDialogMerchant(merchant);
                                setOffersDialogValue(merchant.offersCreated || merchant.dealCount || 0);
                              }}
                              data-testid={`menu-offers-${merchant.id}`}
                            >
                              <Hash className="h-4 w-4 mr-2" />
                              Update Offers Count
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {merchant.status === "pending" && !isModeration && (
                            <DropdownMenuItem
                              onClick={() => confirmStatusChange(merchant, "moderation")}
                              className="text-blue-600"
                              data-testid={`menu-forward-${merchant.id}`}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Forward to Moderation
                            </DropdownMenuItem>
                          )}
                          {merchant.status === "moderation" && !isSales && (
                            <>
                              <DropdownMenuItem
                                onClick={() => confirmStatusChange(merchant, "created")}
                                className="text-green-600"
                                data-testid={`menu-created-${merchant.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Mark as Created
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => confirmStatusChange(merchant, "pending")}
                                className="text-amber-600"
                                data-testid={`menu-back-pending-${merchant.id}`}
                              >
                                <Undo2 className="h-4 w-4 mr-2" />
                                Move to With Sales
                              </DropdownMenuItem>
                            </>
                          )}
                          {merchant.status === "created" && !isSales && (
                            <>
                              <DropdownMenuItem
                                onClick={() => confirmStatusChange(merchant, "licensing")}
                                className="text-purple-600"
                                data-testid={`menu-licensing-${merchant.id}`}
                              >
                                <Scale className="h-4 w-4 mr-2" />
                                Move to Licensing
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => confirmStatusChange(merchant, "moderation")}
                                className="text-amber-600"
                                data-testid={`menu-back-moderation-${merchant.id}`}
                              >
                                <Undo2 className="h-4 w-4 mr-2" />
                                Move back to Moderation
                              </DropdownMenuItem>
                            </>
                          )}
                          {merchant.status === "licensing" && !isSales && (
                            <>
                              <DropdownMenuItem
                                onClick={() => confirmStatusChange(merchant, "licensed")}
                                className="text-emerald-600"
                                data-testid={`menu-licensed-${merchant.id}`}
                              >
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Mark as Licensed
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => confirmStatusChange(merchant, "created")}
                                className="text-amber-600"
                                data-testid={`menu-back-created-${merchant.id}`}
                              >
                                <Undo2 className="h-4 w-4 mr-2" />
                                Move back to Created
                              </DropdownMenuItem>
                            </>
                          )}
                          {merchant.status === "licensed" && !isSales && (
                            <DropdownMenuItem
                              onClick={() => confirmStatusChange(merchant, "licensing")}
                              className="text-amber-600"
                              data-testid={`menu-back-licensing-${merchant.id}`}
                            >
                              <Undo2 className="h-4 w-4 mr-2" />
                              Move back to Licensing
                            </DropdownMenuItem>
                          )}
                          {merchant.status === "archived" && (
                            <>
                              <DropdownMenuItem
                                onClick={() => confirmStatusChange(merchant, "pending")}
                                className="text-amber-600"
                                data-testid={`menu-restore-pending-${merchant.id}`}
                              >
                                <Undo2 className="h-4 w-4 mr-2" />
                                Restore to With Sales
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => confirmStatusChange(merchant, "moderation")}
                                className="text-blue-600"
                                data-testid={`menu-restore-moderation-${merchant.id}`}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Restore to Moderation
                              </DropdownMenuItem>
                              {isAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setMerchantToDelete(merchant);
                                      setDeleteDialogOpen(true);
                                    }}
                                    className="text-red-600"
                                    data-testid={`menu-delete-${merchant.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Permanently Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </>
                          )}
                          {merchant.status !== "archived" && !isSales && (
                            <DropdownMenuItem
                              onClick={() => confirmStatusChange(merchant, "archived")}
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

      <Dialog open={!!statusConfirmDialog} onOpenChange={(open) => { if (!open) setStatusConfirmDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${statusConfirmDialog?.targetStatus === "archived" ? "text-slate-700" : "text-[#00426D]"}`}>
              <AlertTriangle className="h-5 w-5" />
              {statusConfirmDialog?.title}
            </DialogTitle>
            <DialogDescription>
              {statusConfirmDialog?.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setStatusConfirmDialog(null)}
              data-testid="button-cancel-status-change"
            >
              Cancel
            </Button>
            <Button
              className={statusConfirmDialog?.targetStatus === "archived" ? "bg-slate-600 hover:bg-slate-700" : "bg-[#00426D] hover:bg-[#003356]"}
              onClick={() => statusConfirmDialog && updateStatusMutation.mutate({ id: statusConfirmDialog.merchant.id, status: statusConfirmDialog.targetStatus })}
              disabled={updateStatusMutation.isPending}
              data-testid="button-confirm-status-change"
            >
              {updateStatusMutation.isPending ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Permanently Delete Merchant
            </DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{merchantToDelete?.companyName}</strong> ({merchantToDelete?.brandName}) and all associated data including deals and notes. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setMerchantToDelete(null);
              }}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => merchantToDelete && deleteMerchantMutation.mutate(merchantToDelete.id)}
              disabled={deleteMerchantMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMerchantMutation.isPending ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!offersDialogMerchant} onOpenChange={(open) => { if (!open) setOffersDialogMerchant(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Update Offers Count</DialogTitle>
            <DialogDescription>
              Set the number of offers created for {offersDialogMerchant?.companyName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="number"
              min="0"
              value={offersDialogValue}
              onChange={(e) => setOffersDialogValue(parseInt(e.target.value) || 0)}
              data-testid="input-offers-dialog"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOffersDialogMerchant(null)} data-testid="button-cancel-offers">
              Cancel
            </Button>
            <Button
              className="bg-[#00426D] hover:bg-[#003356]"
              onClick={async () => {
                if (!offersDialogMerchant) return;
                try {
                  const res = await fetch(`/api/merchants/${offersDialogMerchant.id}/offers-created`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ offersCreated: offersDialogValue }),
                  });
                  if (res.ok) {
                    queryClient.invalidateQueries({ queryKey: ["merchants"] });
                    toast({ title: "Updated", description: "Offers count updated successfully" });
                    setOffersDialogMerchant(null);
                  }
                } catch {
                  toast({ title: "Error", description: "Failed to update offers count", variant: "destructive" });
                }
              }}
              data-testid="button-save-offers"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
