import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Play,
  Pause,
  Calendar,
  Users,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useActiveWaba } from "@/hooks/use-active-waba";
import type { Campaign } from "@/lib/types";

const Campanhas = () => {
  const navigate = useNavigate();
  const { activeWaba } = useActiveWaba();

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["campaigns", activeWaba?.id],
    queryFn: () => api.getCampaigns(activeWaba!.id),
    enabled: !!activeWaba?.id,
  });

  const summaryStats = useMemo(() => {
    return {
      active: campaigns.filter((c) => c.status === "sending" || c.status === "running").length,
    scheduled: campaigns.filter((c) => c.status === "scheduled").length,
    completed: campaigns.filter((c) => c.status === "completed").length,
      totalReach: campaigns.reduce((acc, c) => acc + (c.contactCount || 0), 0),
  };
  }, [campaigns]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "running":
      case "sending":
        return "Em Execução";
      case "completed":
        return "Concluída";
      case "scheduled":
        return "Agendada";
      case "paused":
        return "Pausada";
      case "created":
        return "Criada";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
      case "sending":
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

  if (!activeWaba) {
    return (
      <div className="p-8">
        <div className="text-center text-muted-foreground space-y-3">
          <p>Conecte uma conta WABA para visualizar campanhas.</p>
          <Button onClick={() => (window.location.href = "/conectar-whatsapp")}>
            Conectar WhatsApp
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campanhas</h1>
          <p className="text-muted-foreground mt-1">
            Crie e gerencie suas campanhas de mensagens
          </p>
        </div>
        <Button
          className="bg-[#25D366] hover:bg-[#25D366]/90"
          onClick={() => navigate("/campanhas/nova")}
        >
          <Plus className="h-4 w-4 mr-2" />
          Criar Campanha
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ativas</p>
                <h3 className="text-2xl font-bold mt-1">{summaryStats.active}</h3>
              </div>
              <Play className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Agendadas</p>
                <h3 className="text-2xl font-bold mt-1">{summaryStats.scheduled}</h3>
              </div>
              <Calendar className="h-8 w-8 text-info" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Concluídas</p>
                <h3 className="text-2xl font-bold mt-1">{summaryStats.completed}</h3>
              </div>
              <BarChart3 className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alcance Total</p>
                <h3 className="text-2xl font-bold mt-1">
                  {(summaryStats.totalReach / 1000).toFixed(1)}K
                </h3>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">Histórico de Campanhas</h2>
        {campaigns.map((campaign) => (
          <Card
            key={campaign.id}
            className="bg-card border-border hover:shadow-md transition-shadow"
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <CardTitle className="text-xl">{campaign.id}</CardTitle>
                    <Badge className={getStatusColor(campaign.status)}>
                      {getStatusLabel(campaign.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {campaign.createdAt
                        ? new Date(campaign.createdAt).toLocaleString("pt-BR")
                        : "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {(campaign.contactCount || 0).toLocaleString()} destinatários
                    </span>
                    {campaign.templateId && <span>Template: {campaign.templateId}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {campaign.status === "running" && (
                    <Button variant="outline" size="sm">
                      <Pause className="h-4 w-4 mr-1" />
                      Pausar
                    </Button>
                  )}
                  {campaign.status === "scheduled" && (
                    <Button variant="outline" size="sm">
                      <Play className="h-4 w-4 mr-1" />
                      Iniciar Agora
                    </Button>
                  )}
                  <Button variant="outline" size="sm">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    Ver Relatório
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {campaign.status !== "completed" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-medium">
                      {(campaign.sentCount || 0).toLocaleString()} /{" "}
                      {(campaign.contactCount || 0).toLocaleString()}
                    </span>
                  </div>
                  <Progress
                    value={calculateProgress(campaign.sentCount || 0, campaign.contactCount || 0)}
                    className="h-2"
                  />
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-5 gap-4 pt-2">
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {(campaign.sentCount || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Enviadas</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">
                    {(campaign.deliveredCount || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Entregues</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-info">
                    {(campaign.readCount || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Lidas</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">
                    {campaign.sentCount
                      ? (((campaign.readCount || 0) / campaign.sentCount) * 100).toFixed(0)
                      : 0}
                    %
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Taxa de Leitura</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-destructive">
                    {campaign.failedCount || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Falhas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && campaigns.length === 0 && (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhuma campanha encontrada.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Campanhas;
