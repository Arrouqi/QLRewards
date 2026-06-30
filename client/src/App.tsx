import { Switch, Route, Redirect } from "wouter";
import { useTranslation } from "react-i18next";
import { DirectionProvider } from "@radix-ui/react-direction";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isRtl } from "./i18n";
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
import LiveData from "@/pages/LiveData";
import Overview from "@/pages/Overview";
import RedirectAnalytics from "@/pages/RedirectAnalytics";
import FeedbackForm from "@/pages/FeedbackForm";
import FeedbackManagement from "@/pages/FeedbackManagement";
import FeedbackView from "@/pages/FeedbackView";

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
      <Route path="/admin/live-data" component={LiveData} />
      <Route path="/admin/existing-merchants">{() => <Redirect to="/admin/live-data?tab=merchants" />}</Route>
      <Route path="/admin/live-offers">{() => <Redirect to="/admin/live-data?tab=deals" />}</Route>
      <Route path="/admin/redirect-analytics" component={RedirectAnalytics} />
      <Route path="/admin/merchants" component={MerchantManagement} />
      <Route path="/admin/merchants/:id" component={MerchantView} />
      <Route path="/admin/merchants/:id/edit" component={MerchantEdit} />
      <Route path="/admin/feedbacks" component={FeedbackManagement} />
      <Route path="/admin/feedbacks/:id" component={FeedbackView} />
      <Route path="/feedback" component={FeedbackForm} />
      <Route path="/merchant-success/:id" component={MerchantSuccess} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { i18n } = useTranslation();
  const dir = isRtl(i18n.language) ? "rtl" : "ltr";

  return (
    <DirectionProvider dir={dir}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </DirectionProvider>
  );
}

export default App;
