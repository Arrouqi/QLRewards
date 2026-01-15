import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  Building2, 
  FileDown, 
  Pencil,
  Send,
  Archive,
  FileText,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Download,
  Calendar,
  User,
  Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";
import jsPDF from "jspdf";

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
  subscriptionFee?: string;
  transactionFee?: string;
  status: string;
  createdAt: string;
  crDocument?: string;
  establishmentCard?: string;
  tradeLicense?: string;
  menuPriceList?: string;
  merchantSignatoryName?: string;
  commencementDate?: string;
  signedContractUpload?: string;
  deals?: any[];
}

export default function MerchantView() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/merchants/:id");
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMerchant();
  }, [params?.id]);

  const fetchMerchant = async () => {
    if (!params?.id) return;

    try {
      const authResponse = await fetch("/api/auth/session", { credentials: "include" });
      if (!authResponse.ok) {
        setLocation("/admin/login");
        return;
      }

      const res = await fetch(`/api/merchants/${params.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch merchant");
      const data = await res.json();
      setMerchant(data);
    } catch (error) {
      toast({ title: "Error loading merchant", variant: "destructive" });
      setLocation("/admin/merchants");
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (status: string) => {
    if (!merchant) return;
    try {
      const res = await fetch(`/api/merchants/${merchant.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast({ title: status === "moderation" ? "Forwarded to moderation" : "Status updated" });
      await fetchMerchant();
    } catch (error) {
      toast({ title: "Error updating status", variant: "destructive" });
    }
  };

  const generatePDF = () => {
    if (!merchant) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = 15;

    const checkPageBreak = (needed: number) => {
      if (y + needed > 280) {
        doc.addPage();
        y = 20;
        return true;
      }
      return false;
    };

    const drawHeader = () => {
      doc.setFillColor(0, 66, 109);
      doc.rect(0, 0, pageWidth, 35, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("QATAR LIVING DEALS", pageWidth / 2, 15, { align: "center" });
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text("Merchant Partnership Agreement", pageWidth / 2, 24, { align: "center" });
      doc.setFontSize(9);
      doc.text(`Reference: ${merchant.id.substring(0, 8).toUpperCase()}`, pageWidth / 2, 31, { align: "center" });
      y = 45;
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const commDate = merchant.commencementDate 
        ? new Date(merchant.commencementDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : '____________________';
      const agreementText = `This AGREEMENT is made and entered into on ${commDate} ("Commencement Date") between Qatar Living ("Living Deals") 20/Floor, Tornado Tower, Majlis Al Tawoon Street, West Bay, Doha, Qatar. (CR NO: 60909)`;
      const agreementLines = doc.splitTextToSize(agreementText, contentWidth);
      agreementLines.forEach((line: string) => {
        doc.text(line, margin, y);
        y += 5;
      });
      y += 5;
    };

    const drawSectionHeader = (title: string) => {
      checkPageBreak(15);
      doc.setFillColor(0, 66, 109);
      doc.rect(margin, y, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(title, margin + 3, y + 5.5);
      doc.setTextColor(0, 0, 0);
      y += 12;
    };

    const drawField = (label: string, value: string, indent = 0) => {
      checkPageBreak(8);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 80, 80);
      doc.text(label + ": ", margin + indent, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      const labelWidth = doc.getTextWidth(label + ": ");
      const valueLines = doc.splitTextToSize(value || "N/A", contentWidth - labelWidth - indent - 10);
      doc.text(valueLines[0], margin + indent + labelWidth + 2, y);
      y += 6;
      for (let i = 1; i < valueLines.length; i++) {
        checkPageBreak(6);
        doc.text(valueLines[i], margin + indent + labelWidth + 2, y);
        y += 6;
      }
    };

    const drawSubsectionTitle = (title: string) => {
      checkPageBreak(10);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 66, 109);
      doc.text(title, margin, y);
      doc.setTextColor(0, 0, 0);
      y += 6;
    };

    const drawDivider = () => {
      checkPageBreak(5);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
    };

    drawHeader();

    drawSectionHeader("COMPANY INFORMATION");
    drawField("Company Name", merchant.companyName);
    drawField("CR Number", merchant.crNumber);
    drawField("Brand Name", merchant.brandName);
    drawField("Address", merchant.address);
    drawField("Contact Person", merchant.contactPerson);
    drawField("Email", merchant.email);
    drawField("Phone", merchant.phone);
    if (merchant.products?.length > 0) {
      drawField("Product Types", merchant.products.join(", "));
    }
    if (merchant.businessCategories?.length > 0) {
      drawField("Business Categories", merchant.businessCategories.join(", "));
    }
    y += 3;

    const documents = [];
    if (merchant.crDocument) documents.push("CR Document");
    if (merchant.establishmentCard) documents.push("Establishment Card");
    if (merchant.tradeLicense) documents.push("Trade License");
    if (merchant.menuPriceList) documents.push("Menu/Price List");
    if (documents.length > 0) {
      drawField("Documents Uploaded", documents.join(", "));
    }
    y += 5;

    drawSectionHeader("FEE STRUCTURE");
    const subscriptionFee = merchant.subscriptionFee || "0";
    const transactionFee = merchant.transactionFee || "3";
    drawField("Subscription Fee", `${subscriptionFee} QAR per year`);
    drawField("Transaction Fee", `${transactionFee} QAR per transaction`);
    y += 2;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const feeNotes = [
      "• Subscription Payment: 100% advance upon signing or renewal.",
      "• Redemption Fees: Qatar Living will issue a monthly invoice for redeemed transactions; payments due within 15 days.",
      "• Unpaid balances may lead to suspension of offers until cleared."
    ];
    feeNotes.forEach(note => {
      checkPageBreak(6);
      const lines = doc.splitTextToSize(note, contentWidth);
      lines.forEach((line: string) => {
        doc.text(line, margin, y);
        y += 4;
      });
    });
    y += 5;

    if (merchant.branches?.length > 0) {
      drawSectionHeader("BRANCH LOCATIONS");
      merchant.branches.forEach((branchStr, index) => {
        try {
          const branch = typeof branchStr === 'string' ? JSON.parse(branchStr) : branchStr;
          drawSubsectionTitle(`Branch ${index + 1}: ${branch.name}`);
          if (branch.location) drawField("Google Maps URL", branch.location, 5);
          if (branch.phone) drawField("Phone", branch.phone, 5);
          if (branch.detail) drawField("Details", branch.detail, 5);
          y += 2;
        } catch {
          drawField(`Branch ${index + 1}`, String(branchStr));
        }
      });
      y += 3;
    }

    if (merchant.deals?.length > 0) {
      drawSectionHeader("DEAL OFFERS");
      merchant.deals.forEach((dealData, index) => {
        const deal = typeof dealData === 'string' ? JSON.parse(dealData) : dealData;
        
        checkPageBreak(20);
        drawSubsectionTitle(`Deal ${index + 1}: ${deal.title || "Untitled"}`);
        
        if (deal.category) drawField("Category", deal.category, 5);
        if (deal.subCategory) drawField("Sub-Category", deal.subCategory, 5);
        if (deal.dealType) drawField("Deal Type", deal.dealType, 5);
        if (deal.startDate && deal.endDate) {
          drawField("Validity Period", `${deal.startDate} to ${deal.endDate}`, 5);
        }
        if (deal.description) drawField("Description", deal.description, 5);
        if (deal.originalPrice) drawField("Original Price", `QAR ${deal.originalPrice}`, 5);
        if (deal.discountPercentage) drawField("Discount", `${deal.discountPercentage}%`, 5);
        if (deal.redemption) {
          drawField("Redemption", deal.redemption === 'limited' 
            ? `Limited (${deal.limitPerUser || 'N/A'} per user)` 
            : 'Unlimited', 5);
        }
        if (deal.isTwoTranches) {
          drawField("Two Tranches", `Yes - ${deal.trancheValidity || 'N/A'} weeks per tranche`, 5);
        }
        if (deal.isMultipleItems) {
          drawField("Multiple Items", "Yes", 5);
        }
        if (deal.specificDays && deal.days?.length > 0) {
          drawField("Valid Days", deal.days.join(", "), 5);
        }
        if (deal.claimRules?.length > 0) {
          drawField("Claim Rules", deal.claimRules.join("; "), 5);
        }
        if (deal.generalRules?.length > 0) {
          drawField("General Rules", deal.generalRules.join("; "), 5);
        }
        if (deal.otherRules) {
          drawField("Other Rules", deal.otherRules, 5);
        }
        if (deal.branches?.length > 0) {
          drawField("Applicable Branches", deal.branches.join(", "), 5);
        }
        if (deal.images?.length > 0) {
          drawField("Images", `${deal.images.length} image(s) uploaded`, 5);
        }
        
        drawDivider();
      });
    }

    drawSectionHeader("TERMS AND CONDITIONS");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const terms = [
      "1. The Merchant agrees to honor all deals and offers as specified in this agreement.",
      "2. Qatar Living reserves the right to feature, promote, or modify the display of deals on its platform.",
      "3. The Merchant shall ensure all information provided is accurate and up-to-date.",
      "4. Any changes to deal terms must be communicated to Qatar Living at least 7 days in advance.",
      "5. The Merchant is responsible for training staff on deal redemption procedures.",
      "6. Qatar Living is not liable for any disputes between the Merchant and customers.",
      "7. This agreement may be terminated by either party with 30 days written notice.",
      "8. The Merchant agrees to display Qatar Living promotional materials at their premises.",
      "9. All deals must comply with Qatar's consumer protection laws and regulations.",
      "10. This agreement is governed by the laws of the State of Qatar."
    ];
    terms.forEach(term => {
      checkPageBreak(6);
      const lines = doc.splitTextToSize(term, contentWidth);
      lines.forEach((line: string) => {
        doc.text(line, margin, y);
        y += 4;
      });
    });
    y += 8;

    doc.addPage();
    y = 25;
    
    drawSectionHeader("SIGNATURE PAGE");
    y += 3;
    
    const signDate = merchant.commencementDate 
      ? new Date(merchant.commencementDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 66, 109);
    doc.text("MERCHANT", margin, y);
    doc.setTextColor(0, 0, 0);
    y += 7;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Company Name: " + merchant.companyName, margin, y);
    y += 7;
    
    doc.text("Authorized Signatory Name: " + (merchant.merchantSignatoryName || ""), margin, y);
    y += 7;
    
    doc.text("Date: " + signDate, margin, y);
    y += 10;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text("Authorized Signatory Signature:", margin, y);
    y += 4;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.5);
    doc.rect(margin, y, contentWidth, 22);
    y += 26;
    
    doc.text("Company Stamp:", margin, y);
    y += 4;
    doc.rect(margin, y, contentWidth / 2, 25);
    y += 32;
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 66, 109);
    doc.text("QATAR LIVING", margin, y);
    doc.setTextColor(0, 0, 0);
    y += 7;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Name: ________________________________________", margin, y);
    y += 7;
    
    doc.text("Title: ________________________________________", margin, y);
    y += 7;
    
    doc.text("Date: ________________________________________", margin, y);
    y += 10;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text("Signature:", margin, y);
    y += 4;
    doc.setDrawColor(180, 180, 180);
    doc.rect(margin, y, contentWidth, 22);
    y += 30;

    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text("Qatar Living Deals - Merchant Partnership Agreement", pageWidth / 2, pageHeight - 12, { align: "center" });
    doc.text(`Document Generated: ${new Date().toLocaleString()} | Reference: ${merchant.id.substring(0, 8).toUpperCase()}`, pageWidth / 2, pageHeight - 7, { align: "center" });

    doc.save(`Qatar_Living_Agreement_${merchant.companyName.replace(/\s+/g, '_')}.pdf`);
    
    toast({ title: "PDF Downloaded", description: "Agreement PDF has been downloaded." });
  };

  const downloadSignedContract = () => {
    if (!merchant?.signedContractUpload) return;
    
    const link = document.createElement("a");
    link.href = merchant.signedContractUpload;
    link.download = `Signed_Contract_${merchant.companyName.replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Downloading signed contract" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>;
      case "moderation":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">In Moderation</Badge>;
      case "approved":
        return <Badge className="bg-green-100 text-green-700 border-green-200">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-700 border-red-200">Rejected</Badge>;
      case "archived":
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Archived</Badge>;
      default:
        return <Badge>{status}</Badge>;
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

  if (!merchant) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-slate-600">Merchant not found</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setLocation("/admin/merchants")}
            className="text-slate-600"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Merchants
          </Button>
          
          <div className="flex items-center gap-3">
            {getStatusBadge(merchant.status)}
            
            <Button
              variant="outline"
              onClick={generatePDF}
              data-testid="button-download-agreement"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Download Agreement
            </Button>
            
            {merchant.signedContractUpload && (
              <Button
                variant="outline"
                onClick={downloadSignedContract}
                data-testid="button-download-signed"
              >
                <Download className="h-4 w-4 mr-2" />
                Signed Contract
              </Button>
            )}
            
            <Button
              onClick={() => setLocation(`/admin/merchants/${merchant.id}/edit`)}
              className="bg-[#00426D] hover:bg-[#003152]"
              data-testid="button-edit"
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-[#00426D] flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-[#00426D]" data-testid="text-company-name">
                    {merchant.companyName}
                  </CardTitle>
                  <p className="text-slate-500">{merchant.brandName}</p>
                </div>
              </div>
              <p className="text-sm text-slate-500">
                Submitted: {format(new Date(merchant.createdAt), "MMMM d, yyyy")}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">CR Number</p>
                    <p className="font-medium">{merchant.crNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Address</p>
                    <p className="font-medium">{merchant.address}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Contact Person</p>
                    <p className="font-medium">{merchant.contactPerson}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="font-medium">{merchant.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Phone</p>
                    <p className="font-medium">{merchant.phone}</p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Products & Categories
              </h4>
              <div className="flex flex-wrap gap-2 mb-3">
                {merchant.products?.map((p) => (
                  <Badge key={p} variant="secondary">{p}</Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {merchant.businessCategories?.map((c) => (
                  <Badge key={c} variant="outline">{c}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[#00426D]">Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "CR Document", value: merchant.crDocument },
                { label: "Establishment Card", value: merchant.establishmentCard },
                { label: "Trade License", value: merchant.tradeLicense },
                { label: "Menu/Price List", value: merchant.menuPriceList },
              ].map((doc) => (
                <div key={doc.label} className="p-4 border rounded-lg text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm font-medium mb-2">{doc.label}</p>
                  {doc.value ? (
                    <a 
                      href={doc.value} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[#00426D] hover:underline text-sm flex items-center justify-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">Not provided</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {merchant.branches && merchant.branches.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-[#00426D] flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Branch Locations ({merchant.branches.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {merchant.branches.map((branchStr, index) => {
                  try {
                    const branch = typeof branchStr === 'string' ? JSON.parse(branchStr) : branchStr;
                    return (
                      <div key={index} className="p-4 bg-slate-50 rounded-lg">
                        <p className="font-medium text-[#00426D]">{branch.name}</p>
                        {branch.location && (
                          <a 
                            href={branch.location} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-slate-500 hover:underline flex items-center gap-1 mt-1"
                          >
                            <MapPin className="h-3 w-3" />
                            View on Map
                          </a>
                        )}
                        {branch.phone && (
                          <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" />
                            {branch.phone}
                          </p>
                        )}
                        {branch.detail && (
                          <p className="text-sm text-slate-600 mt-2">{branch.detail}</p>
                        )}
                      </div>
                    );
                  } catch {
                    return (
                      <div key={index} className="p-4 bg-slate-50 rounded-lg">
                        <p className="font-medium">{String(branchStr)}</p>
                      </div>
                    );
                  }
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {merchant.deals && merchant.deals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-[#00426D]">
                Deals ({merchant.deals?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {merchant.deals?.map((dealData, index) => {
                  const deal = typeof dealData === 'string' ? JSON.parse(dealData) : dealData;
                  return (
                    <div key={index} className="p-5 border rounded-lg bg-slate-50">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="font-semibold text-lg text-[#00426D]">{deal.title}</h4>
                          <p className="text-sm text-slate-500">{deal.category} {deal.subCategory ? `- ${deal.subCategory}` : ''}</p>
                        </div>
                        <Badge variant="outline" className="bg-white">{deal.dealType}</Badge>
                      </div>
                      
                      {deal.description && (
                        <p className="text-sm text-slate-600 mb-4 bg-white p-3 rounded border">{deal.description}</p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        {deal.originalPrice && (
                          <div className="bg-white p-3 rounded border">
                            <span className="text-slate-500 block text-xs mb-1">Original Price</span>
                            <span className="font-medium">QAR {deal.originalPrice}</span>
                          </div>
                        )}
                        {deal.discountPercentage && (
                          <div className="bg-white p-3 rounded border">
                            <span className="text-slate-500 block text-xs mb-1">Discount</span>
                            <span className="font-medium text-green-600">{deal.discountPercentage}%</span>
                          </div>
                        )}
                        {deal.startDate && (
                          <div className="bg-white p-3 rounded border">
                            <span className="text-slate-500 block text-xs mb-1">Start Date</span>
                            <span className="font-medium">{deal.startDate}</span>
                          </div>
                        )}
                        {deal.endDate && (
                          <div className="bg-white p-3 rounded border">
                            <span className="text-slate-500 block text-xs mb-1">End Date</span>
                            <span className="font-medium">{deal.endDate}</span>
                          </div>
                        )}
                        {deal.redemption && (
                          <div className="bg-white p-3 rounded border">
                            <span className="text-slate-500 block text-xs mb-1">Redemption</span>
                            <span className="font-medium capitalize">{deal.redemption}</span>
                            {deal.redemption === 'limited' && deal.limitPerUser && (
                              <span className="text-slate-500 ml-1">({deal.limitPerUser} per user)</span>
                            )}
                          </div>
                        )}
                        {deal.isTwoTranches && (
                          <div className="bg-white p-3 rounded border">
                            <span className="text-slate-500 block text-xs mb-1">Two Tranches</span>
                            <span className="font-medium">Yes - {deal.trancheValidity || 'N/A'} weeks per tranche</span>
                          </div>
                        )}
                        {deal.isMultipleItems && (
                          <div className="bg-white p-3 rounded border">
                            <span className="text-slate-500 block text-xs mb-1">Multiple Items</span>
                            <span className="font-medium">Yes</span>
                          </div>
                        )}
                        {deal.specificDays && deal.days && deal.days.length > 0 && (
                          <div className="bg-white p-3 rounded border col-span-full">
                            <span className="text-slate-500 block text-xs mb-1">Valid Days</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {deal.days.map((day: string) => (
                                <Badge key={day} variant="secondary" className="text-xs">{day}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {deal.claimRules && deal.claimRules.length > 0 && (
                          <div className="bg-white p-3 rounded border col-span-full">
                            <span className="text-slate-500 block text-xs mb-1">Claim Rules</span>
                            <ul className="list-disc list-inside mt-1">
                              {deal.claimRules.map((rule: string, i: number) => (
                                <li key={i} className="text-sm">{rule}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {deal.generalRules && deal.generalRules.length > 0 && (
                          <div className="bg-white p-3 rounded border col-span-full">
                            <span className="text-slate-500 block text-xs mb-1">General Rules</span>
                            <ul className="list-disc list-inside mt-1">
                              {deal.generalRules.map((rule: string, i: number) => (
                                <li key={i} className="text-sm">{rule}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {deal.otherRules && (
                          <div className="bg-white p-3 rounded border col-span-full">
                            <span className="text-slate-500 block text-xs mb-1">Other Rules</span>
                            <p className="text-sm">{deal.otherRules}</p>
                          </div>
                        )}
                        {deal.branches && deal.branches.length > 0 && (
                          <div className="bg-white p-3 rounded border col-span-full">
                            <span className="text-slate-500 block text-xs mb-1">Applicable Branches</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {[...new Set(deal.branches as string[])].map((branch: string, idx: number) => (
                                <Badge key={`${branch}-${idx}`} variant="outline" className="text-xs">{branch}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {deal.images && deal.images.length > 0 && (
                          <div className="bg-white p-3 rounded border col-span-full">
                            <span className="text-slate-500 block text-xs mb-2">Deal Images</span>
                            <div className="flex flex-wrap gap-2">
                              {deal.images.map((img: string, i: number) => (
                                <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="block">
                                  <img src={img} alt={`Deal ${index + 1} image ${i + 1}`} className="h-20 w-20 object-cover rounded border hover:opacity-80" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {merchant.merchantSignature && (
          <Card>
            <CardHeader>
              <CardTitle className="text-[#00426D]">Signature</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-8">
                <div>
                  <p className="text-sm text-slate-500 mb-2">Merchant Signature</p>
                  <div className="border rounded-lg p-4 bg-white">
                    <img src={merchant.merchantSignature} alt="Signature" className="max-h-24" />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-2">Signatory Name</p>
                  <p className="font-medium">{merchant.merchantSignatoryName}</p>
                  {merchant.commencementDate && (
                    <>
                      <p className="text-sm text-slate-500 mt-3 mb-1">Commencement Date</p>
                      <p className="font-medium">{format(new Date(merchant.commencementDate), "MMMM d, yyyy")}</p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {merchant.status === "pending" && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Actions</h4>
                  <p className="text-sm text-slate-500">Review and take action on this application</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => updateStatus("archived")}
                    className="text-slate-600"
                    data-testid="button-archive"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </Button>
                  <Button
                    onClick={() => updateStatus("moderation")}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-forward"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Forward to Moderation
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
