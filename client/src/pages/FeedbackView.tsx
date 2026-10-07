import { useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  FileDown,
  Loader2,
  Send,
  Trash2,
  User,
  MessageSquare,
  Printer,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

interface FeedbackDetail {
  id: string;
  feedbackType: string;
  status: string;
  shopperName: string | null;
  totalBudgetQar: string | null;
  merchantName: string | null;
  merchantId: string | null;
  merchantLocation: string | null;
  visitDate: string | null;
  visitTime: string | null;
  staffAwareOfQld: string | null;
  staffFamiliarWithOffers: string | null;
  staffKnowsRedeem: string | null;
  staffKnowsRedeemComment: string | null;
  staffKnowsRedeemFiles: string[] | null;
  staffScansQr: string | null;
  processRewardComment: string | null;
  processRewardFiles: string[] | null;
  rewardApprovedImmediately: string | null;
  redemptionSmooth: string | null;
  staffAwareOfOffer: string | null;
  productServiceQuality: string | null;
  merchantComments: string | null;
  merchantCommentFiles: string[] | null;
  browseSelectEase: string | null;
  allOffersRedeemedAsDescribed: string | null;
  offersIssueExplanation: string | null;
  improvementSuggestions: string | null;
  enjoyedMost: string | null;
  // Merchant Referral
  referralIntroducedDeals: string | null;
  referralEncouragedAppDownload: string | null;
  referralExplainedOffer: string | null;
  referralProvidedPromoCode: string | null;
  referralSubscriptionSmoothness: string | null;
  referralStaffKnowledge: string | null;
  referralOverallSatisfaction: string | null;
  referralLikedMost: string | null;
  referralCouldImprove: string | null;
  createdAt: string;
  comments: Comment[];
}

const QUALITY_LABEL: Record<string, string> = {
  poor: "Poor",
  fair: "Fair",
  good: "Good",
  very_good: "Very Good",
  excellent: "Excellent",
};

const SMOOTHNESS_LABEL: Record<string, string> = {
  very_easy: "Very Easy",
  easy: "Easy",
  difficult: "Difficult",
  very_difficult: "Very Difficult",
};

const SATISFACTION_LABEL: Record<string, string> = {
  very_unsatisfied: "Very Unsatisfied",
  unsatisfied: "Unsatisfied",
  neutral: "Neutral",
  satisfied: "Satisfied",
  very_satisfied: "Very Satisfied",
};

const TYPE_LABEL: Record<string, string> = {
  employee_referral: "Employee Referral",
  mystery_shopper: "Mystery Shopper",
  merchant_referral: "Merchant Referral",
};

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b py-3 sm:grid-cols-3">
      <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
      <dd className="text-sm sm:col-span-2">
        {value === null || value === undefined || value === "" ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function YesNoBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant={value === "yes" ? "default" : "destructive"} className="capitalize">
      {value}
    </Badge>
  );
}

export default function FeedbackView() {
  const [, params] = useRoute("/admin/feedbacks/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: session } = useQuery<{ role?: string; username?: string }>({
    queryKey: ["/api/auth/session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
  });

  const isAdmin = session?.role === "admin";

  const { data: feedback, isLoading } = useQuery<FeedbackDetail>({
    queryKey: [`/api/feedbacks/${params?.id}`],
    queryFn: async () => {
      const res = await fetch(`/api/feedbacks/${params?.id}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) setLocation("/admin/login");
        throw new Error("Failed to load feedback");
      }
      return res.json();
    },
    enabled: !!params?.id,
  });

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/feedbacks/${params?.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: comment.trim() }),
      });
      if (!res.ok) throw new Error("Failed to post comment");
      setComment("");
      qc.invalidateQueries({ queryKey: [`/api/feedbacks/${params?.id}`] });
      toast({ title: "Comment added" });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/feedbacks/${params?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      qc.invalidateQueries({ queryKey: [`/api/feedbacks/${params?.id}`] });
      qc.invalidateQueries({ queryKey: ["/api/feedbacks"] });
      toast({ title: "Status updated" });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/feedbacks/${params?.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      qc.invalidateQueries({ queryKey: ["/api/feedbacks"] });
      toast({ title: "Feedback deleted" });
      setLocation("/admin/feedbacks");
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current || !feedback) return;
    setGeneratingPdf(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      const filename = `feedback-${feedback.shopperName || feedback.id}-${format(
        new Date(feedback.createdAt),
        "yyyy-MM-dd",
      )}.pdf`;
      pdf.save(filename);
    } catch (err: any) {
      toast({ title: "PDF generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (isLoading || !feedback) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        {/* Header / actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/feedbacks")} data-testid="button-back">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Feedbacks
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={feedback.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
              <SelectTrigger className="w-[160px]" data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleDownloadPDF} disabled={generatingPdf} data-testid="button-download-pdf">
              {generatingPdf ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              Download PDF
            </Button>
            <Button variant="outline" onClick={() => window.print()} data-testid="button-print">
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" data-testid="button-delete">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this feedback?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the feedback and all its comments. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                      {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <div ref={printRef} className="space-y-6 bg-white p-2">
          <Card>
            <CardHeader className="bg-primary/5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle data-testid="text-feedback-title">
                    {TYPE_LABEL[feedback.feedbackType] || feedback.feedbackType} Feedback
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Submitted {format(new Date(feedback.createdAt), "PPpp")}
                  </p>
                </div>
                <Badge className="capitalize">{feedback.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {feedback.feedbackType === "merchant_referral" ? (
                <dl>
                  <Field label="Your Name" value={feedback.shopperName} />
                </dl>
              ) : (
                <>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-primary">
                    Shopper Information
                  </h3>
                  <dl>
                    <Field label="Name" value={feedback.shopperName} />
                    <Field label="Total Budget Used (QAR)" value={feedback.totalBudgetQar} />
                  </dl>
                </>
              )}
            </CardContent>
          </Card>

          {feedback.feedbackType === "merchant_referral" ? (
            <>
              <Card>
                <CardHeader className="bg-primary/5">
                  <CardTitle className="text-base">Visit Details</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <dl>
                    <Field label="Merchant Name" value={feedback.merchantName} />
                    <Field label="Branch Name" value={feedback.merchantLocation} />
                    <Field label="Date" value={feedback.visitDate} />
                    <Field label="Time" value={feedback.visitTime} />
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="bg-primary/5">
                  <CardTitle className="text-base">Staff Interaction</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <dl>
                    <Field
                      label="Did the staff introduce Qatar Living Deals to you?"
                      value={<YesNoBadge value={feedback.referralIntroducedDeals} />}
                    />
                    <Field
                      label="Did the staff ask or encourage you to download the Qatar Living app?"
                      value={<YesNoBadge value={feedback.referralEncouragedAppDownload} />}
                    />
                    <Field
                      label="Did the staff clearly explain the offer (discount, conditions, how to use it)?"
                      value={<YesNoBadge value={feedback.referralExplainedOffer} />}
                    />
                    <Field
                      label="Did the staff provide the correct promo code or guide you on how to scan/redeem the offer?"
                      value={<YesNoBadge value={feedback.referralProvidedPromoCode} />}
                    />
                    <Field
                      label="How smooth was the subscription process?"
                      value={
                        feedback.referralSubscriptionSmoothness
                          ? SMOOTHNESS_LABEL[feedback.referralSubscriptionSmoothness] ||
                            feedback.referralSubscriptionSmoothness
                          : null
                      }
                    />
                    <Field
                      label="How would you rate the staff's knowledge about Qatar Living Deals?"
                      value={
                        feedback.referralStaffKnowledge
                          ? QUALITY_LABEL[feedback.referralStaffKnowledge] || feedback.referralStaffKnowledge
                          : null
                      }
                    />
                    <Field
                      label="Overall, how satisfied are you with your experience?"
                      value={
                        feedback.referralOverallSatisfaction
                          ? SATISFACTION_LABEL[feedback.referralOverallSatisfaction] ||
                            feedback.referralOverallSatisfaction
                          : null
                      }
                    />
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="bg-primary/5">
                  <CardTitle className="text-base">Additional Feedback</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <dl>
                    <Field label="What did you like most about your experience?" value={feedback.referralLikedMost} />
                    <Field label="What can be improved?" value={feedback.referralCouldImprove} />
                    <Field label="Comments" value={feedback.merchantComments} />
                    {Array.isArray(feedback.merchantCommentFiles) && feedback.merchantCommentFiles.length > 0 && (
                      <div className="py-2">
                        <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Comment Attachments</dt>
                        <dd className="flex flex-wrap gap-2">
                          {feedback.merchantCommentFiles.map((url, i) => {
                            const name = url.split("/").pop()?.split("?")[0] || `File ${i + 1}`;
                            return (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm text-primary underline hover:no-underline"
                                data-testid={`link-referral-comment-file-${i}`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                                {name}
                              </a>
                            );
                          })}
                        </dd>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="bg-primary/5">
                  <CardTitle className="text-base">Merchant Experience Summary</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <dl>
                    <Field label="Merchant Name" value={feedback.merchantName} />
                    <Field label="Location" value={feedback.merchantLocation} />
                    <Field label="Date" value={feedback.visitDate} />
                    <Field label="Time" value={feedback.visitTime} />
                    <Field
                      label="Are staff members aware of Qatar Living Deals?"
                      value={<YesNoBadge value={feedback.staffAwareOfQld} />}
                    />
                    <Field
                      label="Are staff familiar with the offers available at their branch?"
                      value={<YesNoBadge value={feedback.staffFamiliarWithOffers} />}
                    />
                    <Field
                      label="Did the staff know how to process the claimed offer?"
                      value={<YesNoBadge value={feedback.staffKnowsRedeem} />}
                    />
                    {feedback.staffKnowsRedeem === "no" && (
                      <>
                        {feedback.staffKnowsRedeemComment && (
                          <Field label="Additional info" value={feedback.staffKnowsRedeemComment} />
                        )}
                        {Array.isArray(feedback.staffKnowsRedeemFiles) && feedback.staffKnowsRedeemFiles.length > 0 && (
                          <div className="py-2">
                            <dt className="text-sm font-medium text-muted-foreground mb-1">Evidence Files</dt>
                            <dd className="flex flex-wrap gap-2">
                              {feedback.staffKnowsRedeemFiles.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                                  File {i + 1}
                                </a>
                              ))}
                            </dd>
                          </div>
                        )}
                      </>
                    )}
                    <Field
                      label="Is the offer approved immediately by the staff?"
                      value={<YesNoBadge value={feedback.rewardApprovedImmediately} />}
                    />
                    {feedback.rewardApprovedImmediately === "no" && (
                      <>
                        {feedback.processRewardComment && (
                          <Field label="Approval Comment" value={feedback.processRewardComment} />
                        )}
                        {feedback.processRewardFiles && feedback.processRewardFiles.length > 0 && (
                          <div className="py-2">
                            <dt className="text-sm font-medium text-muted-foreground mb-1">Evidence Files</dt>
                            <dd className="flex flex-wrap gap-2">
                              {feedback.processRewardFiles.map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  File {i + 1}
                                </a>
                              ))}
                            </dd>
                          </div>
                        )}
                      </>
                    )}
                    {feedback.productServiceQuality && (
                      <Field
                        label="Product / Service Quality"
                        value={QUALITY_LABEL[feedback.productServiceQuality] || feedback.productServiceQuality}
                      />
                    )}
                    <Field label="Comments" value={feedback.merchantComments} />
                    {Array.isArray(feedback.merchantCommentFiles) && feedback.merchantCommentFiles.length > 0 && (
                      <div className="py-2">
                        <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Comment Attachments</dt>
                        <dd className="flex flex-wrap gap-2">
                          {feedback.merchantCommentFiles.map((url, i) => {
                            const name = url.split("/").pop()?.split("?")[0] || `File ${i + 1}`;
                            return (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm text-primary underline hover:no-underline"
                                data-testid={`link-comment-file-${i}`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                                {name}
                              </a>
                            );
                          })}
                        </dd>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>

              {/* Legacy QL Deals Platform Feedback — shown only if old data exists */}
              {(feedback.browseSelectEase || feedback.allOffersRedeemedAsDescribed || feedback.improvementSuggestions || feedback.enjoyedMost) && (
                <Card>
                  <CardHeader className="bg-primary/5">
                    <CardTitle className="text-base">QL Deals Platform Feedback (legacy)</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <dl>
                      {feedback.browseSelectEase && (
                        <Field
                          label="How easy was it to browse and select offers?"
                          value={QUALITY_LABEL[feedback.browseSelectEase] || feedback.browseSelectEase}
                        />
                      )}
                      {feedback.allOffersRedeemedAsDescribed && (
                        <Field
                          label="Did all offers redeem as described?"
                          value={<YesNoBadge value={feedback.allOffersRedeemedAsDescribed} />}
                        />
                      )}
                      {feedback.offersIssueExplanation && (
                        <Field label="Explanation (if issues)" value={feedback.offersIssueExplanation} />
                      )}
                      {feedback.improvementSuggestions && (
                        <Field label="Suggestions for improving QL Deals" value={feedback.improvementSuggestions} />
                      )}
                      {feedback.enjoyedMost && (
                        <Field label="What did you enjoy most about using QL Deals?" value={feedback.enjoyedMost} />
                      )}
                    </dl>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Comments thread */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Internal Comments ({feedback.comments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {feedback.comments.length === 0 && (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            )}
            {feedback.comments.map((c) => (
              <div key={c.id} className="rounded-md border p-3" data-testid={`comment-${c.id}`}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {c.author}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(c.createdAt), "MMM d, yyyy h:mm a")}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{c.content}</p>
              </div>
            ))}
            <Separator />
            <div className="space-y-2">
              <Textarea
                placeholder="Add an internal comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                data-testid="textarea-new-comment"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleAddComment}
                  disabled={!comment.trim() || posting}
                  data-testid="button-add-comment"
                >
                  {posting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Post Comment
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
