import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  Loader2,
  MessageSquare,
  Paperclip,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { compressFileForUpload } from "@/lib/compressImage";
import { cn } from "@/lib/utils";
import { employeeFeedbackSchema, type EmployeeFeedbackInput } from "@shared/employeeFeedback";
import "./FeedbackForm.css";

type FormValues = EmployeeFeedbackInput;
interface MerchantOption {
  id: string;
  name: string;
  category?: string;
}

function MerchantPicker({
  value,
  onChange,
  onMerchantId,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  onMerchantId: (id?: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data, isLoading, isError } = useQuery<{ merchants: any[] }>({
    queryKey: ["/api/public/merchants", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      params.set("size", "30");
      const response = await fetch(`/api/public/merchants?${params}`);
      if (!response.ok) throw new Error("Could not load merchants.");
      return response.json();
    },
  });
  const options: MerchantOption[] = useMemo(
    () =>
      (data?.merchants || []).map((merchant: any) => ({
        id: String(merchant.id || merchant.agencyId || merchant._id || merchant.agencyName || merchant.name),
        name: merchant.agencyName || merchant.name || "(unnamed)",
        category: merchant.category,
      })),
    [data],
  );
  const chooseCustom = () => {
    const name = search.trim();
    if (!name) return;
    onChange(name);
    onMerchantId(undefined);
    setOpen(false);
  };

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            id="qld-merchant"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid}
            aria-describedby={invalid ? "merchantName-error" : undefined}
            className="qld-merchant-trigger"
          >
            <span className={cn("qld-merchant-value", !value && "qld-placeholder")}>
              {value || "Select or type merchant name..."}
            </span>
            <Search size={15} aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="qld-merchant-popover" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search merchants..."
              value={search}
              onValueChange={setSearch}
              aria-label="Search merchants"
            />
            <CommandList>
              {isError && (
                <div className="qld-command-state" role="alert">
                  Could not load merchants. You can still type a name and choose "Use … anyway".
                </div>
              )}
              {isLoading && (
                <div className="qld-command-state"><Loader2 size={17} className="qld-spin" /> Loading merchants</div>
              )}
              {!isLoading && options.length === 0 && (
                <CommandEmpty>
                  <span>No merchants found.</span>
                  {search.trim() && (
                    <button type="button" className="qld-custom-merchant" onClick={chooseCustom}>
                      Use “{search.trim()}” anyway
                    </button>
                  )}
                </CommandEmpty>
              )}
              {!!options.length && (
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.id}
                      value={option.name}
                      onSelect={() => {
                        onChange(option.name);
                        onMerchantId(option.id);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("qld-option-check", value === option.name && "qld-option-selected")} />
                      <span className="qld-option-copy">
                        <span>{option.name}</span>
                        {option.category && <small>{option.category}</small>}
                      </span>
                    </CommandItem>
                  ))}
                  {search.trim() && !options.some((option) => option.name.toLowerCase() === search.trim().toLowerCase()) && (
                    <CommandItem value={`custom-${search}`} onSelect={chooseCustom}>
                      Use “{search.trim()}” anyway
                    </CommandItem>
                  )}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="qld-hint">Pick from the list, or type a merchant name and select "Use … anyway" if not listed.</p>
    </div>
  );
}

function YesNoQuestion({
  name,
  label,
  control,
  error,
}: {
  name: "staffAwareOfQld" | "staffFamiliarWithOffers" | "staffKnowsRedeem" | "rewardApprovedImmediately";
  label: string;
  control: ReturnType<typeof useForm<FormValues>>["control"];
  error?: string;
}) {
  const errorId = `${name}-error`;
  return (
    <fieldset className={cn("qld-question", error && "qld-invalid-question")} aria-describedby={error ? errorId : undefined}>
      <legend className="qld-question-title">{label}</legend>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <div className="qld-radios" role="radiogroup" aria-label={label}>
            {(["yes", "no"] as const).map((answer) => (
              <Label key={answer} className={cn("qld-radio", field.value === answer && "qld-radio-checked")}>
                <input
                  type="radio"
                  name={field.name}
                  value={answer}
                  checked={field.value === answer}
                  onChange={() => field.onChange(answer)}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  aria-invalid={!!error}
                  aria-describedby={error ? errorId : undefined}
                />
                {answer === "yes" ? "Yes" : "No"}
              </Label>
            ))}
          </div>
        )}
      />
      {error && <p className="qld-field-error" id={errorId} role="alert">{error}</p>}
    </fieldset>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error(`Could not read ${file.name}.`));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

export default function FeedbackForm() {
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileHint, setFileHint] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(employeeFeedbackSchema),
    defaultValues: {
      feedbackType: "employee_referral",
      shopperName: "",
      totalBudgetQar: "",
      merchantName: "",
      merchantId: undefined,
      merchantLocation: "",
      visitDate: "",
      visitTime: "",
      merchantComments: "",
    },
  });
  const errors = form.formState.errors;

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setSubmitError("");
    setSuccess(false);
    try {
      let merchantCommentFiles: string[] = [];
      if (files.length) {
        const dataUrls = await Promise.all(
          files.map(async (file) => readAsDataUrl(await compressFileForUpload(file, "merchant"))),
        );
        const uploadResponse = await fetch("/api/feedbacks/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: dataUrls }),
        });
        const uploadBody = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok || !Array.isArray(uploadBody.urls) || uploadBody.urls.length !== files.length) {
          throw new Error(uploadBody.error || "Your attachments could not be uploaded. Please try again.");
        }
        merchantCommentFiles = uploadBody.urls;
      }

      const response = await fetch("/api/feedbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          merchantCommentFiles: merchantCommentFiles.length ? merchantCommentFiles : undefined,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.success !== true) {
        throw new Error(body.error || "Your feedback could not be submitted. Please try again.");
      }
      setSuccess(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    form.reset();
    setFiles([]);
    setFileHint("");
    setSubmitError("");
    setSuccess(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <main className="qld-feedback">
      <div className="qld-wrap">
        <header className="qld-header">
          <span className="qld-logo" aria-hidden="true"><MessageSquare size={20} strokeWidth={2} /></span>
          <h1>Qatar Living Deals — Employee Referral Feedback</h1>
          <p>Share your experience to help us improve.</p>
        </header>

        <div className="qld-tab">
          <ShieldCheck size={16} aria-hidden="true" />
          Employee Referral Program
        </div>

        <form
          autoComplete="off"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          onChange={() => {
            if (success) setSuccess(false);
            if (submitError) setSubmitError("");
          }}
        >
          <section className="qld-card">
            <h2>Shopper Information</h2>
            <div className="qld-card-body">
              <div className="qld-field">
                <label htmlFor="qld-name">Name <span className="qld-required">*</span></label>
                <Input id="qld-name" type="text" placeholder="Your full name" aria-invalid={!!errors.shopperName} aria-describedby={errors.shopperName ? "shopperName-error" : undefined} {...form.register("shopperName")} />
                {errors.shopperName && <p className="qld-field-error" id="shopperName-error" role="alert">{errors.shopperName.message}</p>}
              </div>
              <div className="qld-field">
                <label htmlFor="qld-budget">Total Budget Used (QAR) <span className="qld-required">*</span></label>
                <Input id="qld-budget" type="number" min="0" step="any" placeholder="e.g. 250" aria-invalid={!!errors.totalBudgetQar} aria-describedby={errors.totalBudgetQar ? "totalBudgetQar-error" : undefined} {...form.register("totalBudgetQar")} />
                {errors.totalBudgetQar && <p className="qld-field-error" id="totalBudgetQar-error" role="alert">{errors.totalBudgetQar.message}</p>}
              </div>
            </div>
          </section>

          <div className="qld-note">This form is for feedback on the merchant you visited during your referral program experience. Please provide short and concise responses.</div>

          <section className="qld-card">
            <h2>Merchant Experience Summary</h2>
            <div className="qld-card-body">
              <div className="qld-field">
                <label htmlFor="qld-merchant">Merchant Name <span className="qld-required">*</span></label>
                <Controller
                  name="merchantName"
                  control={form.control}
                  render={({ field }) => (
                    <MerchantPicker
                      value={field.value}
                      onChange={field.onChange}
                      onMerchantId={(id) => form.setValue("merchantId", id, { shouldDirty: true })}
                      invalid={!!errors.merchantName}
                    />
                  )}
                />
                {errors.merchantName && <p className="qld-field-error" id="merchantName-error" role="alert">{errors.merchantName.message}</p>}
              </div>
              <div className="qld-field">
                <label htmlFor="qld-location">Location <span className="qld-required">*</span></label>
                <Input id="qld-location" type="text" placeholder="Branch / area / city" aria-invalid={!!errors.merchantLocation} aria-describedby={errors.merchantLocation ? "merchantLocation-error" : undefined} {...form.register("merchantLocation")} />
                {errors.merchantLocation && <p className="qld-field-error" id="merchantLocation-error" role="alert">{errors.merchantLocation.message}</p>}
              </div>
              <div className="qld-row">
                <div className="qld-field">
                  <label htmlFor="qld-date">Date <span className="qld-required">*</span></label>
                  <Input id="qld-date" type="date" aria-invalid={!!errors.visitDate} aria-describedby={errors.visitDate ? "visitDate-error" : undefined} {...form.register("visitDate")} />
                  {errors.visitDate && <p className="qld-field-error" id="visitDate-error" role="alert">{errors.visitDate.message}</p>}
                </div>
                <div className="qld-field">
                  <label htmlFor="qld-time">Time <span className="qld-required">*</span></label>
                  <Input id="qld-time" type="time" aria-invalid={!!errors.visitTime} aria-describedby={errors.visitTime ? "visitTime-error" : undefined} {...form.register("visitTime")} />
                  {errors.visitTime && <p className="qld-field-error" id="visitTime-error" role="alert">{errors.visitTime.message}</p>}
                </div>
              </div>

              <YesNoQuestion control={form.control} name="staffAwareOfQld" label="Are staff members aware of Qatar Living Deals?" error={errors.staffAwareOfQld?.message} />
              <YesNoQuestion control={form.control} name="staffFamiliarWithOffers" label="Are staff familiar with the offers available at their branch?" error={errors.staffFamiliarWithOffers?.message} />
              <YesNoQuestion control={form.control} name="staffKnowsRedeem" label="Did the staff know how to process the claimed offer?" error={errors.staffKnowsRedeem?.message} />
              <YesNoQuestion control={form.control} name="rewardApprovedImmediately" label="Is the offer approved immediately by the staff?" error={errors.rewardApprovedImmediately?.message} />

              <div className="qld-field">
                <label htmlFor="qld-comments">Comments (optional)</label>
                <Textarea id="qld-comments" rows={4} placeholder="Any additional comments about this merchant..." {...form.register("merchantComments")} />
              </div>

              <div className="qld-files">
                <span className="qld-field-label">Attach files (optional, max 6)</span>
                <input
                  ref={fileInput}
                  className="qld-file-input"
                  id="qld-files"
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={(event) => {
                    const selected = Array.from(event.target.files || []);
                    const room = Math.max(0, 6 - files.length);
                    const accepted = selected.slice(0, room);
                    setFiles((current) => [...current, ...accepted]);
                    setFileHint(selected.length > room ? "You can attach up to 6 files." : "");
                    event.target.value = "";
                  }}
                  aria-describedby="qld-file-hint"
                />
                {files.length < 6 && (
                  <button type="button" className="qld-attach" onClick={() => fileInput.current?.click()} disabled={submitting}>
                    <Paperclip size={14} aria-hidden="true" />
                    Attach file
                  </button>
                )}
                {files.length > 0 && (
                  <ul className="qld-file-list">
                    {files.map((file, index) => (
                      <li key={`${file.name}-${file.lastModified}-${index}`}>
                        <span className="qld-file-name">{file.name}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${file.name}`}
                          onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                          disabled={submitting}
                        >Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
                <div id="qld-file-hint" className={cn("qld-hint", fileHint && "qld-field-error")} role={fileHint ? "alert" : undefined}>{fileHint}</div>
              </div>
            </div>
          </section>

          <div className="qld-actions">
            <button className="qld-reset" type="button" onClick={resetForm} disabled={submitting}>Reset</button>
            <button className="qld-submit" type="submit" disabled={submitting}>
              {submitting && <Loader2 size={15} className="qld-spin" aria-hidden="true" />}
              {submitting ? "Submitting…" : "Submit Feedback"}
            </button>
          </div>
          {submitError && <div className="qld-submit-error" role="alert">{submitError}</div>}
          {success && <div className="qld-done" role="status">Thank you — your feedback has been submitted.</div>}
        </form>
      </div>
    </main>
  );
}
