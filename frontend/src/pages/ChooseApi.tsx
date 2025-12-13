import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Link as LinkIcon, Zap, Shield } from "lucide-react";

const UNOFFICIAL_API_URL = "https://salvazap.com/autenticar";

const ChooseApi = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [shopId, setShopId] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Fetch shops if authenticated
  const { data: shops = [], isLoading: shopsLoading } = useQuery({
    queryKey: ['shops'],
    queryFn: () => api.getShops(),
    enabled: isAuthenticated,
    retry: 1,
  });

  useEffect(() => {
    if (shops.length > 0) {
      setShopId(shops[0].id);
    }
  }, [shops]);

  // Get embedded signup URL if authenticated and shopId is available
  const { data: signupData, isLoading: signupLoading } = useQuery({
    queryKey: ['embedded-signup', shopId],
    queryFn: () => shopId ? api.getEmbeddedSignupUrl(shopId) : Promise.resolve({ url: '' }),
    enabled: isAuthenticated && !!shopId,
    retry: 1,
  });

  const handleUnofficialApi = () => {
    setIsRedirecting(true);
    window.location.href = UNOFFICIAL_API_URL;
  };

  const handleOfficialApi = () => {
    if (!isAuthenticated) {
      toast.error("Please log in first to use the Official API");
      return;
    }

    if (shopsLoading || signupLoading) {
      toast.info("Preparing connection...");
      return;
    }

    if (!shopId) {
      toast.error("No shop found. Please create a shop first.");
      return;
    }

    if (!signupData?.url) {
      toast.error("Failed to generate connection URL. Please try again.");
      return;
    }

    setIsRedirecting(true);
    window.location.href = signupData.url;
  };

  const isLoading = authLoading || (isAuthenticated && (shopsLoading || signupLoading));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-2xl bg-card border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Choose Your API</CardTitle>
          <p className="text-muted-foreground mt-2">
            Select which WhatsApp Business API integration you want to use
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Unofficial API Option */}
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">Unofficial API</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Use the existing unofficial WhatsApp API integration. This will redirect you to the current authentication page.
                  </p>
                  <Button
                    onClick={handleUnofficialApi}
                    disabled={isRedirecting}
                    className="w-full bg-gradient-primary hover:opacity-90"
                    size="lg"
                  >
                    {isRedirecting ? (
                      "Redirecting..."
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Use Unofficial API
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Official API Option */}
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">Official API (WABA)</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Use the official WhatsApp Business API via Meta's Embedded Signup. Connect your WhatsApp Business Account securely.
                  </p>
                  {!isAuthenticated && (
                    <p className="text-xs text-warning mb-2 bg-warning/10 p-2 rounded">
                      ⚠️ You need to be logged in to use the Official API
                    </p>
                  )}
                  <Button
                    onClick={handleOfficialApi}
                    disabled={isRedirecting || isLoading || !isAuthenticated}
                    className="w-full bg-gradient-primary hover:opacity-90"
                    size="lg"
                  >
                    {isRedirecting ? (
                      "Redirecting..."
                    ) : isLoading ? (
                      "Loading..."
                    ) : (
                      <>
                        <Shield className="h-4 w-4 mr-2" />
                        Use Official API
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Section */}
          <div className="mt-6 p-4 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground text-center">
              <LinkIcon className="h-3 w-3 inline mr-1" />
              The Official API requires authentication and will start the Meta Embedded Signup flow.
              The Unofficial API redirects to the existing authentication system.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChooseApi;

