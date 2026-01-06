import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Mail, Plus, Trash2, Loader2, AlertCircle, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";

interface EmailRecipient {
  id: string;
  email: string;
  isActive: boolean;
  createdAt: string;
}

export default function Settings() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recipientToDelete, setRecipientToDelete] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndFetchRecipients();
  }, []);

  const checkAuthAndFetchRecipients = async () => {
    try {
      const authResponse = await fetch("/api/auth/session", { credentials: "include" });
      if (!authResponse.ok) {
        setLocation("/admin/login");
        return;
      }

      const session = await authResponse.json();
      if (session.role !== "admin") {
        toast({
          title: "Access Denied",
          description: "Admin access required for settings",
          variant: "destructive",
        });
        setLocation("/admin/dashboard");
        return;
      }

      const recipientsResponse = await fetch("/api/settings/email-recipients", { credentials: "include" });
      if (recipientsResponse.ok) {
        const data = await recipientsResponse.json();
        setRecipients(data);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/settings/email-recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: newEmail.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add recipient");
      }

      const recipient = await response.json();
      setRecipients([...recipients, recipient]);
      setNewEmail("");
      
      toast({
        title: "Success",
        description: "Email recipient added successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add recipient",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const response = await fetch(`/api/settings/email-recipients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !currentActive }),
      });

      if (!response.ok) {
        throw new Error("Failed to update recipient");
      }

      const updated = await response.json();
      setRecipients(recipients.map(r => r.id === id ? updated : r));
      
      toast({
        title: "Success",
        description: `Email notifications ${!currentActive ? "enabled" : "disabled"} for this recipient`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update recipient",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (id: string) => {
    setRecipientToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recipientToDelete) return;

    try {
      const response = await fetch(`/api/settings/email-recipients/${recipientToDelete}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete recipient");
      }

      setRecipients(recipients.filter(r => r.id !== recipientToDelete));
      toast({
        title: "Success",
        description: "Email recipient removed",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete recipient",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setRecipientToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-[#00426D]" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#00426D]" data-testid="text-page-title">Settings</h1>
          <p className="text-slate-600 mt-1">Configure email notifications and system settings</p>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#00426D]">
              <Mail className="h-5 w-5" />
              Email Notifications
            </CardTitle>
            <CardDescription>
              Manage the list of email addresses that will receive notifications when a new deal request is submitted through the public form.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleAddRecipient} className="flex gap-3">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="h-11"
                  data-testid="input-email-recipient"
                />
              </div>
              <Button
                type="submit"
                disabled={isSaving || !newEmail.trim()}
                className="bg-[#00426D] hover:bg-[#003152] h-11"
                data-testid="button-add-recipient"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </>
                )}
              </Button>
            </form>

            {recipients.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                <AlertCircle className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">No email recipients configured</p>
                <p className="text-slate-500 text-sm mt-1">
                  Add email addresses above to receive notifications when new deal requests are submitted.
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Email Address</TableHead>
                      <TableHead className="w-[120px] text-center">Status</TableHead>
                      <TableHead className="w-[150px] text-center">Added</TableHead>
                      <TableHead className="w-[100px] text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.map((recipient) => (
                      <TableRow key={recipient.id} data-testid={`row-recipient-${recipient.id}`}>
                        <TableCell className="font-medium" data-testid={`text-email-${recipient.id}`}>
                          {recipient.email}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={recipient.isActive}
                              onCheckedChange={() => handleToggleActive(recipient.id, recipient.isActive)}
                              data-testid={`switch-active-${recipient.id}`}
                            />
                            <Badge variant={recipient.isActive ? "default" : "secondary"}>
                              {recipient.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-slate-500 text-sm">
                          {format(new Date(recipient.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(recipient.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            data-testid={`button-delete-${recipient.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <h4 className="font-medium text-blue-900 mb-2">How it works</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• When a merchant submits a new deal request via the public form, all active email recipients will receive a notification.</li>
                <li>• The email will include basic information about the submitted deal and a link to the admin dashboard.</li>
                <li>• Toggle the status to enable or disable notifications for specific email addresses without removing them.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Email Recipient?</AlertDialogTitle>
            <AlertDialogDescription>
              This email address will no longer receive notifications when new deal requests are submitted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
