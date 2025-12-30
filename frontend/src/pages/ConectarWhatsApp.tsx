import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  MessageSquare,
  ExternalLink,
  CheckCircle,
  Shield,
  Users,
  Building2,
  ArrowRight,
  Plus,
  Link as LinkIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useActiveWaba } from "@/hooks/use-active-waba";

const ConectarWhatsApp = () => {
  const navigate = useNavigate();
  const { activeShop, activeWaba } = useActiveWaba();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [connectionType, setConnectionType] = useState<'new' | 'existing'>('new');

  const startEmbeddedSignup = useMutation({
    mutationFn: async () => {
      if (!activeShop) throw new Error("Crie ou selecione uma empresa primeiro");
      const { url } = await api.getEmbeddedSignupUrl(activeShop.id, connectionType);
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

      {/* Connection Type Selection */}
      <div className="max-w-2xl mx-auto">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Como você deseja conectar?</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={connectionType} onValueChange={(value) => setConnectionType(value as 'new' | 'existing')}>
              <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 mb-3 hover:bg-accent cursor-pointer">
                <RadioGroupItem value="new" id="new" className="mt-1" />
                <Label htmlFor="new" className="flex-1 cursor-pointer">
                  <div className="flex items-start gap-3">
                    <Plus className="h-5 w-5 text-[#25D366] mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold">Criar nova Conta WhatsApp Business (WABA)</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Você não tem uma WABA ainda e quer criar uma agora através do Cadastro Incorporado (Embedded Signup) da Meta.
                        A Meta criará automaticamente uma nova conta para você durante o processo.
              </p>
            </div>
                </div>
                </Label>
              </div>
              <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-accent cursor-pointer">
                <RadioGroupItem value="existing" id="existing" className="mt-1" />
                <Label htmlFor="existing" className="flex-1 cursor-pointer">
              <div className="flex items-start gap-3">
                    <LinkIcon className="h-5 w-5 text-[#0EA5E9] mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold">Conectar WABA existente</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Você já tem uma Conta WhatsApp Business (WABA) e quer conectá-la a esta plataforma.
                        <strong className="block mt-2 text-amber-600">
                          Importante: Sua WABA deve estar diretamente acessível à sua conta pessoal do Facebook.
                          Se estiver no Business Manager, certifique-se de ter acesso Admin.
                        </strong>
                  </p>
                </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      </div>

      {/* Connection Button */}
      <div className="max-w-2xl mx-auto">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="space-y-4">
              {connectionType === 'new' ? (
                <div className="space-y-3">
                  <h3 className="font-semibold">O que acontecerá:</h3>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-[#25D366] mt-0.5 shrink-0" />
                      <span>A Meta criará uma nova WABA para você durante o processo</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-[#25D366] mt-0.5 shrink-0" />
                      <span>Você precisará aceitar os termos e condições</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-[#25D366] mt-0.5 shrink-0" />
                      <span>Pode ser necessário verificar um número de telefone</span>
                    </li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="font-semibold">Requisitos:</h3>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-[#0EA5E9] mt-0.5 shrink-0" />
                      <span>Sua WABA deve estar diretamente acessível à sua conta pessoal do Facebook</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-[#0EA5E9] mt-0.5 shrink-0" />
                      <span>Se estiver no Business Manager, você precisa ter acesso Admin</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-[#0EA5E9] mt-0.5 shrink-0" />
                      <span>Você precisará autorizar as permissões necessárias</span>
                    </li>
                  </ul>
              </div>
              )}

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
                    {connectionType === 'new' ? 'Criar e Conectar WABA' : 'Conectar WABA Existente'}
                </>
              )}
            </Button>
            </div>
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
