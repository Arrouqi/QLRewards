import { useState, useRef, ChangeEvent, useCallback, useMemo, useEffect } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop, convertToPixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { 
  Building2, 
  FileText, 
  Plus, 
  Trash2, 
  Upload, 
  X, 
  Loader2, 
  ChevronDown,
  ChevronUp,
  Pencil,
  Gift,
  Percent,
  Tag,
  ShoppingBag,
  Check,
  Info,
  ImageIcon,
  HelpCircle,
  Users,
  TrendingUp,
  Zap,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocation } from "wouter";
import { PhoneInput } from "@/components/ui/phone-input";

interface SubCategory {
  id: string;
  categoryId: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  subCategories: SubCategory[];
}

const ASPECT_RATIO = 16 / 10;

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      { unit: '%', width: 90 },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

const branchSchema = z.object({
  name: z.string().min(1, "Branch name is required"),
  location: z.string().optional(),
  phone: z.string().min(1, "Branch phone is required"),
  detail: z.string().optional(),
  brandId: z.string().optional(),
});

const brandSchema = z.object({
  brandName: z.string().optional(),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  crNumber: z.string().optional(),
  crDocument: z.string().optional(),
  establishmentCard: z.string().optional(),
  tradeLicense: z.string().optional(),
  taxCardDocument: z.string().optional(),
  menuPriceList: z.string().optional(),
  logo: z.string().optional(),
  coverImage: z.string().optional(),
  businessCategories: z.array(z.string()).optional(),
});

const dealSchema = z.object({
  category: z.string().min(1, "Category is required"),
  subCategory: z.string().min(1, "Sub-category is required"),
  dealType: z.string().min(1, "Deal type is required"),
  duration: z.string().min(1, "Duration is required"),
  redemption: z.string().min(1, "Redemption is required"),
  limitPerUser: z.string().optional(),
  originalPrice: z.string().optional(),
  isMultipleItems: z.boolean().default(false),
  discountPercentage: z.string().optional(),
  discountedPrice: z.string().optional(),
  isTwoTranches: z.boolean().default(false),
  trancheValidity: z.string().optional(),
  specificDays: z.boolean().default(false),
  days: z.array(z.string()).optional(),
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().optional(),
  claimRules: z.array(z.string()).optional(),
  generalRules: z.array(z.string()).optional(),
  otherRules: z.string().optional(),
  branches: z.array(z.string()).optional(),
  images: z.array(z.string()).min(4, "At least 4 images are required per deal"),
});

const merchantSchema = z.object({
  companyType: z.enum(["individual", "group"]).default("individual"),
  companyName: z.string().min(1, "Company name is required"),
  crNumber: z.string().optional(),
  brandName: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  contactPerson: z.string().min(1, "Contact person is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone number is required"),
  products: z.array(z.string()).optional(),
  businessCategories: z.array(z.string()).optional(),
  branches: z.array(branchSchema).optional(),
  brands: z.array(brandSchema).optional(),
  subscriptionFee: z.string().default("0"),
  transactionFee: z.string().default("3.00"),
  crDocument: z.string().optional(),
  establishmentCard: z.string().optional(),
  tradeLicense: z.string().optional(),
  menuPriceList: z.string().optional(),
  taxCardDocument: z.string().optional(),
  logo: z.string().optional(),
  coverImage: z.string().optional(),
  whatsapp: z.string().optional(),
  merchantSignatoryName: z.string().min(1, "Authorized signatory name is required"),
  commencementDate: z.string().min(1, "Commencement date is required"),
  termsAccepted: z.boolean().refine(val => val === true, {
    message: "You must accept the terms and conditions to submit",
  }),
  deals: z.array(dealSchema).optional(),
}).superRefine((data, ctx) => {
  if (data.companyType === "group") {
    if (!data.brands || data.brands.length < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["brands"], message: "At least one brand is required for group companies" });
    }
    return;
  }
  // Individual: keep all the original required fields
  if (!data.crNumber || !/^[a-zA-Z0-9]{4,14}$/.test(data.crNumber)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["crNumber"], message: "CR number must be 4-14 alphanumeric characters" });
  }
  if (!data.brandName || data.brandName.trim() === "") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["brandName"], message: "Brand name is required" });
  }
  if (!data.products || data.products.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["products"], message: "Select at least one product" });
  }
  if (!data.businessCategories || data.businessCategories.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["businessCategories"], message: "Select at least one category" });
  }
  if (!data.crDocument || data.crDocument.trim() === "") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["crDocument"], message: "CR Document is required" });
  }
});

type MerchantFormValues = z.infer<typeof merchantSchema>;
type DealFormValues = z.infer<typeof dealSchema>;

const productTypes = [
  { id: "bogo", label: "Buy 1 Get 1" },
  { id: "discount", label: "Discount" },
  { id: "voucher", label: "Voucher" },
  { id: "bundle", label: "Bundle" },
];


const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function MerchantOnboarding() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedDeals, setExpandedDeals] = useState<number[]>([0]);
    
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const { data: claimTerms = [] } = useQuery<{ id: number; type: string; text: string }[]>({
    queryKey: ["terms", "claim"],
    queryFn: async () => {
      const res = await fetch("/api/terms/claim");
      if (!res.ok) throw new Error("Failed to fetch claim terms");
      return res.json();
    },
  });

  const { data: generalTerms = [] } = useQuery<{ id: number; type: string; text: string }[]>({
    queryKey: ["terms", "general"],
    queryFn: async () => {
      const res = await fetch("/api/terms/general");
      if (!res.ok) throw new Error("Failed to fetch general terms");
      return res.json();
    },
  });

  const form = useForm<MerchantFormValues>({
    resolver: zodResolver(merchantSchema),
    defaultValues: {
      companyType: "individual",
      companyName: "",
      crNumber: "",
      brandName: "",
      address: "",
      contactPerson: "",
      email: "",
      phone: "",
      products: [],
      businessCategories: [],
      branches: [],
      brands: [],
      subscriptionFee: "0",
      transactionFee: "3.00",
      deals: [],
      crDocument: "",
      establishmentCard: "",
      tradeLicense: "",
      menuPriceList: "",
      taxCardDocument: "",
      logo: "",
      coverImage: "",
      whatsapp: "",
      commencementDate: new Date().toISOString().split('T')[0],
      termsAccepted: false,
      merchantSignatoryName: "",
    },
  });

  const companyType = useWatch({ control: form.control, name: "companyType" }) || "individual";
  const isGroup = companyType === "group";

  const { fields: branchFields, append: appendBranch, remove: removeBranch } = useFieldArray({
    control: form.control,
    name: "branches",
  });

  const { fields: brandFields, append: appendBrand, remove: removeBrand } = useFieldArray({
    control: form.control,
    name: "brands",
  });

  const brandsValue = useWatch({ control: form.control, name: "brands" }) || [];

  const addBrand = () => {
    appendBrand({
      brandName: "",
      address: "",
      contactPerson: "",
      email: "",
      phone: "",
      whatsapp: "",
      crNumber: "",
      crDocument: "",
      establishmentCard: "",
      tradeLicense: "",
      taxCardDocument: "",
      menuPriceList: "",
      logo: "",
      coverImage: "",
      businessCategories: [],
    });
  };

  // Auto-add the first brand when switching to group
  useEffect(() => {
    if (isGroup && brandFields.length === 0) {
      addBrand();
    }
  }, [isGroup]);

  const { fields: dealFields, append: appendDeal, remove: removeDeal } = useFieldArray({
    control: form.control,
    name: "deals",
  });

  const productsValue = useWatch({ control: form.control, name: "products" }) || [];
  const businessCategoriesValue = useWatch({ control: form.control, name: "businessCategories" }) || [];

  
  const addBranch = () => {
    appendBranch({ name: "", location: "", phone: "", detail: "" });
  };

  const addDeal = () => {
    appendDeal({
      category: "",
      subCategory: "",
      dealType: "",
      duration: "",
      redemption: "",
      limitPerUser: "",
      originalPrice: "",
      isMultipleItems: false,
      discountPercentage: "",
      discountedPrice: "",
      isTwoTranches: false,
      trancheValidity: "",
      specificDays: false,
      days: daysOfWeek,
      title: "",
      description: "",
      claimRules: [],
      generalRules: [],
      otherRules: "",
      branches: [],
      images: [],
    });
    setExpandedDeals(prev => [...prev, dealFields.length]);
  };

  const toggleDealExpansion = (index: number) => {
    setExpandedDeals(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const handleFileUpload = async (field: keyof MerchantFormValues, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const res = await fetch("/api/merchants/upload-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: base64, folder: "merchant-documents" }),
        });
        if (res.ok) {
          const { url } = await res.json();
          form.setValue(field, url);
        } else {
          form.setValue(field, base64);
        }
      } catch {
        form.setValue(field, base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: MerchantFormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const formattedBranches = data.branches?.map(b => JSON.stringify(b)) || [];

      const isGroupSubmit = data.companyType === "group";
      if (isGroupSubmit) {
        if (!data.brands || data.brands.length === 0) {
          toast({ title: "At least one brand required", description: "Group companies must have at least one brand.", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }
        if (data.brands.length > 50) {
          toast({ title: "Too many brands", description: "Maximum 50 brands per group.", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }
      }
      
      // Validate that multi-branch merchants have selected branches for each deal
      if (!isGroupSubmit && (data.branches?.length || 0) > 1 && data.deals && data.deals.length > 0) {
        for (let i = 0; i < data.deals.length; i++) {
          const deal = data.deals[i];
          if (!deal.branches || deal.branches.length === 0) {
            toast({
              title: "Branch Selection Required",
              description: `Please select at least one branch for Deal ${i + 1}: ${deal.title}`,
              variant: "destructive",
            });
            setIsSubmitting(false);
            return;
          }
        }
      }

      const payload: any = {
        ...data,
        branches: formattedBranches,
      };
      if (isGroupSubmit) {
        // Strip individual-only fields & blank deals on group
        payload.deals = [];
        payload.crNumber = undefined;
        payload.brandName = undefined;
        payload.crDocument = undefined;
        payload.establishmentCard = undefined;
        payload.tradeLicense = undefined;
        payload.menuPriceList = undefined;
        payload.taxCardDocument = undefined;
        payload.logo = undefined;
        payload.coverImage = undefined;
        payload.products = [];
        payload.businessCategories = [];
      } else {
        payload.brands = [];
      }

      const response = await fetch("/api/merchants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = "Failed to submit the application.";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          if (response.status === 413) {
            errorMessage = "File attachments are too large. Please reduce the file sizes and try again.";
          } else if (response.status >= 500) {
            errorMessage = "Server error. Please try again in a few minutes.";
          }
        }
        throw new Error(errorMessage);
      }

      const merchant = await response.json();
      setLocation(`/merchant-success/${merchant.id}`);
    } catch (error: any) {
      const msg: string = error?.message || "";
      let description = msg;

      if (error.name === "TypeError" && msg === "Failed to fetch") {
        description = "Could not connect to the server. Please check your internet connection and try again.";
      } else if (msg.toLowerCase().includes("invalid string length") || msg.toLowerCase().includes("string length")) {
        description = "One or more uploaded images or documents are too large. Please re-upload your images — they will be compressed automatically. If the problem persists, try smaller files.";
      } else if (msg.toLowerCase().includes("413") || msg.includes("too large") || msg.includes("payload")) {
        description = "Total upload size is too large. Please use smaller images or documents and try again.";
      } else if (!msg) {
        description = "Something went wrong. Please try again or contact support if the issue continues.";
      }

      toast({
        title: "Submission Failed",
        description,
        variant: "destructive",
        duration: 8000,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-br from-[#00426D] via-[#00395D] to-[#002A45] text-white py-10 px-4 relative">
        <a href="/admin/login" className="absolute top-3 right-4 text-xs text-white/40 hover:text-white/70 transition-colors" data-testid="link-staff-login">Staff Login</a>
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center gap-4 mb-6">
            <img src="/ql-logo.png" alt="Qatar Living" className="h-10" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Grow Your Business with Qatar Living Deals</h1>
          <p className="text-white/80 text-lg mb-8 max-w-2xl">
            Partner with Qatar's largest community platform and reach thousands of new customers ready to discover your offers.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
              <Users className="h-5 w-5 text-[#FF7F39] flex-shrink-0" />
              <span className="text-sm text-white/90">Massive Audience Reach</span>
            </div>
            <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
              <TrendingUp className="h-5 w-5 text-[#FF7F39] flex-shrink-0" />
              <span className="text-sm text-white/90">Boost Your Revenue</span>
            </div>
            <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
              <Zap className="h-5 w-5 text-[#FF7F39] flex-shrink-0" />
              <span className="text-sm text-white/90">Quick & Easy Setup</span>
            </div>
            <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
              <Shield className="h-5 w-5 text-[#FF7F39] flex-shrink-0" />
              <span className="text-sm text-white/90">Trusted Platform</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl py-8 px-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
            console.log("Form validation errors:", errors);
            const fieldLabels: Record<string, string> = {
              companyName: "Company Name",
              crNumber: "CR Number",
              brandName: "Brand Name",
              address: "Address",
              contactPerson: "Contact Person",
              email: "Email",
              phone: "Phone",
              products: "Products",
              businessCategories: "Business Categories",
              crDocument: "CR Document",
              merchantSignatoryName: "Authorized Signatory Name",
              commencementDate: "Commencement Date",
              termsAccepted: "Terms & Conditions",
              deals: "Deal Offers",
              whatsapp: "WhatsApp",
              logo: "Logo",
              coverImage: "Cover Image",
            };
            const messages = Object.keys(errors).map(key => {
              const label = fieldLabels[key] || key;
              const error = errors[key as keyof typeof errors];
              if (key === "deals" && Array.isArray(error)) {
                const dealErrors = error.map((dealErr: any, i: number) => {
                  if (!dealErr) return null;
                  const fields = Object.keys(dealErr).map(f => {
                    const msg = dealErr[f]?.message;
                    return msg || f;
                  });
                  return `Deal ${i + 1}: ${fields.join(", ")}`;
                }).filter(Boolean);
                return dealErrors.length > 0 ? dealErrors.join("; ") : "Check all deal fields";
              }
              return `${label}: ${(error as any)?.message || 'Required'}`;
            });
            toast({
              title: "Please fix the errors below",
              description: messages.join(". "),
              variant: "destructive",
            });
            const firstErrorField = document.querySelector('[data-error="true"], .text-destructive');
            if (firstErrorField) {
              firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          })} className="space-y-8">
            
            {/* Agreement Header */}
            <Card className="border-[#00426D]/20 bg-[#00426D]/5">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    This <span className="font-semibold">AGREEMENT</span> is made and entered into on{" "}
                    <FormField
                      control={form.control}
                      name="commencementDate"
                      render={({ field }) => (
                        <span className="inline-block">
                          <Input 
                            {...field} 
                            type="date" 
                            className="w-40 inline-block mx-1 h-8 text-sm border-[#00426D]/30"
                            data-testid="input-commencement-date"
                          />
                        </span>
                      )}
                    />
                    {" "}("<span className="font-semibold">Commencement Date</span>") between{" "}
                    <span className="font-semibold">Qatar Living</span> ("Living Deals"){" "}
                    20/Floor, Tornado Tower, Majlis Al Tawoon Street, West Bay, Doha, Qatar.{" "}
                    (CR NO: 60909)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Company Type */}
            <Card>
              <CardHeader>
                <CardTitle className="text-[#00426D]">Company Type</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="companyType"
                  render={({ field }) => (
                    <FormItem>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(["individual", "group"] as const).map((opt) => {
                          const selected = field.value === opt;
                          return (
                            <label
                              key={opt}
                              className={cn(
                                "flex flex-col gap-1 p-4 rounded-lg border-2 cursor-pointer transition-all",
                                selected ? "border-[#FF7F39] bg-[#FF7F39]/10" : "border-slate-200 hover:border-[#FF7F39]/50"
                              )}
                              data-testid={`radio-company-type-${opt}`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  checked={selected}
                                  onChange={() => field.onChange(opt)}
                                  className="h-4 w-4 accent-[#FF7F39]"
                                />
                                <span className="font-semibold capitalize">{opt}</span>
                              </div>
                              <span className="text-xs text-slate-600 ml-6">
                                {opt === "individual"
                                  ? "Single brand / company with one CR."
                                  : "Group with multiple brands, each with its own details and documents."}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Company Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#00426D]">
                  <Building2 className="h-5 w-5" />
                  {isGroup ? "Group Information" : "Company Information"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter company name" data-testid="input-company-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {!isGroup && (
                    <>
                      <FormField
                        control={form.control}
                        name="crNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5">
                              CR Number *
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-slate-400" /></TooltipTrigger>
                                  <TooltipContent><p className="max-w-xs text-xs">Your Commercial Registration number issued by the Ministry of Commerce. 4-14 alphanumeric characters.</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g. 123456 or ABC1234" maxLength={14} data-testid="input-cr-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="brandName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Merchant Brand Name *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter brand name" data-testid="input-brand-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter full address" data-testid="input-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="contactPerson"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Person *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Full name" data-testid="input-contact-person" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address *</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="email@company.com" data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number *</FormLabel>
                        <FormControl>
                          <PhoneInput
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Phone number"
                            data-testid="input-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="whatsapp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp Number</FormLabel>
                        <FormControl>
                          <PhoneInput
                            value={field.value || ""}
                            onChange={field.onChange}
                            placeholder="WhatsApp number"
                            data-testid="input-whatsapp"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Conditions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-[#00426D]">Conditions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="text-[#FF7F39] font-bold mt-0.5">•</span>
                    <span>Merchant will provide offers to Qatar Living users via the Living Deals program as per the attached offer form.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#FF7F39] font-bold mt-0.5">•</span>
                    <span>Merchant authorizes Qatar Living to promote these offers across its platforms, apps, newsletters, and marketing channels.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#FF7F39] font-bold mt-0.5">•</span>
                    <span>Merchant guarantees all marketing information is accurate, lawful, and not misleading.</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Products Selection - Individual only */}
            {!isGroup && (
            <Card>
              <CardHeader>
                <CardTitle className="text-[#00426D]">Living Deals Products <span className="text-sm font-normal text-slate-500">(select all that apply)</span></CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {productTypes.map((product) => {
                    const isSelected = productsValue.includes(product.id);
                    return (
                      <label
                        key={product.id}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                          isSelected
                            ? "border-[#FF7F39] bg-[#FF7F39]/10"
                            : "border-slate-200 hover:border-[#FF7F39]/50"
                        )}
                        data-testid={`checkbox-product-${product.id}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              form.setValue("products", [...productsValue, product.id], { shouldValidate: true });
                            } else {
                              form.setValue("products", productsValue.filter((v: string) => v !== product.id), { shouldValidate: true });
                            }
                          }}
                          className="h-4 w-4 accent-[#FF7F39]"
                        />
                        <span className="font-medium text-sm">{product.label}</span>
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            )}

            {/* Business Categories - Individual only */}
            {!isGroup && (
            <Card>
              <CardHeader>
                <CardTitle className="text-[#00426D]">Business Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {categories.map((category: Category, idx: number) => {
                    const isSelected = businessCategoriesValue.includes(category.name);
                    return (
                      <label
                        key={category.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                          isSelected
                            ? "border-[#FF7F39] bg-[#FF7F39]/10"
                            : "border-slate-200 hover:border-[#FF7F39]/50"
                        )}
                        data-testid={`checkbox-category-${idx}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              form.setValue("businessCategories", [...businessCategoriesValue, category.name], { shouldValidate: true });
                            } else {
                              form.setValue("businessCategories", businessCategoriesValue.filter((v: string) => v !== category.name), { shouldValidate: true });
                            }
                          }}
                          className="h-4 w-4 accent-[#FF7F39]"
                        />
                        <span className="text-sm">{category.name}</span>
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            )}

            {/* Brands - Group only */}
            {isGroup && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-[#00426D]">
                    Brands <span className="text-slate-400 font-normal text-sm">({brandFields.length}/50)</span>
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addBrand}
                    disabled={brandFields.length >= 50}
                    data-testid="button-add-brand"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Brand
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {brandFields.length === 0 && (
                    <p className="text-slate-500 text-sm text-center py-4">No brands added yet.</p>
                  )}
                  {brandFields.map((brand, bIdx) => (
                    <BrandFormSection
                      key={brand.id}
                      index={bIdx}
                      form={form}
                      categories={categories}
                      onRemove={() => removeBrand(bIdx)}
                      handleFileUpload={handleFileUpload}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Branches */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-[#00426D]">Branches</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addBranch} data-testid="button-add-branch">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Branch
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {branchFields.length === 0 && (
                  <p className="text-slate-500 text-sm text-center py-4">No branches added. Click "Add Branch" to add one.</p>
                )}
                {branchFields.map((branch, index) => (
                  <div key={branch.id} className="p-4 border rounded-lg space-y-4 relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                      onClick={() => removeBranch(index)}
                      data-testid={`button-remove-branch-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`branches.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Branch Name *</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="Branch name" 
                                data-testid={`input-branch-name-${index}`}
                                onBlur={(e) => {
                                  field.onBlur();
                                  form.trigger(`branches.${index}.name`);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`branches.${index}.location`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location (Google Maps URL)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="https://maps.google.com/..." data-testid={`input-branch-location-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`branches.${index}.phone`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone *</FormLabel>
                            <FormControl>
                              <PhoneInput
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Phone number"
                                data-testid={`input-branch-phone-${index}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`branches.${index}.detail`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address Details</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="Branch address details" rows={2} data-testid={`textarea-branch-detail-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {isGroup && (
                        <FormField
                          control={form.control}
                          name={`branches.${index}.brandId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Brand</FormLabel>
                              <FormControl>
                                <select
                                  value={field.value || ""}
                                  onChange={(e) => field.onChange(e.target.value || undefined)}
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  data-testid={`select-branch-brand-${index}`}
                                >
                                  <option value="">— Unassigned —</option>
                                  {brandsValue.map((b: any, bIdx: number) => (
                                    <option key={bIdx} value={String(bIdx)}>
                                      {b.brandName?.trim() || `Brand ${bIdx + 1}`}
                                    </option>
                                  ))}
                                </select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Deals Section - Individual only */}
            {!isGroup && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-[#00426D]">
                  Deals {dealFields.length > 0 && <span className="text-slate-400 font-normal text-sm">({dealFields.length}/20)</span>}
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDeal}
                  disabled={dealFields.length >= 20}
                  data-testid="button-add-deal"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Deal
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {dealFields.length === 0 && (
                  <p className="text-slate-500 text-sm text-center py-4">No deals added. Click "Add Deal" to add one.</p>
                )}
                {dealFields.length >= 20 && (
                  <p className="text-amber-600 text-sm text-center py-2 bg-amber-50 rounded-md">Maximum of 20 deals reached.</p>
                )}
                {dealFields.map((deal, index) => (
                  <DealFormSection
                    key={deal.id}
                    index={index}
                    form={form}
                    categories={categories}
                    claimTerms={claimTerms}
                    generalTerms={generalTerms}
                    branches={branchFields}
                    isExpanded={expandedDeals.includes(index)}
                    onToggle={() => toggleDealExpansion(index)}
                    onRemove={() => removeDeal(index)}
                  />
                ))}
              </CardContent>
            </Card>

            )}

            {/* Fee Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-[#00426D]">Fee Structure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-gradient-to-r from-[#00426D]/5 to-[#FF7F39]/5 p-4 sm:p-6 rounded-xl border border-[#00426D]/10">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <span className="text-base sm:text-lg font-bold text-[#00426D]">Subscription Fee (QAR per year):</span>
                      <FormField
                        control={form.control}
                        name="subscriptionFee"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <div className="flex items-center gap-2">
                                <Input 
                                  {...field} 
                                  type="number" 
                                  min="0"
                                  step="0.01"
                                  className="w-32 text-xl font-bold text-[#FF7F39] border-[#00426D]/30" 
                                  data-testid="input-subscription-fee"
                                />
                                <span className="text-base text-slate-600">QAR</span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-base sm:text-lg font-bold text-[#00426D]">Transaction Fee (QAR per transaction):</span>
                      <FormField
                        control={form.control}
                        name="transactionFee"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <div className="flex items-center gap-2">
                                <Input 
                                  {...field} 
                                  type="number" 
                                  min="0"
                                  step="0.01"
                                  className="w-32 text-xl font-bold text-[#FF7F39] border-[#00426D]/30" 
                                  data-testid="input-transaction-fee"
                                />
                                <span className="text-base text-slate-600">QAR per transaction</span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
                
                <ul className="space-y-3 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="text-[#FF7F39] font-bold mt-0.5">•</span>
                    <span><strong>Subscription Payment:</strong> 100% advance upon signing or renewal.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#FF7F39] font-bold mt-0.5">•</span>
                    <span><strong>Redemption Fees:</strong> Qatar Living will issue a monthly invoice for redeemed transactions; payments due within 15 days.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#FF7F39] font-bold mt-0.5">•</span>
                    <span>Unpaid balances may lead to suspension of offers until cleared.</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Documents - Individual only (group documents are per-brand) */}
            {!isGroup && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#00426D]">
                  <FileText className="h-5 w-5" />
                  Required Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <DocumentUpload
                    label="CR Document *"
                    field="crDocument"
                    form={form}
                    onChange={handleFileUpload}
                  />
                  <DocumentUpload
                    label="Establishment Card (Optional)"
                    field="establishmentCard"
                    form={form}
                    onChange={handleFileUpload}
                  />
                  <DocumentUpload
                    label="Trade License (Optional)"
                    field="tradeLicense"
                    form={form}
                    onChange={handleFileUpload}
                  />
                  <DocumentUpload
                    label="Menu / Price List (Optional)"
                    field="menuPriceList"
                    form={form}
                    onChange={handleFileUpload}
                  />
                  <DocumentUpload
                    label="Tax Card (Optional)"
                    field="taxCardDocument"
                    form={form}
                    onChange={handleFileUpload}
                  />
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium text-[#00426D] mb-4">Brand Assets (Optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <DocumentUpload
                      label="Logo"
                      field="logo"
                      form={form}
                      onChange={handleFileUpload}
                      accept="image/*"
                    />
                    <DocumentUpload
                      label="Cover Image"
                      field="coverImage"
                      form={form}
                      onChange={handleFileUpload}
                      accept="image/*"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            )}

            {/* Terms */}
            <Card>
              <CardHeader>
                <CardTitle className="text-[#00426D]">Terms & Conditions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-50 p-4 rounded-lg space-y-4 text-sm text-slate-700 max-h-80 overflow-y-auto">
                  <h4 className="font-semibold text-[#00426D]">Merchant Obligations</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Merchant ensures goods/service meet quality standards and comply with regulations.</li>
                    <li>Merchant will honor offers without extra fees or conditions.</li>
                    <li>Merchant will resolve user complaints promptly at no cost to Qatar Living or the users.</li>
                    <li>Merchant must provide an approved price list from the Ministry of Commerce and update Qatar Living on any changes.</li>
                  </ul>
                  
                  <h4 className="font-semibold text-[#00426D] pt-3">Merchant Indemnity</h4>
                  <p>Merchant agrees to indemnify, defend, and hold harmless Qatar Living from any claims, damages, liabilities, or losses arising from the Merchant's breach of this Agreement, any misrepresentations, or any failure to deliver the goods or services as promised.</p>
                  
                  <h4 className="font-semibold text-[#00426D] pt-3">Entire Agreement</h4>
                  <p>The agreement, together with the attached offer details and the Terms of Use available on the Qatar Living website (<a href="https://www.qatarliving.com/terms-of-use" target="_blank" rel="noopener noreferrer" className="text-[#00426D] hover:underline">https://www.qatarliving.com/terms-of-use</a>), constitutes the entire agreement between the parties. This Agreement and the attached documents represent the full and complete understanding between both parties and supersede all prior discussions, negotiations, or agreements.</p>
                  
                  <p className="pt-3">Please find the link to the Terms and Conditions below:<br/>
                  <a href="https://www.qatarliving.com/terms-of-use" target="_blank" rel="noopener noreferrer" className="text-[#00426D] hover:underline">https://www.qatarliving.com/terms-of-use</a></p>
                  
                  <p className="pt-3 font-medium border-t border-slate-200 mt-3 pt-3">By signing this Agreement, you acknowledge that you have read, understood, and agree to be bound by the Terms of Use published on the Qatar Living website.</p>
                </div>
                
                <FormField
                  control={form.control}
                  name="termsAccepted"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 mt-4 p-4 border rounded-lg bg-white">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-terms"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-medium">
                          I agree to the Terms and Conditions
                        </FormLabel>
                        <FormDescription className="text-xs text-slate-500">
                          By checking this box, you confirm that you have read, understood, and agree to be bound by the Terms of Use.
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Authorized Signatory */}
            <Card>
              <CardHeader>
                <CardTitle className="text-[#00426D]">Authorized Signatory</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="merchantSignatoryName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Authorized Signatory Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Full name of authorized signatory" data-testid="input-signatory-name" />
                      </FormControl>
                      <FormDescription className="text-xs text-slate-500">
                        The signature and stamp will be added manually after downloading the PDF agreement.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex justify-end gap-4 pb-8">
              <Button type="button" variant="outline" onClick={() => setLocation("/")}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-[#00426D] hover:bg-[#003557] min-w-[200px]"
                disabled={isSubmitting}
                data-testid="button-submit"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Application"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}

function DocumentUpload({ label, field, form, onChange, accept }: {
  label: string;
  field: any;
  form: any;
  onChange: (field: any, e: ChangeEvent<HTMLInputElement>) => void;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasValue, setHasValue] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(field, e);
    setHasValue(!!e.target.files?.[0]);
  };

  const handleClear = () => {
    form.setValue(field, "");
    setHasValue(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const fieldError = form.formState.errors?.[field];

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <input
        ref={inputRef}
        type="file"
        accept={accept || "image/*,.pdf"}
        className="hidden"
        onChange={handleChange}
      />
      {hasValue ? (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <Check className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-700">File uploaded</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="ml-auto text-red-500"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            fieldError ? 'border-red-300 bg-red-50/50 hover:border-red-500' : 'border-slate-300 hover:border-[#FF7F39] hover:bg-[#FF7F39]/5'
          }`}
        >
          <Upload className={`h-5 w-5 ${fieldError ? 'text-red-400' : 'text-slate-400'}`} />
          <span className={`text-sm ${fieldError ? 'text-red-500' : 'text-slate-500'}`}>Click to upload</span>
        </div>
      )}
      {fieldError && (
        <p className="text-sm text-red-500" data-testid={`text-error-${field}`}>{fieldError.message as string}</p>
      )}
    </div>
  );
}

function BrandFormSection({ index, form, categories, onRemove, handleFileUpload }: {
  index: number;
  form: any;
  categories: Category[];
  onRemove: () => void;
  handleFileUpload: (field: any, e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const brandCats: string[] = (useWatch({ control: form.control, name: `brands.${index}.businessCategories` as any }) as string[]) || [];

  return (
    <div className="p-4 border-2 border-[#00426D]/15 rounded-lg space-y-4 relative bg-slate-50/40" data-testid={`brand-section-${index}`}>
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-[#00426D]">Brand {index + 1}</h4>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-red-500 hover:text-red-700"
          onClick={onRemove}
          data-testid={`button-remove-brand-${index}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name={`brands.${index}.brandName`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Brand Name</FormLabel>
              <FormControl>
                <Input {...field} value={field.value || ""} placeholder="Brand name" data-testid={`input-brand-${index}-name`} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`brands.${index}.crNumber`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>CR Number</FormLabel>
              <FormControl>
                <Input {...field} value={field.value || ""} placeholder="e.g. 123456" maxLength={14} data-testid={`input-brand-${index}-cr`} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name={`brands.${index}.address`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Address</FormLabel>
            <FormControl>
              <Input {...field} value={field.value || ""} placeholder="Brand address" data-testid={`input-brand-${index}-address`} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name={`brands.${index}.contactPerson`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Person</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} placeholder="Full name" data-testid={`input-brand-${index}-contact`} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`brands.${index}.email`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} type="email" placeholder="email@brand.com" data-testid={`input-brand-${index}-email`} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`brands.${index}.phone`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <PhoneInput value={field.value || ""} onChange={field.onChange} placeholder="Phone" data-testid={`input-brand-${index}-phone`} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`brands.${index}.whatsapp`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>WhatsApp</FormLabel>
              <FormControl>
                <PhoneInput value={field.value || ""} onChange={field.onChange} placeholder="WhatsApp" data-testid={`input-brand-${index}-whatsapp`} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <Separator />

      <div>
        <Label className="text-sm font-medium text-[#00426D]">Business Categories</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
          {categories.map((c) => {
            const sel = brandCats.includes(c.name);
            return (
              <label key={c.id} className={cn(
                "flex items-center gap-2 p-2 rounded border cursor-pointer text-xs",
                sel ? "border-[#FF7F39] bg-[#FF7F39]/10" : "border-slate-200"
              )} data-testid={`checkbox-brand-${index}-cat-${c.id}`}>
                <input
                  type="checkbox"
                  checked={sel}
                  onChange={(e) => {
                    if (e.target.checked) form.setValue(`brands.${index}.businessCategories`, [...brandCats, c.name]);
                    else form.setValue(`brands.${index}.businessCategories`, brandCats.filter((v) => v !== c.name));
                  }}
                  className="h-3 w-3 accent-[#FF7F39]"
                />
                <span>{c.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      <Separator />

      <div>
        <Label className="text-sm font-medium text-[#00426D]">Documents</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <DocumentUpload label="CR Document" field={`brands.${index}.crDocument` as any} form={form} onChange={handleFileUpload} />
          <DocumentUpload label="Establishment Card" field={`brands.${index}.establishmentCard` as any} form={form} onChange={handleFileUpload} />
          <DocumentUpload label="Trade License" field={`brands.${index}.tradeLicense` as any} form={form} onChange={handleFileUpload} />
          <DocumentUpload label="Menu / Price List" field={`brands.${index}.menuPriceList` as any} form={form} onChange={handleFileUpload} />
          <DocumentUpload label="Tax Card" field={`brands.${index}.taxCardDocument` as any} form={form} onChange={handleFileUpload} />
          <DocumentUpload label="Logo" field={`brands.${index}.logo` as any} form={form} onChange={handleFileUpload} accept="image/*" />
          <DocumentUpload label="Cover Image" field={`brands.${index}.coverImage` as any} form={form} onChange={handleFileUpload} accept="image/*" />
        </div>
      </div>
    </div>
  );
}

function TwoTranchesSection({ form, index }: { form: any; index: number }) {
  const isTwoTranches = useWatch({ control: form.control, name: `deals.${index}.isTwoTranches` });
  
  return (
    <div className="bg-orange-50/50 p-4 rounded-md border border-orange-100">
      <FormField
        control={form.control}
        name={`deals.${index}.isTwoTranches`}
        render={({ field }) => (
          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <FormLabel className="font-medium text-slate-700 flex items-center gap-1.5">
              Is this deal valid for two tranches?
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-slate-400" /></TooltipTrigger>
                  <TooltipContent><p className="max-w-xs text-xs">A two-tranche deal splits the offer into two usage periods. For example, "Buy 1 Get 1" can be redeemed in two separate visits.</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </FormLabel>
          </FormItem>
        )}
      />
      
      {isTwoTranches && (
        <div className="mt-4 ml-7">
          <FormField
            control={form.control}
            name={`deals.${index}.trancheValidity`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold text-slate-500 uppercase">Tranche Validity</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-11 bg-white">
                      <SelectValue placeholder="Choose" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="1">1 Week</SelectItem>
                    <SelectItem value="2">2 Weeks</SelectItem>
                    <SelectItem value="3">3 Weeks</SelectItem>
                    <SelectItem value="4">4 Weeks</SelectItem>
                    <SelectItem value="5">5 Weeks</SelectItem>
                    <SelectItem value="6">6 Weeks</SelectItem>
                    <SelectItem value="7">7 Weeks</SelectItem>
                    <SelectItem value="8">8 Weeks</SelectItem>
                    <SelectItem value="9">9 Weeks</SelectItem>
                    <SelectItem value="10">10 Weeks</SelectItem>
                    <SelectItem value="11">11 Weeks</SelectItem>
                    <SelectItem value="12">12 Weeks</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );
}

function OfferAvailabilityDays({ form, index }: { form: any; index: number }) {
  const specificDays = useWatch({ control: form.control, name: `deals.${index}.specificDays` }) || false;
  const days = useWatch({ control: form.control, name: `deals.${index}.days` }) || [];

  const toggleDay = (day: string) => {
    const updated = days.includes(day) ? days.filter((d: string) => d !== day) : [...days, day];
    form.setValue(`deals.${index}.days`, updated);
  };

  const setWeekdays = () => {
    form.setValue(`deals.${index}.days`, ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]);
  };

  const setWeekends = () => {
    form.setValue(`deals.${index}.days`, ["Friday", "Saturday"]);
  };

  return (
    <div className="bg-orange-50/50 p-4 rounded-md border border-orange-100">
      <FormField
        control={form.control}
        name={`deals.${index}.specificDays`}
        render={({ field }) => (
          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
                data-testid={`checkbox-specific-days-${index}`}
              />
            </FormControl>
            <FormLabel className="font-medium text-slate-700 flex items-center gap-1.5">
              Available on specific days only
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-slate-400" /></TooltipTrigger>
                  <TooltipContent><p className="max-w-xs text-xs">Restrict this deal to certain days of the week. Useful for weekday-only or weekend-only promotions.</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </FormLabel>
          </FormItem>
        )}
      />

      {specificDays && (
        <div className="mt-4 ml-7 space-y-3">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={setWeekdays} data-testid={`button-weekdays-${index}`}>
              Weekdays
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={setWeekends} data-testid={`button-weekends-${index}`}>
              Weekends
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {daysOfWeek.map((day) => (
              <label key={day} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-slate-50" data-testid={`label-day-${day}-${index}`}>
                <input
                  type="checkbox"
                  checked={days.includes(day)}
                  onChange={() => toggleDay(day)}
                  className="h-4 w-4 accent-[#FF7F39]"
                />
                <span className="text-sm">{day}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const MAX_IMAGE_MB = 10;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

function DealImageUpload({ form, index }: { form: any; index: number }) {
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const images = useWatch({ control: form.control, name: `deals.${index}.images` }) || [];

  const uploadFiles = async (files: File[]): Promise<string[]> => {
    const oversized = files.filter(f => f.size > MAX_IMAGE_BYTES);
    if (oversized.length > 0) {
      const names = oversized.map(f => `"${f.name}" (${(f.size / 1024 / 1024).toFixed(1)} MB)`).join(", ");
      throw new Error(`${oversized.length > 1 ? "These files exceed" : "This file exceeds"} the 10 MB limit: ${names}. Please use a smaller image.`);
    }

    const base64List: string[] = [];
    for (const file of files) {
      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onload = () => { if (reader.result) base64List.push(reader.result as string); resolve(); };
        reader.readAsDataURL(file);
      });
    }

    const res = await fetch("/api/merchants/upload-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: base64List }),
    });
    if (!res.ok) throw new Error("Upload failed. Please try again.");
    const { urls } = await res.json();
    return urls;
  };

  const handleAdd = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadErrors([]);
    setUploading(true);
    try {
      const urls = await uploadFiles(files);
      form.setValue(`deals.${index}.images`, [...images, ...urls]);
    } catch (err: any) {
      setUploadErrors([err.message]);
    } finally {
      setUploading(false);
      if (addInputRef.current) addInputRef.current.value = "";
    }
  };

  const handleReplace = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || replacingIndex === null) return;
    setUploadErrors([]);
    setUploading(true);
    try {
      const urls = await uploadFiles([file]);
      const updated = [...images];
      updated[replacingIndex] = urls[0];
      form.setValue(`deals.${index}.images`, updated);
    } catch (err: any) {
      setUploadErrors([err.message]);
    } finally {
      setUploading(false);
      setReplacingIndex(null);
      if (replaceInputRef.current) replaceInputRef.current.value = "";
    }
  };

  const removeImage = (imgIndex: number) => {
    form.setValue(`deals.${index}.images`, images.filter((_: string, i: number) => i !== imgIndex));
  };

  const imageError = form.formState.errors?.deals?.[index]?.images;

  return (
    <div className="space-y-3">
      <Label>Deal Images ({images.length}/4 minimum) *</Label>

      {imageError && (
        <p className="text-sm text-red-500" data-testid={`text-deal-images-error-${index}`}>
          At least 4 images are required for this deal
        </p>
      )}

      {uploadErrors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 space-y-1" data-testid={`text-upload-error-${index}`}>
          {uploadErrors.map((err, i) => (
            <p key={i} className="text-sm text-red-600 flex items-start gap-1">
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>{err}</span>
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {images.map((img: string, imgIndex: number) => (
          <div key={imgIndex} className="relative flex flex-col items-center gap-1">
            <img
              src={img}
              alt={`Deal image ${imgIndex + 1}`}
              className="w-24 h-24 object-cover rounded-lg border border-slate-200"
            />
            <div className="flex gap-1">
              <button
                type="button"
                title="Replace image"
                onClick={() => { setReplacingIndex(imgIndex); replaceInputRef.current?.click(); }}
                className="flex items-center gap-0.5 text-xs text-slate-500 hover:text-[#00426D] bg-slate-100 hover:bg-slate-200 rounded px-1.5 py-0.5 transition-colors"
                data-testid={`button-replace-image-${index}-${imgIndex}`}
              >
                <Pencil className="h-3 w-3" />
                <span>Replace</span>
              </button>
              <button
                type="button"
                title="Remove image"
                onClick={() => removeImage(imgIndex)}
                className="flex items-center gap-0.5 text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded px-1.5 py-0.5 transition-colors"
                data-testid={`button-remove-image-${index}-${imgIndex}`}
              >
                <X className="h-3 w-3" />
                <span>Remove</span>
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => { setUploadErrors([]); addInputRef.current?.click(); }}
          disabled={uploading}
          className={`w-24 h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${
            imageError ? "border-red-300 text-red-400 hover:border-red-500" : "border-slate-300 text-slate-400 hover:border-[#FF7F39] hover:text-[#FF7F39]"
          }`}
          data-testid={`button-add-image-${index}`}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <ImageIcon className="h-6 w-6 mb-1" />
              <span className="text-xs">Add Image</span>
            </>
          )}
        </button>
      </div>

      <input ref={addInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAdd} />
      <input ref={replaceInputRef} type="file" accept="image/*" className="hidden" onChange={handleReplace} />
    </div>
  );
}

function DealFormSection({ 
  index, 
  form, 
  categories, 
  claimTerms, 
  generalTerms,
  branches,
  isExpanded, 
  onToggle, 
  onRemove 
}: {
  index: number;
  form: any;
  categories: Category[];
  claimTerms: { id: number; type: string; text: string }[];
  generalTerms: { id: number; type: string; text: string }[];
  branches: any[];
  isExpanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const offerTypes = [
    { id: "bogo", label: "Buy 1 Get 1", icon: Gift },
    { id: "discount", label: "Discount", icon: Percent },
    { id: "voucher", label: "Voucher", icon: Tag },
    { id: "bundle", label: "Bundle", icon: ShoppingBag },
  ];

  const categoryValue = useWatch({ control: form.control, name: `deals.${index}.category` });
  const dealTypeValue = useWatch({ control: form.control, name: `deals.${index}.dealType` });
  const redemptionValue = useWatch({ control: form.control, name: `deals.${index}.redemption` });
  const isMultipleItemsValue = useWatch({ control: form.control, name: `deals.${index}.isMultipleItems` });
  const claimRulesValue = useWatch({ control: form.control, name: `deals.${index}.claimRules` }) || [];
  const generalRulesValue = useWatch({ control: form.control, name: `deals.${index}.generalRules` }) || [];
  const branchesValue = useWatch({ control: form.control, name: `deals.${index}.branches` }) || [];
  const [discountType, setDiscountType] = useState<"percentage" | "discountedPrice">("percentage");
  
  const selectedCategory = categories.find(c => c.name === categoryValue);
  const subCategories = selectedCategory?.subCategories || [];
  
  const isBogo = dealTypeValue === "bogo";
  const isDiscount = dealTypeValue === "discount";
  const isLimitedRedemption = redemptionValue === "limited";

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span className="font-medium">Deal {index + 1}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="text-red-500 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-6">
          <FormField
            control={form.control}
            name={`deals.${index}.title`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deal Title *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="E.g., Buy 1 Get 1 Free on All Pizzas" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name={`deals.${index}.category`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`deals.${index}.subCategory`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sub-Category *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!categoryValue}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select sub-category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {subCategories.map((sub) => (
                        <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name={`deals.${index}.dealType`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deal Type *</FormLabel>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {offerTypes.map((type) => {
                    const Icon = type.icon;
                    const isSelected = field.value === type.id;
                    return (
                      <div
                        key={type.id}
                        onClick={() => field.onChange(type.id)}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all",
                          isSelected ? "border-[#FF7F39] bg-[#FF7F39]/10" : "border-slate-200 hover:border-[#FF7F39]/50"
                        )}
                      >
                        <Icon className={cn("h-4 w-4", isSelected ? "text-[#FF7F39]" : "text-slate-500")} />
                        <span className="text-sm">{type.label}</span>
                      </div>
                    );
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name={`deals.${index}.duration`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    Duration *
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-slate-400" /></TooltipTrigger>
                        <TooltipContent><p className="max-w-xs text-xs">How long this deal stays active on the platform. E.g., "3 months", "6 weeks", or "1 year".</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., 3 months, 6 weeks, 1 year" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`deals.${index}.redemption`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    Redemption *
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-slate-400" /></TooltipTrigger>
                        <TooltipContent><p className="max-w-xs text-xs">Choose "Unlimited" to let customers use this deal as many times as they want, or "Limited" to set a maximum per customer.</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select redemption type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unlimited">Unlimited</SelectItem>
                      <SelectItem value="limited">Limited</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isLimitedRedemption && (
              <FormField
                control={form.control}
                name={`deals.${index}.limitPerUser`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Limit Per User *</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" placeholder="e.g., 1" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          {isBogo && <TwoTranchesSection form={form} index={index} />}

          <OfferAvailabilityDays form={form} index={index} />

          {(isDiscount || isBogo) && (
            <div className="space-y-4">
              <FormField
                control={form.control}
                name={`deals.${index}.isMultipleItems`}
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-medium text-slate-700 flex items-center gap-1.5">
                      This Deal is for Multiple Items
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-slate-400" /></TooltipTrigger>
                          <TooltipContent><p className="max-w-xs text-xs">Enable this if the deal covers multiple products or menu items. Pricing won't be displayed on the deal card when enabled.</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FormLabel>
                  </FormItem>
                )}
              />
              
              {isMultipleItemsValue && (
                <div className="bg-[#FFF8E1] border border-[#FFE082] rounded-md p-3 flex items-start gap-3">
                  <Info className="h-5 w-5 text-[#F57F17] flex-shrink-0" />
                  <p className="text-[#5D4037] text-sm">
                    If your deal is for multiple items, the price won't show on the deal card and details page.
                  </p>
                </div>
              )}
            </div>
          )}

          {!isMultipleItemsValue && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name={`deals.${index}.originalPrice`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{dealTypeValue === "voucher" ? "Voucher Amount" : "Original Price"} *</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input placeholder="0.00" className="pr-12" {...field} />
                      </FormControl>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">QAR</div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isDiscount && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDiscountType("percentage");
                        form.setValue(`deals.${index}.discountedPrice`, "");
                      }}
                      className={cn(
                        "px-3 py-1.5 text-sm rounded-md border transition-colors",
                        discountType === "percentage"
                          ? "bg-[#00426D] text-white border-[#00426D]"
                          : "bg-white text-slate-600 border-slate-300 hover:border-[#00426D]"
                      )}
                      data-testid={`button-discount-percentage-${index}`}
                    >
                      Discount %
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDiscountType("discountedPrice");
                        form.setValue(`deals.${index}.discountPercentage`, "");
                      }}
                      className={cn(
                        "px-3 py-1.5 text-sm rounded-md border transition-colors",
                        discountType === "discountedPrice"
                          ? "bg-[#00426D] text-white border-[#00426D]"
                          : "bg-white text-slate-600 border-slate-300 hover:border-[#00426D]"
                      )}
                      data-testid={`button-discount-price-${index}`}
                    >
                      Discounted Price
                    </button>
                  </div>
                  {discountType === "percentage" ? (
                    <FormField
                      control={form.control}
                      name={`deals.${index}.discountPercentage`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount Percentage *</FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input placeholder="0" className="pr-12" {...field} />
                            </FormControl>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">%</div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={form.control}
                      name={`deals.${index}.discountedPrice`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discounted Price *</FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input placeholder="0.00" className="pr-12" {...field} />
                            </FormControl>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">QAR</div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          <FormField
            control={form.control}
            name={`deals.${index}.description`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="Describe the deal..." rows={3} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <Label>Claim Rules *</Label>
            <div className="space-y-2 mt-2">
              {claimTerms.map((term) => {
                const isSelected = claimRulesValue.includes(term.text);
                return (
                  <label
                    key={term.id}
                    className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          form.setValue(`deals.${index}.claimRules`, [...claimRulesValue, term.text]);
                        } else {
                          form.setValue(`deals.${index}.claimRules`, claimRulesValue.filter((v: string) => v !== term.text));
                        }
                      }}
                      className="h-4 w-4 accent-[#FF7F39]"
                    />
                    <span className="text-sm" dangerouslySetInnerHTML={{ __html: term.text }} />
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <Label>General Rules *</Label>
            <div className="space-y-2 mt-2">
              {generalTerms.map((term) => {
                const isSelected = generalRulesValue.includes(term.text);
                return (
                  <label
                    key={term.id}
                    className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          form.setValue(`deals.${index}.generalRules`, [...generalRulesValue, term.text]);
                        } else {
                          form.setValue(`deals.${index}.generalRules`, generalRulesValue.filter((v: string) => v !== term.text));
                        }
                      }}
                      className="h-4 w-4 accent-[#FF7F39]"
                    />
                    <span className="text-sm" dangerouslySetInnerHTML={{ __html: term.text }} />
                  </label>
                );
              })}
            </div>
          </div>

          <FormField
            control={form.control}
            name={`deals.${index}.otherRules`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Other Rules / Additional Terms</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="Enter any additional rules or terms..." rows={3} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {branches.length === 0 ? (
            <div>
              <Label>Applicable Branches</Label>
              <p className="text-sm text-slate-500 mt-2">Add branches above first</p>
            </div>
          ) : branches.length === 1 ? (
            <div>
              <Label>Applicable Branch</Label>
              <p className="text-sm text-slate-600 mt-2 p-2 bg-slate-50 rounded border">
                {branches[0]?.name || "Branch 1"} (automatically selected)
              </p>
            </div>
          ) : (
            <div>
              <Label>Applicable Branches *</Label>
              <p className="text-xs text-slate-500 mb-2">Select at least one branch</p>
              <div className="space-y-2">
                {branches.map((branch: any, branchIndex: number) => {
                  const displayName = branch?.name || `Branch ${branchIndex + 1}`;
                  const isSelected = branchesValue.includes(displayName);
                  return (
                    <label
                      key={branchIndex}
                      className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            form.setValue(`deals.${index}.branches`, [...branchesValue, displayName]);
                          } else {
                            form.setValue(`deals.${index}.branches`, branchesValue.filter((v: string) => v !== displayName));
                          }
                        }}
                        className="h-4 w-4 accent-[#FF7F39]"
                      />
                      <span className="text-sm">{displayName}</span>
                    </label>
                  );
                })}
              </div>
              {branchesValue.length === 0 && (
                <p className="text-sm text-red-500 mt-1">Please select at least one branch</p>
              )}
            </div>
          )}

          <DealImageUpload form={form} index={index} />
        </div>
      )}
    </div>
  );
}
