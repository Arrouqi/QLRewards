import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Search, MapPin, Phone, Mail, Loader2, ExternalLink, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AdminLayout from "@/components/AdminLayout";
import { exportToCSV, exportToExcel } from "@/lib/export";

interface ESMerchant {
  id: string;
  merchantProfileId: number;
  agencyName: string;
  agencyEmail: string;
  agencyId: number;
  category?: { id: number; name: string };
  contactMobile?: string;
  contactWhatsapp?: string;
  website?: string;
  status: number;
  isVerified: boolean;
  agencyLogoUri?: string;
  coverPhoto?: string;
  branches?: { id: number; name: string; location?: { name: string } }[];
  url?: string;
  createdAt?: string;
  user?: { userId: number; username: string; email: string };
}

export function ExistingMerchantsContent() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [branchesDialog, setBranchesDialog] = useState<{ merchantName: string; branches: ESMerchant["branches"] } | null>(null);
  const [contactDialog, setContactDialog] = useState<{ merchantName: string; email?: string; phone?: string; whatsapp?: string; website?: string } | null>(null);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
    }, 400);
    setDebounceTimer(timer);
  };

  const { data, isLoading } = useQuery<{ merchants: ESMerchant[]; total: number }>({
    queryKey: ["es-merchants", debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("size", "200");
      const res = await fetch(`/api/es/merchants?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch merchants");
      return res.json();
    },
  });

  const { data: dealCounts } = useQuery<{ counts: Record<number, number> }>({
    queryKey: ["es-offers-counts-by-merchant"],
    queryFn: async () => {
      const res = await fetch("/api/es/offers/counts-by-merchant", { credentials: "include" });
      if (!res.ok) return { counts: {} };
      return res.json();
    },
  });

  const merchants = data?.merchants || [];
  const total = data?.total || 0;

  const handleExport = (format: "csv" | "excel") => {
    const rows = merchants.map((m) => ({
      "Merchant Name": m.agencyName || "",
      "Agency ID": m.agencyId,
      Category: m.category?.name || "",
      Email: m.agencyEmail || "",
      Phone: m.contactMobile || "",
      WhatsApp: m.contactWhatsapp || "",
      Website: m.website || "",
      Branches: m.branches?.map((b) => b.name).join("; ") || "",
      Deals: dealCounts?.counts?.[m.agencyId] ?? 0,
      Status: m.status === 1 ? "Active" : m.status === 0 ? "Inactive" : "Unknown",
      URL: m.url ? `https://www.qatarliving.com/en/deals/merchant/${m.url}` : "",
    }));
    if (format === "csv") exportToCSV(rows, "live_merchants");
    else exportToExcel(rows, "live_merchants");
  };

  const getStatusBadge = (status: number) => {
    switch (status) {
      case 1:
        return <Badge className="bg-green-100 text-green-700 border-green-200" data-testid="badge-active">Active</Badge>;
      case 0:
        return <Badge className="bg-slate-100 text-slate-600 border-slate-200" data-testid="badge-inactive">Inactive</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-600 border-slate-200" data-testid="badge-unknown">Unknown</Badge>;
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <p className="text-slate-500 text-sm">{total} existing merchants from production</p>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={merchants.length === 0} data-testid="button-export-merchants">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("csv")} data-testid="button-export-merchants-csv">Export as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("excel")} data-testid="button-export-merchants-excel">Export as Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name, email, or category..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-merchants"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#00426D]" />
        </div>
      ) : merchants.length === 0 ? (
        <div className="text-center py-20">
          <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No merchants found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="table-merchants">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Merchant</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Category</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Contact</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Branches</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Deals</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {merchants.map((merchant) => {
                  const hasLongEmail = merchant.agencyEmail && merchant.agencyEmail.length > 22;
                  return (
                    <tr key={merchant.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors" data-testid={`row-merchant-${merchant.id}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-[#00426D] flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-5 w-5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate" data-testid={`text-merchant-name-${merchant.id}`}>{merchant.agencyName}</p>
                            <p className="text-xs text-slate-500 truncate">ID: {merchant.agencyId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-sm text-slate-700">{merchant.category?.name || "—"}</span></td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {merchant.agencyEmail && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Mail className="h-3 w-3 text-slate-400 flex-shrink-0" />
                              <span className="truncate max-w-[180px]">{merchant.agencyEmail}</span>
                            </div>
                          )}
                          {merchant.contactMobile && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Phone className="h-3 w-3 text-slate-400 flex-shrink-0" />
                              <span>{merchant.contactMobile}</span>
                            </div>
                          )}
                          {(hasLongEmail || merchant.contactWhatsapp || merchant.website) && (
                            <button
                              onClick={() => setContactDialog({ merchantName: merchant.agencyName, email: merchant.agencyEmail, phone: merchant.contactMobile, whatsapp: merchant.contactWhatsapp, website: merchant.website })}
                              className="text-xs text-[#00426D] hover:underline font-medium"
                              data-testid={`button-view-contact-${merchant.id}`}
                            >
                              View all
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {merchant.branches && merchant.branches.length > 0 ? (
                          <div className="space-y-1">
                            {merchant.branches.slice(0, 2).map((branch, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-600">
                                <MapPin className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                <span className="truncate max-w-[150px]">{branch.name}</span>
                              </div>
                            ))}
                            {merchant.branches.length > 2 && (
                              <button onClick={() => setBranchesDialog({ merchantName: merchant.agencyName, branches: merchant.branches })} className="text-xs text-[#00426D] hover:underline font-medium" data-testid={`button-view-branches-${merchant.id}`}>
                                +{merchant.branches.length - 2} more
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><span className="text-sm font-medium text-slate-700" data-testid={`text-deals-${merchant.id}`}>{dealCounts?.counts?.[merchant.agencyId] ?? 0}</span></td>
                      <td className="px-4 py-3">{getStatusBadge(merchant.status)}</td>
                      <td className="px-4 py-3">
                        {merchant.url ? (
                          <a href={`https://www.qatarliving.com/en/deals/merchant/${merchant.url}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-[#00426D] hover:text-[#00426D]/80 font-medium transition-colors" data-testid={`link-merchant-${merchant.id}`}>
                            <ExternalLink className="h-4 w-4" />View
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!branchesDialog} onOpenChange={() => setBranchesDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#00426D]">
              <MapPin className="h-5 w-5" />
              {branchesDialog?.merchantName} — Branches
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {branchesDialog?.branches?.map((branch, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border">
                <MapPin className="h-4 w-4 text-[#00426D] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{branch.name}</p>
                  {branch.location?.name && <p className="text-xs text-slate-500 mt-0.5">{branch.location.name}</p>}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!contactDialog} onOpenChange={() => setContactDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#00426D]">
              <Building2 className="h-5 w-5" />
              {contactDialog?.merchantName} — Contact Details
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {contactDialog?.email && (
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border">
                <Mail className="h-4 w-4 text-[#00426D] mt-0.5 flex-shrink-0" />
                <div><p className="text-xs text-slate-500">Email</p><p className="text-sm text-slate-800 break-all">{contactDialog.email}</p></div>
              </div>
            )}
            {contactDialog?.phone && (
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border">
                <Phone className="h-4 w-4 text-[#00426D] mt-0.5 flex-shrink-0" />
                <div><p className="text-xs text-slate-500">Phone</p><p className="text-sm text-slate-800">{contactDialog.phone}</p></div>
              </div>
            )}
            {contactDialog?.whatsapp && (
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border">
                <Phone className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div><p className="text-xs text-slate-500">WhatsApp</p><p className="text-sm text-slate-800">{contactDialog.whatsapp}</p></div>
              </div>
            )}
            {contactDialog?.website && (
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border">
                <ExternalLink className="h-4 w-4 text-[#00426D] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Website</p>
                  <a href={contactDialog.website.startsWith("http") ? contactDialog.website : `https://${contactDialog.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-[#00426D] hover:underline break-all">{contactDialog.website}</a>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ExistingMerchants() {
  return (
    <AdminLayout>
      <div className="p-6 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#00426D]" data-testid="text-page-title">Live Merchants</h1>
        </div>
        <ExistingMerchantsContent />
      </div>
    </AdminLayout>
  );
}
