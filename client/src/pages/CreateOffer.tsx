import { useState, useEffect, useRef, ChangeEvent, useCallback } from "react";
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
  Pencil
} from "lucide-react";

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

// Schema
const formSchema = z.object({
  category: z.string().min(1, "Category is required"),
  subCategory: z.string().min(1, "Sub-category is required"),
  offerType: z.string().min(1, "Deal type is required"),
  offerDuration: z.string().min(1, "Duration is required"),
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
  branches: z.array(z.string()).min(1, "At least one branch is required"),
  agreement: z.boolean().refine(val => val === true, "You must agree to the terms"),
});

type FormValues = z.infer<typeof formSchema>;

const RichTextToolbar = () => (
  <div className="flex items-center gap-1 p-2 border-b border-slate-100 bg-slate-50/50">
    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500"><Bold className="h-4 w-4" /></Button>
    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500"><Italic className="h-4 w-4" /></Button>
    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500"><Underline className="h-4 w-4" /></Button>
    <div className="w-[1px] h-4 bg-slate-300 mx-1" />
    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500"><AlignLeft className="h-4 w-4" /></Button>
    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500"><AlignCenter className="h-4 w-4" /></Button>
    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500"><AlignRight className="h-4 w-4" /></Button>
    <div className="w-[1px] h-4 bg-slate-300 mx-1" />
    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500"><List className="h-4 w-4" /></Button>
    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500"><ListOrdered className="h-4 w-4" /></Button>
    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500"><LinkIcon className="h-4 w-4" /></Button>
  </div>
);

export default function CreateOffer() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSpecificDays, setIsSpecificDays] = useState(false);
  const [isLimitedRedemption, setIsLimitedRedemption] = useState(false);
  const [isMultipleItems, setIsMultipleItems] = useState(false);
  const [isDiscount, setIsDiscount] = useState(false);
  const [isBogo, setIsBogo] = useState(false);
  const [isTwoTranches, setIsTwoTranches] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<{ file: File; preview: string }[]>([]);
  const [branchInput, setBranchInput] = useState("");
  
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>("");
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
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

  useEffect(() => {
    if (categoriesError) {
      toast({
        title: "Error loading categories",
        description: "Please refresh the page to try again",
        variant: "destructive",
      });
    }
  }, [categoriesError, toast]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const remaining = MAX_PHOTOS - uploadedImages.length;
      
      if (remaining <= 0) {
        toast({
          title: "Maximum images reached",
          description: `You can only upload up to ${MAX_PHOTOS} images`,
          variant: "destructive",
        });
        return;
      }

      const filesToUpload = files.slice(0, remaining);
      const newImages = filesToUpload.map(file => ({
        file,
        preview: URL.createObjectURL(file)
      }));
      
      setUploadedImages(prev => [...prev, ...newImages]);
      toast({
        title: "Images uploaded",
        description: `Successfully added ${filesToUpload.length} image(s)`,
      });
      
      if (files.length > remaining) {
        toast({
          title: "Some images skipped",
          description: `Only ${remaining} more image(s) allowed (max ${MAX_PHOTOS})`,
          variant: "destructive",
        });
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
          title: "Image updated",
          description: "Image has been re-cropped successfully",
        });
      } else {
        setUploadedImages(prev => [...prev, croppedImage]);
        toast({
          title: "Image added",
          description: "Image has been cropped and added successfully",
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
      trancheValidity: "",
      title: "",
      description: "",
      otherRules: "",
      branches: [],
      specificDays: false,
      isMultipleItems: false,
      isTwoTranches: false,
      days: [],
      claimRules: [],
      generalRules: [],
      agreement: false,
    },
  });

  const onFormError = (errors: any) => {
    const errorMessages = Object.entries(errors)
      .map(([field, error]: [string, any]) => `${field}: ${error?.message}`)
      .join(", ");
    toast({
      title: "Please fix the following errors",
      description: errorMessages,
      variant: "destructive",
    });
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

  const onSubmit = async (data: FormValues) => {
    if (uploadedImages.length < MIN_PHOTOS) {
      toast({
        title: "Not enough photos",
        description: `Please upload at least ${MIN_PHOTOS} photos`,
        variant: "destructive",
      });
      return;
    }

    try {
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
        isTwoTranches: data.isTwoTranches,
        trancheValidity: data.trancheValidity,
        specificDays: data.specificDays,
        days: data.days,
        title: data.title,
        description: data.description,
        claimRules: data.claimRules,
        generalRules: data.generalRules,
        otherRules: data.otherRules,
        branches: data.branches,
      };

      const response = await fetch("/api/deals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dealData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit deal");
      }

      toast({
        title: "Success",
        description: "Your deal has been submitted successfully!",
      });

      setLocation("/success");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit deal",
        variant: "destructive",
      });
    }
  };

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const claimRulesOptions = claimTerms.map(term => term.text);
  const generalRulesOptions = generalTerms.map(term => term.text);

  const offerTypes = [
    { id: "bogo", label: "Buy 1 Get 1", icon: Gift },
    { id: "discount", label: "Discount", icon: Percent },
    { id: "voucher", label: "Voucher", icon: Tag },
    { id: "bundle", label: "Bundle", icon: ShoppingBag },
  ];

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col font-sans">
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#00426D]">Create Deal</h1>
            <p className="text-slate-500 mt-1">Fill in the details below to create your new deal.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onFormError)} className="space-y-8">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column - Main Details */}
              <div className="lg:col-span-7 space-y-8">

                {/* Deal Details and Pricing */}
                <section>
                  <h2 className="text-lg font-bold text-[#00426D] mb-4">Deal Details and Pricing</h2>
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-6">
                    <p className="text-sm text-slate-500 italic mb-4">
                      • Choose the most suitable category to ensure your reward is listed correctly.
                    </p>

                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">Category <span className="text-red-500">*</span></FormLabel>
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
                                    <span>Loading...</span>
                                  </div>
                                ) : (
                                  <SelectValue placeholder="Select Category" />
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
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">Sub-Category <span className="text-red-500">*</span></FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value}
                            disabled={!watchedCategory || availableSubCategories.length === 0}
                          >
                            <FormControl>
                              <SelectTrigger className="h-11 bg-slate-50" data-testid="select-subcategory">
                                <SelectValue placeholder={watchedCategory ? "Select Sub-Category" : "Select a category first"} />
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
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">Deal Type <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {offerTypes.map((type) => {
                                const Icon = type.icon;
                                const isSelected = field.value === type.id;
                                return (
                                  <div
                                    key={type.id}
                                    className={cn(
                                      "cursor-pointer rounded-xl border p-4 flex flex-col items-center justify-center gap-3 transition-all",
                                      isSelected 
                                        ? "border-blue-500 bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-500" 
                                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                    )}
                                    onClick={() => field.onChange(type.id)}
                                  >
                                    <Icon className={cn("h-6 w-6", isSelected ? "text-blue-600" : "text-slate-900")} />
                                    <span className={cn("text-xs font-medium", isSelected ? "text-blue-700" : "text-slate-900")}>
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
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">Deal Duration <span className="text-red-500">*</span></FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-11 bg-slate-50">
                                <SelectValue placeholder="Select Duration" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly Deal</SelectItem>
                              <SelectItem value="yearly">Yearly Deal</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="redemption"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold text-slate-500 uppercase">Redemption <span className="text-red-500">*</span></FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11 bg-slate-50">
                                  <SelectValue placeholder="Choose" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="unlimited">Unlimited</SelectItem>
                                <SelectItem value="limited">Limited</SelectItem>
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
                              <FormLabel className="text-xs font-bold text-slate-500 uppercase">Limit Per User <span className="text-red-500">*</span></FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="e.g. 1" className="h-11 bg-slate-50" {...field} />
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
                                Is this deal valid for two tranches?
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
                                  <FormLabel className="text-xs font-bold text-slate-500 uppercase">Tranche Validity</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                      </div>
                    )}

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
                              This Deal is for Multiple Items
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
                             If your deal is for multiple items, the price won't show on the deal card and details page.
                           </p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                      <FormField
                        control={form.control}
                        name="originalPrice"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-xs font-bold text-slate-500 uppercase">{offerType === "voucher" ? "Voucher Amount" : "Original Price"} <span className="text-red-500">*</span></FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input 
                                  placeholder="0.00" 
                                  className="h-11 bg-slate-50 pr-12 disabled:opacity-50 disabled:cursor-not-allowed" 
                                  {...field} 
                                  disabled={isMultipleItems}
                                />
                              </FormControl>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">QAR</div>
                            </div>
                          </FormItem>
                        )}
                      />

                      {isDiscount && (
                        <FormField
                          control={form.control}
                          name="discountPercentage"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel className="text-xs font-bold text-slate-500 uppercase">Discount Percentage <span className="text-red-500">*</span></FormLabel>
                              <div className="relative">
                                <FormControl>
                                  <Input 
                                    placeholder="0" 
                                    className="h-11 bg-slate-50 pr-12" 
                                    {...field} 
                                  />
                                </FormControl>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">%</div>
                              </div>
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

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
                                Available on specific days only
                              </FormLabel>
                              <p className="text-xs text-slate-500">
                                If your deal is valid only on specific days, please select them. Otherwise, it will be active every day.
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      {isSpecificDays && (
                        <div className="mt-4 ml-7 grid grid-cols-2 gap-3">
                          {days.map((day) => (
                            <div key={day} className="flex items-center space-x-2">
                              <Checkbox id={day} />
                              <label
                                htmlFor={day}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-600"
                              >
                                {day}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                </section>

                {/* Deal Description */}
                <section>
                  <h2 className="text-lg font-bold text-[#00426D] mb-4">Deal Description</h2>
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-6">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">Title <span className="text-red-500">*</span></FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input className="h-11 bg-slate-50" maxLength={60} {...field} />
                            </FormControl>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{field.value?.length || 0}/60</div>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <Label className="text-xs text-slate-500">
                            • Clearly mention the deal, validity, and terms so users understand what's included.
                          </Label>
                          <div className="border border-slate-200 rounded-md overflow-hidden bg-slate-50">
                            <RichTextToolbar />
                            <FormControl>
                              <textarea 
                                className="w-full h-32 p-3 bg-white focus:outline-none resize-none text-sm" 
                                placeholder="Description"
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

                {/* Other Rules */}
                <section>
                  <h2 className="text-lg font-bold text-[#00426D] mb-4">Other Rules</h2>
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-6">
                    
                    <FormField
                      control={form.control}
                      name="claimRules"
                      render={() => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">Claim Rules <span className="font-normal normal-case text-slate-400">(Must choose one at least)</span></FormLabel>
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
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">General Rules <span className="font-normal normal-case text-slate-400">(Must choose one at least)</span></FormLabel>
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
                                placeholder="Other Rules"
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

                {/* Branches */}
                <section>
                  <h2 className="text-lg font-bold text-[#00426D] mb-4">Branches</h2>
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <FormField
                      control={form.control}
                      name="branches"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">Branches <span className="text-red-500">*</span></FormLabel>
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-2 min-h-[44px] p-2 bg-slate-50 border border-slate-200 rounded-md">
                              {field.value?.map((branch, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-sm text-slate-700"
                                >
                                  {branch}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newBranches = field.value?.filter((_, i) => i !== index) || [];
                                      field.onChange(newBranches);
                                    }}
                                    className="ml-1 text-slate-400 hover:text-red-500"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </span>
                              ))}
                              <input
                                type="text"
                                value={branchInput}
                                onChange={(e) => setBranchInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ',') {
                                    e.preventDefault();
                                    const trimmedValue = branchInput.trim();
                                    if (trimmedValue && !field.value?.includes(trimmedValue)) {
                                      field.onChange([...(field.value || []), trimmedValue]);
                                      setBranchInput("");
                                    }
                                  }
                                }}
                                onBlur={() => {
                                  const trimmedValue = branchInput.trim();
                                  if (trimmedValue && !field.value?.includes(trimmedValue)) {
                                    field.onChange([...(field.value || []), trimmedValue]);
                                    setBranchInput("");
                                  }
                                }}
                                placeholder={field.value?.length ? "" : "Type branch name and press Enter"}
                                className="flex-1 min-w-[200px] bg-transparent border-none outline-none text-sm placeholder:text-slate-400"
                                data-testid="input-branch"
                              />
                            </div>
                            <p className="text-xs text-slate-500">Type a branch name and press Enter to add it</p>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </section>

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
                            I agree to the <a href="#" className="text-blue-600 hover:underline">Rules for Advertising</a> on Qatar Living and the <a href="#" className="text-blue-600 hover:underline">Terms of use</a>.
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
                   <h2 className="text-lg font-bold text-[#00426D] mb-4">Upload Deal Photos</h2>
                   <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                      <div className="flex items-start gap-3 mb-4 bg-slate-50 p-3 rounded text-xs text-slate-600">
                        <Info className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <p>
                          Upload at least {MIN_PHOTOS} photos (maximum {MAX_PHOTOS}) to attract shoppers to your deal. Use landscape orientation (horizontal) for optimal photo display.
                          <br/><br/>
                          Use clear, relevant, and unique images that represent the actual deal. Avoid promotional banners or pixelated visuals.
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                        <span>Hold and drag to reorder</span>
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="flex items-center gap-1 cursor-help text-blue-500 hover:text-blue-600">
                                <Info className="h-3 w-3" />
                                <span>1280 x 800 - recommended size</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p>For best display quality, upload images with 1280 x 800 pixels (16:10 aspect ratio)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      <div className="text-xs text-slate-500 mb-3">
                        {uploadedImages.length} / {MAX_PHOTOS} photos uploaded
                        {uploadedImages.length < MIN_PHOTOS && (
                          <span className="text-amber-600 ml-2">(minimum {MIN_PHOTOS} required)</span>
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

                      <div className="grid grid-cols-5 gap-3">
                        {/* Render uploaded images */}
                        {uploadedImages.map((img, index) => (
                          <div 
                            key={index}
                            className="aspect-[16/10] relative group"
                            data-testid={`image-preview-${index}`}
                          >
                            {index === 0 && (
                              <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#F47920] text-white text-[10px] px-2 py-0.5 rounded-sm font-medium z-10">
                                Cover Photo
                              </div>
                            )}
                            <img 
                              src={img.preview} 
                              alt={`Upload ${index + 1}`}
                              className="w-full h-full object-cover rounded-lg border-2 border-slate-200"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditImage(index)}
                                className="bg-white text-slate-700 rounded-full p-1.5 hover:bg-blue-50 transition-colors"
                                data-testid={`button-edit-image-${index}`}
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="bg-white text-red-500 rounded-full p-1.5 hover:bg-red-50 transition-colors"
                                data-testid={`button-remove-image-${index}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Show up to 5 empty upload tiles */}
                        {uploadedImages.length < MAX_PHOTOS && Array.from({ length: Math.min(5, MAX_PHOTOS - uploadedImages.length) }).map((_, idx) => (
                          <div 
                            key={`empty-${idx}`}
                            className="aspect-[16/10] relative group cursor-pointer"
                            onClick={handleImageClick}
                            data-testid={`upload-tile-${idx}`}
                          >
                            {uploadedImages.length === 0 && idx === 0 && (
                              <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#F47920] text-white text-[10px] px-2 py-0.5 rounded-sm font-medium z-10">
                                Cover Photo
                              </div>
                            )}
                            <div className="w-full h-full border-2 border-dashed border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors flex flex-col items-center justify-center p-2 text-center">
                              <Plus className="h-5 w-5 text-slate-400 mb-1" />
                              <span className="text-[10px] text-slate-500">Upload</span>
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
              <div className="container mx-auto max-w-6xl flex justify-end items-center gap-4">
                <Button type="button" variant="outline" className="min-w-[100px] border-slate-300 text-slate-600 hover:bg-slate-50">
                  Close
                </Button>
                <Button type="submit" className="min-w-[140px] bg-[#00426D] text-white hover:bg-[#003557]">
                  Save & Publish
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
              {editingIndex !== null ? "Edit Image" : "Crop Image"} (16:10)
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-slate-500">
              Adjust the crop area to fit the 16:10 aspect ratio for optimal display.
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
                  alt="Crop preview"
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
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCropConfirm}
              className="bg-[#00426D] hover:bg-[#003557]"
              disabled={!completedCrop}
              data-testid="button-confirm-crop"
            >
              <Check className="h-4 w-4 mr-2" />
              Confirm Crop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
