import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, MessageSquare, Clock } from "lucide-react";
import { api } from "@/lib/api";

const Analytics = () => {
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

  const { data: stats, isLoading: statsLoading } = useQuery({
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
    refetchInterval: 30000,
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns', wabaAccountId],
    queryFn: () => wabaAccountId ? api.getCampaigns(wabaAccountId) : Promise.resolve([]),
    enabled: !!wabaAccountId,
  });

  // Calculate total messages from campaigns
  const totalMessagesSent = campaigns.reduce((sum: number, c: any) => sum + (c.sentCount || 0), 0);
  const totalMessagesDelivered = campaigns.reduce((sum: number, c: any) => sum + (c.deliveredCount || 0), 0);

  // Calculate overall delivery rate
  const overallDeliveryRate = totalMessagesSent > 0
    ? ((totalMessagesDelivered / totalMessagesSent) * 100).toFixed(1)
    : stats?.delivery_rate?.toFixed(1) || '0.0';

  // Calculate overall read rate
  const overallReadRate = stats?.read_rate?.toFixed(1) || '0.0';

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Comprehensive metrics and insights for your WhatsApp operations
        </p>
      </div>

      {!wabaAccountId ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No WhatsApp Business Account Connected</h3>
            <p className="text-muted-foreground">
              Connect a WhatsApp Business Account to view analytics.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {statsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading analytics...</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        Total Messages (24h)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats?.messages_sent_24h?.toLocaleString() || '0'}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats?.messages_sent_24h || 0} messages sent in last 24 hours
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-success" />
                        Delivery Rate
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{overallDeliveryRate}%</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats?.messages_delivered_24h || 0} delivered out of {stats?.messages_sent_24h || 0} sent
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-info" />
                        Read Rate
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{overallReadRate}%</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats?.messages_read_24h || 0} read out of {stats?.messages_delivered_24h || 0} delivered
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4 text-warning" />
                        Active Conversations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats?.active_conversations?.toLocaleString() || '0'}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Conversations active in last 24 hours
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle>Message Volume Trends</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Chart visualization coming soon</p>
                        <p className="text-sm mt-2">
                          Currently showing {stats?.messages_sent_24h || 0} messages sent in last 24h
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Campaign Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Campaign performance charts coming soon</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Template Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Template analytics coming soon</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Performance metrics visualization coming soon</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Analytics;
