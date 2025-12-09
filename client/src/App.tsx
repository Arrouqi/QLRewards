import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import CreateOffer from "@/pages/CreateOffer";
import OfferForm from "@/pages/OfferForm";
import Success from "@/pages/Success";

function Router() {
  return (
    <Switch>
      <Route path="/" component={CreateOffer} />
      <Route path="/success" component={Success} />
      <Route path="/offer-request" component={OfferForm} />
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
