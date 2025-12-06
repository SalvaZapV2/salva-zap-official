import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  Link as LinkIcon,
  Phone,
  Webhook,
  Settings as SettingsIcon,
} from "lucide-react";

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [shopId, setShopId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch shops
  const { data: shops = [], isLoading: shopsLoading } = useQuery({
    queryKey: ['shops'],
    queryFn: () => api.getShops(),
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (shops.length > 0) {
      setShopId(shops[0].id);
    }
  }, [shops]);

  const { data: signupData, isLoading: signupLoading, error: signupError } = useQuery({
    queryKey: ['embedded-signup', shopId],
    queryFn: () => shopId ? api.getEmbeddedSignupUrl(shopId) : Promise.resolve({ url: '' }),
    enabled: !!shopId,
    retry: 1,
  });

  // Get all WABA accounts from all shops
  const allWabaAccounts = shops.flatMap((shop: any) => shop.waba || []);
  const hasWabaAccounts = allWabaAccounts.length > 0;

  const handleConnectNew = () => {
    if (signupData?.url) {
      window.location.href = signupData.url;
    } else if (!shopId) {
      toast.error("Please wait for shops to load.");
    } else if (signupLoading) {
      toast.info("Generating connection URL...");
    } else {
      // Try to refetch if URL is not available
      queryClient.invalidateQueries({ queryKey: ['embedded-signup', shopId] });
      toast.info("Refreshing connection URL...");
    }
  };

  // Dynamic step status based on actual state
  const getStepStatus = (stepId: number) => {
    if (stepId === 1) {
      return hasWabaAccounts ? "completed" : "current";
    } else if (stepId === 2) {
      return hasWabaAccounts ? "current" : "pending";
    } else {
      return "pending";
    }
  };

  const steps = [
    {
      id: 1,
      title: "Connect Meta Account",
      description: "Authenticate with Facebook/Meta to access WhatsApp Business API",
      icon: LinkIcon,
      status: getStepStatus(1),
    },
    {
      id: 2,
      title: "Select WABA & Phone",
      description: "Choose your WhatsApp Business Account and phone number",
      icon: Phone,
      status: getStepStatus(2),
    },
    {
      id: 3,
      title: "Configure Webhooks",
      description: "Set up webhook URL to receive messages and events",
      icon: Webhook,
      status: getStepStatus(3),
    },
    {
      id: 4,
      title: "Review & Complete",
      description: "Review permissions and finalize setup",
      icon: SettingsIcon,
      status: getStepStatus(4),
    },
  ];


  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Embedded Signup</h1>
        <p className="text-muted-foreground mt-1">
          Connect your WhatsApp Business Account via Meta's Embedded Signup flow
        </p>
      </div>

      {/* Steps Progress */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center relative">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                      step.status === "completed"
                        ? "bg-primary text-primary-foreground"
                        : step.status === "current"
                        ? "bg-primary/20 text-primary border-2 border-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step.status === "completed" ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      <step.icon className="h-6 w-6" />
                    )}
                  </div>
                  <div className="mt-3 text-center max-w-[150px]">
                    <p className="text-sm font-semibold">{step.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                  </div>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`h-[2px] flex-1 mx-4 transition-colors ${
                      step.status === "completed" ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current Step Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Instructions */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Step 1: Connect Meta Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect your Facebook/Meta account to access WhatsApp Business API. You'll be redirected to Meta's authorization page to grant necessary permissions.
            </p>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Required Permissions:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  whatsapp_business_messaging
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  whatsapp_business_management
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  business_management
                </li>
              </ul>
            </div>
            {shopsLoading ? (
              <Button 
                className="w-full bg-gradient-primary hover:opacity-90"
                disabled
              >
                Loading shops...
              </Button>
            ) : !shopId ? (
              <div className="space-y-2">
                <Button 
                  className="w-full bg-gradient-primary hover:opacity-90"
                  disabled
                >
                  Please create a shop first
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  A shop is automatically created when you register. Please refresh the page or contact support if you don't see your shop.
                </p>
              </div>
            ) : signupLoading ? (
              <Button 
                className="w-full bg-gradient-primary hover:opacity-90"
                disabled
              >
                Generating connection URL...
              </Button>
            ) : signupError ? (
              <div className="space-y-2">
                <Button 
                  className="w-full bg-gradient-primary hover:opacity-90"
                  disabled
                >
                  Error loading connection URL
                </Button>
                <p className="text-xs text-destructive text-center">
                  Failed to generate connection URL. Please try refreshing the page.
                </p>
              </div>
            ) : signupData?.url ? (
              <Button 
                className="w-full bg-gradient-primary hover:opacity-90"
                onClick={() => {
                  if (signupData?.url) {
                    window.location.href = signupData.url;
                  }
                }}
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                Connect Meta Account
              </Button>
            ) : (
              <Button 
                className="w-full bg-gradient-primary hover:opacity-90"
                disabled
              >
                Preparing connection...
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Connected Accounts */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Connected Accounts</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleConnectNew}
                disabled={!signupData?.url || signupLoading}
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                Connect New
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {shopsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading accounts...</div>
            ) : allWabaAccounts.length === 0 ? (
              <div className="text-center py-8">
                <Circle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  No WhatsApp Business Accounts connected yet.
                </p>
                <Button 
                  variant="outline"
                  onClick={handleConnectNew}
                  disabled={!signupData?.url || signupLoading || !shopId}
                >
                  <LinkIcon className="h-4 w-4 mr-2" />
                  {signupLoading ? "Loading..." : signupData?.url ? "Connect Your First Account" : "Preparing..."}
                </Button>
              </div>
            ) : (
              allWabaAccounts.map((waba: any) => (
                <div
                  key={waba.id}
                  className="p-4 bg-muted/30 rounded-lg space-y-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold">WhatsApp Business Account</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        WABA ID: {waba.wabaId}
                      </p>
                    </div>
                    <Badge className={`${
                      waba.webhookVerified 
                        ? "bg-success/20 text-success border-success/30"
                        : "bg-warning/20 text-warning border-warning/30"
                    }`}>
                      {waba.webhookVerified ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Connected
                        </>
                      ) : (
                        <>
                          <Circle className="h-3 w-3 mr-1" />
                          Pending
                        </>
                      )}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Phone Number:
                    </p>
                    <div className="flex items-center justify-between p-2 bg-background rounded">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-primary" />
                        <span className="text-sm">{waba.displayNumber}</span>
                        {waba.webhookVerified && (
                          <CheckCircle2 className="h-3 w-3 text-success" />
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {waba.webhookVerified ? "Active" : "Setting up"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Phone ID: {waba.phoneId}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;
