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
  brandId?: string | null;
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
  const [brandsOpen, setBrandsOpen] = useState(true);
  const [branchesOpen, setBranchesOpen] = useState(true);
  const [dealsOpen, setDealsOpen] = useState(true);
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
  const [brands, setBrands] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [activeBrandDoc, setActiveBrandDoc] = useState<{ idx: number; field: string } | null>(null);
  const brandDocFileRef = useRef<HTMLInputElement>(null);
  const [companyType, setCompanyType] = useState<"individual" | "group">("individual");
  const isGroup = companyType === "group";
  const dealCap = isGroup ? 200 : 50;
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
      const sessionData = await authResponse.json();
      const userRole = sessionData.role || "user";

      const res = await fetch(`/api/merchants/${params.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch merchant");
      const data = await res.json();

      if ((userRole === "sales" && data.status !== "pending") || (userRole === "moderation" && data.status === "pending")) {
        toast({ title: "Access Denied", description: "You don't have permission to edit this merchant", variant: "destructive" });
        setLocation(`/admin/merchants/${params.id}`);
        return;
      }

      setMerchant(data);
      setCompanyType(data.companyType === "group" ? "group" : "individual");
      setBrands(Array.isArray(data.brands) ? data.brands : []);
      const parsedBranches = Array.isArray(data.branches)
        ? data.branches.map((b: any) => {
            try { return typeof b === "string" ? JSON.parse(b) : b; } catch { return { name: String(b), location: "", phone: "", detail: "" }; }
          })
        : [];
      setBranches(parsedBranches);
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
            brandId: deal.brandId ?? null,
          };
        });
        setDeals(parsedDeals);
        const types: Record<number, "percentage" | "discountedPrice"> = {};
        parsedDeals.forEach((d: Deal, i: number) => {
          types[i] = d.discountedPrice ? "discountedPrice" : "percentage";
        });
        setDiscountTypes(types);
        // Default existing deals collapsed so the form isn't overwhelming
        setExpandedDeals([]);
      }
      // Default Brands & Branches collapsed when there's existing data
      const hasBrands = Array.isArray(data.brands) && data.brands.length > 0;
      const hasBranches = Array.isArray(data.branches) && data.branches.length > 0;
      setBrandsOpen(!hasBrands);
      setBranchesOpen(!hasBranches);
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

  const handleBrandDocUpload = (idx: number, field: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setBrands(prev => prev.map((b, i) => i === idx ? { ...b, [field]: dataUrl } : b));
    };
    reader.readAsDataURL(file);
  };

  const updateBranch = (idx: number, patch: Record<string, any>) => {
    setBranches(prev => prev.map((b, i) => i === idx ? { ...b, ...patch } : b));
  };

  const handleSave = async () => {
    if (!merchant) return;

    const validationErrors: string[] = [];
    if (!formData.companyName.trim()) validationErrors.push("Company name is required");
    if (!isGroup) {
      if (!formData.crNumber.trim()) validationErrors.push("CR number is required");
      if (formData.crNumber && !/^[a-zA-Z0-9]{4,14}$/.test(formData.crNumber)) validationErrors.push("CR number must be 4-14 alphanumeric characters");
      if (!formData.brandName.trim()) validationErrors.push("Brand name is required");
    } else {
      if (brands.length === 0) validationErrors.push("Group merchants must have at least one brand");
      if (brands.length > 50) validationErrors.push("Maximum 50 brands per group");
    }
    if (!formData.contactPerson.trim()) validationErrors.push("Contact person is required");
    if (!formData.email.trim()) validationErrors.push("Email is required");
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) validationErrors.push("Invalid email format");
    if (!formData.phone.trim()) validationErrors.push("Phone is required");

    if (validationErrors.length > 0) {
      toast({
        title: "Please fix the following errors",
        description: validationErrors.join(". "),
        variant: "destructive",
      });
      return;
    }
    
    const dealsWithLowImages = deals.filter(d => (d.images || []).length < 4);
    if (dealsWithLowImages.length > 0) {
      toast({
        title: "Each deal requires at least 4 images",
        description: `${dealsWithLowImages.length} deal(s) have fewer than 4 images.`,
        variant: "destructive",
      });
      return;
    }
    if (deals.length > dealCap) {
      toast({ title: `Maximum ${dealCap} deals exceeded`, variant: "destructive" });
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
      if (isGroup) {
        updateData.brands = brands.map((b) => ({
          ...b,
          businessCategories: Array.isArray(b.businessCategories)
            ? b.businessCategories
            : (typeof b.businessCategories === "string" && b.businessCategories
                ? b.businessCategories.split(",").map((c: string) => c.trim()).filter(Boolean)
                : []),
        }));
      }
      updateData.branches = branches.map((b) => JSON.stringify(b));
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
        <div className="sticky top-0 z-30 -mx-4 px-4 py-3 bg-white/95 backdrop-blur border-b border-slate-200 flex items-center justify-between shadow-sm">
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

        <Card className="border-[#00426D]/20 bg-[#00426D]/5">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Company Type</p>
              <p className="text-base font-semibold text-[#00426D]" data-testid="text-company-type">
                {isGroup ? "Group (multiple brands)" : "Individual (single brand)"}
              </p>
            </div>
            <span className="text-xs text-slate-500 italic">Type cannot be changed after submission</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[#00426D]">{isGroup ? "Group Information" : "Company Information"}</CardTitle>
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
              
              {!isGroup && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="crNumber">CR Number</Label>
                    <Input
                      id="crNumber"
                      name="crNumber"
                      value={formData.crNumber}
                      onChange={handleChange}
                      placeholder="e.g. 123456 or ABC1234"
                      maxLength={14}
                      data-testid="input-cr-number"
                    />
                    {formData.crNumber && !/^[a-zA-Z0-9]{4,14}$/.test(formData.crNumber) && (
                      <p className="text-sm text-red-500">CR number must be 4-14 alphanumeric characters</p>
                    )}
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
                </>
              )}
              
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

            {!isGroup && (
              <>
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
              </>
            )}

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

        {/* Documents Section - individual only (group docs live per-brand) */}
        {!isGroup && (
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
        )}

        {/* Brands - Group only */}
        {isGroup && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <button
                type="button"
                className="flex items-center gap-2 text-left"
                onClick={() => setBrandsOpen((v) => !v)}
                data-testid="toggle-brands"
              >
                {brandsOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                <CardTitle className="text-[#00426D]">Brands ({brands.length}/50)</CardTitle>
              </button>
              <Button
                variant="outline"
                size="sm"
                disabled={brands.length >= 50}
                onClick={() => { setBrandsOpen(true); setBrands([...brands, {
                  brandName: "", address: "", contactPerson: "", email: "", phone: "", whatsapp: "",
                  crNumber: "", crDocument: null, establishmentCard: null, tradeLicense: null,
                  taxCardDocument: null, menuPriceList: null, logo: null, coverImage: null,
                  businessCategories: [],
                }]); }}
                data-testid="button-add-brand"
              >
                <Plus className="h-4 w-4 mr-1" /> Add Brand
              </Button>
            </CardHeader>
            {brandsOpen && (
            <CardContent className="space-y-4">
              {brands.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-4">No brands. Add at least one.</p>
              )}
              {brands.map((b, idx) => (
                <div key={idx} className="p-4 border-2 border-[#00426D]/15 rounded-lg space-y-3 bg-slate-50/40" data-testid={`brand-edit-${idx}`}>
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-[#00426D]">Brand {idx + 1}</h4>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500"
                      onClick={() => setBrands(brands.filter((_, i) => i !== idx))}
                      data-testid={`button-remove-brand-${idx}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Brand Name</Label>
                      <Input value={b.brandName || ""} onChange={(e) => setBrands(brands.map((x, i) => i === idx ? { ...x, brandName: e.target.value } : x))} data-testid={`input-brand-${idx}-name`} />
                    </div>
                    <div className="space-y-1">
                      <Label>CR Number</Label>
                      <Input value={b.crNumber || ""} onChange={(e) => setBrands(brands.map((x, i) => i === idx ? { ...x, crNumber: e.target.value } : x))} maxLength={14} data-testid={`input-brand-${idx}-cr`} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label>Address</Label>
                      <Input value={b.address || ""} onChange={(e) => setBrands(brands.map((x, i) => i === idx ? { ...x, address: e.target.value } : x))} data-testid={`input-brand-${idx}-address`} />
                    </div>
                    <div className="space-y-1">
                      <Label>Contact Person</Label>
                      <Input value={b.contactPerson || ""} onChange={(e) => setBrands(brands.map((x, i) => i === idx ? { ...x, contactPerson: e.target.value } : x))} data-testid={`input-brand-${idx}-contact`} />
                    </div>
                    <div className="space-y-1">
                      <Label>Email</Label>
                      <Input type="email" value={b.email || ""} onChange={(e) => setBrands(brands.map((x, i) => i === idx ? { ...x, email: e.target.value } : x))} data-testid={`input-brand-${idx}-email`} />
                    </div>
                    <div className="space-y-1">
                      <Label>Phone</Label>
                      <Input value={b.phone || ""} onChange={(e) => setBrands(brands.map((x, i) => i === idx ? { ...x, phone: e.target.value } : x))} data-testid={`input-brand-${idx}-phone`} />
                    </div>
                    <div className="space-y-1">
                      <Label>WhatsApp</Label>
                      <Input value={b.whatsapp || ""} onChange={(e) => setBrands(brands.map((x, i) => i === idx ? { ...x, whatsapp: e.target.value } : x))} data-testid={`input-brand-${idx}-whatsapp`} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Business Categories (comma-separated)</Label>
                    <Input
                      value={Array.isArray(b.businessCategories) ? b.businessCategories.join(", ") : (b.businessCategories || "")}
                      onChange={(e) => setBrands(brands.map((x, i) => i === idx ? { ...x, businessCategories: e.target.value } : x))}
                      placeholder="e.g. Restaurant, Cafe, Retail Store"
                      data-testid={`input-brand-${idx}-categories`}
                    />
                  </div>

                  <div className="pt-3 border-t">
                    <p className="text-sm font-medium text-[#00426D] mb-2">Brand Documents</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "CR Document", field: "crDocument" },
                        { label: "Establishment Card", field: "establishmentCard" },
                        { label: "Trade License", field: "tradeLicense" },
                        { label: "Tax Card", field: "taxCardDocument" },
                        { label: "Menu/Price List", field: "menuPriceList" },
                        { label: "Logo", field: "logo" },
                        { label: "Cover Image", field: "coverImage" },
                      ].map((doc) => {
                        const value = b[doc.field] as string | undefined;
                        const isUploaded = !!value;
                        return (
                          <div key={doc.field} className="p-3 border rounded-lg text-center bg-white">
                            <FileText className={`h-6 w-6 mx-auto mb-1 ${isUploaded ? 'text-green-500' : 'text-slate-400'}`} />
                            <p className="text-xs font-medium mb-1">{doc.label}</p>
                            {isUploaded ? (
                              <div className="space-y-0.5">
                                {!value?.startsWith('data:') && (
                                  <a href={value} target="_blank" rel="noopener noreferrer" className="text-[#00426D] hover:underline text-xs block" data-testid={`link-brand-${idx}-${doc.field}`}>View</a>
                                )}
                                <button
                                  type="button"
                                  className="text-xs text-blue-600 hover:underline block w-full"
                                  onClick={() => { setActiveBrandDoc({ idx, field: doc.field }); brandDocFileRef.current?.click(); }}
                                  data-testid={`button-replace-brand-${idx}-${doc.field}`}
                                >
                                  Replace
                                </button>
                                <button
                                  type="button"
                                  className="text-xs text-red-500 hover:underline block w-full"
                                  onClick={() => setBrands(brands.map((x, i) => i === idx ? { ...x, [doc.field]: null } : x))}
                                  data-testid={`button-remove-brand-${idx}-${doc.field}`}
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="text-xs text-blue-600 hover:underline"
                                onClick={() => { setActiveBrandDoc({ idx, field: doc.field }); brandDocFileRef.current?.click(); }}
                                data-testid={`button-upload-brand-${idx}-${doc.field}`}
                              >
                                Upload
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
              <input
                type="file"
                ref={brandDocFileRef}
                accept="image/*,.pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && activeBrandDoc) handleBrandDocUpload(activeBrandDoc.idx, activeBrandDoc.field, file);
                  e.target.value = "";
                }}
                data-testid="input-brand-doc-file"
              />
            </CardContent>
            )}
          </Card>
        )}

        {/* Branches editor */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <button
              type="button"
              className="flex items-center gap-2 text-left"
              onClick={() => setBranchesOpen((v) => !v)}
              data-testid="toggle-branches"
            >
              {branchesOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
              <CardTitle className="text-[#00426D]">Branch Locations ({branches.length})</CardTitle>
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setBranchesOpen(true); setBranches([...branches, { name: "", location: "", phone: "", detail: "", ...(isGroup ? { brandId: "" } : {}) }]); }}
              data-testid="button-add-branch"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Branch
            </Button>
          </CardHeader>
          {branchesOpen && (
          <CardContent className="space-y-4">
            {branches.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-4">No branches added.</p>
            )}
            {branches.map((br, idx) => (
              <div key={idx} className="p-4 border-2 border-[#00426D]/15 rounded-lg space-y-3 bg-slate-50/40" data-testid={`branch-edit-${idx}`}>
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-[#00426D]">Branch {idx + 1}</h4>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500"
                    onClick={() => setBranches(branches.filter((_, i) => i !== idx))}
                    data-testid={`button-remove-branch-${idx}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Branch Name</Label>
                    <Input value={br.name || ""} onChange={(e) => updateBranch(idx, { name: e.target.value })} data-testid={`input-branch-${idx}-name`} />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone</Label>
                    <Input value={br.phone || ""} onChange={(e) => updateBranch(idx, { phone: e.target.value })} data-testid={`input-branch-${idx}-phone`} />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Location URL (Google Maps)</Label>
                    <Input value={br.location || ""} onChange={(e) => updateBranch(idx, { location: e.target.value })} placeholder="https://maps.google.com/..." data-testid={`input-branch-${idx}-location`} />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Address Details</Label>
                    <Textarea value={br.detail || ""} onChange={(e) => updateBranch(idx, { detail: e.target.value })} rows={2} data-testid={`input-branch-${idx}-detail`} />
                  </div>
                  {isGroup && brands.length > 0 && (
                    <div className="space-y-1 md:col-span-2">
                      <Label>Belongs to Brand (optional)</Label>
                      <Select value={br.brandId || "__none__"} onValueChange={(val) => updateBranch(idx, { brandId: val === "__none__" ? "" : val })}>
                        <SelectTrigger data-testid={`select-branch-${idx}-brand`}>
                          <SelectValue placeholder="Select brand" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— None —</SelectItem>
                          {brands.map((br2, brIdx) => (
                            <SelectItem key={br2.id || brIdx} value={br2.id || String(brIdx)}>
                              {br2.brandName || `Brand ${brIdx + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
          )}
        </Card>

        {/* Deals Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[#00426D] flex items-center justify-between gap-2">
              <button
                type="button"
                className="flex items-center gap-2 text-left"
                onClick={() => setDealsOpen((v) => !v)}
                data-testid="toggle-deals"
              >
                {dealsOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                <span>Deals ({deals.length}/{dealCap})</span>
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setDealsOpen(true); addNewDeal(); }}
                disabled={deals.length >= dealCap}
                data-testid="button-add-deal"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Deal
              </Button>
            </CardTitle>
          </CardHeader>
          {dealsOpen && (
          <CardContent className="space-y-4">
            {deals.length >= dealCap && (
              <p className="text-amber-600 text-sm text-center py-2 bg-amber-50 rounded-md">Maximum of {dealCap} deals reached.</p>
            )}
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
                      
                      {isGroup && brands.length > 0 && (
                        <div className="space-y-2">
                          <Label>Brand (optional)</Label>
                          <Select
                            value={deal.brandId || "__none__"}
                            onValueChange={(val) => {
                              const newBrandId = val === "__none__" ? null : val;
                              handleDealChange(index, "brandId", newBrandId);
                              if (newBrandId) {
                                const brandIdx = brands.findIndex((b: any, i: number) => b.id === newBrandId || String(i) === newBrandId);
                                if (brandIdx >= 0) {
                                  const allowedNames = branches
                                    .filter((br: any, bi: number) => {
                                      const ref = br?.brandId;
                                      const refIdx = brands.findIndex((b: any, i: number) => b.id === ref || String(i) === ref);
                                      return refIdx === brandIdx;
                                    })
                                    .map((br: any, bi: number) => br?.name || `Branch ${bi + 1}`);
                                  const filtered = (deal.branches || []).filter((n: string) => allowedNames.includes(n));
                                  if (filtered.length !== (deal.branches || []).length) {
                                    handleDealChange(index, "branches", filtered);
                                  }
                                }
                              }
                            }}
                          >
                            <SelectTrigger data-testid={`select-deal-${index}-brand`}>
                              <SelectValue placeholder="Select a brand" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— None —</SelectItem>
                              {brands.map((b: any, bi: number) => (
                                <SelectItem key={b.id || bi} value={b.id || String(bi)}>
                                  {b.brandName || `Brand ${bi + 1}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {(() => {
                        const selectedBrandIdx = isGroup && deal.brandId
                          ? brands.findIndex((b: any, i: number) => b.id === deal.brandId || String(i) === deal.brandId)
                          : -1;
                        const visibleBranches = selectedBrandIdx >= 0
                          ? branches
                              .map((br: any, bi: number) => ({ br, bi }))
                              .filter(({ br }) => {
                                const ref = br?.brandId;
                                const refIdx = brands.findIndex((b: any, i: number) => b.id === ref || String(i) === ref);
                                return refIdx === selectedBrandIdx;
                              })
                          : branches.map((br: any, bi: number) => ({ br, bi }));
                        return (
                      <div className="space-y-2">
                        {visibleBranches.length === 0 ? (
                          <>
                            <Label>Applicable Branches</Label>
                            <p className="text-sm text-slate-500">
                              {selectedBrandIdx >= 0
                                ? "No branches assigned to this brand yet. Add branches above and assign them to this brand."
                                : "Add branches above first."}
                            </p>
                          </>
                        ) : visibleBranches.length === 1 ? (
                          <>
                            <Label>Applicable Branch</Label>
                            <p className="text-sm text-slate-600 p-2 bg-slate-50 rounded border">
                              {visibleBranches[0].br?.name || `Branch ${visibleBranches[0].bi + 1}`} (automatically selected)
                            </p>
                          </>
                        ) : (
                          <>
                            <Label>Applicable Branches *</Label>
                            <p className="text-xs text-slate-500">Select one or more</p>
                            <div className="space-y-2">
                              {visibleBranches.map(({ br: branch, bi: branchIndex }) => {
                                const displayName = branch?.name || `Branch ${branchIndex + 1}`;
                                const dealBranches = deal.branches || [];
                                const isSelected = dealBranches.includes(displayName);
                                return (
                                  <label
                                    key={branchIndex}
                                    className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-slate-50"
                                    data-testid={`label-deal-${index}-branch-${branchIndex}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const next = e.target.checked
                                          ? [...dealBranches, displayName]
                                          : dealBranches.filter((v: string) => v !== displayName);
                                        handleDealChange(index, "branches", next);
                                      }}
                                      className="h-4 w-4 accent-[#00426D]"
                                      data-testid={`checkbox-deal-${index}-branch-${branchIndex}`}
                                    />
                                    <span className="text-sm">{displayName}</span>
                                  </label>
                                );
                              })}
                            </div>
                            {(deal.branches || []).length === 0 && (
                              <p className="text-sm text-red-500">Please select at least one branch</p>
                            )}
                          </>
                        )}
                      </div>
                        );
                      })()}

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
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
