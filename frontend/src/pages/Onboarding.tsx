import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Circle,
  Link as LinkIcon,
  Phone,
  Webhook,
  Settings as SettingsIcon,
} from "lucide-react";
import { useActiveWaba } from "@/hooks/use-active-waba";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import translations from "@/i18n/pt-BR.json";
import { api } from "@/lib/api";

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const navigate = useNavigate();
  const { shops, activeShop, refetchShops } = useActiveWaba();
  const t = translations.onboarding;

  // Get all WABA accounts from all shops
  const connectedAccounts = shops
    .flatMap((shop) =>
      (shop.waba || []).map((waba) => ({
        id: waba.id,
        name: shop.name,
        waba_id: waba.wabaId,
        phone_numbers: [
          {
            id: waba.phoneId,
            number: waba.displayNumber,
            verified: waba.webhookVerified,
            status: waba.webhookVerified ? "active" : "pending",
          },
        ],
        status: waba.webhookVerified ? "active" : "pending",
      }))
    )
    .filter((account) => account.waba_id);

  // Derived checks
  const hasAny = connectedAccounts.length > 0;
  const hasActive = connectedAccounts.some((acc) => acc.status === 'active');
  const hasVerifiedPhone = connectedAccounts.some((acc) =>
    acc.phone_numbers && acc.phone_numbers.some((p: any) => p.verified),
  );

  // Compute each step's status from actual state (do NOT auto-advance currentStep)
  const steps = [
    {
      id: 1,
      title: t.step1.title,
      description: t.step1.description,
      icon: LinkIcon,
      status: hasAny ? 'completed' : currentStep === 1 ? 'current' : 'pending',
    },
    {
      id: 2,
      title: t.step2.title,
      description: t.step2.description,
      icon: Phone,
      status: hasActive ? 'completed' : currentStep === 2 ? 'current' : 'pending',
    },
    {
      id: 3,
      title: t.step3.title,
      description: t.step3.description,
      icon: Webhook,
      status: hasVerifiedPhone ? 'completed' : currentStep === 3 ? 'current' : 'pending',
    },
    {
      id: 4,
      title: t.step4.title,
      description: t.step4.description,
      icon: SettingsIcon,
      status: currentStep === 4 ? 'current' : 'pending',
    },
  ];

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-muted-foreground mt-1">{t.subtitle}</p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center relative">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                      step.status === "completed"
                        ? "bg-primary text-primary-foreground"
                        : step.status === "current"
                        ? "bg-primary/20 text-primary border-2 border-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step.status === "completed" ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      <step.icon className="h-6 w-6" />
                    )}
                  </div>
                  <div className="mt-3 text-center max-w-[150px]">
                    <p className="text-sm font-semibold">{step.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                  </div>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`h-[2px] flex-1 mx-4 transition-colors ${
                      step.status === "completed" ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Passo {currentStep}: {steps[currentStep - 1].title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{steps[currentStep - 1].description}</p>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">{t.requiredPermissions}</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  whatsapp_business_messaging
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  whatsapp_business_management
                </li>
              </ul>
            </div>
            <Button
              className="w-full bg-gradient-primary hover:opacity-90"
              onClick={() => {
                // handle continue logic
                const hasAny = connectedAccounts.length > 0;
                const hasActive = connectedAccounts.some((acc) => acc.status === 'active');
                const hasVerifiedPhone = connectedAccounts.some((acc) =>
                  acc.phone_numbers && acc.phone_numbers.some((p: any) => p.verified),
                );

                if (currentStep === 1) {
                  if (!hasAny) {
                    toast({ title: 'Nenhuma WABA conectada', description: 'Conecte uma Conta WhatsApp Business para continuar', variant: 'destructive' });
                    navigate('/conectar-whatsapp');
                    return;
                  }
                  // Allow proceeding even without phone numbers
                  setCurrentStep(2);
                  return;
                }

                if (currentStep === 2) {
                  // Allow proceeding even if phone numbers are missing
                  // User can add them later and sync
                  setCurrentStep(3);
                  return;
                }

                if (currentStep === 3) {
                  if (!hasVerifiedPhone) {
                    toast({ title: 'Webhook não verificado', description: 'Registre o webhook e verifique o número para prosseguir', variant: 'destructive' });
                    navigate('/status-conexao');
                    return;
                  }
                  setCurrentStep(4);
                  return;
                }

                if (currentStep === 4) {
                  // Complete onboarding
                  toast({ title: 'Onboarding completo', description: 'Tudo pronto para usar o WABA', });
                  navigate('/');
                }
              }}
            >
              {currentStep < steps.length ? t.continueNextStep : 'Concluir'}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{t.connectedAccounts}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/conectar-whatsapp")}
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                {t.connectNew}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
          {/* Right-side content depends on the current step */}
          {currentStep === 1 && (
            <>
              {connectedAccounts.map((account) => (
                <div
                  key={account.id}
                  className="p-4 bg-muted/30 rounded-lg space-y-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold">{account.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        WABA ID: {account.waba_id}
                      </p>
                    </div>
                    <Badge className="bg-success/20 text-success border-success/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {account.status}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {t.connectedPhoneNumbers}
                    </p>
                    {account.phone_numbers.map((phone) => (
                      <div
                        key={phone.id}
                        className="flex items-center justify-between p-2 bg-background rounded"
                      >
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-primary" />
                          <span className="text-sm">{phone.number}</span>
                          {phone.verified && (
                            <CheckCircle2 className="h-3 w-3 text-success" />
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {phone.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {connectedAccounts.length === 0 && (
                <div className="text-center py-8">
                  <Circle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">{t.noAccounts}</p>
                </div>
              )}
            </>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h4 className="font-semibold">Verificação do Número</h4>
              <p className="text-sm text-muted-foreground">Verifique se o número ligado à sua WABA está ativo e aceitou as permissões.</p>
              <Button variant="outline" onClick={() => navigate('/status-conexao')}>Verificar status</Button>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <h4 className="font-semibold">Configurar Webhook</h4>
              <p className="text-sm text-muted-foreground">Registre a URL do webhook para receber eventos em tempo real (mensagens, status)</p>
              <div className="flex gap-2">
                <Button onClick={async () => {
                  try {
                    if (!activeShop || !activeShop.waba || activeShop.waba.length === 0) {
                      toast({ title: 'Nenhuma WABA selecionada', description: 'Selecione uma loja com WABA para registrar o webhook', variant: 'destructive' });
                      return;
                    }
                    const waba = activeShop.waba[0];
                    await api.registerWebhook(waba.id);
                    toast({ title: 'Webhook registrado', description: 'O webhook foi registrado com sucesso' });
                    // Refresh shops and update UI without full reload
                    const res = await refetchShops();
                    const updatedShops = res?.data || [];
                    // Determine if webhook verification now exists
                    const newAccounts = updatedShops.flatMap((shop: any) => (shop.waba || []).map((waba: any) => ({
                      id: waba.id,
                      phone_verified: waba.webhookVerified,
                      phone_numbers: waba.phoneId ? [{ id: waba.phoneId, verified: waba.webhookVerified }] : [],
                    })));
                    const verified = newAccounts.some((a: any) => a.phone_verified);
                    if (verified) {
                      setCurrentStep(4);
                    } else {
                      // stay on webhook step
                      setCurrentStep(3);
                    }
                  } catch (err: any) {
                    toast({ title: 'Falha ao registrar webhook', description: err?.message || 'Tente novamente', variant: 'destructive' });
                  }
                }}>Registrar Webhook</Button>
                <Button variant="outline" onClick={() => navigate('/status-conexao')}>Ir para status</Button>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <h4 className="font-semibold">Configurações Finais</h4>
              <p className="text-sm text-muted-foreground">Revise suas configurações e finalize o processo.</p>
              <Button onClick={() => { toast({ title: 'Pronto', description: 'Onboarding finalizado' }); navigate('/'); }}>Finalizar</Button>
            </div>
          )}
        </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;
