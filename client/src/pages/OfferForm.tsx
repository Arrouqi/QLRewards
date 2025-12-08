import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, 
  Upload, 
  FileText, 
  Tag, 
  Percent, 
  Gift, 
  ShoppingBag, 
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import bgImage from "@assets/generated_images/minimalist_abstract_business_background_with_blue_and_white_geometric_shapes.png";
import Header from "@/components/Header";

// Schema for the form
const formSchema = z.object({
  requestType: z.enum(["create", "request"]),
  offerName: z.string().min(5, "Offer name must be at least 5 characters"),
  offerType: z.enum(["bogo", "discount", "voucher", "bundle"]),
  category: z.string().min(1, "Please select a category"),
  subCategory: z.string().min(1, "Please select a sub-category"),
  description: z.string().min(20, "Please provide a detailed description (min 20 chars)"),
  contactName: z.string().min(2, "Contact name is required"),
  contactEmail: z.string().email("Invalid email address"),
  contactPhone: z.string().min(8, "Phone number is required"),
  merchantName: z.string().optional(),
  offerLocation: z.string().optional(),
  branches: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const CATEGORIES = {
  "food-dining": {
    label: "Food & Dining",
    sub: ["Fine Dining", "Casual Dining", "Fast Food", "Cafes", "Buffet"]
  },
  "beauty-spa": {
    label: "Beauty & Spa",
    sub: ["Hair Salon", "Nail Salon", "Spa Services", "Makeup", "Skincare"]
  },
  "activities": {
    label: "Activities & Leisure",
    sub: ["Theme Parks", "Water Sports", "Classes", "Tours", "Events"]
  },
  "retail": {
    label: "Retail & Services",
    sub: ["Fashion", "Electronics", "Home & Garden", "Automotive", "Services"]
  },
  "travel": {
    label: "Travel & Hotels",
    sub: ["Hotel Stay", "Flights", "Car Rental", "Resorts", "Staycations"]
  }
};

export default function OfferForm() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requestType: "create",
      offerName: "",
      offerType: "discount",
      category: "",
      subCategory: "",
      description: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      merchantName: "",
      offerLocation: "",
      branches: "",
    },
  });

  const watchCategory = form.watch("category");
  const watchRequestType = form.watch("requestType");

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("Form Data:", data);
    console.log("Files:", files);
    
    setIsSubmitting(false);
    setLocation("/success");
    toast({
      title: "Request Submitted",
      description: "Your offer request has been successfully submitted for review.",
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />
      {/* Hero Header */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden bg-slate-900">
        <div 
          className="absolute inset-0 opacity-40 mix-blend-overlay"
          style={{ 
            backgroundImage: `url(${bgImage})`, 
            backgroundSize: 'cover', 
            backgroundPosition: 'center' 
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 to-slate-800/50" />
        
        <div className="relative container mx-auto px-4 h-full flex flex-col justify-center max-w-4xl z-10">
          <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-400/20 rounded-full px-3 py-1 w-fit mb-4 backdrop-blur-sm">
            <span className="flex h-2 w-2 rounded-full bg-blue-400 animate-pulse"></span>
            <span className="text-xs font-medium text-blue-100 uppercase tracking-wider">Merchant Portal</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Partner Offer Request
          </h1>
          <p className="text-slate-300 text-lg max-w-2xl leading-relaxed">
            Submit your exclusive deals and offers to be featured on the Qatar Living Deals platform. 
            Reach thousands of customers today.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 container mx-auto px-4 -mt-10 mb-12 max-w-4xl z-20 relative">
        <Card className="border-none shadow-xl bg-white/95 backdrop-blur-sm overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500" />
          <CardContent className="p-6 md:p-8 pt-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                
                {/* Request Type Selector */}
                <div className="bg-slate-100/50 p-1 rounded-lg inline-flex w-full md:w-auto mb-4">
                  <div 
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-md text-sm font-medium transition-all cursor-pointer text-center ${watchRequestType === 'create' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => form.setValue('requestType', 'create')}
                  >
                    Create New Offer
                  </div>
                  <div 
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-md text-sm font-medium transition-all cursor-pointer text-center ${watchRequestType === 'request' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => form.setValue('requestType', 'request')}
                  >
                    Request Offer Campaign
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="offerName"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel className="text-slate-700 font-semibold">Offer Title</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 50% Off Weekend Brunch" className="h-12 text-lg bg-slate-50 border-slate-200 focus:border-blue-500 transition-colors" {...field} data-testid="input-offer-name" />
                          </FormControl>
                          <FormDescription>
                            A catchy title for your deal (max 60 chars recommended)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="offerType"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel className="text-slate-700 font-semibold mb-3 block">Offer Type</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="grid grid-cols-2 md:grid-cols-4 gap-4"
                            >
                              {[
                                { id: "bogo", label: "Buy 1 Get 1", icon: Gift },
                                { id: "discount", label: "Discount", icon: Percent },
                                { id: "voucher", label: "Voucher", icon: Tag },
                                { id: "bundle", label: "Bundle", icon: ShoppingBag },
                              ].map((type) => (
                                <FormItem key={type.id}>
                                  <FormControl>
                                    <RadioGroupItem value={type.id} className="peer sr-only" />
                                  </FormControl>
                                  <Label
                                    htmlFor={type.id}
                                    className="flex flex-col items-center justify-center rounded-xl border-2 border-slate-100 bg-white p-4 hover:bg-slate-50 hover:border-slate-200 peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-50/50 peer-data-[state=checked]:text-blue-700 cursor-pointer transition-all h-full"
                                  >
                                    <type.icon className="mb-2 h-6 w-6" />
                                    <span className="font-medium text-sm text-center">{type.label}</span>
                                  </Label>
                                </FormItem>
                              ))}
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-semibold">Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-11 bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(CATEGORIES).map(([key, value]) => (
                                <SelectItem key={key} value={key}>{value.label}</SelectItem>
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
                          <FormLabel className="text-slate-700 font-semibold">Sub-Category</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            disabled={!watchCategory}
                          >
                            <FormControl>
                              <SelectTrigger className="h-11 bg-slate-50 border-slate-200">
                                <SelectValue placeholder={watchCategory ? "Select sub-category" : "Select category first"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {watchCategory && CATEGORIES[watchCategory as keyof typeof CATEGORIES]?.sub.map((sub) => (
                                <SelectItem key={sub} value={sub}>{sub}</SelectItem>
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
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 font-semibold">Offer Description & Terms</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe your offer in detail. Include any terms and conditions, validity dates, and exclusions." 
                            className="min-h-[150px] bg-slate-50 border-slate-200 focus:border-blue-500 resize-none" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <Label className="text-slate-700 font-semibold">Attachments & Supporting Documents</Label>
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 transition-colors hover:border-blue-400 hover:bg-blue-50/10 text-center cursor-pointer group">
                      <input 
                        type="file" 
                        multiple 
                        className="hidden" 
                        id="file-upload" 
                        onChange={handleFileChange}
                        accept="image/*,.pdf,.doc,.docx"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer w-full h-full block">
                        <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                          <Upload className="h-6 w-6 text-slate-500 group-hover:text-blue-600" />
                        </div>
                        <p className="text-sm font-medium text-slate-900 mb-1">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-slate-500">
                          Images, PDF, or Word documents (Max 10MB)
                        </p>
                      </label>
                    </div>
                    {files.length > 0 && (
                      <div className="space-y-2 mt-4">
                        {files.map((file, i) => (
                          <div key={i} className="flex items-center p-3 bg-slate-50 border border-slate-100 rounded-lg">
                            <FileText className="h-5 w-5 text-blue-500 mr-3" />
                            <span className="text-sm text-slate-700 truncate flex-1">{file.name}</span>
                            <span className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator className="my-8" />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Additional Details (Optional)</h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="merchantName"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel className="text-slate-700">Merchant Name</FormLabel>
                            <FormControl>
                              <Input className="h-11 bg-slate-50" placeholder="Business or Brand Name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="offerLocation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700">Location of Offers</FormLabel>
                            <FormControl>
                              <Input className="h-11 bg-slate-50" placeholder="e.g. Doha, Lusail, Al Wakrah" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="branches"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700">Participating Branches</FormLabel>
                            <FormControl>
                              <Input className="h-11 bg-slate-50" placeholder="e.g. All branches, City Center only" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator className="my-8" />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Contact Information</h3>
                    <div className="grid md:grid-cols-3 gap-6">
                      <FormField
                        control={form.control}
                        name="contactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700">Contact Person</FormLabel>
                            <FormControl>
                              <Input className="h-11 bg-slate-50" placeholder="Full Name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="contactEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700">Email Address</FormLabel>
                            <FormControl>
                              <Input className="h-11 bg-slate-50" placeholder="email@company.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="contactPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700">Phone Number</FormLabel>
                            <FormControl>
                              <Input className="h-11 bg-slate-50" placeholder="+974 0000 0000" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                </div>

                <div className="pt-4 flex justify-end">
                  <Button 
                    type="submit" 
                    className="h-12 px-8 text-base bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-blue-500/25 transition-all w-full md:w-auto"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Submit Offer Request
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </div>

              </form>
            </Form>
          </CardContent>
        </Card>
        
        <div className="text-center text-slate-400 text-sm pb-8">
          &copy; 2024 Qatar Living. All rights reserved. • <a href="#" className="hover:text-blue-400 transition-colors">Privacy Policy</a> • <a href="#" className="hover:text-blue-400 transition-colors">Terms of Service</a>
        </div>
      </div>
    </div>
  );
}
