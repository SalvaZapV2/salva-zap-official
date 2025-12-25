import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Wifi,
  WifiOff,
  Phone,
  Building2,
  Clock,
  RefreshCw,
  Unplug,
  Shield,
  TrendingUp,
  BadgeCheck,
  Smartphone,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useActiveWaba } from "@/hooks/use-active-waba";
import { api } from "@/lib/api";

const StatusConexao = () => {
  const { activeWaba, refetchShops } = useActiveWaba();

  const {
    data: dashboard,
    isLoading: statsLoading,
  } = useQuery({
    queryKey: ["dashboard", activeWaba?.id],
    queryFn: () => api.getDashboardStats(activeWaba!.id),
    enabled: !!activeWaba?.id,
  });

  const connectionData = activeWaba
    ? {
    connected: true,
        wabaId: activeWaba.wabaId,
        phoneNumberId: activeWaba.phoneId,
        phoneNumber: activeWaba.displayNumber,
        displayName: activeWaba.displayNumber,
        status: activeWaba.webhookVerified ? "active" : "pending",
        lastSync: activeWaba.updatedAt ? new Date(activeWaba.updatedAt).toLocaleString("pt-BR") : "—",
        businessVerified: activeWaba.webhookVerified,
    accountType: "Business",
      }
    : {
        connected: false,
        wabaId: "—",
        phoneNumberId: "—",
        phoneNumber: "—",
        displayName: "—",
        status: "disconnected",
        lastSync: "—",
        businessVerified: false,
        accountType: "—",
  };

  // Calculate quality rating from dashboard stats
  const qualityData = useMemo(() => {
    if (!connectionData.connected || !dashboard) {
      return {
        rating: 0,
        status: "red" as "green" | "yellow" | "red",
      };
    }

    // Quality rating is based on delivery rate and read rate
    // Average of both rates, weighted: 60% delivery, 40% read
    const deliveryWeight = 0.6;
    const readWeight = 0.4;
    const baseRating = (dashboard.delivery_rate || 0) * deliveryWeight + (dashboard.read_rate || 0) * readWeight;
    const rating = Math.max(0, Math.min(100, Math.round(baseRating)));

    let status: "green" | "yellow" | "red";
    if (rating >= 80) {
      status = "green";
    } else if (rating >= 40) {
      status = "yellow";
    } else {
      status = "red";
    }

    return { rating, status };
  }, [connectionData.connected, dashboard]);

  // Calculate tier based on messages sent
  const tierData = useMemo(() => {
    if (!connectionData.connected) {
      return {
        current: "Offline",
        currentLimit: 0,
        nextTier: "Conectar",
        nextTierLimit: 50,
        progress: 0,
      };
    }

    const messagesSent = dashboard?.messages_sent_24h || 0;
    
    // Tier thresholds: 50, 250, 1k, 10k, 100k
    const tiers = [
      { name: "Inicial", limit: 50 },
      { name: "Básico", limit: 250 },
      { name: "Intermediário", limit: 1000 },
      { name: "Avançado", limit: 10000 },
      { name: "Enterprise", limit: 100000 },
    ];

    let currentTier = tiers[0];
    let nextTier = tiers[1];
    let progress = 0;

    for (let i = 0; i < tiers.length; i++) {
      if (messagesSent < tiers[i].limit) {
        currentTier = i > 0 ? tiers[i - 1] : tiers[0];
        nextTier = tiers[i];
        const currentLimit = currentTier.limit;
        const nextLimit = nextTier.limit;
        const range = nextLimit - currentLimit;
        const progressInRange = messagesSent - currentLimit;
        progress = Math.max(0, Math.min(100, Math.round((progressInRange / range) * 100)));
        break;
      }
      if (i === tiers.length - 1) {
        // At max tier
        currentTier = tiers[i];
        nextTier = tiers[i];
        progress = 100;
      }
    }

    return {
      current: currentTier.name,
      currentLimit: currentTier.limit,
      nextTier: nextTier.name,
      nextTierLimit: nextTier.limit,
      progress,
    };
  }, [connectionData.connected, dashboard]);

  const getQualityColor = (status: string) => {
    switch (status) {
      case "green":
        return { bg: "bg-success/20", text: "text-success", label: "Verde" };
      case "yellow":
        return { bg: "bg-warning/20", text: "text-warning", label: "Amarelo" };
      case "red":
        return { bg: "bg-destructive/20", text: "text-destructive", label: "Vermelho" };
      default:
        return { bg: "bg-muted/20", text: "text-muted-foreground", label: "Desconhecido" };
    }
  };

  const getQualityMessage = (status: string) => {
    switch (status) {
      case "green":
        return "Sua conta está com excelente reputação.";
      case "yellow":
        return "Atenção: risco moderado, evite marketing agressivo.";
      case "red":
        return "Sua conta está em risco de bloqueio temporário.";
      default:
        return "";
    }
  };

  const quality = getQualityColor(qualityData.status);

  const handleReconnect = async () => {
    if (!activeWaba) {
      toast({ title: "Nenhuma WABA selecionada", description: "Selecione uma loja com WABA para reconectar", variant: "destructive" });
      return;
    }

    toast({ title: "Reconectando...", description: "Tentando atualizar token com a Meta" });

    try {
      const res = await api.refreshWabaToken(activeWaba.id);
      toast({ title: "Token atualizado", description: res.tokenExpiresAt ? `Expira em ${new Date(res.tokenExpiresAt).toLocaleString()}` : "Token atualizado" });
      // Refresh shops/WABA data
      await refetchShops();
    } catch (err: any) {
      toast({ title: "Falha ao reconectar", description: err?.message || "Tente novamente mais tarde", variant: "destructive" });
    }
  };

  const handleDisconnect = () => {
    toast({
      title: "Funcionalidade em desenvolvimento",
      description: "Desconexão será habilitada em breve",
      variant: "destructive",
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Status da Conexão</h1>
        <p className="text-muted-foreground mt-1">
          Informações da sua Conta Oficial do WhatsApp (WABA)
        </p>
      </div>

      {/* Card 1 - Status da Conexão */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              {connectionData.connected ? (
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#25D366]/20 flex items-center justify-center shrink-0">
                  <Wifi className="h-6 w-6 sm:h-8 sm:w-8 text-[#25D366]" />
                </div>
              ) : (
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                  <WifiOff className="h-6 w-6 sm:h-8 sm:w-8 text-destructive" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <h2 className="text-xl sm:text-2xl font-bold truncate">WhatsApp Business API</h2>
                  <Badge
                    className={
                      connectionData.connected
                        ? "bg-[#25D366] hover:bg-[#25D366] shrink-0"
                        : "bg-destructive shrink-0"
                    }
                  >
                    {connectionData.connected ? "Conectado" : "Desconectado"}
                  </Badge>
                </div>
                <p className="text-base sm:text-lg text-muted-foreground mt-1 truncate">
                  {connectionData.phoneNumber}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Última sincronização: {statsLoading ? "Carregando..." : connectionData.lastSync}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <Button variant="outline" onClick={handleReconnect} className="w-full sm:w-auto">
                <RefreshCw className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Reconectar WhatsApp Oficial</span>
                <span className="sm:hidden">Reconectar</span>
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive w-full sm:w-auto"
                onClick={handleDisconnect}
              >
                <Unplug className="h-4 w-4 mr-2" />
                Desconectar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 2 - Qualidade da Conta */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Shield className={`h-4 w-4 sm:h-5 sm:w-5 ${quality.text} shrink-0`} />
              <span className="truncate">Qualidade da Conta (Quality Rating)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${quality.bg} flex items-center justify-center shrink-0`}>
                  <span className={`text-lg sm:text-xl font-bold ${quality.text}`}>
                    {statsLoading ? "—" : `${qualityData.rating}%`}
                  </span>
                </div>
                <div>
                  <Badge className={`${quality.bg} ${quality.text} border-0`}>
                    {quality.label}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pontuação</span>
                <span className={`font-medium ${quality.text}`}>
                  {statsLoading ? "—" : `${qualityData.rating}%`}
                </span>
              </div>
              <Progress value={statsLoading ? 0 : qualityData.rating} className={quality.bg} />
              <p className="text-sm text-muted-foreground">
                {statsLoading ? "Carregando dados..." : getQualityMessage(qualityData.status)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 3 - Capacidade de Envio (Tier) */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
              <span className="truncate">Capacidade de Envio (Tier)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  {statsLoading ? (
                    <span className="text-lg sm:text-xl font-bold text-primary">—</span>
                  ) : tierData.current === "Offline" ? (
                    <WifiOff className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  ) : (
                    <span className="text-xs sm:text-sm font-bold text-primary leading-tight text-center px-1">
                      {tierData.current}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm sm:text-base">Tier Atual</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {statsLoading ? "—" : `${tierData.currentLimit.toLocaleString()} mensagens/dia`}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progresso para {tierData.nextTier}</span>
                <span className="font-medium">{statsLoading ? "—" : `${tierData.progress}%`}</span>
              </div>
              <Progress value={statsLoading ? 0 : tierData.progress} />
              <p className="text-sm text-muted-foreground">
                {statsLoading ? "Carregando..." : `Próximo tier: ${tierData.nextTier} (${tierData.nextTierLimit.toLocaleString()} mensagens/dia)`}
              </p>
            </div>
            <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
              <p><strong>Tiers disponíveis:</strong> 50 → 250 → 1k → 10k → 100k mensagens/dia</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card 4 - Detalhes da Conta */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
            Detalhes da Conta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                WABA ID
              </div>
              <p className="font-mono text-lg">{connectionData.wabaId}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Smartphone className="h-4 w-4" />
                Phone Number ID
              </div>
              <p className="font-mono text-lg">{connectionData.phoneNumberId}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                Nome Exibido
              </div>
              <p className="text-lg font-medium">{connectionData.displayName}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BadgeCheck className="h-4 w-4" />
                Verificação do Business
              </div>
              <Badge
                className={
                  connectionData.businessVerified
                    ? "bg-success/20 text-success border-0"
                    : "bg-warning/20 text-warning border-0"
                }
              >
                {connectionData.businessVerified ? "Verificado" : "Pendente"}
              </Badge>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                Tipo da Conta
              </div>
              <p className="text-lg font-medium">{connectionData.accountType}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Última Sincronização
              </div>
              <p className="text-lg">{connectionData.lastSync}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informação Adicional */}
      <Card className="bg-muted/30 border-border">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Wifi className="h-5 w-5 text-[#25D366] mt-0.5" />
            <div>
              <p className="text-sm font-medium">Conexão Ativa</p>
              <p className="text-sm text-muted-foreground">
                {connectionData.connected
                  ? "Sua Conta Oficial do WhatsApp está conectada e pronta para enviar e receber mensagens."
                  : "Conecte sua conta para ativar o envio e recebimento de mensagens."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatusConexao;
