import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  Send,
  CheckCheck,
  Eye,
  AlertCircle,
  MessageSquare,
  Clock,
  TrendingUp,
  Activity,
} from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const [wabaAccountId, setWabaAccountId] = useState<string | null>(null);

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

  const { data: stats = {
    messages_sent_24h: 0,
    messages_delivered_24h: 0,
    messages_read_24h: 0,
    messages_failed_24h: 0,
    active_conversations: 0,
    queue_size: 0,
    delivery_rate: 0,
    read_rate: 0,
  }, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', wabaAccountId],
    queryFn: () => wabaAccountId ? api.getDashboardStats(wabaAccountId) : Promise.resolve({
      messages_sent_24h: 0,
      messages_delivered_24h: 0,
      messages_read_24h: 0,
      messages_failed_24h: 0,
      active_conversations: 0,
      queue_size: 0,
      delivery_rate: 0,
      read_rate: 0,
    }),
    enabled: !!wabaAccountId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ['campaigns', wabaAccountId],
    queryFn: () => wabaAccountId ? api.getCampaigns(wabaAccountId) : Promise.resolve([]),
    enabled: !!wabaAccountId,
  });

  const recentCampaigns = campaigns.slice(0, 3).map((campaign: any) => ({
    id: campaign.id,
    name: `Campaign #${campaign.id.slice(0, 8)}${campaign.templateId ? ' (Template)' : ' (Plain Text)'}`,
    status: campaign.status,
    sent: campaign.sentCount || 0,
    delivered: campaign.deliveredCount || 0,
  }));

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Real-time overview of your WhatsApp operations
          </p>
        </div>
        <Button 
          className="bg-gradient-primary hover:opacity-90 transition-opacity"
          onClick={() => navigate('/campaigns')}
        >
          <Send className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Messages Sent (24h)"
          value={stats.messages_sent_24h.toLocaleString()}
          change={`${stats.messages_sent_24h} messages sent`}
          changeType="neutral"
          icon={Send}
        />
        <StatsCard
          title="Delivered (24h)"
          value={stats.messages_delivered_24h.toLocaleString()}
          change={`${stats.delivery_rate.toFixed(1)}% delivery rate`}
          changeType={stats.delivery_rate >= 95 ? "positive" : stats.delivery_rate >= 80 ? "neutral" : "negative"}
          icon={CheckCheck}
        />
        <StatsCard
          title="Read (24h)"
          value={stats.messages_read_24h.toLocaleString()}
          change={`${stats.read_rate.toFixed(1)}% read rate`}
          changeType="neutral"
          icon={Eye}
        />
        <StatsCard
          title="Failed (24h)"
          value={stats.messages_failed_24h.toLocaleString()}
          change={`${stats.messages_sent_24h > 0 ? ((stats.messages_failed_24h / stats.messages_sent_24h) * 100).toFixed(1) : 0}% failure rate`}
          changeType={stats.messages_failed_24h === 0 ? "positive" : stats.messages_failed_24h < 5 ? "neutral" : "negative"}
          icon={AlertCircle}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Active Conversations</p>
                <h3 className="text-2xl font-bold mt-2">{stats.active_conversations}</h3>
              </div>
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Queue Size</p>
                <h3 className="text-2xl font-bold mt-2">{stats.queue_size.toLocaleString()}</h3>
              </div>
              <Clock className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Avg Response Time</p>
                <h3 className="text-2xl font-bold mt-2">-</h3>
                <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
              </div>
              <Activity className="h-8 w-8 text-info" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Campaigns */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Recent Campaigns
          </CardTitle>
        </CardHeader>
        <CardContent>
          {campaignsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading campaigns...</div>
          ) : recentCampaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No campaigns yet</div>
          ) : (
            <div className="space-y-4">
              {recentCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div>
                  <h4 className="font-semibold">{campaign.name}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sent: {campaign.sent.toLocaleString()} • Delivered:{" "}
                    {campaign.delivered.toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      campaign.status === "running"
                        ? "bg-primary/20 text-primary"
                        : campaign.status === "completed"
                        ? "bg-success/20 text-success"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {campaign.status}
                  </span>
                  <Button variant="ghost" size="sm">
                    View Details
                  </Button>
                </div>
              </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
