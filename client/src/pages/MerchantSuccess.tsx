import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";

interface MerchantData {
  id: string;
  companyName: string;
  email: string;
}

export default function MerchantSuccess() {
  const [, params] = useRoute("/merchant-success/:id");
  const [, setLocation] = useLocation();
  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [loading, setLoading] = useState(true);

  const merchantId = params?.id;

  useEffect(() => {
    if (!merchantId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const response = await fetch(`/api/merchants/public/${merchantId}`);
        if (response.ok) {
          setMerchant(await response.json());
        }
      } catch (error) {
        console.error("Failed to fetch merchant:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [merchantId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#00426D]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-br from-[#00426D] via-[#00395D] to-[#002A45] text-white py-10 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <img src="/ql-logo.png" alt="Qatar Living" className="h-10 mx-auto mb-6" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div className="flex items-center justify-center gap-3 mb-2">
            <CheckCircle2 className="h-10 w-10 text-green-400" />
            <h1 className="text-3xl font-bold" data-testid="text-success-title">Application Submitted!</h1>
          </div>
          <p className="text-white/80 text-sm">Thank you for applying to become a Qatar Living Deals partner.</p>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl py-10 px-4">
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            {merchant ? (
              <p className="text-slate-700" data-testid="text-success-message">
                We've received the application for <span className="font-semibold">{merchant.companyName}</span>.
                Our team will review your submission and contact you
                {merchant.email ? <> at <span className="font-semibold">{merchant.email}</span></> : null} with the next steps.
              </p>
            ) : (
              <p className="text-slate-700" data-testid="text-success-message">
                We've received your application. Our team will review your submission and contact you with the next steps.
              </p>
            )}
            <p className="text-sm text-slate-500">No further action is needed from you right now.</p>
            <div className="pt-2">
              <Button
                className="bg-[#00426D] hover:bg-[#003557]"
                onClick={() => setLocation("/")}
                data-testid="button-back-home"
              >
                Back to Home
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
