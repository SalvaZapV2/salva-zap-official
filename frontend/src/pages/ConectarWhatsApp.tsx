import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  ExternalLink,
  CheckCircle,
  Shield,
  Users,
  Building2,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useActiveWaba } from "@/hooks/use-active-waba";

const ConectarWhatsApp = () => {
  const navigate = useNavigate();
  const { activeShop, activeWaba } = useActiveWaba();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const startEmbeddedSignup = useMutation({
    mutationFn: async () => {
      if (!activeShop) throw new Error("Crie ou selecione uma empresa primeiro");
      const { url } = await api.getEmbeddedSignupUrl(activeShop.id);
      return url;
    },
    onSuccess: (url) => {
      setIsRedirecting(true);
      window.location.href = url;
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao gerar link",
        description: error?.message || "Tente novamente",
        variant: "destructive",
      });
    },
  });

  const handleConnect = () => {
    startEmbeddedSignup.mutate();
  };

  if (activeWaba) {
    return (
      <div className="p-8 space-y-8 animate-fade-in">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-[#25D366]/20 flex items-center justify-center mx-auto">
            <CheckCircle className="h-10 w-10 text-[#25D366]" />
          </div>
          <h1 className="text-3xl font-bold">WhatsApp Conectado!</h1>
          <p className="text-muted-foreground">
            Sua Conta Oficial do WhatsApp já está conectada. Você pode começar a enviar mensagens.
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => navigate("/status-conexao")}
              variant="outline"
            >
              Ver Status da Conexão
            </Button>
            <Button
              onClick={() => navigate("/")}
              className="bg-[#25D366] hover:bg-[#25D366]/90"
            >
              Ir para o Painel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center mx-auto mb-6">
          <MessageSquare className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Conectar WhatsApp Oficial
        </h1>
        <p className="text-muted-foreground mt-3 text-lg">
          Escolha como deseja conectar sua Conta Oficial do WhatsApp
        </p>
      </div>

      {/* Cards de Opção */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1 - Conexão Individual (Lojista) */}
        <Card className="bg-card border-[#25D366]/30 hover:border-[#25D366]/50 transition-colors">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-[#25D366]/20 flex items-center justify-center mb-4">
              <Building2 className="h-6 w-6 text-[#25D366]" />
            </div>
            <CardTitle className="text-[#25D366]">
              Conectar minha empresa ao WhatsApp Oficial
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              Conecte sua empresa diretamente à API oficial do WhatsApp Business. 
              Ideal para lojistas e empresas individuais.
            </p>

            <div className="bg-muted/30 rounded-lg p-4 text-sm">
              <p>
                Ao clicar em <strong>Conectar Conta Oficial</strong>, você será 
                direcionado à página oficial da Meta. Faça login, selecione sua página 
                e número de WhatsApp e finalize a conexão.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Badge className="bg-[#25D366] h-6 w-6 rounded-full flex items-center justify-center p-0 shrink-0">
                  1
                </Badge>
                <div>
                  <p className="font-medium">Login na Meta</p>
                  <p className="text-sm text-muted-foreground">
                    Use sua conta do Facebook Business
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge className="bg-[#25D366] h-6 w-6 rounded-full flex items-center justify-center p-0 shrink-0">
                  2
                </Badge>
                <div>
                  <p className="font-medium">Selecione sua Página</p>
                  <p className="text-sm text-muted-foreground">
                    Escolha a página associada ao WhatsApp Business
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge className="bg-[#25D366] h-6 w-6 rounded-full flex items-center justify-center p-0 shrink-0">
                  3
                </Badge>
                <div>
                  <p className="font-medium">Confirme o Número</p>
                  <p className="text-sm text-muted-foreground">
                    Verifique e confirme o número de WhatsApp
                  </p>
                </div>
              </div>
            </div>

            <Button
              className="w-full bg-[#25D366] hover:bg-[#25D366]/90 h-12 text-lg"
              onClick={handleConnect}
              disabled={isRedirecting || startEmbeddedSignup.isPending || !activeShop}
            >
              {isRedirecting || startEmbeddedSignup.isPending ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Conectando...
                </>
              ) : (
                <>
                  <ExternalLink className="h-5 w-5 mr-2" />
                  Conectar Conta Oficial
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Card 2 - Conexão Agência */}
        <Card className="bg-card border-[#0EA5E9]/30 hover:border-[#0EA5E9]/50 transition-colors">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-[#0EA5E9]/20 flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-[#0EA5E9]" />
            </div>
            <CardTitle className="text-[#0EA5E9]">
              Sou Agência ou Gestor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              Gerencie diversas empresas de clientes com uma única conta. 
              Perfeito para agências de marketing e gestores de múltiplas contas.
            </p>

            <div className="bg-[#0EA5E9]/5 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[#0EA5E9]" />
                <span className="font-medium text-[#0EA5E9]">Benefícios do Módulo Agência</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-[#0EA5E9]" />
                  Painel centralizado para todas as empresas
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-[#0EA5E9]" />
                  Gerencie conexões de múltiplos clientes
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-[#0EA5E9]" />
                  Métricas consolidadas por empresa
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-[#0EA5E9]" />
                  Faturamento simplificado
                </li>
              </ul>
            </div>

            <Button
              className="w-full bg-[#0EA5E9] hover:bg-[#0EA5E9]/90 h-12 text-lg"
              onClick={() => navigate("/agencia")}
            >
              Ir para Gerenciar Múltiplas Empresas
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Info Footer */}
      <div className="max-w-2xl mx-auto">
        <p className="text-xs text-center text-muted-foreground">
          Você será redirecionado para a página oficial da Meta para completar a conexão. 
          Seus dados estão protegidos conforme as políticas de privacidade da Meta.
        </p>
      </div>
    </div>
  );
};

export default ConectarWhatsApp;
