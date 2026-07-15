import { useState, useEffect, useRef, ChangeEvent, useCallback, useMemo } from "react";
import { compressImage, compressImages } from "@/lib/compressImage";
import { useTranslation, Trans } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop, convertToPixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { 
  Calendar,
  ChevronDown, 
  Info, 
  Upload, 
  X,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Plus,
  Gift,
  Percent,
  Tag,
  ShoppingBag,
  Loader2,
  Crop as CropIcon,
  Check,
  Pencil,
  Search,
  Building2
} from "lucide-react";

import { BilingualTabs } from "@/components/BilingualTabs";
import { useAutoTranslate } from "@/hooks/useAutoTranslate";

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

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useLocation } from "wouter";

const ASPECT_RATIO = 16 / 10;

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

interface ESMerchant {
  id: string;
  agencyName: string;
  agencyEmail?: string;
  agencyId: number;
  contactMobile?: string;
  branches?: { id: number; name: string; location?: { name: string } }[];
  category?: { id: number; name: string };
}

const makeFormSchema = (t: (key: string) => string) => z.object({
  category: z.string().min(1, t("validation.categoryRequired")),
  subCategory: z.string().min(1, t("validation.subCategoryRequired")),
  offerType: z.string().min(1, t("validation.dealTypeRequired")),
  offerDuration: z.string().min(1, t("validation.durationRequired")),
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
  titleAr: z.string().min(5, t("validation.titleArMin")),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  claimRules: z.array(z.string()).min(1, t("validation.claimRuleRequired")),
  generalRules: z.array(z.string()).min(1, t("validation.generalRuleRequired")),
  otherRules: z.string().optional(),
  merchantId: z.string().min(1, t("validation.merchantRequired")),
  merchantName: z.string().min(1, t("validation.merchantNameRequired")),
  merchantEmail: z.string().optional(),
  merchantPhone: z.string().optional(),
  branches: z.array(z.string()).min(1, t("validation.branchRequired")),
  agreement: z.boolean().refine(val => val === true, t("validation.agreementRequired")),
});

type FormValues = z.infer<ReturnType<typeof makeFormSchema>>;

const RichTextToolbar = () => (
  <div className="flex items-center gap-1 p-2 border-b border-slate-100 bg-slate-50/50">
    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" tabIndex={-1}><Bold className="h-4 w-4" /></Button>
    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" tabIndex={-1}><Italic className="h-4 w-4" /></Button>
    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" tabIndex={-1}><Underline className="h-4 w-4" /></Button>
    <div className="w-[1px] h-4 bg-slate-300 mx-1" />
    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" tabIndex={-1}><AlignLeft className="h-4 w-4" /></Button>
    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" tabIndex={-1}><AlignCenter className="h-4 w-4" /></Button>
    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" tabIndex={-1}><AlignRight className="h-4 w-4" /></Button>
    <div className="w-[1px] h-4 bg-slate-300 mx-1" />
    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" tabIndex={-1}><List className="h-4 w-4" /></Button>
    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" tabIndex={-1}><ListOrdered className="h-4 w-4" /></Button>
    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" tabIndex={-1}><LinkIcon className="h-4 w-4" /></Button>
  </div>
);

export default function CreateOffer() {
  const { t, i18n } = useTranslation(["createDeal", "common"]);
  const formSchema = useMemo(() => makeFormSchema((key) => t(key)), [t, i18n.language]);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSpecificDays, setIsSpecificDays] = useState(false);
  const [isLimitedRedemption, setIsLimitedRedemption] = useState(false);
  const [isMultipleItems, setIsMultipleItems] = useState(false);
  const [isDiscount, setIsDiscount] = useState(false);
  const [isBogo, setIsBogo] = useState(false);
  const [isTwoTranches, setIsTwoTranches] = useState(false);
  const [discountType, setDiscountType] = useState<"percentage" | "discountedPrice">("percentage");
  const [uploadedImages, setUploadedImages] = useState<{ file: File; preview: string }[]>([]);
  const [imageUploadErrors, setImageUploadErrors] = useState<string[]>([]);
  const [merchantSearch, setMerchantSearch] = useState("");
  const [selectedMerchant, setSelectedMerchant] = useState<ESMerchant | null>(null);
  const [showMerchantDropdown, setShowMerchantDropdown] = useState(false);
  const merchantDropdownRef = useRef<HTMLDivElement>(null);
  
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>("");
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  
  const MIN_PHOTOS = 4;
  const MAX_PHOTOS = 10;

  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useQuery<Category[]>({
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

  const { data: esMerchantsData, isLoading: isMerchantsLoading } = useQuery<{ merchants: ESMerchant[]; total: number }>({
    queryKey: ["es-merchants-all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("size", "500");
      const res = await fetch(`/api/public/es/merchants?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch merchants");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const allEsMerchants = esMerchantsData?.merchants || [];

  const esMerchants = merchantSearch.trim()
    ? allEsMerchants.filter((m) =>
        m.agencyName?.toLowerCase().includes(merchantSearch.toLowerCase())
      )
    : allEsMerchants;

  const handleMerchantSearch = (value: string) => {
    setMerchantSearch(value);
    setShowMerchantDropdown(true);
  };

  const handleSelectMerchant = (merchant: ESMerchant) => {
    setSelectedMerchant(merchant);
    setMerchantSearch(merchant.agencyName);
    setShowMerchantDropdown(false);
    form.setValue("merchantId", merchant.id);
    form.setValue("merchantName", merchant.agencyName);
    form.setValue("merchantEmail", merchant.agencyEmail || "");
    form.setValue("merchantPhone", merchant.contactMobile || "");
    const branchNames = merchant.branches?.map(b => b.name) || [];
    form.setValue("branches", branchNames.length === 1 ? branchNames : []);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (merchantDropdownRef.current && !merchantDropdownRef.current.contains(e.target as Node)) {
        setShowMerchantDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (categoriesError) {
      toast({
        title: t("toast.errorLoadingCategoriesTitle"),
        description: t("toast.errorLoadingCategoriesDesc"),
        variant: "destructive",
      });
    }
  }, [categoriesError, toast]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const remaining = MAX_PHOTOS - uploadedImages.length;
    if (remaining <= 0) {
      toast({ title: t("toast.maxImagesTitle"), description: t("toast.maxImagesDesc", { max: MAX_PHOTOS }), variant: "destructive" });
      return;
    }

    const filesToProcess = files.slice(0, remaining);
    if (files.length > remaining) {
      toast({ title: t("toast.someSkippedTitle"), description: t("toast.someSkippedDesc", { remaining, max: MAX_PHOTOS }), variant: "destructive" });
    }

    setIsCompressing(true);
    setImageUploadErrors([]);
    try {
      const { files: compressed, errors } = await compressImages(filesToProcess, "deal");
      if (errors.length > 0) setImageUploadErrors(errors);
      const newImages = compressed.map(file => ({ file, preview: URL.createObjectURL(file) }));
      setUploadedImages(prev => [...prev, ...newImages]);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleReplaceImage = (index: number) => {
    setReplaceIndex(index);
    replaceFileInputRef.current?.click();
  };

  const handleReplaceFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || replaceIndex === null) { e.target.value = ""; return; }
    e.target.value = "";
    setIsCompressing(true);
    setImageUploadErrors([]);
    try {
      const { file: compressed, error } = await compressImage(file, "deal");
      if (error) { setImageUploadErrors([error]); return; }
      const idx = replaceIndex;
      const preview = URL.createObjectURL(compressed);
      setUploadedImages(prev => prev.map((img, i) => i === idx ? { file: compressed, preview } : img));
    } finally {
      setIsCompressing(false);
      setReplaceIndex(null);
    }
  };

  const handleEditImage = (index: number) => {
    const img = uploadedImages[index];
    setEditingIndex(index);
    setOriginalFile(img.file);
    setImageToCrop(img.preview);
    setShowCropper(true);
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerAspectCrop(width, height, ASPECT_RATIO);
    setCrop(initialCrop);
    const pixelCrop = convertToPixelCrop(initialCrop, width, height);
    setCompletedCrop(pixelCrop);
  }, []);

  const getCroppedImage = useCallback(async (): Promise<{ file: File; preview: string } | null> => {
    if (!completedCrop || !imgRef.current || !canvasRef.current || !originalFile) {
      return null;
    }

    const image = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return null;
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        const croppedFile = new File([blob], originalFile.name, { type: 'image/jpeg' });
        const preview = URL.createObjectURL(blob);
        resolve({ file: croppedFile, preview });
      }, 'image/jpeg', 0.9);
    });
  }, [completedCrop, originalFile]);

  const handleCropConfirm = async () => {
    const croppedImage = await getCroppedImage();
    if (croppedImage) {
      if (editingIndex !== null) {
        setUploadedImages(prev => {
          const newImages = [...prev];
          URL.revokeObjectURL(newImages[editingIndex].preview);
          newImages[editingIndex] = croppedImage;
          return newImages;
        });
        toast({
          title: t("toast.imageUpdatedTitle"),
          description: t("toast.imageUpdatedDesc"),
        });
      } else {
        setUploadedImages(prev => [...prev, croppedImage]);
        toast({
          title: t("toast.imageAddedTitle"),
          description: t("toast.imageAddedDesc"),
        });
      }
    }
    setShowCropper(false);
    setImageToCrop("");
    setOriginalFile(null);
    setEditingIndex(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setImageToCrop("");
    setOriginalFile(null);
    setEditingIndex(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      setUploadedImages(prev => {
        const newImages = [...prev];
        const [draggedItem] = newImages.splice(draggedIndex, 1);
        newImages.splice(dropIndex, 0, draggedItem);
        return newImages;
      });
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: "",
      subCategory: "",
      offerType: "",
      offerDuration: "",
      redemption: "",
      limitPerUser: "",
      originalPrice: "",
      discountPercentage: "",
      discountedPrice: "",
      trancheValidity: "",
      title: "",
      titleAr: "",
      description: "",
      descriptionAr: "",
      otherRules: "",
      merchantId: "",
      merchantName: "",
      merchantEmail: "",
      merchantPhone: "",
      branches: [],
      specificDays: false,
      isMultipleItems: false,
      isTwoTranches: false,
      days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      claimRules: [],
      generalRules: [],
      agreement: false,
    },
  });

  useAutoTranslate(form, "title", "titleAr");
  useAutoTranslate(form, "description", "descriptionAr");

  const onFormError = (errors: any) => {
    const fieldLabels: Record<string, string> = {
      title: t("fieldLabels.title"),
      description: t("fieldLabels.description"),
      category: t("fieldLabels.category"),
      subCategory: t("fieldLabels.subCategory"),
      offerType: t("fieldLabels.offerType"),
      duration: t("fieldLabels.duration"),
      offerDuration: t("fieldLabels.offerDuration"),
      originalPrice: t("fieldLabels.originalPrice"),
      discountPercentage: t("fieldLabels.discountPercentage"),
      discountedPrice: t("fieldLabels.discountedPrice"),
      redemption: t("fieldLabels.redemption"),
      limitPerUser: t("fieldLabels.limitPerUser"),
      branches: t("fieldLabels.branches"),
      claimRules: t("fieldLabels.claimRules"),
      generalRules: t("fieldLabels.generalRules"),
      images: t("fieldLabels.images"),
      merchantId: t("fieldLabels.merchantId"),
      merchantName: t("fieldLabels.merchantName"),
      merchantEmail: t("fieldLabels.merchantEmail"),
      merchantPhone: t("fieldLabels.merchantPhone"),
      agreement: t("fieldLabels.agreement"),
    };
    const errorMessages = Object.entries(errors)
      .map(([field, error]: [string, any]) => {
        const label = fieldLabels[field] || field;
        return `${label}: ${error?.message || t("toast.fieldRequired")}`;
      })
      .join(". ");
    toast({
      title: t("toast.fixErrorsTitle"),
      description: errorMessages,
      variant: "destructive",
    });
    const firstErrorField = document.querySelector('.text-destructive');
    if (firstErrorField) {
      firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Watchers for dynamic behavior
  const offerType = form.watch("offerType");
  const redemptionType = form.watch("redemption");
  const watchedCategory = form.watch("category");
  
  const selectedCategory = categories.find(c => c.name === watchedCategory);
  const availableSubCategories = selectedCategory?.subCategories || [];

  useEffect(() => {
    setIsDiscount(offerType === "discount");
    setIsBogo(offerType === "bogo");
  }, [offerType]);

  useEffect(() => {
    setIsLimitedRedemption(redemptionType === "limited");
  }, [redemptionType]);

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const onSubmit = async (data: FormValues) => {
    if (isSubmitting) return;
    
    if (uploadedImages.length < MIN_PHOTOS) {
      toast({
        title: t("toast.notEnoughPhotosTitle"),
        description: t("toast.notEnoughPhotosDesc", { min: MIN_PHOTOS }),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const imageBase64Array = await Promise.all(
        uploadedImages.map(img => convertFileToBase64(img.file))
      );

      const dealData = {
        category: data.category,
        subCategory: data.subCategory,
        dealType: data.offerType,
        duration: data.offerDuration,
        redemption: data.redemption,
        limitPerUser: data.limitPerUser,
        originalPrice: data.originalPrice,
        isMultipleItems: data.isMultipleItems,
        discountPercentage: data.discountPercentage,
        discountedPrice: data.discountedPrice,
        isTwoTranches: data.isTwoTranches,
        trancheValidity: data.trancheValidity,
        specificDays: data.specificDays,
        days: data.days,
        title: data.title,
        titleAr: data.titleAr,
        description: data.description,
        descriptionAr: data.descriptionAr,
        claimRules: data.claimRules,
        generalRules: data.generalRules,
        otherRules: data.otherRules,
        merchantId: data.merchantId,
        merchantName: data.merchantName,
        merchantEmail: data.merchantEmail,
        merchantPhone: data.merchantPhone,
        branches: data.branches,
        images: imageBase64Array,
      };

      const response = await fetch("/api/deals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dealData),
      });

      if (!response.ok) {
        let errorMessage = t("toast.submitErrorDefault");
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          if (response.status === 413) {
            errorMessage = t("toast.imagesTooLarge");
          } else if (response.status >= 500) {
            errorMessage = t("toast.serverError");
          }
        }
        throw new Error(errorMessage);
      }

      toast({
        title: t("toast.successTitle"),
        description: t("toast.successDesc"),
      });

      setLocation("/success");
    } catch (error: any) {
      const isNetworkError = error.message === "Failed to fetch" || error.name === "TypeError";
      toast({
        title: t("toast.submissionFailedTitle"),
        description: isNetworkError
          ? t("toast.networkError")
          : (error.message || t("toast.failedToSubmit")),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const claimRulesOptions = claimTerms.map(term => term.text);
  const generalRulesOptions = generalTerms.map(term => term.text);

  const offerTypes = [
    { id: "bogo", label: t("dealTypes.bogo"), icon: Gift },
    { id: "discount", label: t("dealTypes.discount"), icon: Percent },
    { id: "voucher", label: t("dealTypes.voucher"), icon: Tag },
    { id: "bundle", label: t("dealTypes.bundle"), icon: ShoppingBag },
  ];

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col font-sans relative">
      <div className="absolute top-3 right-4 flex items-center gap-3">
        <LanguageSwitcher />
        <a href="/admin/login" className="text-xs text-slate-400 hover:text-slate-600 transition-colors" data-testid="link-staff-login">{t("staffLogin")}</a>
      </div>
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#00426D]">{t("header.title")}</h1>
            <p className="text-slate-500 mt-1">{t("header.subtitle")}</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onFormError)} className="space-y-8">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column - Main Details */}
              <div className="lg:col-span-7 space-y-8">

                {/* Deal Details and Pricing */}
                <section>
                  <h2 className="text-lg font-bold text-[#00426D] mb-4">{t("dealDetails.sectionTitle")}</h2>
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-6">
                    <p className="text-sm text-slate-500 italic mb-4">
                      {t("dealDetails.categoryHelper")}
                    </p>

                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">{t("dealDetails.category")} <span className="text-red-500">*</span></FormLabel>
                          <Select 
                            onValueChange={(categoryName) => {
                              field.onChange(categoryName);
                              form.setValue("subCategory", "");
                            }} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="h-11 bg-slate-50" data-testid="select-category">
                                {categoriesLoading ? (
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>{t("dealDetails.loading")}</span>
                                  </div>
                                ) : (
                                  <SelectValue placeholder={t("dealDetails.selectCategory")} />
                                )}
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category.id} value={category.name} data-testid={`option-category-${category.id}`}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="subCategory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">{t("dealDetails.subCategory")} <span className="text-red-500">*</span></FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value}
                            disabled={!watchedCategory || availableSubCategories.length === 0}
                          >
                            <FormControl>
                              <SelectTrigger className="h-11 bg-slate-50" data-testid="select-subcategory">
                                <SelectValue placeholder={watchedCategory ? t("dealDetails.selectSubCategory") : t("dealDetails.selectCategoryFirst")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableSubCategories.map((sub) => (
                                <SelectItem key={sub.id} value={sub.name} data-testid={`option-subcategory-${sub.id}`}>
                                  {sub.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="offerType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">{t("dealDetails.dealType")} <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {offerTypes.map((type) => {
                                const Icon = type.icon;
                                const isSelected = field.value === type.id;
                                return (
                                  <div
                                    key={type.id}
                                    className={cn(
                                      "cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center justify-center gap-3 transition-all",
                                      isSelected 
                                        ? "border-[#FF7F39] bg-[#FF7F39]/5 shadow-sm ring-1 ring-[#FF7F39]" 
                                        : "border-slate-200 bg-white text-slate-600 hover:border-[#FF7F39]/50 hover:bg-[#FF7F39]/5"
                                    )}
                                    onClick={() => field.onChange(type.id)}
                                  >
                                    <Icon className={cn("h-6 w-6", isSelected ? "text-[#FF7F39]" : "text-slate-900")} />
                                    <span className={cn("text-xs font-medium", isSelected ? "text-[#00426D]" : "text-slate-900")}>
                                      {type.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="offerDuration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                            {t("dealDetails.duration")} <span className="text-red-500">*</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger type="button"><Info className="h-3.5 w-3.5 text-slate-400" /></TooltipTrigger>
                                <TooltipContent><p className="max-w-xs text-xs">{t("dealDetails.durationTooltip")}</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </FormLabel>
                          <FormControl>
                            <Input className="h-11 bg-slate-50" placeholder={t("dealDetails.durationPlaceholder")} {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="redemption"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                              {t("dealDetails.redemption")} <span className="text-red-500">*</span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger type="button"><Info className="h-3.5 w-3.5 text-slate-400" /></TooltipTrigger>
                                  <TooltipContent><p className="max-w-xs text-xs">{t("dealDetails.redemptionTooltip")}</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11 bg-slate-50">
                                  <SelectValue placeholder={t("dealDetails.choose")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="unlimited">{t("dealDetails.unlimited")}</SelectItem>
                                <SelectItem value="limited">{t("dealDetails.limited")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      
                      {isLimitedRedemption && (
                        <FormField
                          control={form.control}
                          name="limitPerUser"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-bold text-slate-500 uppercase">{t("dealDetails.limitPerUser")} <span className="text-red-500">*</span></FormLabel>
                              <FormControl>
                                <Input type="number" placeholder={t("dealDetails.limitPerUserPlaceholder")} className="h-11 bg-slate-50" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    {isBogo && (
                      <div className="bg-orange-50/50 p-4 rounded-md border border-orange-100">
                        <FormField
                          control={form.control}
                          name="isTwoTranches"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={(checked) => {
                                    field.onChange(checked);
                                    setIsTwoTranches(!!checked);
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-medium text-slate-700">
                                {t("dealDetails.twoTranches")}
                              </FormLabel>
                            </FormItem>
                          )}
                        />

                        {isTwoTranches && (
                          <div className="mt-4 ml-7">
                            <FormField
                              control={form.control}
                              name="trancheValidity"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-bold text-slate-500 uppercase">{t("dealDetails.trancheValidity")}</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-11 bg-white">
                                        <SelectValue placeholder={t("dealDetails.choose")} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                                        <SelectItem key={n} value={String(n)}>{t("weeks", { count: n })}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {(isDiscount || isBogo) && (
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="isMultipleItems"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={(checked) => {
                                    field.onChange(checked);
                                    setIsMultipleItems(!!checked);
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-medium text-slate-700">
                                {t("dealDetails.multipleItems")}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                        
                        {isMultipleItems && (
                          <div className="bg-[#FFF8E1] border border-[#FFE082] rounded-md p-3 flex items-start gap-3">
                             <div className="bg-[#FFF8E1] rounded-full p-1 mt-0.5">
                               <div className="bg-[#F57F17] rounded-full w-1 h-1"></div>
                               <div className="bg-[#F57F17] w-0.5 h-2 mx-auto mt-0.5"></div>
                             </div>
                             <Info className="h-5 w-5 text-[#F57F17] flex-shrink-0" />
                             <p className="text-[#5D4037] text-sm">
                               {t("dealDetails.multipleItemsInfo")}
                             </p>
                          </div>
                        )}
                      </div>
                    )}

                    {!isMultipleItems && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <FormField
                          control={form.control}
                          name="originalPrice"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel className="text-xs font-bold text-slate-500 uppercase">{offerType === "voucher" ? t("dealDetails.voucherAmount") : t("dealDetails.originalPrice")} <span className="text-red-500">*</span></FormLabel>
                              <div className="relative">
                                <FormControl>
                                  <Input 
                                    placeholder="0.00" 
                                    className="h-11 bg-slate-50 pr-12" 
                                    {...field} 
                                  />
                                </FormControl>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">QAR</div>
                              </div>
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
                                  form.setValue("discountedPrice", "");
                                }}
                                className={cn(
                                  "px-3 py-1.5 text-sm rounded-md border transition-colors",
                                  discountType === "percentage"
                                    ? "bg-[#00426D] text-white border-[#00426D]"
                                    : "bg-white text-slate-600 border-slate-300 hover:border-[#00426D]"
                                )}
                                data-testid="button-discount-percentage"
                              >
                                {t("dealDetails.discountPercentToggle")}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDiscountType("discountedPrice");
                                  form.setValue("discountPercentage", "");
                                }}
                                className={cn(
                                  "px-3 py-1.5 text-sm rounded-md border transition-colors",
                                  discountType === "discountedPrice"
                                    ? "bg-[#00426D] text-white border-[#00426D]"
                                    : "bg-white text-slate-600 border-slate-300 hover:border-[#00426D]"
                                )}
                                data-testid="button-discount-price"
                              >
                                {t("dealDetails.discountedPriceToggle")}
                              </button>
                            </div>
                            {discountType === "percentage" ? (
                              <FormField
                                control={form.control}
                                name="discountPercentage"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs font-bold text-slate-500 uppercase">{t("dealDetails.discountPercentage")} <span className="text-red-500">*</span></FormLabel>
                                    <div className="relative">
                                      <FormControl>
                                        <Input placeholder="0" className="h-11 bg-slate-50 pr-12" {...field} />
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
                                name="discountedPrice"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs font-bold text-slate-500 uppercase">{t("dealDetails.discountedPrice")} <span className="text-red-500">*</span></FormLabel>
                                    <div className="relative">
                                      <FormControl>
                                        <Input placeholder="0.00" className="h-11 bg-slate-50 pr-12" {...field} />
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

                    <div className="bg-slate-50 p-4 rounded-md border border-slate-100">
                      <FormField
                        control={form.control}
                        name="specificDays"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  setIsSpecificDays(!!checked);
                                }}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-medium text-slate-700">
                                {t("dealDetails.specificDays")}
                              </FormLabel>
                              <p className="text-xs text-slate-500">
                                {t("dealDetails.specificDaysHelper")}
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      {isSpecificDays && (
                        <FormField
                          control={form.control}
                          name="days"
                          render={({ field }) => (
                            <div className="mt-4 ml-0 sm:ml-7 space-y-3">
                              {days.map((day) => {
                                const isEnabled = field.value?.includes(day);
                                return (
                                  <div 
                                    key={day} 
                                    className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-slate-200"
                                  >
                                    <label
                                      htmlFor={`day-${day}`}
                                      className="text-sm font-medium text-slate-700 cursor-pointer"
                                    >
                                      {t(`days.${day}`)}
                                    </label>
                                    <Switch
                                      id={`day-${day}`}
                                      checked={isEnabled}
                                      onCheckedChange={(checked) => {
                                        const currentDays = field.value || [];
                                        if (checked) {
                                          field.onChange([...currentDays, day]);
                                        } else {
                                          field.onChange(currentDays.filter((d: string) => d !== day));
                                        }
                                      }}
                                      className="data-[state=checked]:bg-[#FF7F39]"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        />
                      )}
                    </div>

                  </div>
                </section>

                {/* Deal Description */}
                <section>
                  <h2 className="text-lg font-bold text-[#00426D] mb-4">{t("description.sectionTitle")}</h2>
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-6">
                    <BilingualTabs
                      idPrefix="deal-title"
                      hasEnglishError={!!form.formState.errors.title}
                      hasArabicError={!!form.formState.errors.titleAr}
                      english={
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-bold text-slate-500 uppercase">{t("description.title")} <span className="text-red-500">*</span></FormLabel>
                              <div className="relative">
                                <FormControl>
                                  <Input className="h-11 bg-slate-50" maxLength={60} data-testid="input-deal-title" {...field} />
                                </FormControl>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{field.value?.length || 0}/60</div>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      }
                      arabic={
                        <FormField
                          control={form.control}
                          name="titleAr"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-bold text-slate-500 uppercase">{t("description.titleAr")} <span className="text-red-500">*</span></FormLabel>
                              <div className="relative">
                                <FormControl>
                                  <Input className="h-11 bg-slate-50 text-right" dir="rtl" maxLength={60} placeholder={t("description.titleArPlaceholder")} data-testid="input-deal-title-ar" {...field} />
                                </FormControl>
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{field.value?.length || 0}/60</div>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      }
                    />

                    <BilingualTabs
                      idPrefix="deal-description"
                      hasEnglishError={!!form.formState.errors.description}
                      hasArabicError={!!form.formState.errors.descriptionAr}
                      english={
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <Label className="text-xs text-slate-500">
                                {t("description.helper")}
                              </Label>
                              <div className="border border-slate-200 rounded-md overflow-hidden bg-slate-50">
                                <RichTextToolbar />
                                <FormControl>
                                  <textarea 
                                    className="w-full h-32 p-3 bg-white focus:outline-none resize-none text-sm" 
                                    placeholder={t("description.placeholder")}
                                    maxLength={300}
                                    data-testid="input-deal-description"
                                    {...field}
                                  />
                                </FormControl>
                                <div className="bg-slate-50 px-2 py-1 text-right text-xs text-slate-400 border-t border-slate-100">
                                  {field.value?.length || 0}/300
                                </div>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      }
                      arabic={
                        <FormField
                          control={form.control}
                          name="descriptionAr"
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <Label className="text-xs text-slate-500">
                                {t("description.helperAr")}
                              </Label>
                              <div className="border border-slate-200 rounded-md overflow-hidden bg-slate-50">
                                <RichTextToolbar />
                                <FormControl>
                                  <textarea 
                                    className="w-full h-32 p-3 bg-white focus:outline-none resize-none text-sm text-right" 
                                    dir="rtl"
                                    placeholder={t("description.placeholderAr")}
                                    maxLength={300}
                                    data-testid="input-deal-description-ar"
                                    {...field}
                                  />
                                </FormControl>
                                <div className="bg-slate-50 px-2 py-1 text-left text-xs text-slate-400 border-t border-slate-100">
                                  {field.value?.length || 0}/300
                                </div>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      }
                    />
                  </div>
                </section>

                {/* Other Rules */}
                <section>
                  <h2 className="text-lg font-bold text-[#00426D] mb-4">{t("otherRules.sectionTitle")}</h2>
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-6">
                    
                    <FormField
                      control={form.control}
                      name="claimRules"
                      render={() => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">{t("otherRules.claimRules")} <span className="font-normal normal-case text-slate-400">{t("otherRules.mustChooseOne")}</span></FormLabel>
                          <div className="flex flex-col space-y-3 mt-2">
                            {claimRulesOptions.map((item) => (
                              <FormField
                                key={item}
                                control={form.control}
                                name="claimRules"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={item}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(item)}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([...field.value, item])
                                              : field.onChange(
                                                  field.value?.filter(
                                                    (value) => value !== item
                                                  )
                                                )
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal text-slate-700">
                                        {item}
                                      </FormLabel>
                                    </FormItem>
                                  )
                                }}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="h-[1px] bg-slate-100 my-4" />

                    <FormField
                      control={form.control}
                      name="generalRules"
                      render={() => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">{t("otherRules.generalRules")} <span className="font-normal normal-case text-slate-400">{t("otherRules.mustChooseOne")}</span></FormLabel>
                          <div className="grid gap-3 mt-2">
                            {generalRulesOptions.map((item) => (
                              <FormField
                                key={item}
                                control={form.control}
                                name="generalRules"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={item}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(item)}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([...field.value, item])
                                              : field.onChange(
                                                  field.value?.filter(
                                                    (value) => value !== item
                                                  )
                                                )
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal text-slate-700">
                                        {item}
                                      </FormLabel>
                                    </FormItem>
                                  )
                                }}
                              />
                            ))}
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="otherRules"
                      render={({ field }) => (
                        <FormItem className="space-y-2 pt-4">
                          <div className="border border-slate-200 rounded-md overflow-hidden bg-slate-50">
                            <RichTextToolbar />
                            <FormControl>
                              <textarea 
                                className="w-full h-24 p-3 bg-white focus:outline-none resize-none text-sm" 
                                placeholder={t("otherRules.placeholder")}
                                maxLength={300}
                                {...field}
                              />
                            </FormControl>
                            <div className="bg-slate-50 px-2 py-1 text-right text-xs text-slate-400 border-t border-slate-100">
                              {field.value?.length || 0}/300
                            </div>
                          </div>
                        </FormItem>
                      )}
                    />

                  </div>
                </section>

                {/* Select Merchant */}
                <section>
                  <h2 className="text-lg font-bold text-[#00426D] mb-4">{t("merchant.sectionTitle")}</h2>
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
                    <p className="text-sm text-slate-500 italic mb-4">
                      {t("merchant.helper")}
                    </p>

                    <FormField
                      control={form.control}
                      name="merchantId"
                      render={() => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">{t("merchant.selectMerchant")} <span className="text-red-500">*</span></FormLabel>
                          <div className="relative" ref={merchantDropdownRef}>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input
                                className="h-11 bg-slate-50 pl-9"
                                placeholder={t("merchant.searchPlaceholder")}
                                value={merchantSearch}
                                onChange={(e) => handleMerchantSearch(e.target.value)}
                                onFocus={() => setShowMerchantDropdown(true)}
                                data-testid="input-merchant-search"
                              />
                              {selectedMerchant && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedMerchant(null);
                                    setMerchantSearch("");
                                    form.setValue("merchantId", "");
                                    form.setValue("merchantName", "");
                                    form.setValue("merchantEmail", "");
                                    form.setValue("merchantPhone", "");
                                    form.setValue("branches", []);
                                  }}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                                  data-testid="button-clear-merchant"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                            {showMerchantDropdown && !selectedMerchant && (
                              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                                {isMerchantsLoading ? (
                                  <div className="p-3 text-sm text-slate-500 text-center">{t("merchant.loadingMerchants")}</div>
                                ) : esMerchants.length === 0 ? (
                                  <div className="p-3 text-sm text-slate-500 text-center">{t("merchant.noMerchantsFound")}</div>
                                ) : (
                                  esMerchants.map((m) => (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => handleSelectMerchant(m)}
                                      className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                                      data-testid={`option-merchant-${m.id}`}
                                    >
                                      <div className="font-medium text-sm text-slate-900">{m.agencyName}</div>
                                      {m.category?.name && (
                                        <div className="text-xs text-slate-500 mt-0.5">
                                          {m.category.name}
                                        </div>
                                      )}
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedMerchant && (
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-[#00426D]" />
                          <span className="font-medium text-[#00426D]">{selectedMerchant.agencyName}</span>
                        </div>
                        {selectedMerchant.agencyEmail && (
                          <p className="text-sm text-slate-600">{t("merchant.email")} {selectedMerchant.agencyEmail}</p>
                        )}
                        {selectedMerchant.contactMobile && (
                          <p className="text-sm text-slate-600">{t("merchant.phone")} {selectedMerchant.contactMobile}</p>
                        )}
                        {selectedMerchant.branches && selectedMerchant.branches.length > 0 && (
                          <p className="text-sm text-slate-600">
                            {t("merchant.branches")} {selectedMerchant.branches.map(b => b.name).join(", ")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </section>

                {/* Branches */}
                {selectedMerchant && (
                  <section>
                    <h2 className="text-lg font-bold text-[#00426D] mb-4">{t("branches.sectionTitle")}</h2>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                      <FormField
                        control={form.control}
                        name="branches"
                        render={({ field }) => (
                          <FormItem>
                            {selectedMerchant.branches && selectedMerchant.branches.length > 1 ? (
                              <>
                                <FormLabel className="text-xs font-bold text-slate-500 uppercase">{t("branches.selectForDeal")} <span className="text-red-500">*</span></FormLabel>
                                <p className="text-xs text-slate-500 mb-2">{t("branches.selectAtLeastOne")}</p>
                                <div className="space-y-2">
                                  {selectedMerchant.branches.map((branch) => {
                                    const isSelected = field.value?.includes(branch.name);
                                    return (
                                      <label
                                        key={branch.id}
                                        className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-slate-50"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              field.onChange([...(field.value || []), branch.name]);
                                            } else {
                                              field.onChange(field.value?.filter((v) => v !== branch.name) || []);
                                            }
                                          }}
                                          className="h-4 w-4 accent-[#FF7F39]"
                                        />
                                        <span className="text-sm">{branch.name}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </>
                            ) : selectedMerchant.branches && selectedMerchant.branches.length === 1 ? (
                              <>
                                <FormLabel className="text-xs font-bold text-slate-500 uppercase">{t("branches.applicableBranch")}</FormLabel>
                                <p className="text-sm text-slate-600 p-2 bg-slate-50 rounded border">
                                  {selectedMerchant.branches[0].name} {t("branches.autoSelected")}
                                </p>
                              </>
                            ) : (
                              <>
                                <FormLabel className="text-xs font-bold text-slate-500 uppercase">{t("branches.title")} <span className="text-red-500">*</span></FormLabel>
                                <p className="text-xs text-slate-500 mb-2">{t("branches.noBranchesFound")}</p>
                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-2 min-h-[44px] p-2 bg-slate-50 border border-slate-200 rounded-md">
                                    {field.value?.map((branch, index) => (
                                      <span
                                        key={index}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-sm text-slate-700"
                                      >
                                        {branch}
                                        <button
                                          type="button"
                                          onClick={() => field.onChange(field.value?.filter((_, i) => i !== index) || [])}
                                          className="ml-1 text-slate-400 hover:text-red-500"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </span>
                                    ))}
                                    <input
                                      type="text"
                                      placeholder={field.value?.length ? "" : t("branches.typeAndPressEnter")}
                                      className="flex-1 min-w-[200px] bg-transparent border-none outline-none text-sm placeholder:text-slate-400"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ',') {
                                          e.preventDefault();
                                          const val = (e.target as HTMLInputElement).value.trim();
                                          if (val && !field.value?.includes(val)) {
                                            field.onChange([...(field.value || []), val]);
                                            (e.target as HTMLInputElement).value = "";
                                          }
                                        }
                                      }}
                                      onBlur={(e) => {
                                        const val = e.target.value.trim();
                                        if (val && !field.value?.includes(val)) {
                                          field.onChange([...(field.value || []), val]);
                                          e.target.value = "";
                                        }
                                      }}
                                      data-testid="input-branch-manual"
                                    />
                                  </div>
                                </div>
                              </>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </section>
                )}

                {/* Agreement */}
                 <FormField
                    control={form.control}
                    name="agreement"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm text-slate-600 font-normal">
                            <Trans
                              i18nKey="agreement.text"
                              ns="createDeal"
                              components={[
                                <a href="https://www.qatarliving.com/rules-advertising" target="_blank" rel="noopener noreferrer" className="text-[#00426D] hover:underline" />,
                                <a href="https://www.qatarliving.com/terms-of-use" target="_blank" rel="noopener noreferrer" className="text-[#00426D] hover:underline" />,
                              ]}
                            />
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

              </div>

              {/* Right Column - Upload Photos */}
              <div className="lg:col-span-5 space-y-8">
                <section>
                   <h2 className="text-lg font-bold text-[#00426D] mb-4">{t("photos.sectionTitle")}</h2>
                   <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                      {imageUploadErrors.length > 0 && (
                        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 space-y-1" data-testid="deal-image-upload-errors">
                          {imageUploadErrors.map((err, i) => (
                            <p key={i} className="text-sm text-red-600 flex items-start gap-1">
                              <span className="shrink-0 mt-0.5">⚠</span>
                              <span><strong>{t("photos.dealPhoto")}</strong> {err}</span>
                            </p>
                          ))}
                          <p className="text-xs text-red-500 mt-1"><Trans i18nKey="photos.sizeHelp" ns="createDeal" components={[<a href="https://squoosh.app" target="_blank" rel="noopener noreferrer" className="underline" />]} /></p>
                        </div>
                      )}
                      <div className="flex items-start gap-3 mb-4 bg-slate-50 p-3 rounded text-xs text-slate-600">
                        <Info className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <p>
                          {t("photos.info1", { min: MIN_PHOTOS, max: MAX_PHOTOS })}
                          <br/><br/>
                          {t("photos.info2")}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                        <span>{t("photos.dragToReorder")}</span>
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="flex items-center gap-1 cursor-help text-[#00426D] hover:text-[#003557]">
                                <Info className="h-3 w-3" />
                                <span>{t("photos.recommendedSize")}</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p>{t("photos.recommendedSizeTooltip")}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      <div className="text-xs text-slate-500 mb-3">
                        {t("photos.photosUploaded", { current: uploadedImages.length, max: MAX_PHOTOS })}
                        {uploadedImages.length < MIN_PHOTOS && (
                          <span className="text-amber-600 ml-2">{t("photos.minimumRequired", { min: MIN_PHOTOS })}</span>
                        )}
                      </div>

                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                        data-testid="input-image-upload"
                      />
                      <input
                        type="file"
                        ref={replaceFileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleReplaceFileChange}
                        data-testid="input-image-replace"
                      />

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {/* Render uploaded images */}
                        {uploadedImages.map((img, index) => (
                          <div 
                            key={index}
                            className={`relative rounded-lg overflow-hidden border-2 border-slate-200 cursor-grab active:cursor-grabbing transition-all ${
                              draggedIndex === index ? 'opacity-50 scale-95' : ''
                            } ${dragOverIndex === index ? 'ring-2 ring-[#FF7F39] ring-offset-2' : ''}`}
                            style={{ aspectRatio: '16/10' }}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragEnd={handleDragEnd}
                            data-testid={`image-preview-${index}`}
                          >
                            <img 
                              src={img.preview} 
                              alt={`Upload ${index + 1}`}
                              className="w-full h-full object-cover pointer-events-none"
                            />
                            {index === 0 && (
                              <div className="absolute top-2 left-2 bg-[#FF7F39] text-white text-[10px] px-2 py-1 rounded font-medium">
                                {t("photos.cover")}
                              </div>
                            )}
                            {index > 0 && (
                              <div className="absolute top-2 left-2 bg-[#00426D] text-white text-[10px] px-2 py-1 rounded font-medium">
                                {index + 1}
                              </div>
                            )}
                            <div className="absolute bottom-2 right-2 flex gap-1">
                              <button
                                type="button"
                                onClick={() => handleReplaceImage(index)}
                                className="bg-white/90 text-slate-700 rounded-md p-1.5 hover:bg-white shadow-sm transition-colors"
                                data-testid={`button-replace-image-${index}`}
                                title={t("photos.replacePhoto")}
                              >
                                <Upload className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditImage(index)}
                                className="bg-white/90 text-slate-700 rounded-md p-1.5 hover:bg-white shadow-sm transition-colors"
                                data-testid={`button-edit-image-${index}`}
                                title={t("photos.editCrop")}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="bg-white/90 text-red-500 rounded-md p-1.5 hover:bg-white shadow-sm transition-colors"
                                data-testid={`button-remove-image-${index}`}
                                title={t("photos.remove")}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Compressing indicator tile */}
                        {isCompressing && (
                          <div
                            className="relative rounded-lg border-2 border-[#FF7F39]/50 bg-[#FF7F39]/5 flex flex-col items-center justify-center"
                            style={{ aspectRatio: '16/10' }}
                          >
                            <Loader2 className="h-7 w-7 text-[#FF7F39] animate-spin mb-1" />
                            <span className="text-xs text-[#FF7F39] font-medium">{t("photos.compressing")}</span>
                          </div>
                        )}

                        {/* Show empty upload tiles */}
                        {!isCompressing && uploadedImages.length < MAX_PHOTOS && Array.from({ length: Math.min(3, MAX_PHOTOS - uploadedImages.length) }).map((_, idx) => (
                          <div 
                            key={`empty-${idx}`}
                            className="relative rounded-lg cursor-pointer"
                            style={{ aspectRatio: '16/10' }}
                            onClick={handleImageClick}
                            data-testid={`upload-tile-${idx}`}
                          >
                            {uploadedImages.length === 0 && idx === 0 && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FF7F39] text-white text-[10px] px-3 py-1 rounded font-medium z-10 whitespace-nowrap">
                                {t("photos.coverPhoto")}
                              </div>
                            )}
                            <div className="w-full h-full border-2 border-dashed border-slate-300 rounded-lg hover:border-[#FF7F39] hover:bg-[#FF7F39]/5 transition-colors flex flex-col items-center justify-center">
                              <Plus className="h-8 w-8 text-slate-400 mb-1" />
                              <span className="text-xs text-slate-500 font-medium">{t("photos.upload")}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                   </div>
                </section>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 z-50">
              <div className="container mx-auto max-w-6xl flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-2 sm:gap-4">
                <Button type="button" variant="outline" className="min-w-[100px] border-slate-300 text-slate-600 hover:bg-slate-50 order-2 sm:order-1">
                  {t("footer.close")}
                </Button>
                <Button 
                  type="submit" 
                  className="min-w-[140px] bg-[#00426D] text-white hover:bg-[#003557] order-1 sm:order-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("footer.submitting")}
                    </>
                  ) : (
                    t("footer.submitDeal")
                  )}
                </Button>
              </div>
            </div>
            <div className="h-16" /> {/* Spacer for fixed footer */}

          </form>
        </Form>
      </main>

      <Dialog open={showCropper} onOpenChange={(open) => !open && handleCropCancel()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CropIcon className="h-5 w-5" />
              {editingIndex !== null ? t("crop.editImage") : t("crop.cropImage")} {t("crop.ratioSuffix")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-slate-500">
              {t("crop.instruction")}
            </p>
            {imageToCrop && (
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={ASPECT_RATIO}
                className="max-h-[400px]"
              >
                <img
                  ref={imgRef}
                  src={imageToCrop}
                  alt={t("crop.cropPreviewAlt")}
                  onLoad={onImageLoad}
                  className="max-h-[400px] w-auto"
                />
              </ReactCrop>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCropCancel}
              data-testid="button-cancel-crop"
            >
              {t("crop.cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleCropConfirm}
              className="bg-[#00426D] hover:bg-[#003557]"
              disabled={!completedCrop}
              data-testid="button-confirm-crop"
            >
              <Check className="h-4 w-4 mr-2" />
              {t("crop.confirmCrop")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
