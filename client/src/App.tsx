import { Switch, Route, Redirect } from "wouter";
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
import DealDetail from "@/pages/DealDetail";
import DealView from "@/pages/DealView";
import PrintDeal from "@/pages/PrintDeal";
import Settings from "@/pages/Settings";
import MerchantOnboarding from "@/pages/MerchantOnboarding";
import MerchantManagement from "@/pages/MerchantManagement";
import MerchantView from "@/pages/MerchantView";
import MerchantEdit from "@/pages/MerchantEdit";
import MerchantSuccess from "@/pages/MerchantSuccess";
import ExistingMerchants from "@/pages/ExistingMerchants";
import LiveOffers from "@/pages/LiveOffers";
import Overview from "@/pages/Overview";
import RedirectAnalytics from "@/pages/RedirectAnalytics";

function Router() {
  return (
    <Switch>
      <Route path="/" component={MerchantOnboarding} />
      <Route path="/create-deal" component={CreateOffer} />
      <Route path="/success" component={Success} />
      <Route path="/offer-request" component={OfferForm} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/overview" component={Overview} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/users">{() => <Redirect to="/admin/settings?tab=users" />}</Route>
      <Route path="/admin/deals/:id" component={DealDetail} />
      <Route path="/admin/deals/:id/view" component={DealView} />
      <Route path="/admin/deals/:id/print" component={PrintDeal} />
      <Route path="/admin/settings" component={Settings} />
      <Route path="/admin/existing-merchants" component={ExistingMerchants} />
      <Route path="/admin/live-offers" component={LiveOffers} />
      <Route path="/admin/redirect-analytics" component={RedirectAnalytics} />
      <Route path="/admin/merchants" component={MerchantManagement} />
      <Route path="/admin/merchants/:id" component={MerchantView} />
      <Route path="/admin/merchants/:id/edit" component={MerchantEdit} />
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
