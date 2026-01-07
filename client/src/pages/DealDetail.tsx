import { useEffect, useState, useRef, ChangeEvent, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop, convertToPixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { ArrowLeft, CheckCircle, Save, MessageSquare, FileDown, X, Gift, Percent, Tag, ShoppingBag, Upload, Pencil, Check, Crop as CropIcon, Camera, Trash2, Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Deal, AdminUser } from "@shared/schema";

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
  description: z.string().min(1, "Description is required"),
  claimRules: z.array(z.string()).min(1, "Select at least one claim rule"),
  generalRules: z.array(z.string()).min(1, "Select at least one general rule"),
  otherRules: z.string().optional(),
  merchantName: z.string().min(1, "Merchant name is required"),
  merchantEmail: z.string().optional(),
  merchantPhone: z.string().optional(),
  branches: z.array(z.string()).min(1, "At least one branch is required"),
}).refine((data) => {
  if (!data.isMultipleItems && (!data.originalPrice || data.originalPrice.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "Original price is required when not a multiple items deal",
  path: ["originalPrice"],
});

type DealValues = z.infer<typeof dealSchema>;

const offerTypes = [
  { id: "bogo", label: "Buy 1 Get 1", icon: Gift },
  { id: "discount", label: "Discount", icon: Percent },
  { id: "voucher", label: "Voucher", icon: Tag },
  { id: "bundle", label: "Bundle", icon: ShoppingBag },
];

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function DealDetail() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/deals/:id");
  const [deal, setDeal] = useState<Deal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [adminComment, setAdminComment] = useState("");
  const [merchantUserId, setMerchantUserId] = useState("");
  const [merchantBranchId, setMerchantBranchId] = useState("");
  const [branchInput, setBranchInput] = useState("");
  
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>("");
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  const MIN_PHOTOS = 4;
  const MAX_PHOTOS = 10;

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

  const form = useForm<DealValues>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
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
      days: [],
      title: "",
      description: "",
      claimRules: [],
      generalRules: [],
      otherRules: "",
      merchantName: "",
      merchantEmail: "",
      merchantPhone: "",
      branches: [],
    },
  });

  const watchedCategory = form.watch("category");
  const watchedDealType = form.watch("dealType");
  const watchedRedemption = form.watch("redemption");
  const watchedSpecificDays = form.watch("specificDays");
  const watchedIsTwoTranches = form.watch("isTwoTranches");
  const watchedIsMultipleItems = form.watch("isMultipleItems");

  const selectedCategory = categories.find(c => c.name === watchedCategory);
  const availableSubCategories = selectedCategory?.subCategories || [];

  useEffect(() => {
    checkAuthAndFetchDeal();
  }, [params?.id]);

  const checkAuthAndFetchDeal = async () => {
    try {
      const authResponse = await fetch("/api/auth/session", { credentials: "include" });
      if (!authResponse.ok) {
        setLocation("/admin/login");
        return;
      }

      if (!params?.id) return;

      const dealResponse = await fetch(`/api/deals/${params.id}`, { credentials: "include" });
      if (!dealResponse.ok) {
        throw new Error("Deal not found");
      }

      const data = await dealResponse.json();
      setDeal(data);
      setAdminComment("");
      setMerchantUserId(data.merchantUserId || "");
      setMerchantBranchId(data.merchantBranchId || "");
      setUploadedImages(data.images || []);

      form.reset({
        category: data.category || "",
        subCategory: data.subCategory || "",
        dealType: data.dealType || "",
        duration: data.duration || "",
        redemption: data.redemption || "",
        limitPerUser: data.limitPerUser || "",
        originalPrice: data.originalPrice || "",
        isMultipleItems: data.isMultipleItems || false,
        discountPercentage: data.discountPercentage || "",
        isTwoTranches: data.isTwoTranches || false,
        trancheValidity: data.trancheValidity || "",
        specificDays: data.specificDays || false,
        days: data.days || [],
        title: data.title || "",
        description: data.description || "",
        claimRules: data.claimRules || [],
        generalRules: data.generalRules || [],
        otherRules: data.otherRules || "",
        merchantName: data.merchantName || "",
        merchantEmail: data.merchantEmail || "",
        merchantPhone: data.merchantPhone || "",
        branches: data.branches || [],
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch deal",
        variant: "destructive",
      });
      setLocation("/admin/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const onUpdate = async (data: DealValues) => {
    if (!params?.id) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/deals/${params.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ ...data, images: uploadedImages }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update deal");
      }

      const updatedDeal = await response.json();
      setDeal(updatedDeal);

      toast({
        title: "Success",
        description: "Deal updated successfully",
      });
      
      // Redirect back to dashboard after successful save
      setLocation("/admin/dashboard");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update deal",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const onApprove = async () => {
    if (!params?.id) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/deals/${params.id}/approve`, {
        method: "PATCH",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve deal");
      }

      const updatedDeal = await response.json();
      setDeal(updatedDeal);

      toast({
        title: "Success",
        description: "Deal forwarded to moderation successfully",
      });
      
      // Redirect back to dashboard after forwarding
      setLocation("/admin/dashboard");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to forward deal",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveAdminFields = async () => {
    if (!params?.id) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/deals/${params.id}/admin-fields`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ adminComment }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save admin fields");
      }

      const updatedDeal = await response.json();
      setDeal(updatedDeal);
      setAdminComment("");

      toast({
        title: "Success",
        description: "Comment added successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save admin fields",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveMerchantIds = async () => {
    if (!params?.id) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/deals/${params.id}/merchant-ids`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ merchantUserId, merchantBranchId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save merchant IDs");
      }

      const updatedDeal = await response.json();
      setDeal(updatedDeal);

      toast({
        title: "Success",
        description: "Merchant IDs saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save merchant IDs",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

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
      
      filesToUpload.forEach(file => {
        const reader = new FileReader();
        reader.onload = () => {
          setUploadedImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });

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
    setImageToCrop(img);
    setShowCropper(true);
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerAspectCrop(width, height, ASPECT_RATIO);
    setCrop(initialCrop);
    const pixelCrop = convertToPixelCrop(initialCrop, width, height);
    setCompletedCrop(pixelCrop);
  }, []);

  const getCroppedImage = useCallback(async (): Promise<string | null> => {
    if (!completedCrop || !imgRef.current || !canvasRef.current) {
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
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.9);
    });
  }, [completedCrop]);

  const handleCropConfirm = async () => {
    const croppedImage = await getCroppedImage();
    if (croppedImage) {
      if (editingIndex !== null) {
        setUploadedImages(prev => {
          const newImages = [...prev];
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!deal) {
    return null;
  }

  const claimRulesOptions = claimTerms.map(term => term.text);
  const generalRulesOptions = generalTerms.map(term => term.text);

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => setLocation("/admin/dashboard")}
              className="flex items-center gap-2"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation(`/admin/deals/${params?.id}/print`)}
              className="flex items-center gap-2"
              data-testid="button-download-pdf"
            >
              <FileDown className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-[#00426D]">Edit Deal</h1>
              <p className="text-slate-500 mt-1 font-mono text-sm">ID: {deal.id}</p>
            </div>
            <Badge
              variant={deal.status === "approved" ? "default" : "secondary"}
              className={
                deal.status === "approved"
                  ? "bg-green-100 text-green-800"
                  : deal.status === "archived"
                  ? "bg-slate-100 text-slate-600"
                  : "bg-blue-100 text-blue-800"
              }
            >
              {deal.status === "approved" ? "Sent to Moderation" : deal.status === "pending" ? "Pending" : deal.status}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onUpdate)} className="space-y-6">
                
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  <h2 className="text-lg font-bold text-[#00426D] mb-4">Deal Details</h2>
                  
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">Title <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input className="h-11 bg-slate-50" {...field} data-testid="input-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold text-slate-500 uppercase">Category <span className="text-red-500">*</span></FormLabel>
                            <Select
                              onValueChange={(val) => {
                                field.onChange(val);
                                form.setValue("subCategory", "");
                              }}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="h-11 bg-slate-50" data-testid="select-category">
                                  <SelectValue placeholder="Select Category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {categories.map((category) => (
                                  <SelectItem key={category.id} value={category.name}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
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
                                  <SelectValue placeholder="Select Sub-Category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {availableSubCategories.map((sub) => (
                                  <SelectItem key={sub.id} value={sub.name}>
                                    {sub.name}
                                  </SelectItem>
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
                      name="dealType"
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
                                    data-testid={`dealtype-${type.id}`}
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

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="duration"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold text-slate-500 uppercase">Duration <span className="text-red-500">*</span></FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11 bg-slate-50" data-testid="select-duration">
                                  <SelectValue placeholder="Select Duration" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="monthly">Monthly Deal</SelectItem>
                                <SelectItem value="yearly">Yearly Deal</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="redemption"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold text-slate-500 uppercase">Redemption <span className="text-red-500">*</span></FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11 bg-slate-50" data-testid="select-redemption">
                                  <SelectValue placeholder="Select Redemption" />
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

                    {watchedRedemption === "limited" && (
                      <FormField
                        control={form.control}
                        name="limitPerUser"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold text-slate-500 uppercase">Limit Per User</FormLabel>
                            <FormControl>
                              <Input className="h-11 bg-slate-50" placeholder="e.g., 2" {...field} data-testid="input-limit" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {(watchedDealType === "discount" || watchedDealType === "bogo") && (
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="isMultipleItems"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <FormLabel className="font-normal text-slate-700">Multiple items in this deal</FormLabel>
                            </FormItem>
                          )}
                        />
                        
                        {watchedIsMultipleItems && (
                          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                            If your deal is for multiple items, the price won't show on the deal card and details page.
                          </div>
                        )}
                      </div>
                    )}

                    {!watchedIsMultipleItems && (
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="originalPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-bold text-slate-500 uppercase">
                                {watchedDealType === "voucher" ? "Voucher Amount" : "Original Price"} (QAR) <span className="text-red-500">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input className="h-11 bg-slate-50" placeholder="0.00" {...field} data-testid="input-price" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {watchedDealType === "discount" && (
                          <FormField
                            control={form.control}
                            name="discountPercentage"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-bold text-slate-500 uppercase">Discount %</FormLabel>
                                <FormControl>
                                  <Input className="h-11 bg-slate-50" placeholder="e.g., 25" {...field} data-testid="input-discount" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </div>
                    )}

                    <div className="space-y-4">

                      {watchedDealType === "bogo" && (
                        <>
                          <FormField
                            control={form.control}
                            name="isTwoTranches"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="font-normal text-slate-700">Split into two tranches</FormLabel>
                              </FormItem>
                            )}
                          />
                          {watchedIsTwoTranches && (
                            <FormField
                              control={form.control}
                              name="trancheValidity"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-bold text-slate-500 uppercase">Tranche Validity</FormLabel>
                                  <FormControl>
                                    <Input className="h-11 bg-slate-50" placeholder="e.g., 6 months" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </>
                      )}

                      <FormField
                        control={form.control}
                        name="specificDays"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <FormLabel className="font-normal text-slate-700">Valid on specific days only</FormLabel>
                          </FormItem>
                        )}
                      />

                      {watchedSpecificDays && (
                        <FormField
                          control={form.control}
                          name="days"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-bold text-slate-500 uppercase">Select Days</FormLabel>
                              <div className="flex flex-wrap gap-2">
                                {daysOfWeek.map((day) => (
                                  <button
                                    key={day}
                                    type="button"
                                    className={cn(
                                      "px-3 py-1.5 rounded-md text-sm font-medium border transition-colors",
                                      field.value?.includes(day)
                                        ? "bg-blue-500 text-white border-blue-500"
                                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                    )}
                                    onClick={() => {
                                      const newDays = field.value?.includes(day)
                                        ? field.value.filter(d => d !== day)
                                        : [...(field.value || []), day];
                                      field.onChange(newDays);
                                    }}
                                  >
                                    {day}
                                  </button>
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">Description <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Textarea className="bg-slate-50 min-h-[100px]" {...field} data-testid="textarea-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  <h2 className="text-lg font-bold text-[#00426D] mb-4">Rules</h2>
                  
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="claimRules"
                      render={() => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">Claim Rules <span className="text-red-500">*</span></FormLabel>
                          <div className="space-y-2 mt-2">
                            {claimRulesOptions.map((item) => (
                              <FormField
                                key={item}
                                control={form.control}
                                name="claimRules"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(item)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? field.onChange([...field.value, item])
                                            : field.onChange(field.value?.filter((v) => v !== item));
                                        }}
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal text-slate-700">{item}</FormLabel>
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="generalRules"
                      render={() => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">General Rules <span className="text-red-500">*</span></FormLabel>
                          <div className="space-y-2 mt-2">
                            {generalRulesOptions.map((item) => (
                              <FormField
                                key={item}
                                control={form.control}
                                name="generalRules"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(item)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? field.onChange([...field.value, item])
                                            : field.onChange(field.value?.filter((v) => v !== item));
                                        }}
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal text-slate-700">{item}</FormLabel>
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="otherRules"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">Other Rules</FormLabel>
                          <FormControl>
                            <Textarea
                              className="bg-slate-50 min-h-[80px]"
                              placeholder="Any additional rules..."
                              maxLength={300}
                              {...field}
                              data-testid="textarea-other-rules"
                            />
                          </FormControl>
                          <div className="text-right text-xs text-slate-400">{field.value?.length || 0}/300</div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  <h2 className="text-lg font-bold text-[#00426D] mb-4">Merchant Details</h2>
                  
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="merchantName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">Merchant Name <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input className="h-11 bg-slate-50" placeholder="Enter merchant name" {...field} data-testid="input-merchant-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="merchantEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">Qatar Living Account Email</FormLabel>
                          <FormControl>
                            <Input type="email" className="h-11 bg-slate-50" placeholder="Enter email" {...field} data-testid="input-merchant-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="merchantPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase">Contact Number</FormLabel>
                          <FormControl>
                            <Input type="tel" className="h-11 bg-slate-50" placeholder="Enter contact number" {...field} data-testid="input-merchant-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  <h2 className="text-lg font-bold text-[#00426D] mb-4">Branches</h2>
                  
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

                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  <h2 className="text-lg font-bold text-[#00426D] mb-4 flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Deal Photos
                  </h2>
                  
                  <div className="space-y-4">
                    <div className="text-sm text-slate-600">
                      Upload {MIN_PHOTOS} to {MAX_PHOTOS} photos of your offer. Recommended size: 1280x800 pixels (16:10 aspect ratio).
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {uploadedImages.map((img, index) => (
                        <div 
                          key={index}
                          className={`relative aspect-[16/10] rounded-lg overflow-hidden border-2 border-slate-200 group cursor-grab active:cursor-grabbing transition-all ${
                            draggedIndex === index ? 'opacity-50 scale-95' : ''
                          } ${dragOverIndex === index ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragEnd={handleDragEnd}
                          data-testid={`image-preview-${index}`}
                        >
                          <img 
                            src={img} 
                            alt={`Deal photo ${index + 1}`}
                            className="w-full h-full object-cover pointer-events-none"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => handleEditImage(index)}
                              className="h-8"
                              data-testid={`button-edit-image-${index}`}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => removeImage(index)}
                              className="h-8"
                              data-testid={`button-remove-image-${index}`}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Remove
                            </Button>
                          </div>
                          <div className="absolute top-2 left-2 bg-[#00426D] text-white text-xs px-2 py-1 rounded">
                            {index + 1}
                          </div>
                        </div>
                      ))}
                      
                      {uploadedImages.length < MAX_PHOTOS && (
                        <div
                          onClick={handleImageClick}
                          className="aspect-[16/10] rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-[#00426D] hover:bg-slate-50 transition-colors"
                          data-testid="button-add-image"
                        >
                          <Upload className="h-8 w-8 text-slate-400 mb-2" />
                          <span className="text-sm text-slate-500">Add Photo</span>
                          <span className="text-xs text-slate-400">{uploadedImages.length}/{MAX_PHOTOS}</span>
                        </div>
                      )}
                    </div>
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      data-testid="input-file-upload"
                    />
                    
                    {uploadedImages.length < MIN_PHOTOS && (
                      <p className="text-sm text-amber-600">
                        Please upload at least {MIN_PHOTOS - uploadedImages.length} more photo{MIN_PHOTOS - uploadedImages.length > 1 ? 's' : ''}.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    className="bg-[#00426D] hover:bg-[#003152] flex items-center gap-2"
                    disabled={isSaving}
                    data-testid="button-update"
                  >
                    <Save className="h-4 w-4" />
                    {isSaving ? "Saving..." : "Update Deal"}
                  </Button>
                  {deal.status === "pending" && (
                    <Button
                      type="button"
                      onClick={onApprove}
                      className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
                      disabled={isSaving}
                      data-testid="button-approve"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Forward To Moderation
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </div>

          <div className="lg:col-span-4">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 sticky top-4">
              <h2 className="text-lg font-bold text-[#00426D] mb-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Admin Notes
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                    Add Comment
                  </label>
                  <Textarea
                    value={adminComment}
                    onChange={(e) => setAdminComment(e.target.value)}
                    placeholder="Add a comment about this deal..."
                    rows={3}
                    className="bg-slate-50"
                    data-testid="textarea-admin-comment"
                  />
                </div>

                <Button
                  type="button"
                  onClick={saveAdminFields}
                  disabled={isSaving || !adminComment.trim()}
                  className="w-full bg-[#00426D] hover:bg-[#003152]"
                  data-testid="button-save-admin-notes"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Add Comment
                    </>
                  )}
                </Button>

                {deal.adminCommentHistory && deal.adminCommentHistory.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-3">
                      Comment History
                    </label>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {[...deal.adminCommentHistory].reverse().map((commentStr, index) => {
                        try {
                          const comment = JSON.parse(commentStr);
                          return (
                            <div 
                              key={index} 
                              className="bg-slate-50 p-3 rounded-lg border border-slate-200"
                            >
                              <div className="flex justify-between items-start mb-1">
                                <span className="text-sm font-medium text-[#00426D]">
                                  {comment.author}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {new Date(comment.timestamp).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                {comment.text}
                              </p>
                            </div>
                          );
                        } catch (e) {
                          return (
                            <div 
                              key={index} 
                              className="bg-slate-50 p-3 rounded-lg border border-slate-200"
                            >
                              <p className="text-sm text-slate-700">{commentStr}</p>
                            </div>
                          );
                        }
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {deal.status === "approved" && (
              <>
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mt-4">
                  <h2 className="text-lg font-bold text-[#00426D] mb-4">Merchant IDs</h2>
                  <p className="text-sm text-slate-500 mb-4">
                    Enter the merchant user ID and branch ID to link this deal with your system.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                        Merchant User ID
                      </label>
                      <Input
                        value={merchantUserId}
                        onChange={(e) => setMerchantUserId(e.target.value)}
                        placeholder="Enter merchant user ID"
                        className="bg-slate-50"
                        data-testid="input-merchant-user-id"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                        Merchant Branch ID
                      </label>
                      <Input
                        value={merchantBranchId}
                        onChange={(e) => setMerchantBranchId(e.target.value)}
                        placeholder="Enter merchant branch ID"
                        className="bg-slate-50"
                        data-testid="input-merchant-branch-id"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={saveMerchantIds}
                      disabled={isSaving}
                      className="w-full bg-[#00426D] hover:bg-[#003152]"
                      data-testid="button-save-merchant-ids"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Merchant IDs
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mt-4">
                  <h2 className="text-lg font-bold text-[#00426D] mb-4">API Payload Preview</h2>
                  <p className="text-sm text-slate-500 mb-4">
                    This is the sample payload that will be sent to create the offer in your system.
                  </p>
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto max-h-[400px] overflow-y-auto">
{JSON.stringify({
  merchantUserId: deal.merchantUserId || "<MERCHANT_USER_ID>",
  merchantBranchId: deal.merchantBranchId || "<MERCHANT_BRANCH_ID>",
  title: deal.title,
  description: deal.description,
  category: deal.category,
  subCategory: deal.subCategory,
  dealType: deal.dealType,
  duration: deal.duration,
  redemption: deal.redemption,
  limitPerUser: deal.limitPerUser,
  originalPrice: deal.isMultipleItems ? null : deal.originalPrice,
  isMultipleItems: deal.isMultipleItems,
  discountPercentage: deal.discountPercentage,
  isTwoTranches: deal.isTwoTranches,
  trancheValidity: deal.trancheValidity,
  specificDays: deal.specificDays,
  days: deal.days,
  offerStartDate: deal.offerStartDate || null,
  offerEndDate: deal.offerEndDate || null,
  claimRules: deal.claimRules,
  generalRules: deal.generalRules,
  otherRules: deal.otherRules,
  merchantName: deal.merchantName,
  merchantEmail: deal.merchantEmail,
  merchantPhone: deal.merchantPhone,
  branches: deal.branches,
  images: deal.images?.map((_, i) => `<IMAGE_URL_${i + 1}>`) || [],
}, null, 2)}
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showCropper} onOpenChange={setShowCropper}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? "Edit Image" : "Crop Image"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {imageToCrop && (
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={ASPECT_RATIO}
                className="max-h-[60vh]"
              >
                <img
                  ref={imgRef}
                  src={imageToCrop}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  style={{ maxHeight: '60vh' }}
                />
              </ReactCrop>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={handleCropCancel}
              data-testid="button-crop-cancel"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCropConfirm}
              className="bg-[#00426D] hover:bg-[#003152]"
              data-testid="button-crop-confirm"
            >
              {editingIndex !== null ? "Save Changes" : "Add Image"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
