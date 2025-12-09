import { useState, useEffect, useRef, ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
  ShoppingBag
} from "lucide-react";

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

import { useLocation } from "wouter";

// Schema
const formSchema = z.object({
  category: z.string(),
  subCategory: z.string(),
  offerType: z.string(),
  offerDuration: z.string(),
  redemption: z.string(),
  limitPerUser: z.string().optional(),
  originalPrice: z.string(),
  isMultipleItems: z.boolean().default(false),
  discountPercentage: z.string().optional(),
  isTwoTranches: z.boolean().default(false),
  trancheValidity: z.string().optional(),
  specificDays: z.boolean().default(false),
  days: z.array(z.string()).optional(),
  title: z.string().min(5, "Title is required"),
  description: z.string(),
  claimRules: z.array(z.string()).min(1, "Must choose at least one claim rule"),
  generalRules: z.array(z.string()).min(1, "Must choose at least one general rule"),
  otherRules: z.string().optional(),
  branch: z.string(),
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const remaining = 5 - uploadedImages.length;
      
      if (remaining <= 0) {
        toast({
          title: "Maximum images reached",
          description: "You can only upload up to 5 images",
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
        title: "Images Uploaded",
        description: `Successfully uploaded ${filesToUpload.length} image(s)`,
      });
      
      if (files.length > remaining) {
        toast({
          title: "Some images skipped",
          description: `Only ${remaining} more image(s) allowed (max 5)`,
          variant: "destructive",
        });
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
      specificDays: false,
      isMultipleItems: false,
      isTwoTranches: false,
      days: [],
      claimRules: [],
      generalRules: [],
      agreement: false,
    },
  });

  // Watchers for dynamic behavior
  const offerType = form.watch("offerType");
  const redemptionType = form.watch("redemption");

  useEffect(() => {
    setIsDiscount(offerType === "discount");
    setIsBogo(offerType === "bogo");
  }, [offerType]);

  useEffect(() => {
    setIsLimitedRedemption(redemptionType === "limited");
  }, [redemptionType]);

  const onSubmit = async (data: FormValues) => {
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
        branch: data.branch,
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

  const claimRulesOptions = [
    "Deal Valid only for Dine-in (Not valid on Delivery / Take away)",
    "Deal Valid only for Delivery / Take away",
    "Deal Valid for Dine-in, Delivery & Take away",
    "Multiple deals cannot be combined in the same transaction",
    "One voucher per person per visit",
    "One voucher per table/group/bill"
  ];

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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-11 bg-slate-50">
                                <SelectValue placeholder="Select Category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="hotel">Hotel & Resorts</SelectItem>
                              <SelectItem value="dining">Dining</SelectItem>
                              <SelectItem value="wellness">Wellness</SelectItem>
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-11 bg-slate-50">
                                <SelectValue placeholder="Select Sub-Category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="pool">Pool & Beach Access</SelectItem>
                              <SelectItem value="staycation">Staycation</SelectItem>
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
                                  className="data-[state=checked]:bg-[#F47920] data-[state=checked]:border-[#F47920]"
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
                            <FormLabel className="text-xs font-bold text-slate-500 uppercase">Original Price <span className="text-red-500">*</span></FormLabel>
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
                              <Input className="h-11 bg-slate-50" {...field} />
                            </FormControl>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">0/60</div>
                          </div>
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500">
                        • Clearly mention the deal, validity, and terms so users understand what's included.
                      </Label>
                      <div className="border border-slate-200 rounded-md overflow-hidden bg-slate-50">
                        <RichTextToolbar />
                        <textarea 
                          className="w-full h-32 p-3 bg-white focus:outline-none resize-none text-sm" 
                          placeholder="Description"
                        ></textarea>
                        <div className="bg-slate-50 px-2 py-1 text-right text-xs text-slate-400 border-t border-slate-100">
                          0/300
                        </div>
                      </div>
                    </div>
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
                            {[
                              "Deal is not applicable on public holidays & all special events",
                              "Advance booking or reservation requirement",
                              "Cannot be applied to already discounted items",
                              "Cannot be combined with employee discounts"
                            ].map((item) => (
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

                    <div className="space-y-2 pt-4">
                      <div className="border border-slate-200 rounded-md overflow-hidden bg-slate-50">
                        <RichTextToolbar />
                        <textarea 
                          className="w-full h-24 p-3 bg-white focus:outline-none resize-none text-sm" 
                          placeholder="Other Rules"
                        ></textarea>
                         <div className="bg-slate-50 px-2 py-1 text-right text-xs text-slate-400 border-t border-slate-100">
                          0/300
                        </div>
                      </div>
                    </div>

                  </div>
                </section>

                {/* Branches */}
                <section>
                  <h2 className="text-lg font-bold text-[#00426D] mb-4">Branches</h2>
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <FormField
                      control={form.control}
                      name="branch"
                      render={({ field }) => (
                        <FormItem>
                           <FormLabel className="text-xs font-bold text-slate-500 uppercase">Branches <span className="text-red-500">*</span></FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-11 bg-slate-50">
                                <SelectValue placeholder="Al Dafna Branch, Al Aziziya" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="dafna">Al Dafna Branch</SelectItem>
                              <SelectItem value="aziziya">Al Aziziya Branch</SelectItem>
                              <SelectItem value="all">All Branches</SelectItem>
                            </SelectContent>
                          </Select>
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
                      <div className="flex items-start gap-3 mb-6 bg-slate-50 p-3 rounded text-xs text-slate-600">
                        <Info className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <p>
                          Upload at least 3 photos (maximum 5) photos to attract shoppers to your deal. Use landscape orientation (horizontal) for optimal photo display.
                          <br/><br/>
                          Use clear, relevant, and unique images that represent the actual deal. Avoid promotional banners or pixelated visuals.
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                        <span>Hold and drag to reorder</span>
                      </div>

                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                      />

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {/* Render uploaded images */}
                        {uploadedImages.map((img, index) => (
                          <div 
                            key={index}
                            className="col-span-1 aspect-square relative group"
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
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}

                        {/* Empty slots for remaining uploads */}
                        {uploadedImages.length < 5 && (
                          <div 
                            className="col-span-1 aspect-square relative group cursor-pointer"
                            onClick={handleImageClick}
                          >
                            {uploadedImages.length === 0 && (
                              <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#F47920] text-white text-[10px] px-2 py-0.5 rounded-sm font-medium z-10">
                                Cover Photo
                              </div>
                            )}
                            <div className="w-full h-full border-2 border-dashed border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors flex flex-col items-center justify-center p-2 text-center">
                              <Plus className="h-6 w-6 text-slate-400 mb-1" />
                              <span className="text-xs text-slate-500">Upload</span>
                            </div>
                          </div>
                        )}
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
                <Button type="submit" className="min-w-[140px] bg-slate-300 text-slate-500 hover:bg-slate-400" disabled>
                  Save & Publish
                </Button>
              </div>
            </div>
            <div className="h-16" /> {/* Spacer for fixed footer */}

          </form>
        </Form>
      </main>
    </div>
  );
}
