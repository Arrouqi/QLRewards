import { useState, useRef, ChangeEvent, useCallback, useMemo, useEffect } from "react";
import { compressImage, compressImages } from "@/lib/compressImage";
import { useForm, useFieldArray, useWatch, useFormState } from "react-hook-form";
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
  Check,
  Info,
  ImageIcon,
  HelpCircle,
  Download,
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
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { BilingualTabs } from "@/components/BilingualTabs";
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
import { useAutoTranslate } from "@/hooks/useAutoTranslate";
import * as XLSX from "xlsx";

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

type TFn = (key: string, options?: any) => string;

const makeBranchSchema = (t: TFn) => z.object({
  name: z.string().min(1, t("validation.branchNameRequired")),
  location: z.string().min(1, t("validation.branchLocationRequired")),
  phone: z.string().min(1, t("validation.branchPhoneRequired")),
  detail: z.string().optional(),
});

const makeDealSchema = (t: TFn) => z.object({
  category: z.string().default(""),
  subCategory: z.string().default(""),
  dealType: z.string().default(""),
  duration: z.string().min(1, t("validation.durationRequired")),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  estimatedSavings: z.string().min(1, t("validation.estimatedSavingsRequired")),
  estimatedSavingsNote: z.string().max(200).optional(),
  estimatedSavingsNoteAr: z.string().max(200).optional(),
  redemption: z.string().min(1, t("validation.redemptionRequired")),
  limitPerUser: z.string().optional(),
  originalPrice: z.string().optional(),
  isMultipleItems: z.boolean().default(false),
  discountPercentage: z.string().optional(),
  discountedPrice: z.string().optional(),
  isTwoTranches: z.boolean().default(false),
  trancheValidity: z.string().optional(),
  specificDays: z.boolean().default(false),
  days: z.array(z.string()).optional(),
  title: z.string().min(5, t("validation.titleMin")),
  titleAr: z.string().refine(
    (value) => value.trim() === "" || value.trim().length >= 5,
    t("validation.titleArMin"),
  ).optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  claimRules: z.array(z.string()).optional(),
  generalRules: z.array(z.string()).optional(),
  otherRules: z.string().optional(),
  branches: z.array(z.string()).optional(),
  images: z.array(z.string()).min(4, t("validation.imagesMin")),
}).superRefine((deal, ctx) => {
  if (deal.specificDays && (!deal.days || deal.days.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["days"],
      message: t("validation.validDaysRequired"),
    });
  }
});

const makeMerchantSchema = (t: TFn) => z.object({
  companyName: z.string().min(1, t("validation.companyNameRequired")),
  companyNameAr: z.string().optional(),
  crNumber: z.string().optional(),
  brandName: z.string().optional(),
  brandNameAr: z.string().optional(),
  address: z.string().min(1, t("validation.addressRequired")),
  contactPerson: z.string().min(1, t("validation.contactPersonRequired")),
  email: z.string().email(t("validation.emailValid")),
  phone: z.string().min(1, t("validation.phoneRequired")),
  pocName: z.string().min(1, t("validation.pocNameRequired")),
  pocPhone: z.string().min(1, t("validation.pocPhoneRequired")),
  pocEmail: z.union([z.string().email(t("validation.emailValid")), z.literal("")]).optional(),
  products: z.array(z.string()).optional(),
  businessCategories: z.array(z.string()).optional(),
  branches: z.array(makeBranchSchema(t)).min(1, t("validation.branchesRequired")),
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
  termsAccepted: z.boolean().refine(val => val === true, {
    message: t("validation.termsRequired"),
  }),
  deals: z.array(makeDealSchema(t)).min(1, t("validation.dealsRequired")),
}).superRefine((data, ctx) => {
  if (!data.crNumber || !/^[a-zA-Z0-9]{4,14}$/.test(data.crNumber)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["crNumber"], message: t("validation.crNumberFormat") });
  }
  if (!data.brandName || data.brandName.trim() === "") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["brandName"], message: t("validation.brandNameRequired") });
  }
  if (!data.crDocument || data.crDocument.trim() === "") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["crDocument"], message: t("validation.crDocumentRequired") });
  }
  if (!data.logo || data.logo.trim() === "") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["logo"], message: t("validation.logoRequired") });
  }
  if (!data.coverImage || data.coverImage.trim() === "") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["coverImage"], message: t("validation.coverImageRequired") });
  }
});

const passthroughT: TFn = (key: string) => key;
const merchantSchemaBase = makeMerchantSchema(passthroughT);

type MerchantFormValues = z.infer<typeof merchantSchemaBase>;
type DealFormValues = z.infer<ReturnType<typeof makeDealSchema>>;

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type TemplateRow = Record<string, unknown>;

const readTemplateRows = async (file: File): Promise<TemplateRow[]> => {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) return [];
  return XLSX.utils.sheet_to_json<TemplateRow>(firstSheet, { defval: "" });
};

const normalizeTemplateHeader = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const templateCell = (row: TemplateRow, ...headers: string[]) => {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [normalizeTemplateHeader(key), value]),
  );
  for (const header of headers) {
    const value = normalized.get(normalizeTemplateHeader(header));
    if (value !== undefined && value !== null) return String(value).trim();
  }
  return "";
};

const templateList = (value: string, splitCommas = false) =>
  value
    .split(splitCommas ? /\r?\n|[|;,]/ : /\r?\n|[|;]/)
    .map((item) => item.trim())
    .filter(Boolean);

const templateBoolean = (value: string) =>
  ["yes", "true", "1", "y"].includes(value.trim().toLowerCase());

const normalizeTemplateOption = (value: string) =>
  value
    .replace(/&amp;/gi, "&")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const matchTemplateOption = (value: string, options: string[]) => {
  const normalizedValue = normalizeTemplateOption(value);
  if (!normalizedValue) return "";
  return options.find((option) => normalizeTemplateOption(option) === normalizedValue) || value.trim();
};

const matchTemplateTerms = (
  value: string,
  terms: { text: string }[],
) =>
  templateList(value).map((item) =>
    matchTemplateOption(item, terms.map((term) => term.text)),
  );

export default function MerchantOnboarding() {
  const { t, i18n } = useTranslation(["onboarding", "common"]);
  const merchantSchema = useMemo(() => makeMerchantSchema(t), [i18n.language]);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedDeals, setExpandedDeals] = useState<number[]>([0]);
  const branchTemplateInputRef = useRef<HTMLInputElement>(null);
  const dealTemplateInputRef = useRef<HTMLInputElement>(null);
  const [isImportingTemplate, setIsImportingTemplate] = useState<"branches" | "deals" | null>(null);
    
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
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
      companyNameAr: "",
      crNumber: "",
      brandName: "",
      brandNameAr: "",
      address: "",
      contactPerson: "",
      email: "",
      phone: "",
      pocName: "",
      pocPhone: "",
      pocEmail: "",
      products: [],
      businessCategories: [],
      branches: [],
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
      termsAccepted: false,
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

  useAutoTranslate(form, "companyName", "companyNameAr");
  useAutoTranslate(form, "brandName", "brandNameAr");

  const addBranch = () => {
    appendBranch({ name: "", location: "", phone: "", detail: "" });
  };

  const importBranchesTemplate = async (file: File) => {
    setIsImportingTemplate("branches");
    try {
      const rows = await readTemplateRows(file);
      const importedBranches = rows
        .filter((row) => Object.values(row).some((value) => String(value ?? "").trim() !== ""))
        .map((row) => ({
          name: templateCell(row, "Branch Name"),
          location: templateCell(row, "Google Location", "Location"),
          phone: templateCell(row, "Branch Manager Phone Number", "Phone number", "Phone"),
          detail: templateCell(row, "Address Details", "Address Detail"),
        }));

      if (importedBranches.length === 0) {
        throw new Error(t("toast.templateNoRows"));
      }
      appendBranch(importedBranches);
      toast({
        title: t("toast.templateImportedTitle"),
        description: t("toast.branchesImported", { count: importedBranches.length }),
      });
    } catch (error) {
      toast({
        title: t("toast.templateImportFailedTitle"),
        description: error instanceof Error ? error.message : t("toast.templateImportFailed"),
        variant: "destructive",
      });
    } finally {
      setIsImportingTemplate(null);
      if (branchTemplateInputRef.current) branchTemplateInputRef.current.value = "";
    }
  };

  const importDealsTemplate = async (file: File) => {
    setIsImportingTemplate("deals");
    try {
      const rows = await readTemplateRows(file);
      const importedDeals: DealFormValues[] = rows
        .filter((row) => Object.values(row).some((value) => String(value ?? "").trim() !== ""))
        .slice(0, Math.max(0, 20 - dealFields.length))
        .map((row) => {
          const redemptionValue = templateCell(row, "Redemption", "Redemption (Unlimited/Limited)").toLowerCase();
          const dealTypeValue = templateCell(row, "Deal Type").toLowerCase().replace(/[\s_-]/g, "");
          const categoryValue = templateCell(row, "Category");
          const matchedCategory = categories.find(
            (category) =>
              normalizeTemplateOption(category.name) === normalizeTemplateOption(categoryValue),
          );
          const subCategoryValue = templateCell(row, "Sub-Category", "Sub Category");
          const matchedSubCategory = matchedCategory?.subCategories.find(
            (subCategory) =>
              normalizeTemplateOption(subCategory.name) === normalizeTemplateOption(subCategoryValue),
          );
          const normalizedDealType =
            ["buy1get1", "buyonegetone", "bogo"].includes(dealTypeValue)
              ? "bogo"
              : ["discount", "voucher", "bundle"].includes(dealTypeValue)
                ? dealTypeValue
                : "";
          const validDays = templateList(
            templateCell(row, "Valid Days (Required if Specific Days = Yes)", "Valid Days", "Days"),
            true,
          )
            .map((day) => matchTemplateOption(day, daysOfWeek))
            .filter((day) => daysOfWeek.includes(day));
          const additionalTerms = [
            ...templateList(templateCell(row, "Claim Rules")),
            templateCell(row, "Other Rules / Additional Terms", "Additional Terms", "Other (Optional)", "Other"),
          ].filter(Boolean).join("; ");
          return {
            category: matchedCategory?.name || categoryValue,
            subCategory: matchedSubCategory?.name || subCategoryValue,
            dealType: normalizedDealType,
            duration: templateCell(row, "Duration (Days/Weeks/Months/Years)", "Duration"),
            startDate: "",
            endDate: "",
            estimatedSavings: templateCell(row, "EST.Savings", "Estimated Savings"),
            estimatedSavingsNote: templateCell(row, "Estimated Savings Note", "Estimated Savings Note (English)"),
            estimatedSavingsNoteAr: templateCell(row, "Estimated Savings Note (Arabic)", "Arabic Estimated Savings Note"),
            redemption: redemptionValue.includes("limited") && !redemptionValue.includes("unlimited")
              ? "limited"
              : redemptionValue.includes("unlimited")
                ? "unlimited"
                : "",
            limitPerUser: templateCell(row, "Limit Per User"),
            originalPrice: templateCell(row, "Original Price"),
            isMultipleItems: templateBoolean(templateCell(row, "Is Multiple Items (Yes/No)", "Is Multiple Items", "Multiple Items")),
            discountPercentage: templateCell(row, "Discount Percentage", "Discount %"),
            discountedPrice: templateCell(row, "Discounted Price"),
            isTwoTranches: templateBoolean(templateCell(row, "Is Two Tranches (Yes/No)", "Is Two Tranches", "Two Tranches")),
            trancheValidity: templateCell(row, "Tranche Validity").replace(/\s*weeks?\s*$/i, ""),
            specificDays: templateBoolean(templateCell(row, "Specific Days Only (Yes/No)", "Specific Days Only", "Specific Days")) || validDays.length > 0,
            days: validDays.length > 0
              ? validDays
              : templateBoolean(templateCell(row, "Specific Days Only (Yes/No)", "Specific Days Only", "Specific Days"))
                ? []
                : daysOfWeek,
            title: templateCell(row, "Deal title", "Deal Title", "Title"),
            titleAr: templateCell(row, "Deal Title (Arabic) (Optional)", "Deal Title (Arabic)", "Title (Arabic)", "Arabic Deal Title"),
            description: templateCell(row, "Description"),
            descriptionAr: templateCell(row, "Description (Arabic) (Optional)", "Description (Arabic)", "Arabic Description"),
            claimRules: [],
            generalRules: matchTemplateTerms(templateCell(row, "General Rules"), generalTerms),
            otherRules: additionalTerms,
            branches: [],
            images: Array.from({ length: 10 }, (_, imageIndex) =>
              templateCell(row, `Image ${imageIndex + 1} URL`, `Image ${imageIndex + 1}`),
            ).filter(Boolean),
          };
        });

      if (importedDeals.length === 0) {
        throw new Error(t("toast.templateNoRows"));
      }
      appendDeal(importedDeals);
      setExpandedDeals((previous) => [
        ...previous,
        ...importedDeals.map((_, index) => dealFields.length + index),
      ]);
      toast({
        title: t("toast.templateImportedTitle"),
        description: t("toast.dealsImported", { count: importedDeals.length }),
      });
      if (rows.length > importedDeals.length) {
        toast({
          title: t("toast.dealImportLimitTitle"),
          description: t("toast.dealImportLimit"),
        });
      }
    } catch (error) {
      toast({
        title: t("toast.templateImportFailedTitle"),
        description: error instanceof Error ? error.message : t("toast.templateImportFailed"),
        variant: "destructive",
      });
    } finally {
      setIsImportingTemplate(null);
      if (dealTemplateInputRef.current) dealTemplateInputRef.current.value = "";
    }
  };

  // Remove a branch and strip its id from every deal's selection
  const handleRemoveBranch = (index: number) => {
    const removedId = branchFields[index]?.id;
    removeBranch(index);
    if (removedId) {
      const currentDeals = form.getValues("deals") || [];
      currentDeals.forEach((deal: any, i: number) => {
        if (deal?.branches?.includes(removedId)) {
          form.setValue(`deals.${i}.branches`, deal.branches.filter((v: string) => v !== removedId));
        }
      });
    }
  };

  const addDeal = () => {
    appendDeal({
      category: "",
      subCategory: "",
      dealType: "",
      duration: "",
      startDate: "",
      endDate: "",
      estimatedSavings: "",
      estimatedSavingsNote: "",
      estimatedSavingsNoteAr: "",
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
      titleAr: "",
      description: "",
      descriptionAr: "",
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

  const handleFileUpload = async (field: keyof MerchantFormValues, e: ChangeEvent<HTMLInputElement>, onError?: (msg: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");

    if (!isImage && file.size > 25 * 1024 * 1024) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      const msg = t("toast.fileSizeExceeds", { name: file.name, size: sizeMB });
      if (onError) onError(msg);
      if (e.target) e.target.value = "";
      return;
    }

    if (e.target) e.target.value = "";

    const { file: fileToUpload, error } = isImage
      ? await compressImage(file, "merchant")
      : { file, error: undefined };

    if (error) {
      if (onError) onError(error);
      return;
    }

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
    reader.readAsDataURL(fileToUpload);
  };

  const onSubmit = async (data: MerchantFormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const formattedBranches = data.branches?.map(b => JSON.stringify(b)) || [];

      const dealsWithBranchNames = data.deals?.map(d => ({
        ...d,
        branches: [],
      }));

      const payload: any = {
        ...data,
        companyType: "individual",
        branches: formattedBranches,
        brands: [],
        deals: dealsWithBranchNames || [],
      };

      const response = await fetch("/api/merchants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = t("toast.failedSubmit");
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          if (response.status === 413) {
            errorMessage = t("toast.filesTooLarge");
          } else if (response.status >= 500) {
            errorMessage = t("toast.serverError");
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
        description = t("toast.couldNotConnect");
      } else if (msg.toLowerCase().includes("invalid string length") || msg.toLowerCase().includes("string length")) {
        description = t("toast.imagesTooLarge");
      } else if (msg.toLowerCase().includes("413") || msg.includes("too large") || msg.includes("payload")) {
        description = t("toast.totalTooLarge");
      } else if (!msg) {
        description = t("toast.somethingWrong");
      }

      toast({
        title: t("toast.submissionFailedTitle"),
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
        <div className="absolute top-3 right-4 flex items-center gap-3">
          <LanguageSwitcher className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white" />
          <a href="/admin/login" className="text-xs text-white/40 hover:text-white/70 transition-colors" data-testid="link-staff-login">{t("staffLogin")}</a>
        </div>
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center gap-4 mb-6">
            <img src="/ql-logo.png" alt="Qatar Living" className="h-10" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">{t("hero.title")}</h1>
          <p className="text-white/80 text-lg mb-8 max-w-2xl">
            {t("hero.subtitle")}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
              <Users className="h-5 w-5 text-[#FF7F39] flex-shrink-0" />
              <span className="text-sm text-white/90">{t("hero.audience")}</span>
            </div>
            <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
              <TrendingUp className="h-5 w-5 text-[#FF7F39] flex-shrink-0" />
              <span className="text-sm text-white/90">{t("hero.revenue")}</span>
            </div>
            <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
              <Zap className="h-5 w-5 text-[#FF7F39] flex-shrink-0" />
              <span className="text-sm text-white/90">{t("hero.setup")}</span>
            </div>
            <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
              <Shield className="h-5 w-5 text-[#FF7F39] flex-shrink-0" />
              <span className="text-sm text-white/90">{t("hero.trusted")}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl py-8 px-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
            console.log("Form validation errors:", errors);
            const fieldLabels: Record<string, string> = {
              companyName: t("validation.fieldLabels.companyName"),
              companyNameAr: t("validation.fieldLabels.companyNameAr"),
              crNumber: t("validation.fieldLabels.crNumber"),
              brandName: t("validation.fieldLabels.brandName"),
              brandNameAr: t("validation.fieldLabels.brandNameAr"),
              address: t("validation.fieldLabels.address"),
              contactPerson: t("validation.fieldLabels.contactPerson"),
              email: t("validation.fieldLabels.email"),
              phone: t("validation.fieldLabels.phone"),
              crDocument: t("validation.fieldLabels.crDocument"),
              termsAccepted: t("validation.fieldLabels.termsAccepted"),
              branches: t("validation.fieldLabels.branches"),
              deals: t("validation.fieldLabels.deals"),
              whatsapp: t("validation.fieldLabels.whatsapp"),
              logo: t("validation.fieldLabels.logo"),
              coverImage: t("validation.fieldLabels.coverImage"),
              pocName: t("poc.name"),
              pocPhone: t("poc.phone"),
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
                  return `${t("validation.dealPrefix", { num: i + 1 })}${fields.join(", ")}`;
                }).filter(Boolean);
                return dealErrors.length > 0 ? dealErrors.join("; ") : t("validation.checkDealFields");
              }
              return `${label}: ${(error as any)?.message || t("validation.required")}`;
            });
            toast({
              title: t("toast.fixErrorsTitle"),
              description: messages.join(". "),
              variant: "destructive",
            });
            const firstErrorField = document.querySelector('[data-error="true"], .text-destructive');
            if (firstErrorField) {
              firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          })} className="space-y-8">
            
            {/* Company Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#00426D]">
                  <Building2 className="h-5 w-5" />
                  {t("companyInfo.companyTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <BilingualTabs
                    idPrefix="company-name"
                    hasEnglishError={!!form.formState.errors.companyName}
                    hasArabicError={!!form.formState.errors.companyNameAr}
                    english={
                      <FormField
                        control={form.control}
                        name="companyName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("companyInfo.companyName")}</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder={t("companyInfo.companyNamePlaceholder")} data-testid="input-company-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    }
                    arabic={
                      <FormField
                        control={form.control}
                        name="companyNameAr"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("companyInfo.companyNameAr")}</FormLabel>
                            <FormControl>
                              <Input {...field} dir="rtl" placeholder={t("companyInfo.companyNameArPlaceholder")} data-testid="input-company-name-ar" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    }
                  />

                  <>
                      <FormField
                        control={form.control}
                        name="crNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5">
                              {t("companyInfo.crNumber")}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-slate-400" /></TooltipTrigger>
                                  <TooltipContent><p className="max-w-xs text-xs">{t("companyInfo.crNumberTooltip")}</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </FormLabel>
                            <FormControl>
                              <Input {...field} placeholder={t("companyInfo.crNumberPlaceholder")} maxLength={14} data-testid="input-cr-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <BilingualTabs
                        idPrefix="brand-name"
                        hasEnglishError={!!form.formState.errors.brandName}
                        hasArabicError={!!form.formState.errors.brandNameAr}
                        english={
                          <FormField
                            control={form.control}
                            name="brandName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("companyInfo.brandName")}</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder={t("companyInfo.brandNamePlaceholder")} data-testid="input-brand-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        }
                        arabic={
                          <FormField
                            control={form.control}
                            name="brandNameAr"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("companyInfo.brandNameAr")}</FormLabel>
                                <FormControl>
                                  <Input {...field} dir="rtl" placeholder={t("companyInfo.brandNameArPlaceholder")} data-testid="input-brand-name-ar" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        }
                      />
                    </>
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("companyInfo.address")}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t("companyInfo.addressPlaceholder")} data-testid="input-address" />
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
                        <FormLabel>{t("companyInfo.contactPerson")}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t("companyInfo.contactPersonPlaceholder")} data-testid="input-contact-person" />
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
                        <FormLabel>{t("companyInfo.email")}</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder={t("companyInfo.emailPlaceholder")} data-testid="input-email" />
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
                        <FormLabel>{t("companyInfo.phone")}</FormLabel>
                        <FormControl>
                          <PhoneInput
                            value={field.value}
                            onChange={field.onChange}
                            placeholder={t("companyInfo.phonePlaceholder")}
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
                        <FormLabel>{t("companyInfo.whatsapp")}</FormLabel>
                        <FormControl>
                          <PhoneInput
                            value={field.value || ""}
                            onChange={field.onChange}
                            placeholder={t("companyInfo.whatsappPlaceholder")}
                            data-testid="input-whatsapp"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold text-[#00426D]">{t("poc.title")}</h3>
                  <p className="text-sm text-slate-500 mt-1 mb-4">{t("poc.subtitle")}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="pocName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("poc.name")} *</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder={t("poc.namePlaceholder")} data-testid="input-poc-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="pocPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("poc.phone")} *</FormLabel>
                          <FormControl>
                            <PhoneInput
                              value={field.value || ""}
                              onChange={field.onChange}
                              placeholder={t("poc.phonePlaceholder")}
                              data-testid="input-poc-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="pocEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("poc.email")}</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} type="email" placeholder={t("poc.emailPlaceholder")} data-testid="input-poc-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Conditions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-[#00426D]">{t("conditions.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="text-[#FF7F39] font-bold mt-0.5">•</span>
                    <span>{t("conditions.item1")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#FF7F39] font-bold mt-0.5">•</span>
                    <span>{t("conditions.item2")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#FF7F39] font-bold mt-0.5">•</span>
                    <span>{t("conditions.item3")}</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Branches */}
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-[#00426D]">{t("branches.title")} *</CardTitle>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" asChild data-testid="button-download-branch-template">
                    <a href="/templates/Address_Template_for_Merchants.xlsx" download>
                      <Download className="h-4 w-4 mr-1" />
                      {t("branches.downloadTemplate")}
                    </a>
                  </Button>
                  <input
                    ref={branchTemplateInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void importBranchesTemplate(file);
                    }}
                    data-testid="input-branch-template"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => branchTemplateInputRef.current?.click()}
                    disabled={isImportingTemplate !== null}
                    data-testid="button-upload-branch-template"
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    {isImportingTemplate === "branches" ? t("branches.importing") : t("branches.uploadTemplate")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addBranch} data-testid="button-add-branch">
                    <Plus className="h-4 w-4 mr-1" />
                    {t("branches.addBranch")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-500">{t("branches.templateGuide")}</p>
                {branchFields.length === 0 && (
                  <p className="text-slate-500 text-sm text-center py-4">{t("branches.empty")}</p>
                )}
                {branchFields.map((branch, index) => (
                  <div key={branch.id} className="p-4 border rounded-lg space-y-4 relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                      onClick={() => handleRemoveBranch(index)}
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
                            <FormLabel>{t("branches.branchName")}</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder={t("branches.branchNamePlaceholder")} 
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
                            <FormLabel>{t("branches.location")} *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder={t("branches.locationPlaceholder")} data-testid={`input-branch-location-${index}`} />
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
                            <FormLabel>{t("branches.phone")}</FormLabel>
                            <FormControl>
                              <PhoneInput
                                value={field.value}
                                onChange={field.onChange}
                                placeholder={t("branches.phonePlaceholder")}
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
                            <FormLabel>{t("branches.addressDetails")}</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder={t("branches.addressDetailsPlaceholder")} rows={2} data-testid={`textarea-branch-detail-${index}`} />
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
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-[#00426D]">
                  {t("deals.title")} * {dealFields.length > 0 && <span className="text-slate-400 font-normal text-sm">({dealFields.length}/20)</span>}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" asChild data-testid="button-download-deal-template">
                    <a href="/templates/Deals_Offers_Template.xlsx" download>
                      <Download className="h-4 w-4 mr-1" />
                      {t("deals.downloadTemplate")}
                    </a>
                  </Button>
                  <input
                    ref={dealTemplateInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void importDealsTemplate(file);
                    }}
                    data-testid="input-deal-template"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => dealTemplateInputRef.current?.click()}
                    disabled={isImportingTemplate !== null || dealFields.length >= 20}
                    data-testid="button-upload-deal-template"
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    {isImportingTemplate === "deals" ? t("deals.importing") : t("deals.uploadTemplate")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addDeal}
                    disabled={dealFields.length >= 20}
                    data-testid="button-add-deal"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t("deals.addDeal")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-500">{t("deals.templateGuide")}</p>
                {dealFields.length === 0 && (
                  <p className="text-slate-500 text-sm text-center py-4">{t("deals.empty")}</p>
                )}
                {dealFields.length >= 20 && (
                  <p className="text-amber-600 text-sm text-center py-2 bg-amber-50 rounded-md">{t("deals.maxReached")}</p>
                )}
                {dealFields.map((deal, index) => (
                  <DealFormSection
                    key={deal.id}
                    index={index}
                    form={form}
                    generalTerms={generalTerms}
                    isExpanded={expandedDeals.includes(index)}
                    onToggle={() => toggleDealExpansion(index)}
                    onRemove={() => removeDeal(index)}
                  />
                ))}
              </CardContent>
            </Card>

            {/* Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#00426D]">
                  <FileText className="h-5 w-5" />
                  {t("documents.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <DocumentUpload
                    label={t("documents.crDocument")}
                    field="crDocument"
                    form={form}
                    onChange={handleFileUpload}
                  />
                  <DocumentUpload
                    label={t("documents.establishmentCard")}
                    field="establishmentCard"
                    form={form}
                    onChange={handleFileUpload}
                  />
                  <DocumentUpload
                    label={t("documents.tradeLicense")}
                    field="tradeLicense"
                    form={form}
                    onChange={handleFileUpload}
                  />
                  <DocumentUpload
                    label={t("documents.menuPriceList")}
                    field="menuPriceList"
                    form={form}
                    onChange={handleFileUpload}
                  />
                  <DocumentUpload
                    label={t("documents.taxCard")}
                    field="taxCardDocument"
                    form={form}
                    onChange={handleFileUpload}
                  />
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium text-[#00426D] mb-4">{t("documents.brandAssets")}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <DocumentUpload
                      label={`${t("documents.logo")} *`}
                      field="logo"
                      form={form}
                      onChange={handleFileUpload}
                      accept="image/*"
                    />
                    <DocumentUpload
                      label={`${t("documents.coverImage")} *`}
                      field="coverImage"
                      form={form}
                      onChange={handleFileUpload}
                      accept="image/*"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Terms */}
            <Card>
              <CardHeader>
                <CardTitle className="text-[#00426D]">{t("terms.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-50 p-4 rounded-lg space-y-4 text-sm text-slate-700 max-h-80 overflow-y-auto">
                  <h4 className="font-semibold text-[#00426D]">{t("terms.obligationsTitle")}</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>{t("terms.obligation1")}</li>
                    <li>{t("terms.obligation2")}</li>
                    <li>{t("terms.obligation3")}</li>
                    <li>{t("terms.obligation4")}</li>
                  </ul>
                  
                  <h4 className="font-semibold text-[#00426D] pt-3">{t("terms.indemnityTitle")}</h4>
                  <p>{t("terms.indemnityText")}</p>
                  
                  <h4 className="font-semibold text-[#00426D] pt-3">{t("terms.entireAgreementTitle")}</h4>
                  <p>{t("terms.entireAgreementText1")}<a href="https://www.qatarliving.com/terms-of-use" target="_blank" rel="noopener noreferrer" className="text-[#00426D] hover:underline">https://www.qatarliving.com/terms-of-use</a>{t("terms.entireAgreementText2")}</p>
                  
                  <p className="pt-3">{t("terms.linkLabel")}<br/>
                  <a href="https://www.qatarliving.com/terms-of-use" target="_blank" rel="noopener noreferrer" className="text-[#00426D] hover:underline">https://www.qatarliving.com/terms-of-use</a></p>
                  
                  <p className="pt-3 font-medium border-t border-slate-200 mt-3 pt-3">{t("terms.acknowledge")}</p>
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
                          {t("terms.agreeCheckbox")}
                        </FormLabel>
                        <FormDescription className="text-xs text-slate-500">
                          {t("terms.agreeDescription")}
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex justify-end gap-4 pb-8">
              <Button type="button" variant="outline" onClick={() => setLocation("/")}>
                {t("buttons.cancel")}
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
                    {t("buttons.submitting")}
                  </>
                ) : (
                  t("buttons.submit")
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
  onChange: (field: any, e: ChangeEvent<HTMLInputElement>, onError?: (msg: string) => void) => void;
  accept?: string;
}) {
  const { t } = useTranslation(["onboarding", "common"]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const currentValue = useWatch({ control: form.control, name: field });
  const isUploaded = !!(currentValue && currentValue !== "");

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setFileName(file.name);
    onChange(field, e, (msg: string) => {
      setUploadError(msg);
      setFileName(null);
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  const handleClear = () => {
    form.setValue(field, "");
    setFileName(null);
    setUploadError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const fieldError = form.formState.errors?.[field];
  const isImage = accept === "image/*";

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

      {isUploaded ? (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <Check className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-sm text-green-700 truncate flex-1" title={fileName || undefined}>
            {fileName || t("upload.fileUploaded")}
          </span>
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setUploadError(null); inputRef.current?.click(); }}
              className="text-slate-500 hover:text-[#00426D] h-7 px-2 text-xs"
              title={t("upload.replaceTitle", { label })}
            >
              <Pencil className="h-3 w-3 mr-1" />
              {t("upload.replace")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-red-500 hover:text-red-700 h-7 px-2 text-xs"
              title={t("upload.removeTitle", { label })}
            >
              <X className="h-3 w-3 mr-1" />
              {t("upload.remove")}
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => { setUploadError(null); inputRef.current?.click(); }}
          className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            fieldError || uploadError
              ? "border-red-300 bg-red-50/50 hover:border-red-500"
              : "border-slate-300 hover:border-[#FF7F39] hover:bg-[#FF7F39]/5"
          }`}
        >
          <Upload className={`h-5 w-5 ${fieldError || uploadError ? "text-red-400" : "text-slate-400"}`} />
          <span className={`text-sm ${fieldError || uploadError ? "text-red-500" : "text-slate-500"}`}>
            {isImage ? t("upload.clickImage") : t("upload.clickFile")}
          </span>
        </div>
      )}

      {uploadError && (
        <p className="text-sm text-red-600 flex items-start gap-1" data-testid={`text-size-error-${field}`}>
          <span className="shrink-0 mt-0.5">⚠</span>
          <span><strong>{label}:</strong> {uploadError}</span>
        </p>
      )}
      {fieldError && !uploadError && (
        <p className="text-sm text-red-500" data-testid={`text-error-${field}`}>{fieldError.message as string}</p>
      )}
    </div>
  );
}

function TwoTranchesSection({ form, index }: { form: any; index: number }) {
  const { t } = useTranslation(["onboarding", "common"]);
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
              {t("onboarding:deals.twoTranches")}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-slate-400" /></TooltipTrigger>
                  <TooltipContent><p className="max-w-xs text-xs">{t("onboarding:deals.twoTranchesTooltip")}</p></TooltipContent>
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
                <FormLabel className="text-xs font-bold text-slate-500 uppercase">{t("onboarding:deals.trancheValidity")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-11 bg-white">
                      <SelectValue placeholder={t("onboarding:deals.trancheChoose")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n === 1 ? t("onboarding:deals.weekSingular", { count: n }) : t("onboarding:deals.weekPlural", { count: n })}
                      </SelectItem>
                    ))}
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
  const { t } = useTranslation(["onboarding", "common"]);
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
              {t("onboarding:deals.specificDays")}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-slate-400" /></TooltipTrigger>
                  <TooltipContent><p className="max-w-xs text-xs">{t("onboarding:deals.specificDaysTooltip")}</p></TooltipContent>
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
              {t("onboarding:deals.weekdays")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={setWeekends} data-testid={`button-weekends-${index}`}>
              {t("onboarding:deals.weekends")}
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
                <span className="text-sm">{t(`onboarding:days.${day}`)}</span>
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
  const { t } = useTranslation(["onboarding", "common"]);
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const images = useWatch({ control: form.control, name: `deals.${index}.images` }) || [];

  const uploadFiles = async (files: File[]): Promise<string[]> => {
    const { files: compressed, errors } = await compressImages(files, "deal");
    if (errors.length > 0) throw new Error(errors.join(", "));

    const base64List: string[] = [];
    for (const file of compressed) {
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
    if (!res.ok) throw new Error(t("onboarding:toast.uploadFailed"));
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
      <Label>{t("onboarding:deals.dealImages", { count: images.length })}</Label>

      {imageError && (
        <p className="text-sm text-red-500" data-testid={`text-deal-images-error-${index}`}>
          {t("onboarding:deals.imagesError")}
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
              alt={t("onboarding:deals.imageAlt", { num: imgIndex + 1 })}
              className="w-24 h-24 object-cover rounded-lg border border-slate-200"
            />
            <div className="flex gap-1">
              <button
                type="button"
                title={t("onboarding:deals.replace")}
                onClick={() => { setReplacingIndex(imgIndex); replaceInputRef.current?.click(); }}
                className="flex items-center gap-0.5 text-xs text-slate-500 hover:text-[#00426D] bg-slate-100 hover:bg-slate-200 rounded px-1.5 py-0.5 transition-colors"
                data-testid={`button-replace-image-${index}-${imgIndex}`}
              >
                <Pencil className="h-3 w-3" />
                <span>{t("onboarding:deals.replace")}</span>
              </button>
              <button
                type="button"
                title={t("onboarding:deals.remove")}
                onClick={() => removeImage(imgIndex)}
                className="flex items-center gap-0.5 text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded px-1.5 py-0.5 transition-colors"
                data-testid={`button-remove-image-${index}-${imgIndex}`}
              >
                <X className="h-3 w-3" />
                <span>{t("onboarding:deals.remove")}</span>
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
              <span className="text-xs">{t("onboarding:deals.addImage")}</span>
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
  generalTerms,
  isExpanded, 
  onToggle, 
  onRemove 
}: {
  index: number;
  form: any;
  generalTerms: { id: number; type: string; text: string }[];
  isExpanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation(["onboarding", "common"]);

  const dealTypeValue = useWatch({ control: form.control, name: `deals.${index}.dealType` });
  const redemptionValue = useWatch({ control: form.control, name: `deals.${index}.redemption` });
  useAutoTranslate(form, `deals.${index}.title`, `deals.${index}.titleAr`);
  useAutoTranslate(form, `deals.${index}.description`, `deals.${index}.descriptionAr`);
  const isMultipleItemsValue = useWatch({ control: form.control, name: `deals.${index}.isMultipleItems` });
  const generalRulesValue = useWatch({ control: form.control, name: `deals.${index}.generalRules` }) || [];
  const generalRuleOptions = [
    ...generalTerms,
    ...generalRulesValue
      .filter((value: string) =>
        !generalTerms.some(
          (term) => normalizeTemplateOption(term.text) === normalizeTemplateOption(value),
        ),
      )
      .map((text: string, importedIndex: number) => ({
        id: `imported-general-${importedIndex}`,
        type: "general",
        text,
      })),
  ];
  const { errors: dealFormErrors } = useFormState({ control: form.control });
  const dealErrors = (dealFormErrors as any)?.deals?.[index] || {};
  const [discountType, setDiscountType] = useState<"percentage" | "discountedPrice">("percentage");
  
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
          <span className="font-medium">{t("onboarding:deals.dealLabel", { num: index + 1 })}</span>
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
          <BilingualTabs
            idPrefix={`deal-title-${index}`}
            hasEnglishError={!!dealErrors.title}
            hasArabicError={!!dealErrors.titleAr}
            english={
              <FormField
                control={form.control}
                name={`deals.${index}.title`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("onboarding:deals.dealTitle")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("onboarding:deals.dealTitlePlaceholder")} data-testid={`input-deal-title-${index}`} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            }
            arabic={
              <FormField
                control={form.control}
                name={`deals.${index}.titleAr`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("onboarding:deals.dealTitleAr")}</FormLabel>
                    <FormControl>
                      <Input {...field} dir="rtl" placeholder={t("onboarding:deals.dealTitleArPlaceholder")} data-testid={`input-deal-title-ar-${index}`} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name={`deals.${index}.duration`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    {t("onboarding:deals.duration")}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-slate-400" /></TooltipTrigger>
                        <TooltipContent><p className="max-w-xs text-xs">{t("onboarding:deals.durationTooltip")}</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t("onboarding:deals.durationPlaceholder")} />
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
                    {t("onboarding:deals.redemption")}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-slate-400" /></TooltipTrigger>
                        <TooltipContent><p className="max-w-xs text-xs">{t("onboarding:deals.redemptionTooltip")}</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("onboarding:deals.redemptionPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unlimited">{t("onboarding:deals.unlimited")}</SelectItem>
                      <SelectItem value="limited">{t("onboarding:deals.limited")}</SelectItem>
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
                    <FormLabel>{t("onboarding:deals.limitPerUser")}</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" placeholder={t("onboarding:deals.limitPerUserPlaceholder")} />
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
                      {t("onboarding:deals.multipleItems")}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-slate-400" /></TooltipTrigger>
                          <TooltipContent><p className="max-w-xs text-xs">{t("onboarding:deals.multipleItemsTooltip")}</p></TooltipContent>
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
                    {t("onboarding:deals.multipleItemsInfo")}
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
                    <FormLabel>{dealTypeValue === "voucher" ? t("onboarding:deals.voucherAmount") : t("onboarding:deals.originalPrice")} *</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input placeholder={t("onboarding:deals.pricePlaceholder")} className="pr-12" {...field} />
                      </FormControl>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">{t("onboarding:fees.qar")}</div>
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
                      {t("onboarding:deals.discountPercent")}
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
                      {t("onboarding:deals.discountedPrice")}
                    </button>
                  </div>
                  {discountType === "percentage" ? (
                    <FormField
                      control={form.control}
                      name={`deals.${index}.discountPercentage`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("onboarding:deals.discountPercentage")}</FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input placeholder={t("onboarding:deals.discountPercentagePlaceholder")} className="pr-12" {...field} />
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
                          <FormLabel>{t("onboarding:deals.discountedPriceLabel")}</FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input placeholder={t("onboarding:deals.pricePlaceholder")} className="pr-12" {...field} />
                            </FormControl>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">{t("onboarding:fees.qar")}</div>
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
            name={`deals.${index}.estimatedSavings`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("onboarding:deals.estimatedSavings")} *</FormLabel>
                <div className="relative md:w-1/2">
                  <FormControl>
                    <Input {...field} type="number" placeholder={t("onboarding:deals.estimatedSavingsPlaceholder")} className="pr-12" data-testid={`input-deal-estimated-savings-${index}`} />
                  </FormControl>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">{t("onboarding:fees.qar")}</div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <BilingualTabs
            idPrefix={`deal-description-${index}`}
            hasEnglishError={!!dealErrors.description}
            hasArabicError={!!dealErrors.descriptionAr}
            english={
              <FormField
                control={form.control}
                name={`deals.${index}.description`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("onboarding:deals.description")}</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder={t("onboarding:deals.descriptionPlaceholder")} rows={3} data-testid={`textarea-deal-description-${index}`} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            }
            arabic={
              <FormField
                control={form.control}
                name={`deals.${index}.descriptionAr`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("onboarding:deals.descriptionAr")}</FormLabel>
                    <FormControl>
                      <Textarea {...field} dir="rtl" placeholder={t("onboarding:deals.descriptionArPlaceholder")} rows={3} data-testid={`textarea-deal-description-ar-${index}`} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            }
          />

          <div>
            <Label>{t("onboarding:deals.generalRules")}</Label>
            <div className="space-y-2 mt-2">
              {generalRuleOptions.map((term) => {
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

          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start">
            <FormField
              control={form.control}
              name={`deals.${index}.otherRules`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("onboarding:deals.otherRules")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder={t("onboarding:deals.otherRulesPlaceholder")} rows={5} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-medium mb-1">{t("onboarding:deals.additionalTermsNoteTitle")}</p>
              <p className="text-xs leading-relaxed">{t("onboarding:deals.additionalTermsNote")}</p>
            </div>
          </div>

          <DealImageUpload form={form} index={index} />
        </div>
      )}
    </div>
  );
}
