import { useEffect, useState, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Save, Loader2, Plus, Trash2, ChevronDown, ChevronUp, Upload, Download, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";

interface SubCategory {
  id: string;
  categoryId: string;
  name: string;
}

interface CategoryWithSubs {
  id: string;
  name: string;
  subCategories: SubCategory[];
}

interface Term {
  id: number;
  type: string;
  text: string;
}

interface Deal {
  id?: string;
  category: string;
  subCategory: string;
  dealType: string;
  duration: string;
  redemption: string;
  limitPerUser?: string;
  originalPrice?: string;
  isMultipleItems?: boolean;
  discountPercentage?: string;
  discountedPrice?: string;
  isTwoTranches?: boolean;
  trancheValidity?: string;
  specificDays?: boolean;
  days?: string[];
  title: string;
  description?: string;
  claimRules?: string[];
  generalRules?: string[];
  otherRules?: string;
  branches?: string[];
  images?: string[];
}

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
  deals?: Deal[];
  salesOrder?: string;
  taxCardDocument?: string;
  crDocument?: string;
  establishmentCard?: string;
  tradeLicense?: string;
  menuPriceList?: string;
  logo?: string;
  coverImage?: string;
  whatsapp?: string;
  subscriptionFee?: string;
  transactionFee?: string;
  status: string;
}

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function MerchantEdit() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/merchants/:id/edit");
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedDeals, setExpandedDeals] = useState<number[]>([]);
  const [isUploadingSalesOrder, setIsUploadingSalesOrder] = useState(false);
  const salesOrderFileRef = useRef<HTMLInputElement>(null);
  const dealImageFileRef = useRef<HTMLInputElement>(null);
  const [activeDealImageIndex, setActiveDealImageIndex] = useState<number | null>(null);
  const documentFileRef = useRef<HTMLInputElement>(null);
  const [activeDocField, setActiveDocField] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    companyName: "",
    crNumber: "",
    brandName: "",
    address: "",
    contactPerson: "",
    email: "",
    phone: "",
    whatsapp: "",
    subscriptionFee: "",
    transactionFee: "",
    products: "",
    businessCategories: "",
    commencementDate: "",
    merchantSignatoryName: "",
  });

  const [deals, setDeals] = useState<Deal[]>([]);
  const [discountTypes, setDiscountTypes] = useState<Record<number, "percentage" | "discountedPrice">>({});
  const [categories, setCategories] = useState<CategoryWithSubs[]>([]);
  const [claimTerms, setClaimTerms] = useState<Term[]>([]);
  const [generalTerms, setGeneralTerms] = useState<Term[]>([]);

  useEffect(() => {
    fetchMerchant();
    fetchCategories();
    fetchTerms();
  }, [params?.id]);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) setCategories(await res.json());
    } catch {}
  };

  const fetchTerms = async () => {
    try {
      const [claimRes, generalRes] = await Promise.all([
        fetch("/api/terms/claim"),
        fetch("/api/terms/general"),
      ]);
      if (claimRes.ok) setClaimTerms(await claimRes.json());
      if (generalRes.ok) setGeneralTerms(await generalRes.json());
    } catch {}
  };

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
      setFormData({
        companyName: data.companyName || "",
        crNumber: data.crNumber || "",
        brandName: data.brandName || "",
        address: data.address || "",
        contactPerson: data.contactPerson || "",
        email: data.email || "",
        phone: data.phone || "",
        whatsapp: data.whatsapp || "",
        subscriptionFee: data.subscriptionFee || "",
        transactionFee: data.transactionFee || "",
        products: data.products?.join(", ") || "",
        businessCategories: data.businessCategories?.join(", ") || "",
        commencementDate: data.commencementDate || "",
        merchantSignatoryName: data.merchantSignatoryName || "",
      });
      
      // Load deals
      if (data.deals && Array.isArray(data.deals)) {
        const parsedDeals = data.deals.map((d: any) => {
          const deal = typeof d === 'string' ? JSON.parse(d) : d;
          return {
            id: deal.id,
            category: deal.category || "",
            subCategory: deal.subCategory || "",
            dealType: deal.dealType || "",
            duration: deal.duration || "",
            redemption: deal.redemption || "",
            limitPerUser: deal.limitPerUser || "",
            originalPrice: deal.originalPrice || "",
            isMultipleItems: deal.isMultipleItems || false,
            discountPercentage: deal.discountPercentage || "",
            discountedPrice: deal.discountedPrice || "",
            isTwoTranches: deal.isTwoTranches || false,
            trancheValidity: deal.trancheValidity || "",
            specificDays: deal.specificDays || false,
            days: deal.days || [],
            title: deal.title || "",
            description: deal.description || "",
            claimRules: deal.claimRules || [],
            generalRules: deal.generalRules || [],
            otherRules: deal.otherRules || "",
            branches: deal.branches || [],
            images: deal.images || [],
          };
        });
        setDeals(parsedDeals);
        const types: Record<number, "percentage" | "discountedPrice"> = {};
        parsedDeals.forEach((d: Deal, i: number) => {
          types[i] = d.discountedPrice ? "discountedPrice" : "percentage";
        });
        setDiscountTypes(types);
        setExpandedDeals(parsedDeals.map((_: any, i: number) => i));
      }
    } catch (error) {
      toast({ title: "Error loading merchant", variant: "destructive" });
      setLocation("/admin/merchants");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleDealChange = (index: number, field: keyof Deal, value: any) => {
    setDeals(prev => prev.map((deal, i) => 
      i === index ? { ...deal, [field]: value } : deal
    ));
  };

  const toggleDealExpanded = (index: number) => {
    setExpandedDeals(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
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

  const addNewDeal = () => {
    const newDeal: Deal = {
      category: "",
      subCategory: "",
      dealType: "",
      duration: "",
      redemption: "",
      title: "",
      description: "",
      claimRules: [],
      generalRules: [],
      branches: [],
      images: [],
    };
    setDeals(prev => [...prev, newDeal]);
    setDiscountTypes(prev => ({ ...prev, [deals.length]: "percentage" }));
    setExpandedDeals(prev => [...prev, deals.length]);
  };

  const removeDeal = (index: number) => {
    setDeals(prev => prev.filter((_, i) => i !== index));
    setExpandedDeals(prev => prev.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  const handleDealImageAdd = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setDeals(prev => prev.map((deal, i) => 
        i === index ? { ...deal, images: [...(deal.images || []), base64] } : deal
      ));
    };
    reader.readAsDataURL(file);
  };

  const handleDealImageRemove = (dealIndex: number, imageIndex: number) => {
    setDeals(prev => prev.map((deal, i) => 
      i === dealIndex ? { ...deal, images: (deal.images || []).filter((_, j) => j !== imageIndex) } : deal
    ));
  };

  const handleDocumentUpload = (field: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setMerchant(prev => prev ? { ...prev, [field]: reader.result as string } : prev);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!merchant) return;
    
    const dealsWithLowImages = deals.filter(d => (d.images || []).length < 4);
    if (dealsWithLowImages.length > 0) {
      toast({
        title: "Each deal requires at least 4 images",
        description: `${dealsWithLowImages.length} deal(s) have fewer than 4 images.`,
        variant: "destructive",
      });
      return;
    }
    
    setIsSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        ...formData,
        products: formData.products.split(",").map(p => p.trim()).filter(Boolean),
        businessCategories: formData.businessCategories.split(",").map(c => c.trim()).filter(Boolean),
        deals: deals,
        taxCardDocument: merchant.taxCardDocument || null,
        logo: merchant.logo || null,
        coverImage: merchant.coverImage || null,
      };
      if (merchant.crDocument) updateData.crDocument = merchant.crDocument;
      if (merchant.establishmentCard) updateData.establishmentCard = merchant.establishmentCard;
      if (merchant.tradeLicense) updateData.tradeLicense = merchant.tradeLicense;
      if (merchant.menuPriceList) updateData.menuPriceList = merchant.menuPriceList;
      
      const res = await fetch(`/api/merchants/${merchant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updateData),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to update merchant");
      }
      
      toast({ title: "Merchant updated successfully" });
      setLocation(`/admin/merchants/${merchant.id}`);
    } catch (error: any) {
      toast({ title: error.message || "Error updating merchant", variant: "destructive" });
    } finally {
      setIsSaving(false);
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
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setLocation(`/admin/merchants/${merchant.id}`)}
            className="text-slate-600"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Merchant
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#00426D] hover:bg-[#003152]"
            data-testid="button-save"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-[#00426D]">Company Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  data-testid="input-company-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="crNumber">CR Number</Label>
                <Input
                  id="crNumber"
                  name="crNumber"
                  value={formData.crNumber}
                  onChange={handleChange}
                  data-testid="input-cr-number"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="brandName">Brand Name</Label>
                <Input
                  id="brandName"
                  name="brandName"
                  value={formData.brandName}
                  onChange={handleChange}
                  data-testid="input-brand-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input
                  id="contactPerson"
                  name="contactPerson"
                  value={formData.contactPerson}
                  onChange={handleChange}
                  data-testid="input-contact-person"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  data-testid="input-email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  data-testid="input-phone"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp Number</Label>
                <Input
                  id="whatsapp"
                  name="whatsapp"
                  value={formData.whatsapp}
                  onChange={handleChange}
                  placeholder="WhatsApp number"
                  data-testid="input-whatsapp"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={2}
                data-testid="input-address"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subscriptionFee">Subscription Fee (QAR)</Label>
                <Input
                  id="subscriptionFee"
                  name="subscriptionFee"
                  type="number"
                  step="0.01"
                  value={formData.subscriptionFee}
                  onChange={handleChange}
                  placeholder="e.g., 99.99"
                  data-testid="input-subscription-fee"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transactionFee">Transaction Fee (QAR)</Label>
                <Input
                  id="transactionFee"
                  name="transactionFee"
                  type="number"
                  step="0.01"
                  value={formData.transactionFee}
                  onChange={handleChange}
                  placeholder="e.g., 2.50"
                  data-testid="input-transaction-fee"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="products">Products (comma-separated)</Label>
              <Input
                id="products"
                name="products"
                value={formData.products}
                onChange={handleChange}
                placeholder="e.g. Food, Beverages, Retail"
                data-testid="input-products"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="businessCategories">Business Categories (comma-separated)</Label>
              <Input
                id="businessCategories"
                name="businessCategories"
                value={formData.businessCategories}
                onChange={handleChange}
                placeholder="e.g. Restaurant, Cafe, Retail Store"
                data-testid="input-categories"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="commencementDate">Commencement Date</Label>
                <Input
                  id="commencementDate"
                  name="commencementDate"
                  type="date"
                  value={formData.commencementDate}
                  onChange={handleChange}
                  data-testid="input-commencement-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="merchantSignatoryName">Authorized Signatory Name</Label>
                <Input
                  id="merchantSignatoryName"
                  name="merchantSignatoryName"
                  value={formData.merchantSignatoryName}
                  onChange={handleChange}
                  placeholder="Name of authorized signatory"
                  data-testid="input-signatory-name"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales Order Section */}
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
              data-testid="input-sales-order-file"
            />
            <input
              type="file"
              ref={dealImageFileRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && activeDealImageIndex !== null) handleDealImageAdd(activeDealImageIndex, file);
                e.target.value = "";
              }}
              data-testid="input-deal-image-file"
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
                      data-testid="link-sales-order"
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
                    data-testid="button-download-sales-order"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => salesOrderFileRef.current?.click()}
                    disabled={isUploadingSalesOrder}
                    data-testid="button-replace-sales-order"
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Replace
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveSalesOrder}
                    className="text-red-600 hover:text-red-700"
                    data-testid="button-remove-sales-order"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg">
                <FileText className="h-8 w-8 text-slate-400 mb-2" />
                <p className="text-sm text-slate-500 mb-3">No sales order attached</p>
                <Button
                  variant="outline"
                  onClick={() => salesOrderFileRef.current?.click()}
                  disabled={isUploadingSalesOrder}
                  data-testid="button-upload-sales-order"
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
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documents Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[#00426D]">Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              ref={documentFileRef}
              accept="image/*,.pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && activeDocField) handleDocumentUpload(activeDocField, file);
                e.target.value = "";
              }}
              data-testid="input-document-file"
            />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "CR Document", field: "crDocument", required: true },
                { label: "Establishment Card", field: "establishmentCard", required: true },
                { label: "Trade License", field: "tradeLicense", required: true },
                { label: "Menu/Price List", field: "menuPriceList", required: true },
                { label: "Tax Card", field: "taxCardDocument", required: false },
                { label: "Logo", field: "logo", required: false },
                { label: "Cover Image", field: "coverImage", required: false },
              ].map((doc) => {
                const value = merchant[doc.field as keyof Merchant] as string | undefined;
                const isUploaded = !!value;
                return (
                  <div key={doc.field} className={`p-4 border rounded-lg text-center ${doc.required && !isUploaded ? 'border-red-200 bg-red-50/50' : ''}`}>
                    <FileText className={`h-8 w-8 mx-auto mb-2 ${isUploaded ? 'text-green-500' : doc.required ? 'text-red-400' : 'text-slate-400'}`} />
                    <p className="text-sm font-medium mb-1">
                      {doc.label}
                      {doc.required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                    {isUploaded ? (
                      <div className="space-y-1">
                        {!value?.startsWith('data:') && (
                          <a href={value} target="_blank" rel="noopener noreferrer" className="text-[#00426D] hover:underline text-xs block">View</a>
                        )}
                        <button
                          type="button"
                          className="text-xs text-blue-600 hover:underline"
                          onClick={() => { setActiveDocField(doc.field); documentFileRef.current?.click(); }}
                        >
                          Replace
                        </button>
                        {!doc.required && (
                          <button
                            type="button"
                            className="text-xs text-red-500 hover:underline"
                            onClick={() => setMerchant(prev => prev ? { ...prev, [doc.field]: undefined } : prev)}
                            data-testid={`button-remove-${doc.field}`}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => { setActiveDocField(doc.field); documentFileRef.current?.click(); }}
                      >
                        Upload
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Deals Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[#00426D] flex items-center justify-between">
              <span>Deals ({deals.length})</span>
              <Button
                variant="outline"
                size="sm"
                onClick={addNewDeal}
                data-testid="button-add-deal"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Deal
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {deals.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No deals submitted with this application.</p>
            ) : (
              deals.map((deal, index) => (
                <div key={index} className="border rounded-lg overflow-hidden">
                  <div 
                    className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer"
                    onClick={() => toggleDealExpanded(index)}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-white">Deal {index + 1}</Badge>
                      <span className="font-medium">{deal.title || "Untitled Deal"}</span>
                      <span className="text-sm text-slate-500">{deal.category}</span>
                      {(deal.images || []).length < 4 && (
                        <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-xs">
                          {(deal.images || []).length}/4 images
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); removeDeal(index); }}
                        data-testid={`button-remove-deal-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {expandedDeals.includes(index) ? (
                        <ChevronUp className="h-5 w-5 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-500" />
                      )}
                    </div>
                  </div>
                  
                  {expandedDeals.includes(index) && (
                    <div className="p-4 space-y-4 border-t">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Title</Label>
                          <Input
                            value={deal.title}
                            onChange={(e) => handleDealChange(index, "title", e.target.value)}
                            data-testid={`input-deal-title-${index}`}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Category</Label>
                          <Select
                            value={deal.category}
                            onValueChange={(value) => {
                              handleDealChange(index, "category", value);
                              handleDealChange(index, "subCategory", "");
                            }}
                          >
                            <SelectTrigger data-testid={`select-deal-category-${index}`}>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Sub-Category</Label>
                          <Select
                            value={deal.subCategory}
                            onValueChange={(value) => handleDealChange(index, "subCategory", value)}
                            disabled={!deal.category}
                          >
                            <SelectTrigger data-testid={`select-deal-subcategory-${index}`}>
                              <SelectValue placeholder="Select sub-category" />
                            </SelectTrigger>
                            <SelectContent>
                              {(categories.find(c => c.name === deal.category)?.subCategories || []).map((sub) => (
                                <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Deal Type</Label>
                          <Select
                            value={deal.dealType}
                            onValueChange={(value) => handleDealChange(index, "dealType", value)}
                          >
                            <SelectTrigger data-testid={`select-deal-type-${index}`}>
                              <SelectValue placeholder="Select deal type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bogo">Buy 1 Get 1</SelectItem>
                              <SelectItem value="discount">Discount</SelectItem>
                              <SelectItem value="voucher">Voucher</SelectItem>
                              <SelectItem value="bundle">Bundle</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Duration</Label>
                          <Input
                            value={deal.duration}
                            onChange={(e) => handleDealChange(index, "duration", e.target.value)}
                            placeholder="e.g., 3 months, 6 weeks"
                            data-testid={`input-deal-duration-${index}`}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Redemption</Label>
                          <Select
                            value={deal.redemption}
                            onValueChange={(value) => handleDealChange(index, "redemption", value)}
                          >
                            <SelectTrigger data-testid={`select-deal-redemption-${index}`}>
                              <SelectValue placeholder="Select redemption type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unlimited">Unlimited</SelectItem>
                              <SelectItem value="limited">Limited</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {deal.redemption === "limited" && (
                          <div className="space-y-2">
                            <Label>Limit Per User</Label>
                            <Input
                              value={deal.limitPerUser || ""}
                              onChange={(e) => handleDealChange(index, "limitPerUser", e.target.value)}
                              data-testid={`input-deal-limit-${index}`}
                            />
                          </div>
                        )}
                        
                        {!deal.isMultipleItems && (
                          <div className="space-y-2">
                            <Label>{deal.dealType === "voucher" ? "Voucher Amount (QAR)" : "Original Price (QAR)"}</Label>
                            <Input
                              value={deal.originalPrice || ""}
                              onChange={(e) => handleDealChange(index, "originalPrice", e.target.value)}
                              data-testid={`input-deal-price-${index}`}
                            />
                          </div>
                        )}
                        
                        {deal.dealType === "discount" && !deal.isMultipleItems && (
                          <>
                            <div className="space-y-2">
                              <Label>Discount Type</Label>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant={(discountTypes[index] || "percentage") === "percentage" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => {
                                    setDiscountTypes(prev => ({ ...prev, [index]: "percentage" }));
                                    handleDealChange(index, "discountedPrice", "");
                                  }}
                                  data-testid={`button-discount-type-percentage-${index}`}
                                >
                                  Percentage
                                </Button>
                                <Button
                                  type="button"
                                  variant={(discountTypes[index] || "percentage") === "discountedPrice" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => {
                                    setDiscountTypes(prev => ({ ...prev, [index]: "discountedPrice" }));
                                    handleDealChange(index, "discountPercentage", "");
                                  }}
                                  data-testid={`button-discount-type-price-${index}`}
                                >
                                  Discounted Price
                                </Button>
                              </div>
                            </div>
                            
                            {(discountTypes[index] || "percentage") === "percentage" ? (
                              <div className="space-y-2">
                                <Label>Discount Percentage</Label>
                                <Input
                                  value={deal.discountPercentage || ""}
                                  onChange={(e) => handleDealChange(index, "discountPercentage", e.target.value)}
                                  placeholder="e.g., 20"
                                  data-testid={`input-deal-discount-${index}`}
                                />
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Label>Discounted Price (QAR)</Label>
                                <Input
                                  value={deal.discountedPrice || ""}
                                  onChange={(e) => handleDealChange(index, "discountedPrice", e.target.value)}
                                  placeholder="e.g., 49.99"
                                  data-testid={`input-deal-discounted-price-${index}`}
                                />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={deal.description || ""}
                          onChange={(e) => handleDealChange(index, "description", e.target.value)}
                          rows={2}
                          data-testid={`input-deal-description-${index}`}
                        />
                      </div>

                      {deal.dealType === "bogo" && (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`twoTranches-${index}`}
                            checked={deal.isTwoTranches || false}
                            onCheckedChange={(checked) => handleDealChange(index, "isTwoTranches", checked)}
                          />
                          <Label htmlFor={`twoTranches-${index}`}>Two Tranches</Label>
                        </div>
                      )}

                      {(deal.dealType === "discount" || deal.dealType === "bogo") && (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`multipleItems-${index}`}
                            checked={deal.isMultipleItems || false}
                            onCheckedChange={(checked) => handleDealChange(index, "isMultipleItems", checked)}
                          />
                          <Label htmlFor={`multipleItems-${index}`}>Multiple Items</Label>
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`specificDays-${index}`}
                          checked={deal.specificDays || false}
                          onCheckedChange={(checked) => handleDealChange(index, "specificDays", checked)}
                        />
                        <Label htmlFor={`specificDays-${index}`}>Specific Days Only</Label>
                      </div>
                      
                      {deal.isTwoTranches && deal.dealType === "bogo" && (
                        <div className="space-y-2">
                          <Label>Tranche Validity (weeks)</Label>
                          <Input
                            value={deal.trancheValidity || ""}
                            onChange={(e) => handleDealChange(index, "trancheValidity", e.target.value)}
                            data-testid={`input-deal-tranche-${index}`}
                          />
                        </div>
                      )}
                      
                      {deal.specificDays && (
                        <div className="space-y-2">
                          <Label>Valid Days</Label>
                          <div className="flex gap-2 mb-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleDealChange(index, "days", ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"])}
                              data-testid={`button-weekdays-edit-${index}`}
                            >
                              Weekdays
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleDealChange(index, "days", ["Friday", "Saturday"])}
                              data-testid={`button-weekends-edit-${index}`}
                            >
                              Weekends
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {daysOfWeek.map((day) => (
                              <div key={day} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`day-${index}-${day}`}
                                  checked={deal.days?.includes(day) || false}
                                  onCheckedChange={(checked) => {
                                    const newDays = checked 
                                      ? [...(deal.days || []), day]
                                      : (deal.days || []).filter(d => d !== day);
                                    handleDealChange(index, "days", newDays);
                                  }}
                                />
                                <Label htmlFor={`day-${index}-${day}`} className="text-sm">{day}</Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label>Claim Rules</Label>
                        <div className="space-y-2 mt-1">
                          {claimTerms.map((term) => {
                            const currentRules = deal.claimRules || [];
                            const isSelected = currentRules.includes(term.text);
                            return (
                              <label
                                key={term.id}
                                className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-slate-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const updated = e.target.checked
                                      ? [...currentRules, term.text]
                                      : currentRules.filter((v: string) => v !== term.text);
                                    handleDealChange(index, "claimRules", updated);
                                  }}
                                  className="h-4 w-4 accent-[#00426D]"
                                />
                                <span className="text-sm" dangerouslySetInnerHTML={{ __html: term.text }} />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>General Rules</Label>
                        <div className="space-y-2 mt-1">
                          {generalTerms.map((term) => {
                            const currentRules = deal.generalRules || [];
                            const isSelected = currentRules.includes(term.text);
                            return (
                              <label
                                key={term.id}
                                className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-slate-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const updated = e.target.checked
                                      ? [...currentRules, term.text]
                                      : currentRules.filter((v: string) => v !== term.text);
                                    handleDealChange(index, "generalRules", updated);
                                  }}
                                  className="h-4 w-4 accent-[#00426D]"
                                />
                                <span className="text-sm" dangerouslySetInnerHTML={{ __html: term.text }} />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Other Rules</Label>
                        <Textarea
                          value={deal.otherRules || ""}
                          onChange={(e) => handleDealChange(index, "otherRules", e.target.value)}
                          rows={2}
                          data-testid={`input-deal-other-rules-${index}`}
                        />
                      </div>
                      
                      {deal.branches && deal.branches.length > 0 && (
                        <div className="space-y-2">
                          <Label>Applicable Branches</Label>
                          <div className="flex flex-wrap gap-1">
                            {deal.branches.map((branch, i) => (
                              <Badge key={i} variant="secondary">{branch}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Deal Images ({(deal.images || []).length}/4 minimum)</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setActiveDealImageIndex(index);
                              dealImageFileRef.current?.click();
                            }}
                            data-testid={`button-add-deal-image-${index}`}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Image
                          </Button>
                        </div>
                        {(deal.images || []).length < 4 && (
                          <p className="text-xs text-red-500">At least 4 images required for moderation</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {(deal.images || []).map((img, i) => (
                            <div key={i} className="relative group">
                              <img
                                src={img}
                                alt={`Deal image ${i + 1}`}
                                className="h-20 w-20 object-cover rounded border"
                              />
                              <button
                                type="button"
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDealImageRemove(index, i)}
                                data-testid={`button-remove-deal-image-${index}-${i}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
