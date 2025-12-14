import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

interface Term {
  id: number;
  type: string;
  text: string;
  createdAt: string;
}

export default function TermsManagement() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [claimRules, setClaimRules] = useState<Term[]>([]);
  const [generalRules, setGeneralRules] = useState<Term[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newClaimRule, setNewClaimRule] = useState("");
  const [newGeneralRule, setNewGeneralRule] = useState("");
  const [editingTermId, setEditingTermId] = useState<number | null>(null);
  const [editingTermText, setEditingTermText] = useState("");

  useEffect(() => {
    checkAuthAndFetchTerms();
  }, []);

  const checkAuthAndFetchTerms = async () => {
    try {
      const authResponse = await fetch("/api/auth/session");
      if (!authResponse.ok) {
        setLocation("/admin/login");
        return;
      }
      await fetchTerms();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load terms",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTerms = async () => {
    const [claimRes, generalRes] = await Promise.all([
      fetch("/api/terms/claim"),
      fetch("/api/terms/general"),
    ]);
    if (!claimRes.ok || !generalRes.ok) {
      throw new Error("Failed to fetch terms");
    }
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
          <h1 className="text-2xl font-bold text-[#00426D]">Terms Management</h1>
          <p className="text-slate-500 mt-1">Manage claim rules and general rules for deals</p>
        </div>

        <div className="space-y-6">
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
        </div>
      </div>
    </AdminLayout>
  );
}
