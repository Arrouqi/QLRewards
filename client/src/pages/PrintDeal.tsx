import { useEffect, useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import type { Deal } from "@shared/schema";
import { format } from "date-fns";
import { FileDown, ArrowLeft, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function PrintDeal() {
  const [, params] = useRoute("/admin/deals/:id/print");
  const [, setLocation] = useLocation();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDeal();
  }, [params?.id]);

  const fetchDeal = async () => {
    try {
      const authResponse = await fetch("/api/auth/session");
      if (!authResponse.ok) {
        setLocation("/admin/login");
        return;
      }

      if (!params?.id) return;

      const dealResponse = await fetch(`/api/deals/${params.id}`);
      if (!dealResponse.ok) {
        throw new Error("Deal not found");
      }

      const data = await dealResponse.json();
      setDeal(data);
    } catch (error) {
      console.error("Failed to fetch deal:", error);
      setLocation("/admin/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!contentRef.current || !deal) return;
    
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = pdfWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;
      
      if (scaledHeight <= pdfHeight) {
        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, scaledHeight);
      } else {
        let yPosition = 0;
        let page = 0;
        const pageHeightInCanvas = pdfHeight / ratio;
        
        while (yPosition < imgHeight) {
          if (page > 0) {
            pdf.addPage();
          }
          
          const remainingHeight = imgHeight - yPosition;
          const sliceHeight = Math.min(pageHeightInCanvas, remainingHeight);
          
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = imgWidth;
          tempCanvas.height = sliceHeight;
          const ctx = tempCanvas.getContext("2d");
          
          if (ctx) {
            ctx.drawImage(
              canvas,
              0, yPosition, imgWidth, sliceHeight,
              0, 0, imgWidth, sliceHeight
            );
            const pageData = tempCanvas.toDataURL("image/png");
            pdf.addImage(pageData, "PNG", 0, 0, pdfWidth, sliceHeight * ratio);
          }
          
          yPosition += pageHeightInCanvas;
          page++;
        }
      }
      
      const filename = `deal-${deal.title.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}-${deal.id.slice(0, 8)}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!deal) {
    return null;
  }

  const getDealTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      bogo: "Buy 1 Get 1",
      discount: "Discount",
      voucher: "Voucher",
      bundle: "Bundle",
    };
    return types[type] || type;
  };

  const getDurationLabel = (duration: string) => {
    const durations: Record<string, string> = {
      monthly: "Monthly Deal",
      yearly: "Yearly Deal",
    };
    return durations[duration] || duration;
  };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      
      <div className="no-print fixed top-4 left-4 right-4 z-50 flex justify-between">
        <Button 
          variant="outline"
          onClick={() => setLocation(`/admin/deals/${params?.id}`)} 
          className="flex items-center gap-2 bg-white"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={handlePrint}
            className="flex items-center gap-2 bg-white"
            data-testid="button-print"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button 
            onClick={handleDownloadPDF}
            disabled={isGenerating}
            className="bg-[#00426D] hover:bg-[#003152] flex items-center gap-2"
            data-testid="button-download-pdf"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Download PDF
              </>
            )}
          </Button>
        </div>
      </div>

      <div ref={contentRef} className="min-h-screen bg-white p-8 max-w-4xl mx-auto mt-16">
        <header className="border-b-4 border-[#00426D] pb-6 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-[#00426D]">Qatar Living Deals</h1>
              <p className="text-gray-600 mt-1">Offer Details</p>
            </div>
            <div className="text-right text-sm text-gray-600">
              <p>Generated: {format(new Date(), "MMMM d, yyyy")}</p>
              <p className="font-mono text-xs mt-1">ID: {deal.id}</p>
            </div>
          </div>
        </header>

        <section className="mb-8">
          <div className="bg-[#00426D] text-white px-6 py-4 rounded-t-lg">
            <h2 className="text-2xl font-bold" data-testid="print-title">{deal.title}</h2>
          </div>
          <div className="border-2 border-t-0 border-[#00426D] rounded-b-lg p-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500 uppercase font-semibold">Category</p>
                <p className="text-lg font-medium" data-testid="print-category">{deal.category}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 uppercase font-semibold">Sub-Category</p>
                <p className="text-lg font-medium" data-testid="print-subcategory">{deal.subCategory}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 uppercase font-semibold">Deal Type</p>
                <p className="text-lg font-medium" data-testid="print-deal-type">{getDealTypeLabel(deal.dealType)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 uppercase font-semibold">Duration</p>
                <p className="text-lg font-medium" data-testid="print-duration">{getDurationLabel(deal.duration)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 uppercase font-semibold">Original Price</p>
                <p className="text-lg font-medium" data-testid="print-price">QAR {deal.originalPrice}</p>
              </div>
              {deal.discountPercentage && (
                <div>
                  <p className="text-sm text-gray-500 uppercase font-semibold">Discount</p>
                  <p className="text-lg font-medium text-green-600" data-testid="print-discount">{deal.discountPercentage}% OFF</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500 uppercase font-semibold">Redemption</p>
                <p className="text-lg font-medium capitalize" data-testid="print-redemption">{deal.redemption}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 uppercase font-semibold">Status</p>
                <p className={`text-lg font-medium ${deal.status === 'approved' ? 'text-green-600' : deal.status === 'pending' ? 'text-yellow-600' : 'text-gray-600'}`} data-testid="print-status">
                  {deal.status === 'approved' ? 'Sent to Moderation' : deal.status.charAt(0).toUpperCase() + deal.status.slice(1)}
                </p>
              </div>
            </div>
          </div>
        </section>

        {(deal.merchantName || deal.merchantEmail || deal.merchantPhone) && (
          <section className="mb-8">
            <h3 className="text-lg font-bold text-[#00426D] mb-4 border-b pb-2">Merchant Details</h3>
            <div className="grid grid-cols-3 gap-6">
              {deal.merchantName && (
                <div>
                  <p className="text-sm text-gray-500 uppercase font-semibold">Name</p>
                  <p className="text-lg font-medium" data-testid="print-merchant-name">{deal.merchantName}</p>
                </div>
              )}
              {deal.merchantEmail && (
                <div>
                  <p className="text-sm text-gray-500 uppercase font-semibold">Email</p>
                  <p className="text-lg font-medium" data-testid="print-merchant-email">{deal.merchantEmail}</p>
                </div>
              )}
              {deal.merchantPhone && (
                <div>
                  <p className="text-sm text-gray-500 uppercase font-semibold">Phone</p>
                  <p className="text-lg font-medium" data-testid="print-merchant-phone">{deal.merchantPhone}</p>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="mb-8">
          <h3 className="text-lg font-bold text-[#00426D] mb-4 border-b pb-2">Description</h3>
          <p className="text-gray-700 leading-relaxed" data-testid="print-description">{deal.description}</p>
        </section>

        {deal.branches && deal.branches.length > 0 && (
          <section className="mb-8">
            <h3 className="text-lg font-bold text-[#00426D] mb-4 border-b pb-2">Branches</h3>
            <ul className="list-disc list-inside space-y-1" data-testid="print-branches">
              {deal.branches.map((branch, index) => (
                <li key={index} className="text-gray-700">{branch}</li>
              ))}
            </ul>
          </section>
        )}

        {deal.claimRules && deal.claimRules.length > 0 && (
          <section className="mb-8">
            <h3 className="text-lg font-bold text-[#00426D] mb-4 border-b pb-2">Claim Rules</h3>
            <ul className="list-disc list-inside space-y-1" data-testid="print-claim-rules">
              {deal.claimRules.map((rule, index) => (
                <li key={index} className="text-gray-700">{rule}</li>
              ))}
            </ul>
          </section>
        )}

        {deal.generalRules && deal.generalRules.length > 0 && (
          <section className="mb-8">
            <h3 className="text-lg font-bold text-[#00426D] mb-4 border-b pb-2">General Rules</h3>
            <ul className="list-disc list-inside space-y-1" data-testid="print-general-rules">
              {deal.generalRules.map((rule, index) => (
                <li key={index} className="text-gray-700">{rule}</li>
              ))}
            </ul>
          </section>
        )}

        {deal.otherRules && (
          <section className="mb-8">
            <h3 className="text-lg font-bold text-[#00426D] mb-4 border-b pb-2">Other Rules</h3>
            <p className="text-gray-700" data-testid="print-other-rules">{deal.otherRules}</p>
          </section>
        )}

        {(deal.adminComment || deal.assignedTo) && (
          <section className="mb-8 bg-gray-100 p-6 rounded-lg">
            <h3 className="text-lg font-bold text-[#00426D] mb-4 border-b border-gray-300 pb-2">Admin Notes</h3>
            {deal.assignedTo && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 uppercase font-semibold">Assigned To</p>
                <p className="text-lg font-medium" data-testid="print-assigned-to">{deal.assignedTo}</p>
              </div>
            )}
            {deal.adminComment && (
              <div>
                <p className="text-sm text-gray-500 uppercase font-semibold">Comment</p>
                <p className="text-gray-700" data-testid="print-admin-comment">{deal.adminComment}</p>
              </div>
            )}
          </section>
        )}

        <footer className="border-t-2 border-gray-300 pt-6 mt-8 text-center text-sm text-gray-500">
          <p>Created: {format(new Date(deal.createdAt), "MMMM d, yyyy 'at' h:mm a")}</p>
          <p className="mt-2">Qatar Living Deals - Merchant Portal</p>
        </footer>
      </div>
    </>
  );
}
