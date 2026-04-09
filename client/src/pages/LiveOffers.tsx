import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tag, Search, Loader2, Building2, Percent, Gift, Ticket, Package, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AdminLayout from "@/components/AdminLayout";

interface ESOffer {
  id: string;
  title?: string;
  description?: string;
  agency?: {
    agencyName?: string;
    agencyId?: number;
    url?: string;
  };
  category?: {
    id?: number;
    name?: string;
  };
  offerType?: {
    id?: number;
    name?: string;
  };
  discount?: number;
  discountPercentage?: number;
  status?: number;
  urls?: { urlAlias?: string }[];
  [key: string]: any;
}

const ITEMS_PER_PAGE = 20;

function getOfferTypeBadge(offerTypeName?: string) {
  if (!offerTypeName) return <span className="text-xs text-slate-400">—</span>;

  const lower = offerTypeName.toLowerCase();
  if (lower.includes("buy 1") || lower.includes("bogo") || lower.includes("b1g1")) {
    return (
      <Badge className="bg-purple-100 text-purple-700 border-purple-200 gap-1">
        <Gift className="h-3 w-3" />
        BOGO
      </Badge>
    );
  }
  if (lower.includes("discount")) {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
        <Percent className="h-3 w-3" />
        Discount
      </Badge>
    );
  }
  if (lower.includes("voucher")) {
    return (
      <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1">
        <Ticket className="h-3 w-3" />
        Voucher
      </Badge>
    );
  }
  if (lower.includes("bundle")) {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
        <Package className="h-3 w-3" />
        Bundle
      </Badge>
    );
  }
  return (
    <Badge className="bg-slate-100 text-slate-600 border-slate-200">
      {offerTypeName}
    </Badge>
  );
}

function getOfferUrl(offer: ESOffer): string | null {
  if (offer.urls && offer.urls.length > 0 && offer.urls[0].urlAlias) {
    return `https://www.qatarliving.com${offer.urls[0].urlAlias}`;
  }
  return null;
}

export default function LiveOffers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
    }, 400);
    setDebounceTimer(timer);
  };

  const fromIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const { data, isLoading } = useQuery<{ offers: ESOffer[]; total: number }>({
    queryKey: ["es-offers", debouncedSearch, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("size", String(ITEMS_PER_PAGE));
      params.set("from", String(fromIndex));
      const res = await fetch(`/api/es/offers?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch offers");
      return res.json();
    },
  });

  const offers = data?.offers || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <AdminLayout>
      <div className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#00426D]" data-testid="text-page-title">Live Deals</h1>
            <p className="text-slate-500 text-sm mt-1">
              {total} live deals on the platform
            </p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by title, merchant, or category..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-offers"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#00426D]" />
          </div>
        ) : offers.length === 0 ? (
          <div className="text-center py-20">
            <Tag className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No offers found</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="table-offers">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Offer</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Merchant</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Category</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Offer Type</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Status</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((offer) => {
                      const offerUrl = getOfferUrl(offer);
                      return (
                        <tr
                          key={offer.id}
                          className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                          data-testid={`row-offer-${offer.id}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
                                <Tag className="h-5 w-5 text-white" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900 truncate max-w-[250px]" data-testid={`text-offer-title-${offer.id}`}>
                                  {offer.title || "Untitled Offer"}
                                </p>
                                <p className="text-xs text-slate-500 truncate">
                                  ID: {offer.id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-sm text-slate-700 truncate max-w-[180px]">
                                {offer.agency?.agencyName || "—"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-slate-700">{offer.category?.name || "—"}</span>
                          </td>
                          <td className="px-4 py-3">
                            {getOfferTypeBadge(offer.offerType?.name)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              Active
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {offerUrl ? (
                              <a
                                href={offerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm text-[#00426D] hover:text-[#00426D]/80 font-medium transition-colors"
                                data-testid={`link-offer-${offer.id}`}
                              >
                                <ExternalLink className="h-4 w-4" />
                                View
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

            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-4">
                <div className="text-sm text-slate-500">
                  Showing {fromIndex + 1} to {Math.min(fromIndex + ITEMS_PER_PAGE, total)} of {total}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-slate-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
