import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Plus, Trash2, Loader2, AlertCircle, Settings as SettingsIcon, Send, CheckCircle2, XCircle, Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";

interface EmailRecipient {
  id: string;
  email: string;
  recipientType: string;
  isActive: boolean;
  createdAt: string;
}

interface EmailConfig {
  id: string;
  provider: string;
  apiKey: string | null;
  fromEmail: string | null;
  fromName: string | null;
  isEnabled: boolean;
  updatedAt: string;
}

export default function Settings() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  const [salesRecipients, setSalesRecipients] = useState<EmailRecipient[]>([]);
  const [moderationRecipients, setModerationRecipients] = useState<EmailRecipient[]>([]);
  const [newSalesEmail, setNewSalesEmail] = useState("");
  const [newModerationEmail, setNewModerationEmail] = useState("");
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recipientToDelete, setRecipientToDelete] = useState<{ id: string; type: string } | null>(null);

  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null);
  const [configForm, setConfigForm] = useState({
    provider: "mandrill",
    apiKey: "",
    fromEmail: "",
    fromName: "Qatar Living Deals",
    isEnabled: false,
  });
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  const checkAuthAndFetchData = async () => {
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

      const [salesResponse, moderationResponse, configResponse] = await Promise.all([
        fetch("/api/settings/email-recipients?type=sales", { credentials: "include" }),
        fetch("/api/settings/email-recipients?type=moderation", { credentials: "include" }),
        fetch("/api/settings/email-config", { credentials: "include" }),
      ]);

      if (salesResponse.ok) {
        const data = await salesResponse.json();
        setSalesRecipients(data);
      }

      if (moderationResponse.ok) {
        const data = await moderationResponse.json();
        setModerationRecipients(data);
      }

      if (configResponse.ok) {
        const config = await configResponse.json();
        if (config) {
          setEmailConfig(config);
          setConfigForm({
            provider: config.provider || "mandrill",
            apiKey: config.apiKey || "",
            fromEmail: config.fromEmail || "",
            fromName: config.fromName || "Qatar Living Deals",
            isEnabled: config.isEnabled || false,
          });
        }
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

  const handleSaveConfig = async () => {
    if (!configForm.fromEmail) {
      toast({
        title: "Error",
        description: "Please enter a 'From' email address",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/settings/email-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(configForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save settings");
      }

      const savedConfig = await response.json();
      setEmailConfig(savedConfig);
      setConfigForm(prev => ({
        ...prev,
        apiKey: savedConfig.apiKey || "",
      }));

      toast({
        title: "Success",
        description: "Email settings saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast({
        title: "Error",
        description: "Please enter an email address to send the test to",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/settings/email-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ testEmail }),
      });

      const result = await response.json();

      if (result.success) {
        setTestResult({ success: true, message: "Test email sent successfully! Check your inbox." });
        toast({
          title: "Success",
          description: "Test email sent successfully",
        });
      } else {
        setTestResult({ success: false, message: result.error || "Failed to send test email" });
        toast({
          title: "Failed",
          description: result.error || "Failed to send test email",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send test email";
      setTestResult({ success: false, message: errorMessage });
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddRecipient = async (recipientType: "sales" | "moderation") => {
    const email = recipientType === "sales" ? newSalesEmail : newModerationEmail;
    
    if (!email.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
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
        body: JSON.stringify({ email: email.trim(), recipientType }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add recipient");
      }

      const recipient = await response.json();
      
      if (recipientType === "sales") {
        setSalesRecipients([...salesRecipients, recipient]);
        setNewSalesEmail("");
      } else {
        setModerationRecipients([...moderationRecipients, recipient]);
        setNewModerationEmail("");
      }
      
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

  const handleToggleActive = async (id: string, currentActive: boolean, recipientType: string) => {
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
      
      if (recipientType === "sales") {
        setSalesRecipients(salesRecipients.map(r => r.id === id ? updated : r));
      } else {
        setModerationRecipients(moderationRecipients.map(r => r.id === id ? updated : r));
      }
      
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

  const handleDeleteClick = (id: string, type: string) => {
    setRecipientToDelete({ id, type });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recipientToDelete) return;

    try {
      const response = await fetch(`/api/settings/email-recipients/${recipientToDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete recipient");
      }

      if (recipientToDelete.type === "sales") {
        setSalesRecipients(salesRecipients.filter(r => r.id !== recipientToDelete.id));
      } else {
        setModerationRecipients(moderationRecipients.filter(r => r.id !== recipientToDelete.id));
      }
      
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

  const renderRecipientTable = (recipients: EmailRecipient[], recipientType: "sales" | "moderation") => {
    if (recipients.length === 0) {
      return (
        <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          <AlertCircle className="h-10 w-10 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No recipients configured</p>
          <p className="text-slate-500 text-sm mt-1">
            {recipientType === "sales" 
              ? "Add email addresses to receive notifications when new deals are submitted."
              : "Add email addresses to receive notifications when deals are forwarded to moderation."}
          </p>
        </div>
      );
    }

    return (
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
              <TableRow key={recipient.id} data-testid={`row-${recipientType}-${recipient.id}`}>
                <TableCell className="font-medium" data-testid={`text-email-${recipient.id}`}>
                  {recipient.email}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Switch
                      checked={recipient.isActive}
                      onCheckedChange={() => handleToggleActive(recipient.id, recipient.isActive, recipientType)}
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
                    onClick={() => handleDeleteClick(recipient.id, recipientType)}
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
    );
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
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#00426D]" data-testid="text-page-title">Settings</h1>
          <p className="text-slate-600 mt-1">Configure email notifications and system settings</p>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#00426D]">
              <SettingsIcon className="h-5 w-5" />
              Email Provider Configuration
            </CardTitle>
            <CardDescription>
              Configure Mailchimp Transactional (Mandrill) to send email notifications.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                <div>
                  <Label className="text-base font-medium">Enable Email Notifications</Label>
                  <p className="text-sm text-slate-500 mt-1">Turn on to send emails for new deals and moderation</p>
                </div>
                <Switch
                  checked={configForm.isEnabled}
                  onCheckedChange={(checked) => setConfigForm(prev => ({ ...prev, isEnabled: checked }))}
                  data-testid="switch-email-enabled"
                />
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Mailchimp Transactional (Mandrill)</strong> - Enter your Mandrill API key below. 
                  You can find this in your Mailchimp Transactional account under Settings → SMTP & API Info.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">Mandrill API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="Enter your Mandrill API key"
                    value={configForm.apiKey}
                    onChange={(e) => setConfigForm(prev => ({ ...prev, apiKey: e.target.value }))}
                    data-testid="input-api-key"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fromEmail">From Email Address *</Label>
                  <Input
                    id="fromEmail"
                    type="email"
                    placeholder="noreply@yourdomain.com"
                    value={configForm.fromEmail}
                    onChange={(e) => setConfigForm(prev => ({ ...prev, fromEmail: e.target.value }))}
                    data-testid="input-from-email"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="fromName">From Name</Label>
                  <Input
                    id="fromName"
                    placeholder="Qatar Living Deals"
                    value={configForm.fromName}
                    onChange={(e) => setConfigForm(prev => ({ ...prev, fromName: e.target.value }))}
                    data-testid="input-from-name"
                  />
                </div>
              </div>

              <Button
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="bg-[#00426D] hover:bg-[#003152] w-full md:w-auto"
                data-testid="button-save-config"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Email Settings"
                )}
              </Button>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-medium text-[#00426D]">Send Test Email</h3>
              <p className="text-sm text-slate-500">
                Verify your email configuration is working by sending a test email.
              </p>
              
              <div className="flex gap-3">
                <Input
                  type="email"
                  placeholder="Enter email to receive test"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="flex-1"
                  data-testid="input-test-email"
                />
                <Button
                  onClick={handleTestEmail}
                  disabled={isTesting || !testEmail}
                  variant="outline"
                  className="border-[#00426D] text-[#00426D] hover:bg-[#00426D]/5"
                  data-testid="button-send-test"
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Test
                    </>
                  )}
                </Button>
              </div>

              {testResult && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${testResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  {testResult.success ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <XCircle className="h-5 w-5" />
                  )}
                  <span className="text-sm">{testResult.message}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="sales" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="sales" className="flex items-center gap-2" data-testid="tab-sales">
              <Users className="h-4 w-4" />
              Sales Team
            </TabsTrigger>
            <TabsTrigger value="moderation" className="flex items-center gap-2" data-testid="tab-moderation">
              <Shield className="h-4 w-4" />
              Moderation Team
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="sales">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#00426D]">
                  <Users className="h-5 w-5" />
                  Sales Team Notifications
                </CardTitle>
                <CardDescription>
                  These recipients will be notified when merchants submit new deal requests via the public form.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Input
                      type="email"
                      placeholder="Enter email address"
                      value={newSalesEmail}
                      onChange={(e) => setNewSalesEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddRecipient("sales");
                        }
                      }}
                      className="h-11"
                      data-testid="input-email-sales"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleAddRecipient("sales")}
                    disabled={isSaving || !newSalesEmail.trim()}
                    className="bg-[#00426D] hover:bg-[#003152] h-11"
                    data-testid="button-add-sales"
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
                </div>

                {renderRecipientTable(salesRecipients, "sales")}
              </CardContent>
            </Card>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <h4 className="font-medium text-blue-900 mb-2">When are sales emails sent?</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• When a merchant submits a new deal request through the public form</li>
                <li>• Email includes deal details and a link to the admin dashboard</li>
              </ul>
            </div>
          </TabsContent>
          
          <TabsContent value="moderation">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#00426D]">
                  <Shield className="h-5 w-5" />
                  Moderation Team Notifications
                </CardTitle>
                <CardDescription>
                  These recipients will be notified when a deal is forwarded to moderation for review.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Input
                      type="email"
                      placeholder="Enter email address"
                      value={newModerationEmail}
                      onChange={(e) => setNewModerationEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddRecipient("moderation");
                        }
                      }}
                      className="h-11"
                      data-testid="input-email-moderation"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleAddRecipient("moderation")}
                    disabled={isSaving || !newModerationEmail.trim()}
                    className="bg-[#00426D] hover:bg-[#003152] h-11"
                    data-testid="button-add-moderation"
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
                </div>

                {renderRecipientTable(moderationRecipients, "moderation")}
              </CardContent>
            </Card>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
              <h4 className="font-medium text-green-900 mb-2">When are moderation emails sent?</h4>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• When a sales team member clicks "Forward To Moderation" on a deal</li>
                <li>• Email includes deal details, who forwarded it, and a link to review the deal</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Email Recipient?</AlertDialogTitle>
            <AlertDialogDescription>
              This email address will no longer receive notifications.
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
