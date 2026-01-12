import { useState, useRef, ChangeEvent, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
  Download,
  Pencil,
  Gift,
  Percent,
  Tag,
  ShoppingBag,
  Check,
  Info
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  location: z.string().min(1, "Location is required"),
  phone: z.string().optional(),
  detail: z.string().optional(),
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
  isTwoTranches: z.boolean().default(false),
  trancheValidity: z.string().optional(),
  specificDays: z.boolean().default(false),
  days: z.array(z.string()).optional(),
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().optional(),
  claimRules: z.array(z.string()).min(1, "Select at least one claim rule"),
  generalRules: z.array(z.string()).min(1, "Select at least one general rule"),
  otherRules: z.string().optional(),
  branches: z.array(z.string()).min(1, "Select at least one branch"),
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
  companyStamp: z.string().optional(),
  merchantSignDate: z.string().optional(),
  deals: z.array(dealSchema).optional(),
});

type MerchantFormValues = z.infer<typeof merchantSchema>;
type DealFormValues = z.infer<typeof dealSchema>;

const productTypes = [
  { id: "bogo", label: "Buy 1 Get 1", icon: Gift },
  { id: "discount", label: "Discount", icon: Percent },
  { id: "voucher", label: "Voucher", icon: Tag },
  { id: "bundle", label: "Bundle", icon: ShoppingBag },
];

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function MerchantOnboarding() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedDeals, setExpandedDeals] = useState<number[]>([0]);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [submittedMerchantId, setSubmittedMerchantId] = useState<string | null>(null);

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

  const watchedBranches = form.watch("branches") || [];
  const branchNames = watchedBranches.map((b: any, i: number) => b?.name || `Branch ${i + 1}`);

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
      setSubmittedMerchantId(merchant.id);
      setShowSuccessDialog(true);
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
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

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="+974 XXXX XXXX" data-testid="input-phone" />
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
                </div>
              </CardContent>
            </Card>

            {/* Products Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-[#00426D]">Living Deals Products</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="products"
                  render={({ field }) => (
                    <FormItem>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {productTypes.map((product) => {
                          const Icon = product.icon;
                          const isSelected = field.value?.includes(product.id);
                          return (
                            <div
                              key={product.id}
                              onClick={() => {
                                const newValue = isSelected
                                  ? field.value.filter((v: string) => v !== product.id)
                                  : [...(field.value || []), product.id];
                                field.onChange(newValue);
                              }}
                              className={cn(
                                "flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                                isSelected
                                  ? "border-[#FF7F39] bg-[#FF7F39]/10"
                                  : "border-slate-200 hover:border-[#FF7F39]/50"
                              )}
                              data-testid={`checkbox-product-${product.id}`}
                            >
                              <Checkbox checked={isSelected} className="pointer-events-none" />
                              <Icon className={cn("h-5 w-5", isSelected ? "text-[#FF7F39]" : "text-slate-500")} />
                              <span className="font-medium text-sm">{product.label}</span>
                            </div>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Business Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="text-[#00426D]">Business Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="businessCategories"
                  render={({ field }) => (
                    <FormItem>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {categories.map((category) => {
                          const isSelected = field.value?.includes(category.name);
                          return (
                            <div
                              key={category.id}
                              onClick={() => {
                                const newValue = isSelected
                                  ? field.value.filter((v: string) => v !== category.name)
                                  : [...(field.value || []), category.name];
                                field.onChange(newValue);
                              }}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                                isSelected
                                  ? "border-[#FF7F39] bg-[#FF7F39]/10"
                                  : "border-slate-200 hover:border-[#FF7F39]/50"
                              )}
                              data-testid={`checkbox-category-${category.id}`}
                            >
                              <Checkbox checked={isSelected} className="pointer-events-none" />
                              <span className="text-sm">{category.name}</span>
                            </div>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                            <FormLabel>Location *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Branch location" data-testid={`input-branch-location-${index}`} />
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
                              <Input {...field} placeholder="Branch phone" data-testid={`input-branch-phone-${index}`} />
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
                    branchNames={branchNames}
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
                <div className="bg-slate-50 p-4 rounded-lg space-y-4 text-sm text-slate-700 max-h-64 overflow-y-auto">
                  <h4 className="font-semibold">1. Merchant Obligations</h4>
                  <p>The Merchant agrees to honor all deals published on the Qatar Living Deals platform. Failure to do so may result in removal from the program.</p>
                  
                  <h4 className="font-semibold">2. Merchant Indemnity</h4>
                  <p>The Merchant shall indemnify and hold harmless Qatar Living from any claims arising from the Merchant's products or services.</p>
                  
                  <h4 className="font-semibold">3. Entire Agreement</h4>
                  <p>This agreement constitutes the entire agreement between the parties regarding the subject matter hereof.</p>
                  
                  <h4 className="font-semibold">4. Confidentiality</h4>
                  <p>Both parties agree to maintain the confidentiality of any proprietary information shared during the partnership.</p>
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
                  <div className="flex items-end">
                    <p className="text-sm text-slate-500">Date: {new Date().toLocaleDateString()}</p>
                  </div>
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

                <div className="space-y-2">
                  <Label>Company Stamp (Optional)</Label>
                  <DocumentUpload
                    label=""
                    field="companyStamp"
                    form={form}
                    onChange={handleFileUpload}
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

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              Application Submitted Successfully
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Thank you for submitting your merchant partnership application. Our team will review your application and get back to you soon.</p>
            <div className="bg-slate-50 p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">Optional: Upload Signed Contract</p>
              <p className="text-xs text-slate-500">If you prefer, you can download the contract, sign it manually, and upload the signed copy.</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Download PDF
                </Button>
                <UploadSignedContract merchantId={submittedMerchantId} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setLocation("/")} className="bg-[#00426D] hover:bg-[#003557]">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocumentUpload({ label, field, form, onChange }: {
  label: string;
  field: keyof MerchantFormValues;
  form: any;
  onChange: (field: keyof MerchantFormValues, e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const value = form.watch(field);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => onChange(field, e)}
      />
      {value ? (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <Check className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-700">File uploaded</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => form.setValue(field, "")}
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

function UploadSignedContract({ merchantId }: { merchantId: string | null }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
          toast({ title: "Signed contract uploaded successfully" });
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

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleUpload}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
        Upload Signed Copy
      </Button>
    </>
  );
}

function DealFormSection({ 
  index, 
  form, 
  categories, 
  claimTerms, 
  generalTerms,
  branches,
  branchNames,
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
  branchNames: string[];
  isExpanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const dealTitle = form.watch(`deals.${index}.title`) || `Deal ${index + 1}`;
  const dealCategory = form.watch(`deals.${index}.category`);
  const selectedCategory = categories.find(c => c.name === dealCategory);
  const availableSubCategories = selectedCategory?.subCategories || [];

  const offerTypes = [
    { id: "bogo", label: "Buy 1 Get 1", icon: Gift },
    { id: "discount", label: "Discount", icon: Percent },
    { id: "voucher", label: "Voucher", icon: Tag },
    { id: "bundle", label: "Bundle", icon: ShoppingBag },
  ];

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span className="font-medium">{dealTitle}</span>
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
                  <Select onValueChange={field.onChange} value={field.value} disabled={!dealCategory}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select sub-category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableSubCategories.map((sub) => (
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
                  <FormLabel>Duration *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1 month">1 Month</SelectItem>
                      <SelectItem value="3 months">3 Months</SelectItem>
                      <SelectItem value="6 months">6 Months</SelectItem>
                      <SelectItem value="1 year">1 Year</SelectItem>
                    </SelectContent>
                  </Select>
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
          </div>

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

          <FormField
            control={form.control}
            name={`deals.${index}.claimRules`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Claim Rules *</FormLabel>
                <div className="space-y-2">
                  {claimTerms.map((term) => {
                    const isSelected = field.value?.includes(term.text);
                    return (
                      <div
                        key={term.id}
                        onClick={() => {
                          const newValue = isSelected
                            ? field.value.filter((v: string) => v !== term.text)
                            : [...(field.value || []), term.text];
                          field.onChange(newValue);
                        }}
                        className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-slate-50"
                      >
                        <Checkbox checked={isSelected} className="pointer-events-none" />
                        <span className="text-sm" dangerouslySetInnerHTML={{ __html: term.text }} />
                      </div>
                    );
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`deals.${index}.generalRules`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>General Rules *</FormLabel>
                <div className="space-y-2">
                  {generalTerms.map((term) => {
                    const isSelected = field.value?.includes(term.text);
                    return (
                      <div
                        key={term.id}
                        onClick={() => {
                          const newValue = isSelected
                            ? field.value.filter((v: string) => v !== term.text)
                            : [...(field.value || []), term.text];
                          field.onChange(newValue);
                        }}
                        className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-slate-50"
                      >
                        <Checkbox checked={isSelected} className="pointer-events-none" />
                        <span className="text-sm" dangerouslySetInnerHTML={{ __html: term.text }} />
                      </div>
                    );
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`deals.${index}.branches`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Applicable Branches *</FormLabel>
                {branchNames.length === 0 ? (
                  <p className="text-sm text-slate-500">Add branches above first</p>
                ) : (
                  <div className="space-y-2">
                    {branchNames.map((branchName, branchIndex) => {
                      const displayName = branchName || `Branch ${branchIndex + 1}`;
                      const isSelected = field.value?.includes(displayName);
                      return (
                        <div
                          key={branchIndex}
                          onClick={() => {
                            const newValue = isSelected
                              ? field.value.filter((v: string) => v !== displayName)
                              : [...(field.value || []), displayName];
                            field.onChange(newValue);
                          }}
                          className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-slate-50"
                        >
                          <Checkbox checked={isSelected} className="pointer-events-none" />
                          <span className="text-sm">{displayName}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );
}
