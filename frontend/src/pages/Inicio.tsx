import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  CheckCheck,
  AlertCircle,
  MessageSquare,
  Megaphone,
  FileCheck,
  Wifi,
  WifiOff,
  TrendingUp,
  Shield,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useActiveWaba } from "@/hooks/use-active-waba";

const Inicio = () => {
  const navigate = useNavigate();
  const { activeShop, activeWaba, isLoading: shopsLoading } = useActiveWaba();

  const {
    data: dashboard,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery({
    queryKey: ["dashboard", activeWaba?.id],
    queryFn: () => api.getDashboardStats(activeWaba!.id),
    enabled: !!activeWaba?.id,
  });

  const connectionStatus = {
    connected: !!activeWaba,
    phoneNumber: activeWaba?.displayNumber ?? "",
    wabaId: activeWaba?.wabaId ?? "",
  };

  const quality = useMemo(() => {
    const baseScore =
      dashboard?.delivery_rate ?? dashboard?.read_rate ?? 50;
    const rating = Math.max(0, Math.min(100, Math.round(baseScore)));
    return {
      rating,
      tier: connectionStatus.connected ? "Ativo" : "Desconectado",
    };
  }, [dashboard, connectionStatus.connected]);

  const todayStats = {
    sent: dashboard?.messages_sent_24h ?? 0,
    delivered: dashboard?.messages_delivered_24h ?? 0,
    failed: dashboard?.messages_failed_24h ?? 0,
  };

  const getQualityColor = (rating: number) => {
    if (rating >= 80) return "text-success";
    if (rating >= 40) return "text-warning";
    return "text-destructive";
  };

  const getQualityBgColor = (rating: number) => {
    if (rating >= 80) return "bg-success/20";
    if (rating >= 40) return "bg-warning/20";
    return "bg-destructive/20";
  };

  const getQualityLabel = (rating: number) => {
    if (rating >= 80) return "Verde";
    if (rating >= 40) return "Amarelo";
    return "Vermelho";
  };

  const loading = shopsLoading || statsLoading;

    return (
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral da sua conta WhatsApp Business
          </p>
          {activeShop && (
                  <p className="text-sm text-muted-foreground">
              Empresa ativa: <span className="font-semibold">{activeShop.name}</span>
            </p>
          )}
        </div>
        {!connectionStatus.connected && (
          <Button onClick={() => navigate("/conectar-whatsapp")}>
            Conectar WhatsApp
          </Button>
        )}
      </div>

      {/* Status da Conexão */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {connectionStatus.connected ? (
                <div className="w-12 h-12 rounded-full bg-[#25D366]/20 flex items-center justify-center">
                  <Wifi className="h-6 w-6 text-[#25D366]" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                  <WifiOff className="h-6 w-6 text-destructive" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Status da Conexão</h3>
                  <Badge
                    variant={connectionStatus.connected ? "default" : "destructive"}
                    className={connectionStatus.connected ? "bg-[#25D366]" : ""}
                  >
                    {connectionStatus.connected ? "Conectado" : "Desconectado"}
                  </Badge>
                </div>
                {connectionStatus.connected ? (
                  <p className="text-sm text-muted-foreground mt-1">
                    Número: {connectionStatus.phoneNumber || "—"}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    Conecte sua conta para visualizar métricas.
                  </p>
                )}
              </div>
            </div>
            {!connectionStatus.connected && (
              <Button
                onClick={() => navigate("/conectar-whatsapp")}
                className="bg-[#25D366] hover:bg-[#25D366]/90"
              >
                Conectar WhatsApp
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Qualidade e Capacidade */}
      {connectionStatus.connected && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full ${getQualityBgColor(
                      quality.rating
                    )} flex items-center justify-center`}
                  >
                    <Shield className={`h-5 w-5 ${getQualityColor(quality.rating)}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold">Qualidade da Conta</h3>
                    <p className="text-sm text-muted-foreground">Quality Rating</p>
                  </div>
                </div>
                <Badge
                  className={`${getQualityBgColor(quality.rating)} ${getQualityColor(
                    quality.rating
                  )} border-0`}
                >
                  {getQualityLabel(quality.rating)}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pontuação</span>
                  <span className={`font-medium ${getQualityColor(quality.rating)}`}>
                    {quality.rating}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      quality.rating >= 80
                        ? "bg-success"
                        : quality.rating >= 40
                        ? "bg-warning"
                        : "bg-destructive"
                    }`}
                    style={{ width: `${quality.rating}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Métricas calculadas a partir das taxas de entrega e leitura das últimas 24h.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Capacidade de Envio</h3>
                    <p className="text-sm text-muted-foreground">
                      Baseada nas entregas das últimas 24h
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="font-bold">
                  {dashboard?.queue_size ?? 0} em fila
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Mensagens entregues</span>
                  <span className="font-medium">
                    {todayStats.delivered.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxa de entrega</span>
                  <span className="font-medium">
                    {dashboard?.delivery_rate?.toFixed(2) ?? "0.00"}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxa de leitura</span>
                  <span className="font-medium">
                    {dashboard?.read_rate?.toFixed(2) ?? "0.00"}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Atalhos Rápidos */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Atalhos Rápidos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            className="bg-card border-border cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate("/campanhas/nova")}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Megaphone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Criar Campanha</h3>
                <p className="text-sm text-muted-foreground">
                  Envie mensagens em massa
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-card border-border cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate("/conversas")}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-info" />
              </div>
              <div>
                <h3 className="font-semibold">Conversas</h3>
                <p className="text-sm text-muted-foreground">
                  Veja suas mensagens
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-card border-border cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate("/mensagens-aprovadas")}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                <FileCheck className="h-6 w-6 text-success" />
              </div>
              <div>
                <h3 className="font-semibold">Mensagens Aprovadas</h3>
                <p className="text-sm text-muted-foreground">
                  Templates disponíveis
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Indicadores de Hoje */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Hoje</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Mensagens Enviadas</p>
                  <h3 className="text-2xl font-bold mt-1">
                    {loading ? "—" : todayStats.sent.toLocaleString()}
                  </h3>
                </div>
                <Send className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Entregues</p>
                  <h3 className="text-2xl font-bold mt-1 text-success">
                    {loading ? "—" : todayStats.delivered.toLocaleString()}
                  </h3>
                </div>
                <CheckCheck className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Falhas</p>
                  <h3 className="text-2xl font-bold mt-1 text-destructive">
                    {loading ? "—" : todayStats.failed}
                  </h3>
                </div>
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Inicio;
