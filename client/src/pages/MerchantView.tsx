import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Tag,
  Upload,
  X,
  Loader2,
  Undo2,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  salesOrder?: string;
  taxCardDocument?: string;
  logo?: string;
  coverImage?: string;
  whatsapp?: string;
  submittedBy?: string;
  offersCreated?: number;
  deals?: any[];
}

interface MerchantNote {
  id: string;
  merchantId: string;
  author: string;
  content: string;
  createdAt: string;
}

export default function MerchantView() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/merchants/:id");
  
  const { data: session } = useQuery({
    queryKey: ["/api/auth/session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (!res.ok) return { role: "user" };
      return res.json();
    },
  });
  const userRole = session?.role || "user";
  const isAdmin = userRole === "admin";
  const isSales = userRole === "sales";
  const isModeration = userRole === "moderation";
  
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const canEditMerchant = merchant ? !(isSales && merchant.status !== "pending") && !(isModeration && merchant.status === "pending") : false;
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingSalesOrder, setIsUploadingSalesOrder] = useState(false);
  const salesOrderFileRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState<MerchantNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isUploadingSignedContract, setIsUploadingSignedContract] = useState(false);
  const signedContractFileRef = useRef<HTMLInputElement>(null);
  const [statusConfirmDialog, setStatusConfirmDialog] = useState<{
    targetStatus: string;
    title: string;
    description: string;
  } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

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
      fetchNotes(params.id);
    } catch (error) {
      toast({ title: "Error loading merchant", variant: "destructive" });
      setLocation("/admin/merchants");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNotes = async (merchantId: string) => {
    try {
      const res = await fetch(`/api/merchants/${merchantId}/notes`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
      }
    } catch {
    }
  };

  const submitNote = async () => {
    if (!merchant || !newNote.trim()) return;
    setIsSubmittingNote(true);
    try {
      const res = await fetch(`/api/merchants/${merchant.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: newNote.trim() }),
      });
      if (!res.ok) throw new Error("Failed to add note");
      const note = await res.json();
      setNotes(prev => [...prev, note]);
      setNewNote("");
      toast({ title: "Note added" });
    } catch {
      toast({ title: "Error adding note", variant: "destructive" });
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const confirmStatusChange = (targetStatus: string) => {
    if (!merchant) return;
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
      targetStatus,
      title: isArchive ? "Archive Merchant?" : `Change Status: ${currentLabel} → ${targetLabel}?`,
      description: isArchive
        ? `Are you sure you want to archive "${merchant.companyName}" (${merchant.brandName})? You can restore it later from the Archived tab.`
        : `Are you sure you want to move "${merchant.companyName}" (${merchant.brandName}) from "${currentLabel}" to "${targetLabel}"?`,
    });
  };

  const executeStatusChange = async (status: string) => {
    if (!merchant) return;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/merchants/${merchant.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        toast({ title: "Cannot proceed", description: errorData.error, variant: "destructive" });
        return;
      }
      const messages: Record<string, string> = {
        moderation: "Forwarded to moderation",
        created: "Marked as Created",
        pending: "Moved back to With Sales",
        archived: "Archived",
        licensing: "Moved to Licensing",
        licensed: "Marked as Licensed",
      };
      toast({ title: messages[status] || "Status updated" });
      setStatusConfirmDialog(null);
      if (status === "moderation") {
        setLocation("/admin/merchants");
        return;
      }
      await fetchMerchant();
    } catch (error) {
      toast({ title: "Error updating status", variant: "destructive" });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSalesOrderUpload = async (file: File) => {
    if (!merchant) return;
    setIsUploadingSalesOrder(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await fetch(`/api/merchants/${merchant.id}/sales-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ salesOrder: reader.result }),
          });
          if (!res.ok) throw new Error("Failed to upload sales order");
          const updated = await res.json();
          setMerchant({ ...merchant, salesOrder: updated.salesOrder });
          toast({ title: "Sales order uploaded successfully" });
        } catch (error) {
          toast({ title: "Error uploading sales order", variant: "destructive" });
        } finally {
          setIsUploadingSalesOrder(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setIsUploadingSalesOrder(false);
      toast({ title: "Error reading file", variant: "destructive" });
    }
  };

  const handleRemoveSalesOrder = async () => {
    if (!merchant) return;
    try {
      const res = await fetch(`/api/merchants/${merchant.id}/sales-order`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove sales order");
      setMerchant({ ...merchant, salesOrder: undefined });
      toast({ title: "Sales order removed" });
    } catch {
      toast({ title: "Error removing sales order", variant: "destructive" });
    }
  };

  const handleSignedContractUpload = async (file: File) => {
    if (!merchant) return;
    setIsUploadingSignedContract(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await fetch(`/api/merchants/${merchant.id}/upload-signed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ signedContractUpload: reader.result }),
          });
          if (!res.ok) throw new Error("Failed to upload signed agreement");
          const updated = await res.json();
          setMerchant({ ...merchant, signedContractUpload: updated.signedContractUpload });
          toast({ title: "Signed agreement uploaded successfully" });
        } catch (error) {
          toast({ title: "Error uploading signed agreement", variant: "destructive" });
        } finally {
          setIsUploadingSignedContract(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setIsUploadingSignedContract(false);
      toast({ title: "Error reading file", variant: "destructive" });
    }
  };

  const handleRemoveSignedContract = async () => {
    if (!merchant) return;
    try {
      const res = await fetch(`/api/merchants/${merchant.id}/signed-contract`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove signed agreement");
      setMerchant({ ...merchant, signedContractUpload: undefined });
      toast({ title: "Signed agreement removed" });
    } catch {
      toast({ title: "Error removing signed agreement", variant: "destructive" });
    }
  };

  const downloadSignedContract = () => {
    if (!merchant?.signedContractUpload) return;
    const link = document.createElement("a");
    link.href = merchant.signedContractUpload;
    link.download = `Signed_Agreement_${merchant.companyName.replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

    if (merchant.deals && merchant.deals.length > 0) {
      drawSectionHeader("DEAL OFFERS");
      merchant.deals.forEach((dealData, index) => {
        const deal = typeof dealData === 'string' ? JSON.parse(dealData) : dealData;
        
        checkPageBreak(20);
        drawSubsectionTitle(`Deal ${index + 1}: ${deal.title || "Untitled"}`);
        
        if (deal.category) drawField("Category", deal.category, 5);
        if (deal.subCategory) drawField("Sub-Category", deal.subCategory, 5);
        if (deal.dealType) drawField("Deal Type", deal.dealType, 5);
        if (deal.duration) drawField("Duration", deal.duration, 5);
        if (deal.description) drawField("Description", deal.description, 5);
        if (deal.originalPrice) drawField("Original Price", `QAR ${deal.originalPrice}`, 5);
        if (deal.discountedPrice) {
          drawField("Discounted Price", `QAR ${deal.discountedPrice}`, 5);
        } else if (deal.discountPercentage) {
          drawField("Discount", `${deal.discountPercentage}%`, 5);
        }
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
    doc.text("Signature & Company Stamp:", margin, y);
    y += 4;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.5);
    doc.rect(margin, y, contentWidth, 40);
    y += 48;
    
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
    doc.text("Signature & Company Stamp:", margin, y);
    y += 4;
    doc.setDrawColor(180, 180, 180);
    doc.rect(margin, y, contentWidth, 40);
    y += 48;

    // Add footer with page numbers to all pages
    const pageHeight = doc.internal.pageSize.getHeight();
    const totalPages = (doc as any).internal.getNumberOfPages();
    
    for (let i = 1; i <= totalPages; i++) {
      (doc as any).setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "normal");
      doc.text("Qatar Living Deals - Merchant Partnership Agreement", pageWidth / 2, pageHeight - 15, { align: "center" });
      doc.text(`Document Generated: ${new Date().toLocaleString()} | Reference: ${merchant.id.substring(0, 8).toUpperCase()}`, pageWidth / 2, pageHeight - 10, { align: "center" });
      doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 5, { align: "center" });
    }

    doc.save(`Qatar_Living_Agreement_${merchant.companyName.replace(/\s+/g, '_')}.pdf`);
    
    toast({ title: "PDF Downloaded", description: "Agreement PDF has been downloaded." });
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">With Sales</Badge>;
      case "moderation":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">In Moderation</Badge>;
      case "created":
        return <Badge className="bg-green-100 text-green-700 border-green-200">Created</Badge>;
      case "licensing":
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Licensing</Badge>;
      case "licensed":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Licensed</Badge>;
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
            
            {canEditMerchant && (
              <Button
                onClick={() => setLocation(`/admin/merchants/${merchant.id}/edit`)}
                className="bg-[#00426D] hover:bg-[#003152]"
                data-testid="button-edit"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
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
                {merchant.whatsapp && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">WhatsApp</p>
                      <p className="font-medium">{merchant.whatsapp}</p>
                    </div>
                  </div>
                )}
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "CR Document", value: merchant.crDocument, required: true },
                { label: "Establishment Card", value: merchant.establishmentCard, required: true },
                { label: "Trade License", value: merchant.tradeLicense, required: true },
                { label: "Menu/Price List", value: merchant.menuPriceList, required: true },
                { label: "Tax Card", value: merchant.taxCardDocument, required: false },
                { label: "Logo", value: merchant.logo, required: false },
                { label: "Cover Image", value: merchant.coverImage, required: false },
              ].map((doc) => (
                <div key={doc.label} className={`p-4 border rounded-lg text-center ${doc.required && !doc.value ? 'border-red-200 bg-red-50/50' : ''}`}>
                  <FileText className={`h-8 w-8 mx-auto mb-2 ${doc.value ? 'text-green-500' : doc.required ? 'text-red-400' : 'text-slate-400'}`} />
                  <p className="text-sm font-medium mb-1">
                    {doc.label}
                    {doc.required && <span className="text-red-500 ml-1">*</span>}
                  </p>
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
                    <span className={`text-xs ${doc.required ? 'text-red-400 font-medium' : 'text-slate-400'}`}>
                      {doc.required ? 'Missing' : 'Not provided'}
                    </span>
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
                        {deal.discountedPrice && (
                          <div className="bg-white p-3 rounded border">
                            <span className="text-slate-500 block text-xs mb-1">Discounted Price</span>
                            <span className="font-medium text-green-600">QAR {deal.discountedPrice}</span>
                          </div>
                        )}
                        {deal.duration && (
                          <div className="bg-white p-3 rounded border">
                            <span className="text-slate-500 block text-xs mb-1">Duration</span>
                            <span className="font-medium">{deal.duration}</span>
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
                              {Array.from(new Set(deal.branches as string[])).map((branch: string, idx: number) => (
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

        {merchant.merchantSignatoryName && (
          <Card>
            <CardHeader>
              <CardTitle className="text-[#00426D]">Signature Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-8">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-[#00426D]">Sales Order</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              ref={salesOrderFileRef}
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSalesOrderUpload(file);
                e.target.value = "";
              }}
              data-testid="input-sales-order-file-view"
            />
            {merchant.salesOrder ? (
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-[#00426D]" />
                  <div>
                    <p className="font-medium text-sm">Sales Order PDF</p>
                    <a
                      href={merchant.salesOrder}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                      data-testid="link-sales-order-view"
                    >
                      View Document
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = merchant.salesOrder!;
                      link.download = `Sales_Order_${merchant.companyName.replace(/\s+/g, '_')}.pdf`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    data-testid="button-download-sales-order-view"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  {canEditMerchant && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => salesOrderFileRef.current?.click()}
                        disabled={isUploadingSalesOrder}
                        data-testid="button-replace-sales-order-view"
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Replace
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveSalesOrder}
                        className="text-red-600 hover:text-red-700"
                        data-testid="button-remove-sales-order-view"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg">
                <FileText className="h-8 w-8 text-slate-400 mb-2" />
                <p className="text-sm text-slate-500 mb-3">No sales order attached</p>
                {canEditMerchant && (
                  <Button
                    variant="outline"
                    onClick={() => salesOrderFileRef.current?.click()}
                    disabled={isUploadingSalesOrder}
                    data-testid="button-upload-sales-order-view"
                  >
                    {isUploadingSalesOrder ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Sales Order PDF
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[#00426D]">Signed Agreement</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              ref={signedContractFileRef}
              accept=".pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSignedContractUpload(file);
                e.target.value = "";
              }}
              data-testid="input-signed-contract-file"
            />
            {merchant.signedContractUpload ? (
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-[#00426D]" />
                  <div>
                    <p className="font-medium text-sm">Signed Agreement</p>
                    <a
                      href={merchant.signedContractUpload}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                      data-testid="link-signed-contract-view"
                    >
                      View Document
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadSignedContract}
                    data-testid="button-download-signed-contract"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  {canEditMerchant && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => signedContractFileRef.current?.click()}
                        disabled={isUploadingSignedContract}
                        data-testid="button-replace-signed-contract"
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Replace
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveSignedContract}
                        className="text-red-600 hover:text-red-700"
                        data-testid="button-remove-signed-contract"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg">
                <FileText className="h-8 w-8 text-slate-400 mb-2" />
                <p className="text-sm text-slate-500 mb-3">No signed agreement attached</p>
                {canEditMerchant && (
                  <Button
                    variant="outline"
                    onClick={() => signedContractFileRef.current?.click()}
                    disabled={isUploadingSignedContract}
                    data-testid="button-upload-signed-contract"
                  >
                    {isUploadingSignedContract ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Signed Agreement
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#00426D]" />
              Internal Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {notes.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No notes yet</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {[...notes]
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map((note) => (
                  <div key={note.id} className="bg-slate-50 rounded-lg p-3 border" data-testid={`note-${note.id}`}>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                      <User className="h-3 w-3" />
                      <span className="font-medium">{note.author}</span>
                      <span>•</span>
                      <span>{format(new Date(note.createdAt), "dd MMM yyyy, HH:mm")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                className="flex-1"
                data-testid="input-note"
              />
              <Button
                onClick={submitNote}
                disabled={!newNote.trim() || isSubmittingNote}
                className="self-end bg-[#00426D] hover:bg-[#003557]"
                data-testid="button-submit-note"
              >
                {isSubmittingNote ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Offers Created</h4>
                <p className="text-sm text-slate-500">Track the number of offers created for this merchant</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  defaultValue={merchant.offersCreated || merchant.deals?.length || 0}
                  key={`${merchant.offersCreated}-${merchant.deals?.length}`}
                  className="w-24 text-center"
                  data-testid="input-offers-created"
                  id="offers-count-input"
                />
                <span className="text-sm text-slate-500">offers</span>
                <Button
                  size="sm"
                  className="bg-[#00426D] hover:bg-[#003356]"
                  onClick={async () => {
                    const input = document.getElementById("offers-count-input") as HTMLInputElement;
                    const val = parseInt(input?.value) || 0;
                    if (val < 0) return;
                    try {
                      const res = await fetch(`/api/merchants/${merchant.id}/offers-created`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ offersCreated: val }),
                      });
                      if (res.ok) {
                        setMerchant({ ...merchant, offersCreated: val });
                        toast({ title: "Updated", description: "Offers count saved" });
                      }
                    } catch {
                      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
                    }
                  }}
                  data-testid="button-save-offers"
                >
                  Save
                </Button>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium">Actions</h4>
                <p className="text-sm text-slate-500">Review and take action on this application</p>
              </div>
              <div className="flex items-center gap-3">
                {merchant.status !== "archived" && !isSales && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => confirmStatusChange("archived")}
                    className="text-slate-400 hover:text-slate-600 text-xs"
                    data-testid="button-archive"
                  >
                    <Archive className="h-3 w-3 mr-1" />
                    Archive
                  </Button>
                )}
                {merchant.status === "archived" && (
                  <>
                    {!isModeration && (
                      <Button
                        variant="outline"
                        onClick={() => confirmStatusChange("pending")}
                        className="text-amber-600 border-amber-300 hover:bg-amber-50"
                        data-testid="button-restore-pending"
                      >
                        Restore to With Sales
                      </Button>
                    )}
                    <Button
                      onClick={() => confirmStatusChange("moderation")}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="button-restore-moderation"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Restore to Moderation
                    </Button>
                  </>
                )}
                {merchant.status === "pending" && !isModeration && (
                  <Button
                    onClick={() => confirmStatusChange("moderation")}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="button-forward"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Forward to Moderation
                  </Button>
                )}
                {merchant.status === "moderation" && !isSales && (
                  <>
                    {!isModeration && (
                      <Button
                        variant="outline"
                        onClick={() => confirmStatusChange("pending")}
                        className="text-amber-600 border-amber-300 hover:bg-amber-50"
                        data-testid="button-back-pending"
                      >
                        Move to With Sales
                      </Button>
                    )}
                    <Button
                      onClick={() => confirmStatusChange("created")}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid="button-created"
                    >
                      Mark as Created
                    </Button>
                  </>
                )}
                {merchant.status === "created" && !isSales && (
                  <>
                    <Button
                      onClick={() => confirmStatusChange("licensing")}
                      className="bg-purple-600 hover:bg-purple-700"
                      data-testid="button-licensing"
                    >
                      Move to Licensing
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => confirmStatusChange("moderation")}
                      className="text-amber-600 border-amber-300 hover:bg-amber-50"
                      data-testid="button-back-moderation"
                    >
                      <Undo2 className="h-4 w-4 mr-2" />
                      Move back to Moderation
                    </Button>
                  </>
                )}
                {merchant.status === "licensing" && !isSales && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => confirmStatusChange("created")}
                      className="text-green-600 border-green-300 hover:bg-green-50"
                      data-testid="button-back-created"
                    >
                      <Undo2 className="h-4 w-4 mr-2" />
                      Move back to Created
                    </Button>
                    <Button
                      onClick={() => confirmStatusChange("licensed")}
                      className="bg-emerald-600 hover:bg-emerald-700"
                      data-testid="button-licensed"
                    >
                      Mark as Licensed
                    </Button>
                  </>
                )}
                {merchant.status === "licensed" && !isSales && (
                  <Button
                    variant="outline"
                    onClick={() => confirmStatusChange("licensing")}
                    className="text-purple-600 border-purple-300 hover:bg-purple-50"
                    data-testid="button-back-licensing"
                  >
                    <Undo2 className="h-4 w-4 mr-2" />
                    Move back to Licensing
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
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
              onClick={() => statusConfirmDialog && executeStatusChange(statusConfirmDialog.targetStatus)}
              disabled={isUpdatingStatus}
              data-testid="button-confirm-status-change"
            >
              {isUpdatingStatus ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
