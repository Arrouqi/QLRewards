import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Search, ExternalLink, MapPin, Phone, Mail, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AdminLayout from "@/components/AdminLayout";

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

export default function ExistingMerchants() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

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

  const merchants = data?.merchants || [];
  const total = data?.total || 0;

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
    <AdminLayout>
      <div className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#00426D]" data-testid="text-page-title">Merchants</h1>
            <p className="text-slate-500 text-sm mt-1">
              {total} existing merchants from production
            </p>
          </div>
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
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {merchants.map((merchant) => (
                    <tr
                      key={merchant.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      data-testid={`row-merchant-${merchant.id}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-[#00426D] flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-5 w-5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate" data-testid={`text-merchant-name-${merchant.id}`}>
                              {merchant.agencyName}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              ID: {merchant.agencyId}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-700">{merchant.category?.name || "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {merchant.agencyEmail && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Mail className="h-3 w-3 text-slate-400" />
                              <span className="truncate max-w-[180px]">{merchant.agencyEmail}</span>
                            </div>
                          )}
                          {merchant.contactMobile && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Phone className="h-3 w-3 text-slate-400" />
                              <span>{merchant.contactMobile}</span>
                            </div>
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
                              <span className="text-xs text-slate-400">+{merchant.branches.length - 2} more</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(merchant.status)}
                      </td>
                      <td className="px-4 py-3">
                        {merchant.website && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <a
                              href={merchant.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-testid={`link-website-${merchant.id}`}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
