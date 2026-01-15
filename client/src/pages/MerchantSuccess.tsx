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
  deals: string[];
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
      const response = await fetch(`/api/merchants/${merchantId}`);
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
    const margin = 20;
    let y = 20;

    const addLine = (text: string, fontSize = 10, bold = false) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
      lines.forEach((line: string) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += fontSize * 0.4 + 2;
      });
    };

    const addSection = (title: string) => {
      y += 5;
      addLine(title, 12, true);
      y += 2;
    };

    doc.setTextColor(0, 66, 109);
    addLine("QATAR LIVING DEALS", 18, true);
    addLine("MERCHANT PARTNERSHIP AGREEMENT", 14, true);
    doc.setTextColor(0, 0, 0);
    y += 10;

    addSection("Company Information");
    addLine(`Company Name: ${merchant.companyName}`);
    addLine(`CR Number: ${merchant.crNumber}`);
    addLine(`Brand Name: ${merchant.brandName}`);
    addLine(`Address: ${merchant.address}`);
    addLine(`Contact Person: ${merchant.contactPerson}`);
    addLine(`Email: ${merchant.email}`);
    addLine(`Phone: ${merchant.phone}`);

    if (merchant.products?.length > 0) {
      addLine(`Products/Services: ${merchant.products.join(", ")}`);
    }

    if (merchant.businessCategories?.length > 0) {
      addLine(`Business Categories: ${merchant.businessCategories.join(", ")}`);
    }

    if (merchant.branches?.length > 0) {
      addSection("Branch Locations");
      merchant.branches.forEach((branchStr, index) => {
        try {
          const branch = JSON.parse(branchStr);
          addLine(`Branch ${index + 1}: ${branch.name}`);
          if (branch.location) addLine(`  Location: ${branch.location}`);
          if (branch.phone) addLine(`  Phone: ${branch.phone}`);
          if (branch.detail) addLine(`  Details: ${branch.detail}`);
        } catch {
          addLine(`Branch ${index + 1}: ${branchStr}`);
        }
      });
    }

    if (merchant.deals?.length > 0) {
      addSection("Deal Offers");
      merchant.deals.forEach((dealStr, index) => {
        try {
          const deal = JSON.parse(dealStr);
          addLine(`Deal ${index + 1}: ${deal.title || "Untitled"}`);
          if (deal.category) addLine(`  Category: ${deal.category}`);
          if (deal.dealType) addLine(`  Type: ${deal.dealType}`);
          if (deal.startDate && deal.endDate) {
            addLine(`  Validity: ${deal.startDate} to ${deal.endDate}`);
          }
          if (deal.description) addLine(`  Description: ${deal.description}`);
          if (deal.originalPrice) addLine(`  Original Price: QAR ${deal.originalPrice}`);
          if (deal.discountPercentage) addLine(`  Discount: ${deal.discountPercentage}%`);
          if (deal.claimRules?.length > 0) {
            addLine(`  Claim Rules: ${deal.claimRules.join("; ")}`);
          }
          if (deal.generalRules?.length > 0) {
            addLine(`  General Rules: ${deal.generalRules.join("; ")}`);
          }
          if (deal.otherRules) addLine(`  Other Rules: ${deal.otherRules}`);
        } catch {
          addLine(`Deal ${index + 1}: ${dealStr}`);
        }
      });
    }

    y += 20;
    addSection("Authorization & Signature");
    
    addLine("I, the undersigned, hereby confirm that all information provided in this application is true and accurate.");
    addLine("I agree to the terms and conditions of the Qatar Living Deals Merchant Partnership Program.");
    y += 10;

    if (merchant.merchantSignatoryName) {
      addLine(`Authorized Signatory Name: ${merchant.merchantSignatoryName}`);
    } else {
      addLine("Authorized Signatory Name: _______________________________");
    }
    y += 5;

    if (merchant.merchantSignDate) {
      const date = new Date(merchant.merchantSignDate).toLocaleDateString();
      addLine(`Date: ${date}`);
    } else {
      addLine("Date: _______________________________");
    }
    y += 5;

    addLine("Signature:");
    y += 3;

    if (merchant.merchantSignature) {
      try {
        doc.addImage(merchant.merchantSignature, "PNG", margin, y, 60, 25);
        y += 30;
      } catch {
        doc.rect(margin, y, 80, 30);
        y += 35;
      }
    } else {
      doc.rect(margin, y, 80, 30);
      y += 35;
    }

    y += 10;
    addLine("Company Stamp:");
    doc.rect(margin, y, 50, 50);
    y += 55;

    y += 10;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Qatar Living Deals - Merchant Partnership Agreement", margin, y);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y + 5);

    doc.save(`Qatar_Living_Merchant_Agreement_${merchant.companyName.replace(/\s+/g, '_')}.pdf`);
    
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
