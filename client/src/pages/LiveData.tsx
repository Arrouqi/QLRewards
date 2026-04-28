import { useSearch } from "wouter";
import { useState } from "react";
import { Building2, Tag } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminLayout from "@/components/AdminLayout";
import { ExistingMerchantsContent } from "./ExistingMerchants";
import { LiveOffersContent } from "./LiveOffers";

export default function LiveData() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const initialTab = searchParams.get("tab") === "deals" ? "deals" : "merchants";
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <AdminLayout>
      <div className="p-6 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#00426D]" data-testid="text-page-title">Live Data</h1>
          <p className="text-slate-500 text-sm mt-1">Production merchants and active deals from Qatar Living</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="merchants" className="flex items-center gap-2" data-testid="tab-live-merchants">
              <Building2 className="h-4 w-4" />
              Live Merchants
            </TabsTrigger>
            <TabsTrigger value="deals" className="flex items-center gap-2" data-testid="tab-live-deals">
              <Tag className="h-4 w-4" />
              Live Deals
            </TabsTrigger>
          </TabsList>

          <TabsContent value="merchants">
            <ExistingMerchantsContent />
          </TabsContent>

          <TabsContent value="deals">
            <LiveOffersContent />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
