import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { format } from "date-fns";
import { ArrowLeft, Download, Copy, Check, Calendar, Tag, MapPin, User, Mail, Phone, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";
import type { Deal } from "@shared/schema";

export default function DealView() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/deals/:id/view");
  const [deal, setDeal] = useState<Deal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    fetchDeal();
  }, [params?.id]);

  const fetchDeal = async () => {
    if (!params?.id) return;

    try {
      const authResponse = await fetch("/api/auth/session", { credentials: "include" });
      if (!authResponse.ok) {
        setLocation("/admin/login");
        return;
      }

      const dealResponse = await fetch(`/api/deals/${params.id}`, { credentials: "include" });
      if (!dealResponse.ok) {
        throw new Error("Failed to fetch deal");
      }

      const dealData = await dealResponse.json();
      setDeal(dealData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load deal details",
        variant: "destructive",
      });
      setLocation("/admin/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        title: "Copied!",
        description: `${field} copied to clipboard`,
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const downloadImage = (index: number) => {
    const link = document.createElement("a");
    link.href = `/api/deals/${deal?.id}/download-image/${index}`;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({
      title: "Downloading",
      description: `Image ${index + 1} download started`,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "archived":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const getDealTypeLabel = (dealType: string) => {
    switch (dealType) {
      case "bogo":
        return "Buy 1 Get 1";
      case "discount":
        return "Discount";
      case "voucher":
        return "Voucher";
      case "bundle":
        return "Bundle";
      default:
        return dealType;
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00426D]"></div>
        </div>
      </AdminLayout>
    );
  }

  if (!deal) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-slate-600">Deal not found</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/admin/dashboard")}
              className="text-slate-600"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={getStatusColor(deal.status)}>
              {deal.status === "approved" ? "Sent to Moderation" : deal.status.charAt(0).toUpperCase() + deal.status.slice(1)}
            </Badge>
            <Button
              onClick={() => setLocation(`/admin/deals/${deal.id}`)}
              className="bg-[#00426D] hover:bg-[#003152]"
              data-testid="button-edit"
            >
              Edit Deal
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl text-[#00426D]" data-testid="text-title">{deal.title}</CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  Created on {format(new Date(deal.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Category</p>
                <p className="font-medium text-slate-800">{deal.category}</p>
                <p className="text-sm text-slate-600">{deal.subCategory}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Deal Type</p>
                <p className="font-medium text-slate-800">{getDealTypeLabel(deal.dealType)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Duration</p>
                <p className="font-medium text-slate-800 capitalize">{deal.duration}</p>
              </div>
            </div>

            {!deal.isMultipleItems && deal.originalPrice && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">Original Price</p>
                  <p className="font-medium text-slate-800">{deal.originalPrice} QAR</p>
                </div>
                {deal.discountPercentage && (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Discount</p>
                    <p className="font-medium text-slate-800">{deal.discountPercentage}%</p>
                  </div>
                )}
              </div>
            )}

            {deal.isMultipleItems && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-800 text-sm">This deal is for multiple items (price not displayed)</p>
              </div>
            )}

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Description
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(deal.description, "Description")}
                  data-testid="button-copy-description"
                >
                  {copiedField === "Description" ? (
                    <Check className="h-4 w-4 mr-2 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  Copy
                </Button>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-slate-700 whitespace-pre-wrap" data-testid="text-description">{deal.description}</p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Branches
              </p>
              <div className="flex flex-wrap gap-2">
                {deal.branches.map((branch, index) => (
                  <Badge key={index} variant="secondary" className="text-sm">
                    {branch}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-3">Claim Rules</p>
              <ul className="space-y-2">
                {deal.claimRules.map((rule, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-[#00426D] mt-1">•</span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-3">General Rules</p>
              <ul className="space-y-2">
                {deal.generalRules.map((rule, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-[#00426D] mt-1">•</span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>

            {deal.otherRules && (
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-3">Other Rules</p>
                <p className="text-sm text-slate-700">{deal.otherRules}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#00426D]">
              <User className="h-5 w-5" />
              Merchant Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {deal.merchantName && (
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Name</p>
                    <p className="font-medium">{deal.merchantName}</p>
                  </div>
                </div>
              )}
              {deal.merchantEmail && (
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="font-medium">{deal.merchantEmail}</p>
                  </div>
                </div>
              )}
              {deal.merchantPhone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Phone</p>
                    <p className="font-medium">{deal.merchantPhone}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {deal.images && deal.images.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#00426D]">
                <ImageIcon className="h-5 w-5" />
                Deal Images ({deal.images.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {deal.images.map((image, index) => (
                  <div key={index} className="space-y-2">
                    <div className="relative">
                      <div className="aspect-[16/10] rounded-lg overflow-hidden border border-slate-200">
                        <img
                          src={image}
                          alt={`Deal image ${index + 1}`}
                          className="w-full h-full object-cover"
                          data-testid={`image-${index}`}
                        />
                      </div>
                      <div className="absolute top-2 left-2 bg-[#00426D] text-white text-xs px-2 py-1 rounded">
                        {index + 1}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => downloadImage(index)}
                      data-testid={`button-download-${index}`}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Image {index + 1}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {deal.adminCommentHistory && deal.adminCommentHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-[#00426D]">Admin Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {deal.adminCommentHistory.map((comment, index) => {
                  try {
                    const parsed = JSON.parse(comment);
                    return (
                      <div key={index} className="bg-slate-50 rounded-lg p-4">
                        <p className="text-sm text-slate-700">{parsed.text}</p>
                        <p className="text-xs text-slate-500 mt-2">
                          By {parsed.author} on {format(new Date(parsed.timestamp), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    );
                  } catch {
                    return (
                      <div key={index} className="bg-slate-50 rounded-lg p-4">
                        <p className="text-sm text-slate-700">{comment}</p>
                      </div>
                    );
                  }
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
