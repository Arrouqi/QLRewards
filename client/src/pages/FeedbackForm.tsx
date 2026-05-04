import { useState, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Loader2, MessageSquare, ShieldCheck, Sparkles, Search, Check, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const QUALITY_OPTIONS = ["Poor", "Fair", "Good", "Very Good", "Excellent"] as const;
const QUALITY_VALUES = ["poor", "fair", "good", "very_good", "excellent"] as const;
type QualityValue = (typeof QUALITY_VALUES)[number];

const feedbackSchema = z.object({
  shopperName: z.string().min(1, "Name is required"),
  totalBudgetQar: z.string().min(1, "Total budget is required"),

  merchantName: z.string().min(1, "Merchant name is required"),
  merchantId: z.string().optional(),
  merchantLocation: z.string().min(1, "Location is required"),
  visitDate: z.string().min(1, "Date of visit is required"),
  visitTime: z.string().min(1, "Time is required"),

  staffAwareOfQld: z.enum(["yes", "no"], { required_error: "Please select an option" }),
  staffFamiliarWithOffers: z.enum(["yes", "no"], { required_error: "Please select an option" }),
  staffKnowsRedeem: z.enum(["yes", "no"], { required_error: "Please select an option" }),
  staffKnowsRedeemComment: z.string().optional(),
  processRewardComment: z.string().optional(),
  rewardApprovedImmediately: z.enum(["yes", "no"], { required_error: "Please select an option" }),
  merchantComments: z.string().optional(),

});

type FeedbackFormValues = z.infer<typeof feedbackSchema>;

interface MerchantOption {
  id: string;
  name: string;
  category?: string;
}

function MerchantPicker({
  value,
  onChange,
  onMerchantId,
}: {
  value: string;
  onChange: (v: string) => void;
  onMerchantId: (id: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<{ merchants: any[] }>({
    queryKey: ["/api/public/merchants", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      params.set("size", "30");
      const res = await fetch(`/api/public/merchants?${params}`);
      if (!res.ok) return { merchants: [] };
      return res.json();
    },
  });

  const options: MerchantOption[] = useMemo(() => {
    return (data?.merchants || []).map((m: any) => ({
      id: m.id || m.agencyId || m._id,
      name: m.agencyName || m.name || "(unnamed)",
      category: m.category,
    }));
  }, [data]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            data-testid="button-merchant-picker"
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || "Select or type merchant name..."}
            </span>
            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search merchants..."
              value={search}
              onValueChange={setSearch}
              data-testid="input-merchant-search"
            />
            <CommandList>
              {isLoading && (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </div>
              )}
              {!isLoading && options.length === 0 && (
                <CommandEmpty>
                  No merchants found.{" "}
                  {search && (
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => {
                        onChange(search);
                        onMerchantId(undefined);
                        setOpen(false);
                      }}
                    >
                      Use "{search}" anyway
                    </button>
                  )}
                </CommandEmpty>
              )}
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.id}
                    value={opt.name}
                    onSelect={() => {
                      onChange(opt.name);
                      onMerchantId(opt.id);
                      setOpen(false);
                    }}
                    data-testid={`option-merchant-${opt.id}`}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === opt.name ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{opt.name}</span>
                      {opt.category && (
                        <span className="text-xs text-muted-foreground">{opt.category}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground">
        Pick from the list, or type a merchant name and select "Use ... anyway" if not listed.
      </p>
    </div>
  );
}

function YesNoField({
  control,
  name,
  label,
}: {
  control: any;
  name: keyof FeedbackFormValues;
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name as any}
      render={({ field }) => (
        <FormItem className="rounded-md border p-4">
          <FormLabel className="text-sm font-semibold">{label}</FormLabel>
          <FormControl>
            <RadioGroup
              onValueChange={field.onChange}
              value={field.value}
              className="mt-2 flex gap-4"
            >
              <Label
                className={cn(
                  "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm",
                  field.value === "yes" && "border-primary bg-primary/10 font-semibold",
                )}
              >
                <RadioGroupItem value="yes" data-testid={`radio-${name}-yes`} />
                Yes
              </Label>
              <Label
                className={cn(
                  "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm",
                  field.value === "no" && "border-primary bg-primary/10 font-semibold",
                )}
              >
                <RadioGroupItem value="no" data-testid={`radio-${name}-no`} />
                No
              </Label>
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function QualityField({
  control,
  name,
  label,
}: {
  control: any;
  name: keyof FeedbackFormValues;
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name as any}
      render={({ field }) => (
        <FormItem className="rounded-md border p-4">
          <FormLabel className="text-sm font-semibold">{label}</FormLabel>
          <FormControl>
            <RadioGroup
              onValueChange={field.onChange}
              value={field.value}
              className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5"
            >
              {QUALITY_OPTIONS.map((opt, idx) => {
                const val = QUALITY_VALUES[idx];
                return (
                  <Label
                    key={val}
                    className={cn(
                      "flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm",
                      field.value === val && "border-primary bg-primary/10 font-semibold",
                    )}
                  >
                    <RadioGroupItem value={val} data-testid={`radio-${name}-${val}`} />
                    {opt}
                  </Label>
                );
              })}
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Merchant Referral Form (Living Deals Staff Interaction)
// ─────────────────────────────────────────────────────────────────────────────

const SMOOTHNESS_OPTIONS = ["Very Easy", "Easy", "Difficult", "Very Difficult"] as const;
const SMOOTHNESS_VALUES = ["very_easy", "easy", "difficult", "very_difficult"] as const;
const KNOWLEDGE_OPTIONS = ["Poor", "Fair", "Good", "Excellent"] as const;
const KNOWLEDGE_VALUES = ["poor", "fair", "good", "excellent"] as const;
const SATISFACTION_OPTIONS = [
  "Very Unsatisfied",
  "Unsatisfied",
  "Neutral",
  "Satisfied",
  "Very Satisfied",
] as const;
const SATISFACTION_VALUES = [
  "very_unsatisfied",
  "unsatisfied",
  "neutral",
  "satisfied",
  "very_satisfied",
] as const;

const referralSchema = z.object({
  merchantName: z.string().min(1, "Merchant name is required"),
  merchantId: z.string().optional(),
  merchantLocation: z.string().min(1, "Branch name is required"),
  visitDate: z.string().min(1, "Date is required"),
  visitTime: z.string().min(1, "Time is required"),
  shopperName: z.string().min(1, "Your name is required"),

  referralIntroducedDeals: z.enum(["yes", "no"], { required_error: "Please select an option" }),
  referralEncouragedAppDownload: z.enum(["yes", "no"], { required_error: "Please select an option" }),
  referralExplainedOffer: z.enum(["yes", "no"], { required_error: "Please select an option" }),
  referralProvidedPromoCode: z.enum(["yes", "no"], { required_error: "Please select an option" }),

  referralSubscriptionSmoothness: z.enum(SMOOTHNESS_VALUES, { required_error: "Please select an option" }),
  referralStaffKnowledge: z.enum(KNOWLEDGE_VALUES, { required_error: "Please select an option" }),
  referralOverallSatisfaction: z.enum(SATISFACTION_VALUES, { required_error: "Please select an option" }),

  referralLikedMost: z.string().optional(),
  referralCouldImprove: z.string().optional(),
  merchantComments: z.string().optional(),
});

type ReferralFormValues = z.infer<typeof referralSchema>;

function OptionsField({
  control,
  name,
  label,
  options,
  values,
  cols,
}: {
  control: any;
  name: keyof ReferralFormValues;
  label: string;
  options: readonly string[];
  values: readonly string[];
  cols: 4 | 5;
}) {
  const colClass = cols === 5 ? "sm:grid-cols-5" : "sm:grid-cols-4";
  return (
    <FormField
      control={control}
      name={name as any}
      render={({ field }) => (
        <FormItem className="rounded-md border p-4">
          <FormLabel className="text-sm font-semibold">{label}</FormLabel>
          <FormControl>
            <RadioGroup
              onValueChange={field.onChange}
              value={field.value}
              className={cn("mt-2 grid grid-cols-2 gap-2", colClass)}
            >
              {options.map((opt, idx) => {
                const val = values[idx];
                return (
                  <Label
                    key={val}
                    className={cn(
                      "flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm",
                      field.value === val && "border-primary bg-primary/10 font-semibold",
                    )}
                  >
                    <RadioGroupItem value={val} data-testid={`radio-${name}-${val}`} />
                    {opt}
                  </Label>
                );
              })}
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ReferralYesNoField({
  control,
  name,
  label,
}: {
  control: any;
  name: keyof ReferralFormValues;
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name as any}
      render={({ field }) => (
        <FormItem className="rounded-md border p-4">
          <FormLabel className="text-sm font-semibold">{label}</FormLabel>
          <FormControl>
            <RadioGroup
              onValueChange={field.onChange}
              value={field.value}
              className="mt-2 flex gap-4"
            >
              <Label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2",
                  field.value === "yes" && "border-primary bg-primary/10 font-semibold",
                )}
              >
                <RadioGroupItem value="yes" data-testid={`radio-${name}-yes`} />
                Yes
              </Label>
              <Label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2",
                  field.value === "no" && "border-primary bg-primary/10 font-semibold",
                )}
              >
                <RadioGroupItem value="no" data-testid={`radio-${name}-no`} />
                No
              </Label>
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function MerchantReferralForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [merchantCommentFiles, setMerchantCommentFiles] = useState<File[]>([]);
  const merchantCommentFileRef = useRef<HTMLInputElement>(null);

  const form = useForm<ReferralFormValues>({
    resolver: zodResolver(referralSchema),
    defaultValues: {
      merchantName: "",
      merchantId: undefined,
      merchantLocation: "",
      visitDate: "",
      visitTime: "",
      shopperName: "",
      referralLikedMost: "",
      referralCouldImprove: "",
      merchantComments: "",
    },
  });

  const onSubmit = async (values: ReferralFormValues) => {
    setSubmitting(true);
    try {
      let merchantCommentFileUrls: string[] = [];
      if (merchantCommentFiles.length > 0) {
        const base64Files = await Promise.all(
          merchantCommentFiles.map(
            (f) =>
              new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(f);
              })
          )
        );
        const uploadRes = await fetch("/api/feedbacks/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: base64Files }),
        });
        if (uploadRes.ok) {
          const { urls } = await uploadRes.json();
          merchantCommentFileUrls = urls;
        }
      }
      const res = await fetch("/api/feedbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          feedbackType: "merchant_referral",
          merchantCommentFiles: merchantCommentFileUrls.length > 0 ? merchantCommentFileUrls : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit feedback");
      }
      onSuccess();
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <p className="rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Living Deals Staff Interaction — Referral Feedback Form. Please share your honest experience with the
          merchant's staff.
        </p>

        {/* Visit details */}
        <Card>
          <CardHeader className="bg-primary/5">
            <CardTitle className="text-lg">Visit Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <FormField
              control={form.control}
              name="merchantName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Merchant Name *</FormLabel>
                  <FormControl>
                    <MerchantPicker
                      value={field.value}
                      onChange={field.onChange}
                      onMerchantId={(id) => form.setValue("merchantId", id)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="merchantLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Branch / area" {...field} data-testid="input-referral-branch" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="visitDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-referral-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="visitTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time *</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} data-testid="input-referral-time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="shopperName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Your full name" {...field} data-testid="input-referral-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Staff interaction */}
        <Card>
          <CardHeader className="bg-primary/5">
            <CardTitle className="text-lg">Staff Interaction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            <ReferralYesNoField
              control={form.control}
              name="referralIntroducedDeals"
              label="Did the staff introduce Qatar Living Deals to you?"
            />
            <ReferralYesNoField
              control={form.control}
              name="referralEncouragedAppDownload"
              label="Did the staff ask or encourage you to download the Qatar Living app?"
            />
            <ReferralYesNoField
              control={form.control}
              name="referralExplainedOffer"
              label="Did the staff clearly explain the offer (discount, conditions, how to use it)?"
            />
            <ReferralYesNoField
              control={form.control}
              name="referralProvidedPromoCode"
              label="Did the staff provide the correct promo code or guide you on how to scan/redeem the offer?"
            />
            <OptionsField
              control={form.control}
              name="referralSubscriptionSmoothness"
              label="How smooth was the subscription process?"
              options={SMOOTHNESS_OPTIONS}
              values={SMOOTHNESS_VALUES}
              cols={4}
            />
            <OptionsField
              control={form.control}
              name="referralStaffKnowledge"
              label="How would you rate the staff's knowledge about Qatar Living Deals?"
              options={KNOWLEDGE_OPTIONS}
              values={KNOWLEDGE_VALUES}
              cols={4}
            />
            <OptionsField
              control={form.control}
              name="referralOverallSatisfaction"
              label="Overall, how satisfied are you with your experience?"
              options={SATISFACTION_OPTIONS}
              values={SATISFACTION_VALUES}
              cols={5}
            />
          </CardContent>
        </Card>

        {/* Additional Feedback */}
        <Card>
          <CardHeader className="bg-primary/5">
            <CardTitle className="text-lg">Additional Feedback (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <FormField
              control={form.control}
              name="referralLikedMost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What did you like most about your experience?</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="Share what went well..."
                      {...field}
                      data-testid="textarea-referral-liked-most"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="referralCouldImprove"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What can be improved?</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="Share what could be better..."
                      {...field}
                      data-testid="textarea-referral-could-improve"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="merchantComments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comments (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="Any additional comments about this merchant..."
                      {...field}
                      data-testid="textarea-referral-merchant-comments"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Attach files (optional, max 6)</p>
              <input
                ref={merchantCommentFileRef}
                type="file"
                accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx"
                multiple
                className="hidden"
                data-testid="input-referral-merchant-comment-files"
                onChange={(e) => {
                  const selected = Array.from(e.target.files || []);
                  setMerchantCommentFiles((prev) => [...prev, ...selected].slice(0, 6));
                  e.target.value = "";
                }}
              />
              {merchantCommentFiles.length < 6 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => merchantCommentFileRef.current?.click()}
                  data-testid="button-referral-attach-comment"
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  Attach file
                </Button>
              )}
              {merchantCommentFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {merchantCommentFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border px-3 py-1.5 text-sm bg-slate-50">
                      <Paperclip className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="flex-1 truncate text-slate-700">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => setMerchantCommentFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-slate-400 hover:text-red-500"
                        data-testid={`button-referral-remove-comment-file-${i}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              form.reset();
              setMerchantCommentFiles([]);
            }}
            disabled={submitting}
            className="w-full sm:w-auto"
            data-testid="button-referral-reset"
          >
            Reset
          </Button>
          <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-auto" data-testid="button-referral-submit">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Feedback
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function FeedbackForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const searchString = useSearch();
  const tabParam = new URLSearchParams(searchString).get("tab");
  const initialTab: "mystery_shopper" | "merchant_referral" =
    tabParam === "referral" || tabParam === "merchant_referral" ? "merchant_referral" : "mystery_shopper";
  const [activeTab, setActiveTab] = useState<"mystery_shopper" | "merchant_referral">(initialTab);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [staffKnowsRedeemFiles, setStaffKnowsRedeemFiles] = useState<File[]>([]);
  const staffKnowsRedeemFileRef = useRef<HTMLInputElement>(null);
  const [processRewardFiles, setProcessRewardFiles] = useState<File[]>([]);
  const processRewardFileRef = useRef<HTMLInputElement>(null);
  const [merchantCommentFiles, setMerchantCommentFiles] = useState<File[]>([]);
  const merchantCommentFileRef = useRef<HTMLInputElement>(null);

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      shopperName: "",
      totalBudgetQar: "",
      merchantName: "",
      merchantId: undefined,
      merchantLocation: "",
      visitDate: "",
      staffKnowsRedeemComment: "",
      processRewardComment: "",
      merchantComments: "",
    },
  });

  const staffKnowsRedeemValue = form.watch("staffKnowsRedeem");
  const rewardApprovedValue = form.watch("rewardApprovedImmediately");

  const onSubmit = async (values: FeedbackFormValues) => {
    setSubmitting(true);
    try {
      let staffKnowsRedeemFileUrls: string[] = [];
      if (values.staffKnowsRedeem === "no" && staffKnowsRedeemFiles.length > 0) {
        const base64Files = await Promise.all(
          staffKnowsRedeemFiles.map(
            (f) =>
              new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(f);
              })
          )
        );
        const uploadRes = await fetch("/api/feedbacks/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: base64Files }),
        });
        if (uploadRes.ok) {
          const { urls } = await uploadRes.json();
          staffKnowsRedeemFileUrls = urls;
        }
      }
      let processRewardFileUrls: string[] = [];
      if (values.rewardApprovedImmediately === "no" && processRewardFiles.length > 0) {
        const base64Files = await Promise.all(
          processRewardFiles.map(
            (f) =>
              new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(f);
              })
          )
        );
        const uploadRes = await fetch("/api/feedbacks/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: base64Files }),
        });
        if (uploadRes.ok) {
          const { urls } = await uploadRes.json();
          processRewardFileUrls = urls;
        }
      }
      let merchantCommentFileUrls: string[] = [];
      if (merchantCommentFiles.length > 0) {
        const base64Files = await Promise.all(
          merchantCommentFiles.map(
            (f) =>
              new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(f);
              })
          )
        );
        const uploadRes = await fetch("/api/feedbacks/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: base64Files }),
        });
        if (uploadRes.ok) {
          const { urls } = await uploadRes.json();
          merchantCommentFileUrls = urls;
        }
      }
      const res = await fetch("/api/feedbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          feedbackType: "mystery_shopper",
          staffKnowsRedeemFiles: staffKnowsRedeemFileUrls.length > 0 ? staffKnowsRedeemFileUrls : undefined,
          processRewardFiles: processRewardFileUrls.length > 0 ? processRewardFileUrls : undefined,
          merchantCommentFiles: merchantCommentFileUrls.length > 0 ? merchantCommentFileUrls : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit feedback");
      }
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast({
        title: "Thank you!",
        description: "Your feedback has been submitted.",
      });
    } catch (err: any) {
      toast({
        title: "Submission failed",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-xl">
          <Card>
            <CardContent className="space-y-4 py-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold" data-testid="text-success-title">
                Feedback Received
              </h1>
              <p className="text-muted-foreground">
                Thank you for taking the time to share your experience. Our team will review your feedback shortly.
              </p>
              <div className="flex justify-center gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    form.reset();
                    setSuccess(false);
                  }}
                  data-testid="button-submit-another"
                >
                  Submit another
                </Button>
                <Button onClick={() => setLocation("/")} data-testid="button-go-home">
                  Go to Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-4 sm:py-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold tracking-tight sm:text-3xl" data-testid="text-page-title">
            Qatar Living Deals — Feedback
          </h1>
          <p className="mt-2 text-muted-foreground">
            Share your experience to help us improve.
          </p>
        </div>

        {/* Type tabs */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setActiveTab("mystery_shopper")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-semibold transition sm:p-4",
              activeTab === "mystery_shopper"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted bg-white hover:border-primary/50",
            )}
            data-testid="tab-mystery-shopper"
          >
            <ShieldCheck className="h-5 w-5" />
            Mystery Shopper
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("merchant_referral")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-semibold transition sm:p-4",
              activeTab === "merchant_referral"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted bg-white hover:border-primary/50",
            )}
            data-testid="tab-merchant-referral"
          >
            <Sparkles className="h-5 w-5" />
            Merchant Referral
          </button>
        </div>

        {activeTab === "merchant_referral" ? (
          <MerchantReferralForm
            onSuccess={() => {
              setSuccess(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
              toast({ title: "Thank you!", description: "Your feedback has been submitted." });
            }}
          />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Shopper Information */}
              <Card>
                <CardHeader className="bg-primary/5">
                  <CardTitle className="text-lg">Shopper Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <FormField
                    control={form.control}
                    name="shopperName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Your full name" {...field} data-testid="input-shopper-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="totalBudgetQar"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Budget Used (QAR) *</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="e.g. 250"
                            {...field}
                            data-testid="input-total-budget"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <p className="rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-900">
                This form is for feedback on the merchant you visited during your mystery shopping
                experience. Please provide short and concise responses.
              </p>

              {/* Merchant Experience Summary */}
              <Card>
                <CardHeader className="bg-primary/5">
                  <CardTitle className="text-lg">Merchant Experience Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <FormField
                    control={form.control}
                    name="merchantName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Merchant Name *</FormLabel>
                        <FormControl>
                          <MerchantPicker
                            value={field.value}
                            onChange={field.onChange}
                            onMerchantId={(id) => form.setValue("merchantId", id)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="merchantLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Branch / area / city"
                            {...field}
                            data-testid="input-merchant-location"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="visitDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-visit-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="visitTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time *</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} data-testid="input-visit-time" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-3 pt-2">
                    <YesNoField
                      control={form.control}
                      name="staffAwareOfQld"
                      label="Are staff members aware of Qatar Living Deals?"
                    />
                    <YesNoField
                      control={form.control}
                      name="staffFamiliarWithOffers"
                      label="Are staff familiar with the offers available at their branch?"
                    />
                    <YesNoField
                      control={form.control}
                      name="staffKnowsRedeem"
                      label="Did the staff know how to process the claimed offer?"
                    />
                    {staffKnowsRedeemValue === "no" && (
                      <div className="ml-1 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs font-medium text-amber-800">Additional info</p>
                        <FormField
                          control={form.control}
                          name="staffKnowsRedeemComment"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Textarea
                                  rows={3}
                                  placeholder="e.g. What did the staff do instead? Did they need to call a manager?"
                                  {...field}
                                  data-testid="textarea-staff-knows-redeem-comment"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div>
                          <p className="mb-2 text-sm font-medium text-slate-700">Attach files (optional, max 6)</p>
                          <input
                            ref={staffKnowsRedeemFileRef}
                            type="file"
                            accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx"
                            multiple
                            className="hidden"
                            data-testid="input-staff-knows-redeem-files"
                            onChange={(e) => {
                              const selected = Array.from(e.target.files || []);
                              setStaffKnowsRedeemFiles((prev) => [...prev, ...selected].slice(0, 6));
                              e.target.value = "";
                            }}
                          />
                          {staffKnowsRedeemFiles.length < 6 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-amber-700 border-amber-300 hover:bg-amber-100"
                              onClick={() => staffKnowsRedeemFileRef.current?.click()}
                              data-testid="button-attach-staff-knows-redeem"
                            >
                              <Paperclip className="h-4 w-4 mr-2" />
                              Attach file
                            </Button>
                          )}
                          {staffKnowsRedeemFiles.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {staffKnowsRedeemFiles.map((f, i) => (
                                <div key={i} className="flex items-center gap-2 rounded bg-white border border-amber-200 px-3 py-1.5 text-sm">
                                  <Paperclip className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                  <span className="flex-1 truncate text-slate-700">{f.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => setStaffKnowsRedeemFiles((prev) => prev.filter((_, idx) => idx !== i))}
                                    className="text-slate-400 hover:text-red-500"
                                    data-testid={`button-remove-redeem-file-${i}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <YesNoField
                      control={form.control}
                      name="rewardApprovedImmediately"
                      label="Is the offer approved immediately by the staff?"
                    />
                    {rewardApprovedValue === "no" && (
                      <div className="ml-1 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs font-medium text-amber-800">Additional info</p>
                        <FormField
                          control={form.control}
                          name="processRewardComment"
                          render={({ field }) => (
                            <FormItem>
                                  <FormControl>
                                <Textarea
                                  rows={3}
                                  placeholder="e.g. How long did it take? Did they escalate to a manager?"
                                  {...field}
                                  data-testid="textarea-process-reward-comment"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div>
                          <p className="mb-2 text-sm font-medium text-slate-700">Attach files (optional, max 6)</p>
                          <input
                            ref={processRewardFileRef}
                            type="file"
                            accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx"
                            multiple
                            className="hidden"
                            data-testid="input-process-reward-files"
                            onChange={(e) => {
                              const selected = Array.from(e.target.files || []);
                              setProcessRewardFiles((prev) => {
                                const combined = [...prev, ...selected];
                                return combined.slice(0, 6);
                              });
                              e.target.value = "";
                            }}
                          />
                          {processRewardFiles.length < 6 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-amber-700 border-amber-300 hover:bg-amber-100"
                              onClick={() => processRewardFileRef.current?.click()}
                              data-testid="button-attach-process-reward"
                            >
                              <Paperclip className="h-4 w-4 mr-2" />
                              Attach file
                            </Button>
                          )}
                          {processRewardFiles.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {processRewardFiles.map((f, i) => (
                                <div key={i} className="flex items-center gap-2 rounded bg-white border border-amber-200 px-3 py-1.5 text-sm">
                                  <Paperclip className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                  <span className="flex-1 truncate text-slate-700">{f.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => setProcessRewardFiles((prev) => prev.filter((_, idx) => idx !== i))}
                                    className="text-slate-400 hover:text-red-500"
                                    data-testid={`button-remove-file-${i}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="merchantComments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Comments (optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={4}
                            placeholder="Any additional comments about this merchant..."
                            {...field}
                            data-testid="textarea-merchant-comments"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-700">Attach files (optional, max 6)</p>
                    <input
                      ref={merchantCommentFileRef}
                      type="file"
                      accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx"
                      multiple
                      className="hidden"
                      data-testid="input-merchant-comment-files"
                      onChange={(e) => {
                        const selected = Array.from(e.target.files || []);
                        setMerchantCommentFiles((prev) => {
                          const combined = [...prev, ...selected];
                          return combined.slice(0, 6);
                        });
                        e.target.value = "";
                      }}
                    />
                    {merchantCommentFiles.length < 6 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => merchantCommentFileRef.current?.click()}
                        data-testid="button-attach-comment"
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        Attach file
                      </Button>
                    )}
                    {merchantCommentFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {merchantCommentFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 rounded border px-3 py-1.5 text-sm bg-slate-50">
                            <Paperclip className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                            <span className="flex-1 truncate text-slate-700">{f.name}</span>
                            <button
                              type="button"
                              onClick={() => setMerchantCommentFiles((prev) => prev.filter((_, idx) => idx !== i))}
                              className="text-slate-400 hover:text-red-500"
                              data-testid={`button-remove-comment-file-${i}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.reset()}
                  disabled={submitting}
                  className="w-full sm:w-auto"
                  data-testid="button-reset"
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting}
                  className="w-full sm:w-auto"
                  data-testid="button-submit-feedback"
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Feedback
                </Button>
              </div>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
