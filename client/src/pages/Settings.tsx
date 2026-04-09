import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Trash2, Loader2, AlertCircle, Settings as SettingsIcon, Send, CheckCircle2, XCircle, Users, Shield, Cloud, FolderCog, FileText, Pencil, Check, X, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface Term {
  id: number;
  type: string;
  text: string;
  createdAt: string;
}

interface AdminUser {
  id: string;
  username: string;
  role: string;
}

function UsersTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin-users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; role: string }) => {
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin-users"] });
      setIsAddDialogOpen(false);
      setNewUsername("");
      setNewPassword("");
      setNewRole("user");
      toast({ title: "User created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { password?: string; role?: string } }) => {
      const res = await fetch(`/api/admin-users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin-users"] });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      setEditPassword("");
      setEditRole("");
      toast({ title: "User updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin-users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin-users"] });
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      toast({ title: "User deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateUser = () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      toast({ title: "Error", description: "Username and password are required", variant: "destructive" });
      return;
    }
    createUserMutation.mutate({ username: newUsername, password: newPassword, role: newRole });
  };

  const handleUpdateUser = () => {
    if (!selectedUser) return;
    const data: { password?: string; role?: string } = {};
    if (editPassword.trim()) data.password = editPassword;
    if (editRole && editRole !== selectedUser.role) data.role = editRole;
    if (Object.keys(data).length === 0) {
      toast({ title: "No changes", description: "Please make some changes to update", variant: "destructive" });
      return;
    }
    updateUserMutation.mutate({ id: selectedUser.id, data });
  };

  const handleDeleteUser = () => {
    if (!selectedUser) return;
    deleteUserMutation.mutate(selectedUser.id);
  };

  const openEditDialog = (user: AdminUser) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setEditPassword("");
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (user: AdminUser) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-[#00426D]">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription className="mt-1">Manage admin portal users and their roles</CardDescription>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-user">
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">Loading users...</div>
          ) : (
            <div className="space-y-3">
              {users.map((user: AdminUser) => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border" data-testid={`card-user-${user.id}`}>
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-[#00426D] flex items-center justify-center text-white">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800" data-testid={`text-username-${user.id}`}>{user.username}</p>
                      <Badge
                        variant={user.role === "admin" ? "default" : "secondary"}
                        className={user.role === "admin" ? "bg-[#00426D]" : ""}
                        data-testid={`badge-role-${user.id}`}
                      >
                        {user.role === "admin" ? "Admin" : "User"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(user)} data-testid={`button-edit-${user.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {user.username !== "admin" && (
                      <Button variant="outline" size="sm" onClick={() => openDeleteDialog(user)} className="text-red-600 hover:text-red-700" data-testid={`button-delete-${user.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account for the admin portal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-username">Username</Label>
              <Input id="new-username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="Enter username" data-testid="input-new-username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Password</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter password" data-testid="input-new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-role">Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger data-testid="select-new-role"><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={createUserMutation.isPending} data-testid="button-create-user">
              {createUserMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User: {selectedUser?.username}</DialogTitle>
            <DialogDescription>Update user password or role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
              <Input id="edit-password" type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Enter new password" data-testid="input-edit-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger data-testid="select-edit-role"><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateUser} disabled={updateUserMutation.isPending} data-testid="button-save-user">
              {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the user "{selectedUser?.username}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-red-600 hover:bg-red-700" data-testid="button-confirm-delete-user">
              {deleteUserMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const initialTab = searchParams.get("tab") || "email";
  const [activeTab, setActiveTab] = useState(initialTab);
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
  
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ success: boolean; message: string } | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSubCategoryName, setNewSubCategoryName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingSubCategoryId, setEditingSubCategoryId] = useState<string | null>(null);
  const [editingSubCategoryName, setEditingSubCategoryName] = useState("");

  const [claimRules, setClaimRules] = useState<Term[]>([]);
  const [generalRules, setGeneralRules] = useState<Term[]>([]);
  const [newClaimRule, setNewClaimRule] = useState("");
  const [newGeneralRule, setNewGeneralRule] = useState("");
  const [editingTermId, setEditingTermId] = useState<number | null>(null);
  const [editingTermText, setEditingTermText] = useState("");

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

      await Promise.all([fetchCategories(), fetchTerms()]);
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

  const handleMigrateImages = async () => {
    setIsMigrating(true);
    setMigrationResult(null);
    
    try {
      const response = await fetch("/api/admin/migrate-images", {
        method: "POST",
        credentials: "include",
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Migration failed");
      }
      
      setMigrationResult({ success: true, message: result.message });
      toast({
        title: "Migration Complete",
        description: result.message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Migration failed";
      setMigrationResult({ success: false, message });
      toast({
        title: "Migration Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const fetchCategories = async () => {
    const response = await fetch("/api/categories");
    if (!response.ok) throw new Error("Failed to fetch categories");
    const data = await response.json();
    setCategories(data);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({ title: "Error", description: "Category name is required", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      if (!response.ok) throw new Error("Failed to create category");
      setNewCategoryName("");
      await fetchCategories();
      toast({ title: "Success", description: "Category created successfully" });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to create category", variant: "destructive" });
    }
  };

  const handleRenameCategory = async (categoryId: string, oldName: string) => {
    if (!editingCategoryName.trim()) {
      toast({ title: "Error", description: "Category name is required", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingCategoryName.trim(), oldName }),
      });
      if (!response.ok) throw new Error("Failed to rename category");
      setEditingCategoryId(null);
      setEditingCategoryName("");
      await fetchCategories();
      toast({ title: "Success", description: "Category renamed successfully. All existing deals have been updated." });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to rename category", variant: "destructive" });
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const response = await fetch(`/api/categories/${categoryId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete category");
      await fetchCategories();
      toast({ title: "Success", description: "Category deleted successfully" });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to delete category", variant: "destructive" });
    }
  };

  const handleAddSubCategory = async () => {
    if (!newSubCategoryName.trim()) {
      toast({ title: "Error", description: "Subcategory name is required", variant: "destructive" });
      return;
    }
    if (!selectedCategoryId) {
      toast({ title: "Error", description: "Please select a category", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch("/api/subcategories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: selectedCategoryId, name: newSubCategoryName.trim() }),
      });
      if (!response.ok) throw new Error("Failed to create subcategory");
      setNewSubCategoryName("");
      setSelectedCategoryId("");
      await fetchCategories();
      toast({ title: "Success", description: "Subcategory created successfully" });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to create subcategory", variant: "destructive" });
    }
  };

  const handleRenameSubCategory = async (subCategoryId: string) => {
    if (!editingSubCategoryName.trim()) {
      toast({ title: "Error", description: "Subcategory name is required", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch(`/api/subcategories/${subCategoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingSubCategoryName.trim() }),
      });
      if (!response.ok) throw new Error("Failed to rename subcategory");
      setEditingSubCategoryId(null);
      setEditingSubCategoryName("");
      await fetchCategories();
      toast({ title: "Success", description: "Subcategory renamed successfully" });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to rename subcategory", variant: "destructive" });
    }
  };

  const handleDeleteSubCategory = async (subCategoryId: string) => {
    try {
      const response = await fetch(`/api/subcategories/${subCategoryId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete subcategory");
      await fetchCategories();
      toast({ title: "Success", description: "Subcategory deleted successfully" });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to delete subcategory", variant: "destructive" });
    }
  };

  const fetchTerms = async () => {
    const [claimRes, generalRes] = await Promise.all([
      fetch("/api/terms/claim"),
      fetch("/api/terms/general"),
    ]);
    if (!claimRes.ok || !generalRes.ok) throw new Error("Failed to fetch terms");
    const claimData = await claimRes.json();
    const generalData = await generalRes.json();
    setClaimRules(claimData);
    setGeneralRules(generalData);
  };

  const handleAddClaimRule = async () => {
    if (!newClaimRule.trim()) {
      toast({ title: "Error", description: "Claim rule text is required", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch("/api/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "claim", text: newClaimRule.trim() }),
      });
      if (!response.ok) throw new Error("Failed to create claim rule");
      setNewClaimRule("");
      await fetchTerms();
      toast({ title: "Success", description: "Claim rule created successfully" });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to create claim rule", variant: "destructive" });
    }
  };

  const handleAddGeneralRule = async () => {
    if (!newGeneralRule.trim()) {
      toast({ title: "Error", description: "General rule text is required", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch("/api/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "general", text: newGeneralRule.trim() }),
      });
      if (!response.ok) throw new Error("Failed to create general rule");
      setNewGeneralRule("");
      await fetchTerms();
      toast({ title: "Success", description: "General rule created successfully" });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to create general rule", variant: "destructive" });
    }
  };

  const handleUpdateTerm = async (termId: number) => {
    if (!editingTermText.trim()) {
      toast({ title: "Error", description: "Term text is required", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch(`/api/terms/${termId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editingTermText.trim() }),
      });
      if (!response.ok) throw new Error("Failed to update term");
      setEditingTermId(null);
      setEditingTermText("");
      await fetchTerms();
      toast({ title: "Success", description: "Term updated successfully" });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to update term", variant: "destructive" });
    }
  };

  const handleDeleteTerm = async (termId: number) => {
    try {
      const response = await fetch(`/api/terms/${termId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete term");
      await fetchTerms();
      toast({ title: "Success", description: "Term deleted successfully" });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to delete term", variant: "destructive" });
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

  const renderTermsList = (terms: Term[], type: string) => (
    <div className="space-y-2">
      {terms.length === 0 ? (
        <p className="text-slate-500 text-center py-4">No {type} rules found. Add your first rule above.</p>
      ) : (
        terms.map((term) => (
          <div key={term.id} className="flex items-start justify-between py-3 px-4 bg-slate-50 rounded-lg" data-testid={`term-${term.id}`}>
            {editingTermId === term.id ? (
              <div className="flex items-start gap-2 flex-1">
                <Textarea
                  value={editingTermText}
                  onChange={(e) => setEditingTermText(e.target.value)}
                  className="flex-1 min-h-[60px]"
                  autoFocus
                />
                <Button size="icon" variant="ghost" onClick={() => handleUpdateTerm(term.id)} className="text-green-600 hover:text-green-700">
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => { setEditingTermId(null); setEditingTermText(""); }} className="text-slate-500">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <span className="text-slate-700 flex-1">{term.text}</span>
                <div className="flex items-center gap-1 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-[#00426D]"
                    onClick={() => { setEditingTermId(term.id); setEditingTermText(term.text); }}
                    data-testid={`button-edit-term-${term.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" data-testid={`button-delete-term-${term.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Term</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this {type} rule? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteTerm(term.id)} className="bg-red-500 hover:bg-red-600">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );

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
          <p className="text-slate-600 mt-1">Manage email, categories, terms, and system settings</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="email" className="flex items-center gap-2" data-testid="tab-email">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2" data-testid="tab-categories">
              <FolderCog className="h-4 w-4" />
              <span className="hidden sm:inline">Categories</span>
            </TabsTrigger>
            <TabsTrigger value="terms" className="flex items-center gap-2" data-testid="tab-terms">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Terms</span>
            </TabsTrigger>
            <TabsTrigger value="storage" className="flex items-center gap-2" data-testid="tab-storage">
              <Cloud className="h-4 w-4" />
              <span className="hidden sm:inline">Storage</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2" data-testid="tab-users">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-6">
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
          </TabsContent>

          <TabsContent value="categories" className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-[#00426D] mb-4">Add New Category</h2>
              <div className="flex gap-3">
                <Input
                  placeholder="Enter category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  data-testid="input-category-name"
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                />
                <Button onClick={handleAddCategory} data-testid="button-add-category" className="bg-[#00426D] hover:bg-[#003557]">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-[#00426D] mb-4">Add New Subcategory</h2>
              <div className="flex gap-3">
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                  <SelectTrigger className="w-[200px]" data-testid="select-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Enter subcategory name"
                  value={newSubCategoryName}
                  onChange={(e) => setNewSubCategoryName(e.target.value)}
                  data-testid="input-subcategory-name"
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleAddSubCategory()}
                />
                <Button onClick={handleAddSubCategory} data-testid="button-add-subcategory" className="bg-[#00426D] hover:bg-[#003557]">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Subcategory
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-[#00426D] mb-4">Categories & Subcategories</h2>
              {categories.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No categories found. Add your first category above.</p>
              ) : (
                <div className="space-y-4">
                  {categories.map((category) => (
                    <div key={category.id} className="border border-slate-200 rounded-lg p-4" data-testid={`category-${category.id}`}>
                      <div className="flex items-center justify-between mb-3">
                        {editingCategoryId === category.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              value={editingCategoryName}
                              onChange={(e) => setEditingCategoryName(e.target.value)}
                              className="max-w-xs"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameCategory(category.id, category.name);
                                if (e.key === "Escape") { setEditingCategoryId(null); setEditingCategoryName(""); }
                              }}
                            />
                            <Button size="icon" variant="ghost" onClick={() => handleRenameCategory(category.id, category.name)} className="text-green-600 hover:text-green-700">
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => { setEditingCategoryId(null); setEditingCategoryName(""); }} className="text-slate-500">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <h3 className="font-semibold text-[#00426D]">{category.name}</h3>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setEditingCategoryId(category.id); setEditingCategoryName(category.name); }}
                                className="text-slate-500 hover:text-[#00426D]"
                                data-testid={`button-edit-category-${category.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" data-testid={`button-delete-category-${category.id}`}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Category</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{category.name}"? This will also delete all subcategories within it. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteCategory(category.id)} className="bg-red-500 hover:bg-red-600">Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </>
                        )}
                      </div>
                      {category.subCategories.length === 0 ? (
                        <p className="text-sm text-slate-400 pl-4">No subcategories</p>
                      ) : (
                        <div className="pl-4 space-y-2">
                          {category.subCategories.map((sub) => (
                            <div key={sub.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded" data-testid={`subcategory-${sub.id}`}>
                              {editingSubCategoryId === sub.id ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <Input
                                    value={editingSubCategoryName}
                                    onChange={(e) => setEditingSubCategoryName(e.target.value)}
                                    className="max-w-xs"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleRenameSubCategory(sub.id);
                                      if (e.key === "Escape") { setEditingSubCategoryId(null); setEditingSubCategoryName(""); }
                                    }}
                                  />
                                  <Button size="icon" variant="ghost" onClick={() => handleRenameSubCategory(sub.id)} className="text-green-600 hover:text-green-700">
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => { setEditingSubCategoryId(null); setEditingSubCategoryName(""); }} className="text-slate-500">
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <span className="text-slate-700">{sub.name}</span>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-500 hover:text-[#00426D]"
                                      onClick={() => { setEditingSubCategoryId(sub.id); setEditingSubCategoryName(sub.name); }}
                                      data-testid={`button-edit-subcategory-${sub.id}`}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => handleDeleteSubCategory(sub.id)}
                                      data-testid={`button-delete-subcategory-${sub.id}`}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="terms" className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-[#00426D] mb-4">Claim Rules</h2>
              <p className="text-sm text-slate-500 mb-4">Rules that merchants can select for how customers claim offers</p>
              <div className="flex gap-3 mb-4">
                <Input
                  placeholder="Enter claim rule text"
                  value={newClaimRule}
                  onChange={(e) => setNewClaimRule(e.target.value)}
                  data-testid="input-claim-rule"
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleAddClaimRule()}
                />
                <Button onClick={handleAddClaimRule} data-testid="button-add-claim-rule" className="bg-[#00426D] hover:bg-[#003557]">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </div>
              {renderTermsList(claimRules, "claim")}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-[#00426D] mb-4">General Rules</h2>
              <p className="text-sm text-slate-500 mb-4">Standard terms and conditions that apply to all deals</p>
              <div className="flex gap-3 mb-4">
                <Input
                  placeholder="Enter general rule text"
                  value={newGeneralRule}
                  onChange={(e) => setNewGeneralRule(e.target.value)}
                  data-testid="input-general-rule"
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleAddGeneralRule()}
                />
                <Button onClick={handleAddGeneralRule} data-testid="button-add-general-rule" className="bg-[#00426D] hover:bg-[#003557]">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </div>
              {renderTermsList(generalRules, "general")}
            </div>
          </TabsContent>

          <TabsContent value="storage">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5" />
                  Storage Migration
                </CardTitle>
                <CardDescription>
                  Migrate existing deal images from database to Azure Cloud Storage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      This will move any images stored in the database to Azure Blob Storage. 
                      New deals already save images to Azure automatically. 
                      Running this migration is safe and can be done multiple times.
                    </p>
                  </div>
                  
                  <Button
                    onClick={handleMigrateImages}
                    disabled={isMigrating}
                    className="bg-[#00426D] hover:bg-[#003152]"
                    data-testid="button-migrate-images"
                  >
                    {isMigrating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Migrating...
                      </>
                    ) : (
                      <>
                        <Cloud className="h-4 w-4 mr-2" />
                        Migrate Images to Azure
                      </>
                    )}
                  </Button>
                  
                  {migrationResult && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg ${
                      migrationResult.success 
                        ? "bg-green-50 text-green-800 border border-green-200" 
                        : "bg-red-50 text-red-800 border border-red-200"
                    }`}>
                      {migrationResult.success ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <XCircle className="h-5 w-5" />
                      )}
                      <span>{migrationResult.message}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <UsersTab />
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
