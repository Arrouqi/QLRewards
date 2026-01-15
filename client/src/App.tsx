import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import CreateOffer from "@/pages/CreateOffer";
import OfferForm from "@/pages/OfferForm";
import Success from "@/pages/Success";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminConfig from "@/pages/AdminConfig";
import TermsManagement from "@/pages/TermsManagement";
import UserManagement from "@/pages/UserManagement";
import DealDetail from "@/pages/DealDetail";
import DealView from "@/pages/DealView";
import PrintDeal from "@/pages/PrintDeal";
import Settings from "@/pages/Settings";
import MerchantOnboarding from "@/pages/MerchantOnboarding";
import MerchantManagement from "@/pages/MerchantManagement";
import MerchantSuccess from "@/pages/MerchantSuccess";

function Router() {
  return (
    <Switch>
      <Route path="/" component={MerchantOnboarding} />
      <Route path="/create-deal" component={CreateOffer} />
      <Route path="/success" component={Success} />
      <Route path="/offer-request" component={OfferForm} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/config" component={AdminConfig} />
      <Route path="/admin/terms" component={TermsManagement} />
      <Route path="/admin/users" component={UserManagement} />
      <Route path="/admin/deals/:id" component={DealDetail} />
      <Route path="/admin/deals/:id/view" component={DealView} />
      <Route path="/admin/deals/:id/print" component={PrintDeal} />
      <Route path="/admin/settings" component={Settings} />
      <Route path="/admin/merchants" component={MerchantManagement} />
      <Route path="/merchant-success/:id" component={MerchantSuccess} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
