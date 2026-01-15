import { useState, useRef, ChangeEvent, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Download, Upload, FileText, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

interface MerchantData {
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
  deals: any[];
  crDocument?: string;
  establishmentCard?: string;
  tradeLicense?: string;
  menuPriceList?: string;
  merchantSignature?: string;
  merchantSignatoryName?: string;
  merchantSignDate?: string;
  signedContractUpload?: string;
}

export default function MerchantSuccess() {
  const [, params] = useRoute("/merchant-success/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const merchantId = params?.id;

  useEffect(() => {
    if (merchantId) {
      fetchMerchant();
    }
  }, [merchantId]);

  const fetchMerchant = async () => {
    try {
      const response = await fetch(`/api/merchants/public/${merchantId}`);
      if (response.ok) {
        const data = await response.json();
        setMerchant(data);
        setUploadComplete(!!data.signedContractUpload);
      }
    } catch (error) {
      console.error("Failed to fetch merchant:", error);
    } finally {
      setLoading(false);
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
      doc.text(label + ":", margin + indent, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      const labelWidth = doc.getTextWidth(label + ": ");
      const valueLines = doc.splitTextToSize(value || "N/A", contentWidth - labelWidth - indent - 5);
      doc.text(valueLines[0], margin + indent + labelWidth, y);
      y += 5;
      for (let i = 1; i < valueLines.length; i++) {
        checkPageBreak(5);
        doc.text(valueLines[i], margin + indent + labelWidth, y);
        y += 5;
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
    y = 20;

    drawSectionHeader("AUTHORIZATION & SIGNATURES");
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const declaration = "We, the undersigned, hereby confirm that all information provided in this application is true and accurate. Both parties agree to the terms and conditions of the Qatar Living Deals Merchant Partnership Program as outlined above.";
    const declLines = doc.splitTextToSize(declaration, contentWidth);
    declLines.forEach((line: string) => {
      doc.text(line, margin, y);
      y += 5;
    });
    y += 10;

    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, (contentWidth / 2) - 5, 85, 'F');
    doc.rect(margin + (contentWidth / 2) + 5, y, (contentWidth / 2) - 5, 85, 'F');
    
    doc.setDrawColor(0, 66, 109);
    doc.setLineWidth(0.5);
    doc.rect(margin, y, (contentWidth / 2) - 5, 85, 'S');
    doc.rect(margin + (contentWidth / 2) + 5, y, (contentWidth / 2) - 5, 85, 'S');

    const leftBoxX = margin + 3;
    const rightBoxX = margin + (contentWidth / 2) + 8;
    const boxWidth = (contentWidth / 2) - 11;
    let boxY = y + 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 66, 109);
    doc.text("MERCHANT", leftBoxX, boxY);
    doc.text("QATAR LIVING", rightBoxX, boxY);
    boxY += 8;
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    
    doc.text("Signature:", leftBoxX, boxY);
    doc.text("Signature:", rightBoxX, boxY);
    boxY += 3;
    
    if (merchant.merchantSignature) {
      try {
        doc.addImage(merchant.merchantSignature, "PNG", leftBoxX, boxY, 50, 20);
      } catch {
        doc.setDrawColor(180, 180, 180);
        doc.rect(leftBoxX, boxY, boxWidth - 5, 20, 'S');
      }
    } else {
      doc.setDrawColor(180, 180, 180);
      doc.rect(leftBoxX, boxY, boxWidth - 5, 20, 'S');
    }
    doc.setDrawColor(180, 180, 180);
    doc.rect(rightBoxX, boxY, boxWidth - 5, 20, 'S');
    boxY += 25;

    doc.text("Name: " + (merchant.merchantSignatoryName || "_______________________"), leftBoxX, boxY);
    doc.text("Name: _______________________", rightBoxX, boxY);
    boxY += 7;

    doc.text("Title: _______________________", leftBoxX, boxY);
    doc.text("Title: _______________________", rightBoxX, boxY);
    boxY += 7;

    const signDate = merchant.merchantSignDate 
      ? new Date(merchant.merchantSignDate).toLocaleDateString() 
      : "_______________________";
    doc.text("Date: " + signDate, leftBoxX, boxY);
    doc.text("Date: _______________________", rightBoxX, boxY);

    y += 95;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Company Stamp:", margin, y);
    doc.text("Company Stamp:", margin + (contentWidth / 2) + 5, y);
    y += 5;
    
    doc.setDrawColor(180, 180, 180);
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y, 45, 45, 'FD');
    doc.rect(margin + (contentWidth / 2) + 5, y, 45, 45, 'FD');
    
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150, 150, 150);
    doc.text("(Merchant Stamp)", margin + 5, y + 25);
    doc.text("(Qatar Living Stamp)", margin + (contentWidth / 2) + 10, y + 25);

    y += 55;

    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text("Qatar Living Deals - Merchant Partnership Agreement", pageWidth / 2, 285, { align: "center" });
    doc.text(`Document Generated: ${new Date().toLocaleString()} | Reference: ${merchant.id.substring(0, 8).toUpperCase()}`, pageWidth / 2, 290, { align: "center" });

    doc.save(`Qatar_Living_Agreement_${merchant.companyName.replace(/\s+/g, '_')}.pdf`);
    
    toast({
      title: "PDF Downloaded",
      description: "Your merchant agreement has been downloaded successfully.",
    });
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !merchantId) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const response = await fetch(`/api/merchants/${merchantId}/upload-signed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signedContractUpload: reader.result }),
        });

        if (response.ok) {
          setUploadComplete(true);
          toast({ title: "Signed contract uploaded successfully!" });
        } else {
          throw new Error("Upload failed");
        }
      } catch (error) {
        toast({ title: "Upload failed", variant: "destructive" });
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#00426D]" />
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-slate-600">Merchant not found</p>
            <Button className="mt-4" onClick={() => setLocation("/")}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#00426D] text-white py-6 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center gap-4">
            <img src="/ql-logo.png" alt="Qatar Living" className="h-10" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <div>
              <h1 className="text-2xl font-bold">Application Submitted</h1>
              <p className="text-white/80 text-sm">Complete the final steps below</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl py-8 px-4">
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-green-800">Application Submitted Successfully!</h2>
                <p className="text-green-700 mt-1">
                  Thank you, <strong>{merchant.companyName}</strong>. Your merchant partnership application has been received.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#00426D]">
                <span className="h-8 w-8 rounded-full bg-[#00426D] text-white flex items-center justify-center text-sm">1</span>
                Download Your Agreement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 mb-4">
                Download the PDF containing all your submitted information. 
                {!merchant.merchantSignature && " The document includes spaces for your signature and company stamp."}
              </p>
              <Button onClick={generatePDF} className="bg-[#00426D] hover:bg-[#003557]" data-testid="button-download-pdf">
                <Download className="h-4 w-4 mr-2" />
                Download Agreement PDF
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#00426D]">
                <span className="h-8 w-8 rounded-full bg-[#00426D] text-white flex items-center justify-center text-sm">2</span>
                Sign & Stamp the Document
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">
                Print the downloaded PDF, sign it with an authorized signature, and apply your company stamp in the designated areas.
              </p>
            </CardContent>
          </Card>

          <Card className={uploadComplete ? "border-green-200 bg-green-50" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#00426D]">
                <span className={`h-8 w-8 rounded-full flex items-center justify-center text-sm ${uploadComplete ? 'bg-green-600 text-white' : 'bg-[#00426D] text-white'}`}>
                  {uploadComplete ? <Check className="h-4 w-4" /> : "3"}
                </span>
                Upload Signed Copy
              </CardTitle>
            </CardHeader>
            <CardContent>
              {uploadComplete ? (
                <div className="flex items-center gap-3 text-green-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Signed document uploaded successfully!</span>
                </div>
              ) : (
                <>
                  <p className="text-slate-600 mb-4">
                    Scan or photograph the signed and stamped document, then upload it here to complete your application.
                  </p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleUpload}
                  />
                  <Button
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                    variant="outline"
                    className="border-[#00426D] text-[#00426D] hover:bg-[#00426D]/5"
                    data-testid="button-upload-signed"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Signed Document
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {uploadComplete && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-green-800">All Steps Completed!</h2>
                    <p className="text-green-700 mt-1">
                      Your application is now complete. Our team will review your submission and contact you shortly.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-center pt-4">
            <Button onClick={() => setLocation("/")} variant="outline">
              Return to Home
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
