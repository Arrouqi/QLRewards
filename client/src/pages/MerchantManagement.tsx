import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { 
  Building2, 
  Eye, 
  Check, 
  X, 
  Archive, 
  Search,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  FileText,
  Phone,
  Mail,
  MapPin,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
  deals?: any[];
}

export default function MerchantManagement() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

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
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchants"] });
      toast({ title: "Status updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const fetchMerchantDetails = async (id: string) => {
    const res = await fetch(`/api/merchants/${id}`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch merchant details");
    return res.json();
  };

  const viewMerchant = async (merchant: Merchant) => {
    try {
      const details = await fetchMerchantDetails(merchant.id);
      setSelectedMerchant(details);
      setShowDetailDialog(true);
    } catch (error) {
      toast({ title: "Error loading merchant details", variant: "destructive" });
    }
  };

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
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>;
      case "archived":
        return <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const statusCounts = {
    all: merchants.length,
    pending: merchants.filter((m) => m.status === "pending").length,
    approved: merchants.filter((m) => m.status === "approved").length,
    rejected: merchants.filter((m) => m.status === "rejected").length,
    archived: merchants.filter((m) => m.status === "archived").length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#00426D] text-white py-4 px-6">
        <div className="container mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/admin/dashboard")}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              <h1 className="text-xl font-bold">Merchant Management</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl py-6 px-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: "All", value: statusCounts.all, filter: "all" },
            { label: "Pending", value: statusCounts.pending, filter: "pending" },
            { label: "Approved", value: statusCounts.approved, filter: "approved" },
            { label: "Rejected", value: statusCounts.rejected, filter: "rejected" },
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
                  <TableRow key={merchant.id}>
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
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => viewMerchant(merchant)}
                          data-testid={`button-view-${merchant.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {merchant.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => updateStatusMutation.mutate({ id: merchant.id, status: "approved" })}
                              data-testid={`button-approve-${merchant.id}`}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => updateStatusMutation.mutate({ id: merchant.id, status: "rejected" })}
                              data-testid={`button-reject-${merchant.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-600 hover:text-slate-700"
                          onClick={() => updateStatusMutation.mutate({ id: merchant.id, status: "archived" })}
                          data-testid={`button-archive-${merchant.id}`}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </main>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#00426D]" />
              Merchant Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedMerchant && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">{selectedMerchant.companyName}</h3>
                  <p className="text-slate-500">{selectedMerchant.brandName}</p>
                </div>
                {getStatusBadge(selectedMerchant.status)}
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-500">CR Number:</span>
                    <span className="font-medium">{selectedMerchant.crNumber}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-500">Address:</span>
                    <span className="font-medium">{selectedMerchant.address}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-500">Email:</span>
                    <a href={`mailto:${selectedMerchant.email}`} className="font-medium text-[#00426D] hover:underline">
                      {selectedMerchant.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-500">Phone:</span>
                    <span className="font-medium">{selectedMerchant.phone}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Products</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedMerchant.products?.map((p) => (
                    <Badge key={p} variant="secondary">{p}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Business Categories</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedMerchant.businessCategories?.map((c) => (
                    <Badge key={c} variant="outline">{c}</Badge>
                  ))}
                </div>
              </div>

              {selectedMerchant.branches && selectedMerchant.branches.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Branches</h4>
                  <div className="space-y-2">
                    {selectedMerchant.branches.map((branch, index) => {
                      try {
                        const parsed = JSON.parse(branch);
                        return (
                          <div key={index} className="p-3 bg-slate-50 rounded-lg text-sm">
                            <p className="font-medium">{parsed.name}</p>
                            <p className="text-slate-500">{parsed.location}</p>
                            {parsed.phone && <p className="text-slate-500">{parsed.phone}</p>}
                          </div>
                        );
                      } catch {
                        return (
                          <div key={index} className="p-3 bg-slate-50 rounded-lg text-sm">{branch}</div>
                        );
                      }
                    })}
                  </div>
                </div>
              )}

              {selectedMerchant.deals && selectedMerchant.deals.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Deals ({selectedMerchant.deals.length})</h4>
                  <div className="space-y-2">
                    {selectedMerchant.deals.map((deal, index) => (
                      <div key={index} className="p-3 bg-slate-50 rounded-lg">
                        <p className="font-medium">{deal.title}</p>
                        <p className="text-sm text-slate-500">{deal.category} - {deal.dealType}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Documents</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "CR Document", value: selectedMerchant.crDocument },
                    { label: "Establishment Card", value: selectedMerchant.establishmentCard },
                    { label: "Trade License", value: selectedMerchant.tradeLicense },
                    { label: "Menu/Price List", value: selectedMerchant.menuPriceList },
                  ].map((doc) => (
                    <div key={doc.label} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">{doc.label}</span>
                      {doc.value ? (
                        <a href={doc.value} target="_blank" rel="noopener noreferrer" className="text-[#00426D] hover:underline">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">Not provided</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {selectedMerchant.merchantSignature && (
                <div>
                  <h4 className="font-medium mb-2">Signature</h4>
                  <div className="border rounded-lg p-4 bg-white">
                    <img src={selectedMerchant.merchantSignature} alt="Signature" className="max-h-24" />
                    <p className="text-sm text-slate-500 mt-2">Signed by: {selectedMerchant.merchantSignatoryName}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {selectedMerchant?.status === "pending" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    updateStatusMutation.mutate({ id: selectedMerchant.id, status: "rejected" });
                    setShowDetailDialog(false);
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  onClick={() => {
                    updateStatusMutation.mutate({ id: selectedMerchant.id, status: "approved" });
                    setShowDetailDialog(false);
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
