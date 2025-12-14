import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";

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

export default function AdminConfig() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSubCategoryName, setNewSubCategoryName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingSubCategoryId, setEditingSubCategoryId] = useState<string | null>(null);
  const [editingSubCategoryName, setEditingSubCategoryName] = useState("");

  useEffect(() => {
    checkAuthAndFetchCategories();
  }, []);

  const checkAuthAndFetchCategories = async () => {
    try {
      const authResponse = await fetch("/api/auth/session");
      if (!authResponse.ok) {
        setLocation("/admin/login");
        return;
      }
      await fetchCategories();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    const response = await fetch("/api/categories");
    if (!response.ok) {
      throw new Error("Failed to fetch categories");
    }
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

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-slate-500">Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#00426D]">Category Management</h1>
          <p className="text-slate-500 mt-1">Manage categories and subcategories</p>
        </div>

        <div className="space-y-6">
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
        </div>
      </div>
    </AdminLayout>
  );
}
