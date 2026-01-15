import { useState, useRef, ChangeEvent, useCallback, useMemo } from "react";
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
  ImageIcon
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
import { SignaturePad } from "@/components/ui/signature-pad";
import {
  Form,
  FormControl,
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
  phone: z.string().optional(),
  detail: z.string().optional(),
});

const dealSchema = z.object({
  category: z.string().min(1, "Category is required"),
  subCategory: z.string().min(1, "Sub-category is required"),
  dealType: z.string().min(1, "Deal type is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  redemption: z.string().min(1, "Redemption is required"),
  limitPerUser: z.string().optional(),
  originalPrice: z.string().optional(),
  isMultipleItems: z.boolean().default(false),
  discountPercentage: z.string().optional(),
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
  images: z.array(z.string()).optional(),
});

const merchantSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  crNumber: z.string().regex(/^\d{6,8}$/, "CR number must be 6-8 digits"),
  brandName: z.string().min(1, "Brand name is required"),
  address: z.string().min(1, "Address is required"),
  contactPerson: z.string().min(1, "Contact person is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone number is required"),
  products: z.array(z.string()).min(1, "Select at least one product"),
  businessCategories: z.array(z.string()).min(1, "Select at least one category"),
  branches: z.array(branchSchema).optional(),
  crDocument: z.string().optional(),
  establishmentCard: z.string().optional(),
  tradeLicense: z.string().optional(),
  menuPriceList: z.string().optional(),
  merchantSignature: z.string().optional(),
  merchantSignatoryName: z.string().optional(),
    merchantSignDate: z.string().optional(),
  deals: z.array(dealSchema).optional(),
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
      deals: [],
      merchantSignDate: new Date().toISOString().split('T')[0],
    },
  });

  const { fields: branchFields, append: appendBranch, remove: removeBranch } = useFieldArray({
    control: form.control,
    name: "branches",
  });

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
      startDate: "",
      endDate: "",
      redemption: "",
      limitPerUser: "",
      originalPrice: "",
      isMultipleItems: false,
      discountPercentage: "",
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
    reader.onload = () => {
      form.setValue(field, reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: MerchantFormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const formattedBranches = data.branches?.map(b => JSON.stringify(b)) || [];
      
      // Validate that multi-branch merchants have selected branches for each deal
      if ((data.branches?.length || 0) > 1 && data.deals && data.deals.length > 0) {
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

      const response = await fetch("/api/merchants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          branches: formattedBranches,
          merchantSignDate: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit");
      }

      const merchant = await response.json();
      setLocation(`/merchant-success/${merchant.id}`);
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#00426D] text-white py-6 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center gap-4">
            <img src="/ql-logo.png" alt="Qatar Living" className="h-10" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <div>
              <h1 className="text-2xl font-bold">Merchant Partnership Application</h1>
              <p className="text-white/80 text-sm">Join Qatar Living Deals as a partner merchant</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl py-8 px-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
            console.log("Form validation errors:", errors);
            toast({
              title: "Please fix the errors below",
              description: Object.keys(errors).map(key => {
                const error = errors[key as keyof typeof errors];
                if (Array.isArray(error)) {
                  return `${key}: Check all required fields`;
                }
                return `${key}: ${(error as any)?.message || 'Invalid'}`;
              }).join(', '),
              variant: "destructive",
            });
          })} className="space-y-8">
            
            {/* Company Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#00426D]">
                  <Building2 className="h-5 w-5" />
                  Company Information
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

                  <FormField
                    control={form.control}
                    name="crNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CR Number *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="6-8 digit number" maxLength={8} data-testid="input-cr-number" />
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                </div>
              </CardContent>
            </Card>

            {/* Products Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-[#00426D]">Living Deals Products</CardTitle>
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

            {/* Business Categories */}
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
                              <Input {...field} placeholder="Branch name" data-testid={`input-branch-name-${index}`} />
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
                            <FormLabel>Phone</FormLabel>
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
                            <FormLabel>Additional Details</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="Additional details about this branch" rows={2} data-testid={`textarea-branch-detail-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Deals Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-[#00426D]">Deals</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addDeal} data-testid="button-add-deal">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Deal
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {dealFields.length === 0 && (
                  <p className="text-slate-500 text-sm text-center py-4">No deals added. Click "Add Deal" to add one.</p>
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

            {/* Fee Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-[#00426D]">Fee Structure</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-600">Fee structure will be confirmed by the Qatar Living team after reviewing your application.</p>
                </div>
              </CardContent>
            </Card>

            {/* Documents */}
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
                    label="Establishment Card"
                    field="establishmentCard"
                    form={form}
                    onChange={handleFileUpload}
                  />
                  <DocumentUpload
                    label="Trade License"
                    field="tradeLicense"
                    form={form}
                    onChange={handleFileUpload}
                  />
                  <DocumentUpload
                    label="Menu / Price List"
                    field="menuPriceList"
                    form={form}
                    onChange={handleFileUpload}
                  />
                </div>
              </CardContent>
            </Card>

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
              </CardContent>
            </Card>

            {/* Signatures */}
            <Card>
              <CardHeader>
                <CardTitle className="text-[#00426D]">Merchant Signature</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="merchantSignatoryName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Authorized Signatory Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Full name of signatory" data-testid="input-signatory-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="merchantSignDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" data-testid="input-sign-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Authorized Signatory Signature</Label>
                  <FormField
                    control={form.control}
                    name="merchantSignature"
                    render={({ field }) => (
                      <SignaturePad
                        value={field.value}
                        onSignatureChange={field.onChange}
                      />
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Qatar Living Section - Display Only */}
            <Card className="bg-slate-100">
              <CardHeader>
                <CardTitle className="text-slate-500">Qatar Living (For Office Use)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500">This section will be completed by the Qatar Living team.</p>
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

function DocumentUpload({ label, field, form, onChange }: {
  label: string;
  field: keyof MerchantFormValues;
  form: any;
  onChange: (field: keyof MerchantFormValues, e: ChangeEvent<HTMLInputElement>) => void;
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

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
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
          className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-[#FF7F39] hover:bg-[#FF7F39]/5 transition-colors"
        >
          <Upload className="h-5 w-5 text-slate-400" />
          <span className="text-sm text-slate-500">Click to upload</span>
        </div>
      )}
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
            <FormLabel className="font-medium text-slate-700">
              Is this deal valid for two tranches?
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

function DealImageUpload({ form, index }: { form: any; index: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const images = useWatch({ control: form.control, name: `deals.${index}.images` }) || [];

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newImages: string[] = [];

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onload = () => {
          if (reader.result) {
            newImages.push(reader.result as string);
          }
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }

    form.setValue(`deals.${index}.images`, [...images, ...newImages]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeImage = (imageIndex: number) => {
    const updated = images.filter((_: string, i: number) => i !== imageIndex);
    form.setValue(`deals.${index}.images`, updated);
  };

  return (
    <div className="space-y-3">
      <Label>Deal Images</Label>
      <div className="flex flex-wrap gap-3">
        {images.map((img: string, imgIndex: number) => (
          <div key={imgIndex} className="relative group">
            <img src={img} alt={`Deal image ${imgIndex + 1}`} className="w-24 h-24 object-cover rounded-lg border" />
            <button
              type="button"
              onClick={() => removeImage(imgIndex)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-[#FF7F39] hover:text-[#FF7F39] transition-colors"
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
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleUpload}
      />
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
              name={`deals.${index}.startDate`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date *</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`deals.${index}.endDate`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date *</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
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
                  <FormLabel>Redemption *</FormLabel>
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
                    <FormLabel className="font-medium text-slate-700">
                      This Deal is for Multiple Items
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
