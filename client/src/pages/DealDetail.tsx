import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, CheckCircle, Save, MessageSquare, FileDown } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Deal, AdminUser } from "@shared/schema";

interface AdminUserSafe {
  id: string;
  username: string;
  role: string;
}

const dealSchema = z.object({
  title: z.string().min(1, "Title is required"),
  category: z.string(),
  subCategory: z.string(),
  dealType: z.string(),
  duration: z.string(),
  description: z.string(),
  originalPrice: z.string(),
  branch: z.string(),
});

type DealValues = z.infer<typeof dealSchema>;

export default function DealDetail() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/deals/:id");
  const [deal, setDeal] = useState<Deal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUserSafe[]>([]);
  const [adminComment, setAdminComment] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  const form = useForm<DealValues>({
    resolver: zodResolver(dealSchema),
  });

  useEffect(() => {
    checkAuthAndFetchDeal();
  }, [params?.id]);

  const checkAuthAndFetchDeal = async () => {
    try {
      const authResponse = await fetch("/api/auth/session");
      if (!authResponse.ok) {
        setLocation("/admin/login");
        return;
      }

      if (!params?.id) return;

      const dealResponse = await fetch(`/api/deals/${params.id}`);
      if (!dealResponse.ok) {
        throw new Error("Deal not found");
      }

      const data = await dealResponse.json();
      setDeal(data);
      setAdminComment(data.adminComment || "");
      setAssignedTo(data.assignedTo || "");

      const adminUsersResponse = await fetch("/api/admin-users");
      if (adminUsersResponse.ok) {
        const users = await adminUsersResponse.json();
        setAdminUsers(users);
      }

      form.reset({
        title: data.title,
        category: data.category,
        subCategory: data.subCategory,
        dealType: data.dealType,
        duration: data.duration,
        description: data.description,
        originalPrice: data.originalPrice,
        branch: data.branch,
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
        body: JSON.stringify(data),
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
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve deal");
      }

      const updatedDeal = await response.json();
      setDeal(updatedDeal);

      toast({
        title: "Success",
        description: "Deal approved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve deal",
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
        body: JSON.stringify({ adminComment, assignedTo }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save admin fields");
      }

      const updatedDeal = await response.json();
      setDeal(updatedDeal);

      toast({
        title: "Success",
        description: "Admin notes saved successfully",
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

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
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
              <h1 className="text-2xl font-bold text-[#00426D]">Deal Details</h1>
              <p className="text-slate-500 mt-1 font-mono text-sm">ID: {deal.id}</p>
            </div>
            <Badge
              variant={deal.status === "approved" ? "default" : "secondary"}
              className={
                deal.status === "approved"
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }
            >
              {deal.status === "approved" ? "Sent to Moderation" : deal.status}
            </Badge>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onUpdate)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-title" />
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
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="hotel">Hotel & Resorts</SelectItem>
                          <SelectItem value="dining">Dining</SelectItem>
                          <SelectItem value="wellness">Wellness</SelectItem>
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
                      <FormLabel>Sub-Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-subcategory">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pool">Pool & Beach Access</SelectItem>
                          <SelectItem value="staycation">Staycation</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dealType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deal Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-dealtype">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bogo">Buy 1 Get 1</SelectItem>
                          <SelectItem value="discount">Discount</SelectItem>
                          <SelectItem value="voucher">Voucher</SelectItem>
                          <SelectItem value="bundle">Bundle</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-duration">
                            <SelectValue />
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
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={4} data-testid="textarea-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="originalPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Original Price (QAR)</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-price" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="branch"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-branch" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mt-6">
          <h2 className="text-lg font-bold text-[#00426D] mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Admin Notes
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Assign To
              </label>
              <Select value={assignedTo || "unassigned"} onValueChange={(val) => setAssignedTo(val === "unassigned" ? "" : val)}>
                <SelectTrigger data-testid="select-assigned-to">
                  <SelectValue placeholder="Select admin user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {adminUsers.map((user) => (
                    <SelectItem key={user.id} value={user.username}>
                      {user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Admin Comment
              </label>
              <Textarea
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                placeholder="Add internal notes about this deal..."
                rows={4}
                data-testid="textarea-admin-comment"
              />
            </div>

            <Button
              type="button"
              onClick={saveAdminFields}
              disabled={isSaving}
              className="bg-[#00426D] hover:bg-[#003152]"
              data-testid="button-save-admin-notes"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Admin Notes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
