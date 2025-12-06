import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus,
  Play,
  Pause,
  BarChart3,
  Calendar,
  Users,
  TrendingUp,
  DollarSign,
} from "lucide-react";

const Campaigns = () => {
  const navigate = useNavigate();
  const [wabaAccountId, setWabaAccountId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [contactNumbers, setContactNumbers] = useState<string>("");
  const queryClient = useQueryClient();

  // Use React Query for shops to enable automatic refresh
  const { data: shops = [] } = useQuery({
    queryKey: ['shops'],
    queryFn: () => api.getShops(),
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    // Get first shop's WABA account
    if (shops.length > 0 && shops[0].waba && shops[0].waba.length > 0) {
      setWabaAccountId(shops[0].waba[0].id);
    }
  }, [shops]);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns', wabaAccountId],
    queryFn: () => wabaAccountId ? api.getCampaigns(wabaAccountId) : Promise.resolve([]),
    enabled: !!wabaAccountId,
    refetchInterval: 30000,
  });

  // Calculate summary stats from real campaign data
  const campaignStats = {
    active: campaigns.filter((c: any) => c.status === 'sending' || c.status === 'running').length,
    scheduled: campaigns.filter((c: any) => c.status === 'created' || c.status === 'scheduled').length,
    completed: campaigns.filter((c: any) => c.status === 'completed').length,
    totalReach: campaigns.reduce((sum: number, c: any) => sum + (c.contactCount || 0), 0),
  };

  const { data: templates = [] } = useQuery({
    queryKey: ['templates', wabaAccountId],
    queryFn: () => wabaAccountId ? api.getTemplates(wabaAccountId) : Promise.resolve([]),
    enabled: !!wabaAccountId,
  });

  const contactCount = contactNumbers.split('\n').filter(num => num.trim().length > 0).length;
  const { data: costData } = useQuery({
    queryKey: ['campaign-cost', selectedTemplateId, contactCount],
    queryFn: () => api.getCampaignCost(selectedTemplateId || null, contactCount),
    enabled: contactCount > 0,
  });

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      if (!wabaAccountId) throw new Error("No WABA account selected");
      const contacts = contactNumbers.split('\n')
        .map(num => num.trim())
        .filter(num => num.length > 0);
      if (contacts.length === 0) throw new Error("Please enter at least one contact number");
      
      return api.createCampaign(
        wabaAccountId,
        selectedTemplateId || null,
        contacts
      );
    },
    onSuccess: () => {
      toast.success("Campaign created successfully!");
      setIsDialogOpen(false);
      setContactNumbers("");
      setSelectedTemplateId("");
      queryClient.invalidateQueries({ queryKey: ['campaigns', wabaAccountId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create campaign");
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "bg-primary/20 text-primary border-primary/30";
      case "completed":
        return "bg-success/20 text-success border-success/30";
      case "scheduled":
        return "bg-info/20 text-info border-info/30";
      case "paused":
        return "bg-warning/20 text-warning border-warning/30";
      default:
        return "bg-muted/20 text-muted-foreground border-muted/30";
    }
  };

  const calculateProgress = (sent: number, total: number) => {
    return total > 0 ? (sent / total) * 100 : 0;
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage your messaging campaigns
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90 transition-opacity">
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Campaign</DialogTitle>
              <DialogDescription>
                Create a new messaging campaign. Enter contact numbers (one per line) and optionally select a template.
              </DialogDescription>
            </DialogHeader>
            {!wabaAccountId ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground mb-4">
                  You need to connect a WhatsApp Business Account first to create campaigns.
                </p>
                <Button onClick={() => {
                  setIsDialogOpen(false);
                  navigate('/onboarding');
                }}>
                  Go to Onboarding
                </Button>
              </div>
            ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="template">Template (Optional)</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger id="template">
                    <SelectValue placeholder="Select a template (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None - Send plain text</SelectItem>
                    {templates.filter((t: any) => t.status === 'approved').map((template: any) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} ({template.language})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contacts">Contact Numbers (one per line)</Label>
                <Textarea
                  id="contacts"
                  placeholder="+5511999999999&#10;+5521888888888&#10;+5531777777777"
                  value={contactNumbers}
                  onChange={(e) => setContactNumbers(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {contactCount} contact{contactCount !== 1 ? 's' : ''} entered
                </p>
              </div>

              {costData && contactCount > 0 && (
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-semibold">Estimated Cost</p>
                          <p className="text-xs text-muted-foreground">
                            {costData.costPerMessage.toFixed(4)} {costData.currency} per message
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">
                          {costData.totalCost.toFixed(2)} {costData.currency}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          for {costData.breakdown.messageCount} message{costData.breakdown.messageCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={createCampaignMutation.isPending}
              >
                Cancel
              </Button>
              {wabaAccountId && (
                <Button
                  onClick={() => createCampaignMutation.mutate()}
                  disabled={createCampaignMutation.isPending || contactCount === 0}
                  className="bg-gradient-primary hover:opacity-90"
                >
                  {createCampaignMutation.isPending ? "Creating..." : "Create Campaign"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <h3 className="text-2xl font-bold mt-1">{campaignStats.active}</h3>
              </div>
              <Play className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Scheduled</p>
                <h3 className="text-2xl font-bold mt-1">{campaignStats.scheduled}</h3>
              </div>
              <Calendar className="h-8 w-8 text-info" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <h3 className="text-2xl font-bold mt-1">{campaignStats.completed}</h3>
              </div>
              <BarChart3 className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Reach</p>
                <h3 className="text-2xl font-bold mt-1">
                  {campaignStats.totalReach >= 1000
                    ? `${(campaignStats.totalReach / 1000).toFixed(1)}K`
                    : campaignStats.totalReach.toLocaleString()}
                </h3>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      {!wabaAccountId ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No WhatsApp Business Account Connected</h3>
            <p className="text-muted-foreground mb-4">
              You need to connect a WhatsApp Business Account to view and create campaigns.
            </p>
            <Button onClick={() => navigate('/onboarding')} className="bg-gradient-primary hover:opacity-90">
              Go to Onboarding
            </Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first campaign to start sending messages to your contacts.
            </p>
            <Button 
              onClick={() => setIsDialogOpen(true)} 
              className="bg-gradient-primary hover:opacity-90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {campaigns.map((campaign: any) => (
          <Card
            key={campaign.id}
            className="bg-card border-border hover:shadow-glow transition-all duration-300"
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <CardTitle className="text-xl">
                      Campaign #{campaign.id.slice(0, 8)}
                      {campaign.templateId ? ` (Template)` : ` (Plain Text)`}
                    </CardTitle>
                    <Badge className={getStatusColor(campaign.status)}>
                      {campaign.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(campaign.createdAt).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {campaign.contactCount.toLocaleString()} recipients
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {campaign.status === "running" ? (
                    <Button variant="outline" size="sm">
                      <Pause className="h-4 w-4 mr-1" />
                      Pause
                    </Button>
                  ) : campaign.status === "scheduled" ? (
                    <Button variant="outline" size="sm">
                      <Play className="h-4 w-4 mr-1" />
                      Start Now
                    </Button>
                  ) : null}
                  <Button variant="outline" size="sm">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    View Report
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress */}
              {campaign.status === "running" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">
                      {(campaign.sentCount || 0).toLocaleString()} /{" "}
                      {campaign.contactCount.toLocaleString()}
                    </span>
                  </div>
                  <Progress
                    value={calculateProgress(campaign.sentCount || 0, campaign.contactCount)}
                    className="h-2"
                  />
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4 pt-2">
                <div className="text-center">
                  <p className="text-2xl font-bold">{(campaign.sentCount || 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">Sent</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">
                    {(campaign.deliveredCount || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Delivered</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-info">
                    {(campaign.readCount || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Read</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-destructive">
                    {(campaign.failedCount || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Campaigns;
