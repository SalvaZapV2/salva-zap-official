import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

const Settings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // State for tenant information
  const [tenantName, setTenantName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [shopId, setShopId] = useState<string | null>(null);

  // Fetch shops to get the first shop (tenant)
  const { data: shops = [], isLoading: shopsLoading } = useQuery({
    queryKey: ['shops'],
    queryFn: () => api.getShops(),
  });

  // Fetch user profile for email
  const { data: userProfile, isLoading: userLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: () => api.getUserProfile(),
    enabled: !!user,
  });

  // Initialize form data when shops and user data are loaded
  useEffect(() => {
    if (shops.length > 0 && !shopId) {
      setShopId(shops[0].id);
      setTenantName(shops[0].name || "");
    }
  }, [shops, shopId]);

  useEffect(() => {
    if (userProfile) {
      setContactEmail(userProfile.email || "");
    }
  }, [userProfile]);

  // Mutation for updating shop name
  const updateShopMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!shopId) throw new Error("No shop found");
      return api.updateShop(shopId, name);
    },
    onSuccess: () => {
      toast.success("Tenant name updated successfully!");
      queryClient.invalidateQueries({ queryKey: ['shops'] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update tenant name");
    },
  });

  // Mutation for updating user email
  const updateEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      return api.updateUserEmail(email);
    },
    onSuccess: () => {
      toast.success("Contact email updated successfully!");
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update contact email");
    },
  });

  const handleSaveTenantInfo = async () => {
    try {
      // Update shop name if changed
      if (shopId && tenantName && tenantName !== shops[0]?.name) {
        await updateShopMutation.mutateAsync(tenantName);
      }

      // Update user email if changed
      if (contactEmail && contactEmail !== userProfile?.email) {
        await updateEmailMutation.mutateAsync(contactEmail);
      }

      // If nothing changed
      if (
        (!shopId || tenantName === shops[0]?.name) &&
        contactEmail === userProfile?.email
      ) {
        toast.info("No changes to save");
      }
    } catch (error) {
      // Error handling is done in mutations
    }
  };

  const isSaving = updateShopMutation.isPending || updateEmailMutation.isPending;
  const isLoading = shopsLoading || userLoading;

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account, integrations, and platform configuration
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Tenant Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Loading...
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="tenant-name">Tenant Name</Label>
                    <Input
                      id="tenant-name"
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      placeholder="My Company"
                      disabled={isSaving || !shopId}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tenant-email">Contact Email</Label>
                    <Input
                      id="tenant-email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="contact@mycompany.com"
                      disabled={isSaving}
                    />
                  </div>
                  <Button
                    className="bg-gradient-primary hover:opacity-90"
                    onClick={handleSaveTenantInfo}
                    disabled={isSaving || isLoading}
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Real-time Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive instant notifications for new messages
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-assign Conversations</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically assign new conversations to available agents
                  </p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure webhook endpoints to receive real-time events from WhatsApp
              </p>
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input
                  value={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/webhooks/meta`}
                  readOnly
                />
              </div>
              <div className="space-y-2">
                <Label>Verify Token</Label>
                <Input value={import.meta.env.VITE_WEBHOOK_VERIFY_TOKEN || "your_verify_token_here"} readOnly />
              </div>
              <Button variant="outline" disabled>
                Regenerate Token
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
