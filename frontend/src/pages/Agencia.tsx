import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users,
  Building2,
  Plus,
  ExternalLink,
  CheckCircle,
  Clock,
  Phone,
  Activity,
} from "lucide-react";
import { useActiveWaba } from "@/hooks/use-active-waba";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// Component to fetch and display stats for a single shop
const ShopStats = ({ wabaId }: { wabaId: string }) => {
  const { data: dashboard } = useQuery({
    queryKey: ["dashboard", wabaId],
    queryFn: () => api.getDashboardStats(wabaId),
    enabled: !!wabaId,
  });

  return <>{dashboard?.messages_sent_24h || 0}</>;
};

const Agencia = () => {
  const { shops, selectShop, refetchShops } = useActiveWaba();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newShopName, setNewShopName] = useState("");

  const createShopMutation = useMutation({
    mutationFn: async (name: string) => {
      return api.createShop(name);
    },
    onSuccess: (newShop) => {
      toast.success("Empresa criada com sucesso!");
      setIsCreateDialogOpen(false);
      setNewShopName("");
      queryClient.invalidateQueries({ queryKey: ["shops"] });
      refetchShops();
      // Optionally select the new shop
      if (newShop) {
        selectShop(newShop.id);
      }
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erro ao criar empresa");
    },
  });

  const handleCreateShop = () => {
    if (!newShopName.trim()) {
      toast.error("Digite um nome para a empresa");
      return;
    }
    createShopMutation.mutate(newShopName.trim());
  };

  const handleManageShop = (shopId: string) => {
    selectShop(shopId);
    navigate("/");
  };

  const empresas = shops.map((shop) => {
    const waba = shop.waba?.[0];
    return {
      id: shop.id,
      nome: shop.name,
      status: waba ? "connected" : "pending",
      wabaId: waba?.id || null,
      numero: waba?.displayNumber || null,
      ultimaAtividade: waba
        ? `Conectado${waba.updatedAt ? ` - ${new Date(waba.updatedAt).toLocaleDateString("pt-BR")}` : ""}`
        : "Aguardando conexão",
    };
  });

  const stats = {
    connected: empresas.filter((e) => e.status === "connected").length,
    pending: empresas.filter((e) => e.status === "pending").length,
    total: empresas.length,
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header com visual azul destacado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#0EA5E9] to-[#0284C7] flex items-center justify-center shadow-lg shadow-[#0EA5E9]/25">
            <Users className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0EA5E9]">
              Módulo Agência
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie múltiplas empresas de clientes em um só lugar
            </p>
          </div>
        </div>
        <Button 
          className="bg-[#0EA5E9] hover:bg-[#0284C7] shadow-lg shadow-[#0EA5E9]/25"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Empresa
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-[#0EA5E9]/10 to-transparent border-[#0EA5E9]/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Empresas Conectadas</p>
                <h3 className="text-3xl font-bold mt-2 text-[#0EA5E9]">
                  {stats.connected}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-full bg-[#0EA5E9]/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-[#0EA5E9]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-warning/10 to-transparent border-warning/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Aguardando Conexão</p>
                <h3 className="text-3xl font-bold mt-2 text-warning">
                  {stats.pending}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#0EA5E9]/10 to-transparent border-[#0EA5E9]/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Empresas</p>
                <h3 className="text-3xl font-bold mt-2">
                  {stats.total}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-full bg-[#0EA5E9]/20 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-[#0EA5E9]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Empresas */}
      <Card className="bg-card border-[#0EA5E9]/20">
        <CardHeader className="border-b border-[#0EA5E9]/10">
          <CardTitle className="flex items-center gap-2 text-[#0EA5E9]">
            <Building2 className="h-5 w-5" />
            Empresas Gerenciadas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {empresas.map((empresa) => (
              <div
                key={empresa.id}
                className="flex items-center justify-between p-6 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#0EA5E9]/20 to-[#0EA5E9]/5 flex items-center justify-center border border-[#0EA5E9]/20">
                    <Building2 className="h-7 w-7 text-[#0EA5E9]" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-lg">{empresa.nome}</h4>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {empresa.numero ? (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          {empresa.numero}
                        </span>
                      ) : (
                        <span className="text-warning">Sem número conectado</span>
                      )}
                      {empresa.status === "connected" && empresa.wabaId && (
                        <span className="flex items-center gap-1">
                          <Activity className="h-3.5 w-3.5" />
                          <ShopStats wabaId={empresa.wabaId} /> mensagens hoje
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {empresa.ultimaAtividade}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge
                    className={
                      empresa.status === "connected"
                        ? "bg-[#0EA5E9]/20 text-[#0EA5E9] border-[#0EA5E9]/30 font-medium"
                        : "bg-warning/20 text-warning border-warning/30 font-medium"
                    }
                  >
                    {empresa.status === "connected" ? "Conectado" : "Pendente"}
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-[#0EA5E9]/30 text-[#0EA5E9] hover:bg-[#0EA5E9]/10 hover:border-[#0EA5E9]/50"
                    onClick={() => handleManageShop(empresa.id)}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Gerenciar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-[#0EA5E9]/10 via-[#0EA5E9]/5 to-transparent border-[#0EA5E9]/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#0EA5E9]/20 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-[#0EA5E9]" />
            </div>
            <div>
              <p className="font-semibold text-[#0EA5E9]">Módulo Agência</p>
              <p className="text-sm text-muted-foreground mt-1">
                Gerencie todas as Contas Oficiais do WhatsApp dos seus clientes a partir de um único painel.
                Adicione novas empresas, monitore conexões e acompanhe a atividade de cada conta.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Shop Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Nova Empresa</DialogTitle>
            <DialogDescription>
              Crie uma nova empresa para gerenciar suas contas WhatsApp Business.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="shop-name">Nome da Empresa</Label>
              <Input
                id="shop-name"
                placeholder="Ex: Minha Empresa Ltda"
                value={newShopName}
                onChange={(e) => setNewShopName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateShop();
                  }
                }}
                disabled={createShopMutation.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setNewShopName("");
              }}
              disabled={createShopMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateShop}
              disabled={createShopMutation.isPending || !newShopName.trim()}
              className="bg-[#0EA5E9] hover:bg-[#0284C7]"
            >
              {createShopMutation.isPending ? "Criando..." : "Criar Empresa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Agencia;
