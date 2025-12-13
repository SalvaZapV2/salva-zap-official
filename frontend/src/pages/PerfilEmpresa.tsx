import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Link as LinkIcon,
  Clock,
  Save,
  Instagram,
  Globe,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useActiveWaba } from "@/hooks/use-active-waba";
import { api } from "@/lib/api";

const NICHOS = [
  { value: "restaurante", label: "Restaurantes/Delivery" },
  { value: "pizzaria", label: "Pizzaria" },
  { value: "hamburgueria", label: "Hamburgueria" },
  { value: "sorveteria", label: "Sorveteria/Açaí" },
  { value: "supermercado", label: "Supermercado" },
  { value: "lanchonete", label: "Lanchonete" },
  { value: "moda", label: "Moda" },
  { value: "beleza", label: "Beleza/Cosméticos" },
  { value: "salao", label: "Salão/Barbearia" },
  { value: "farmacia", label: "Farmácia" },
  { value: "petshop", label: "Petshop" },
  { value: "servicos", label: "Serviços" },
  { value: "outro", label: "Outro" },
];

const DIAS_SEMANA = [
  { key: "segunda", label: "Segunda-feira" },
  { key: "terca", label: "Terça-feira" },
  { key: "quarta", label: "Quarta-feira" },
  { key: "quinta", label: "Quinta-feira" },
  { key: "sexta", label: "Sexta-feira" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" },
];

interface HorariosDia {
  aberto: boolean;
  horario1Inicio: string;
  horario1Fim: string;
  horario2Inicio: string;
  horario2Fim: string;
}

type HorariosType = {
  [key: string]: HorariosDia;
};

const PerfilEmpresa = () => {
  const { user } = useAuth();
  const { activeShop } = useActiveWaba();
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    nicho: "outro",
    nichoOutro: "",
    linkPrincipal: "",
    linkSecundario: "",
    instagram: "",
  });

  const [horarios, setHorarios] = useState<HorariosType>({
    segunda: { aberto: true, horario1Inicio: "08:00", horario1Fim: "12:00", horario2Inicio: "14:00", horario2Fim: "18:00" },
    terca: { aberto: true, horario1Inicio: "08:00", horario1Fim: "12:00", horario2Inicio: "14:00", horario2Fim: "18:00" },
    quarta: { aberto: true, horario1Inicio: "08:00", horario1Fim: "12:00", horario2Inicio: "14:00", horario2Fim: "18:00" },
    quinta: { aberto: true, horario1Inicio: "08:00", horario1Fim: "12:00", horario2Inicio: "14:00", horario2Fim: "18:00" },
    sexta: { aberto: true, horario1Inicio: "08:00", horario1Fim: "12:00", horario2Inicio: "14:00", horario2Fim: "18:00" },
    sabado: { aberto: true, horario1Inicio: "09:00", horario1Fim: "13:00", horario2Inicio: "", horario2Fim: "" },
    domingo: { aberto: false, horario1Inicio: "", horario1Fim: "", horario2Inicio: "", horario2Fim: "" },
  });

  useEffect(() => {
    if (activeShop) {
      setFormData((prev) => ({ ...prev, nome: activeShop.name || "" }));
    }
    if (user?.email) {
      setFormData((prev) => ({ ...prev, email: user.email || "" }));
    }
  }, [activeShop, user]);

  const updateHorario = (dia: string, field: keyof HorariosDia, value: string | boolean) => {
    setHorarios((prev) => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    try {
      if (activeShop && formData.nome) {
        await api.updateShop(activeShop.id, formData.nome);
      }
      if (user?.email && formData.email && formData.email !== user.email) {
        await api.updateUserEmail(formData.email);
      }
    toast({
      title: "Perfil salvo!",
      description: "As informações da empresa foram atualizadas",
    });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error?.message || "Tente novamente",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Perfil da Empresa</h1>
          <p className="text-muted-foreground mt-1">
            Configure as informações da sua empresa
          </p>
        </div>
        <Button onClick={handleSave} className="bg-[#25D366] hover:bg-[#25D366]/90">
          <Save className="h-4 w-4 mr-2" />
          Salvar Alterações
        </Button>
      </div>

      {/* Bloco A - Informações da Empresa */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Informações da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome">Nome da Empresa</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="email">E-mail de Contato</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="telefone">Telefone/WhatsApp (opcional)</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bloco B - Segmento/Nicho */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Segmento / Nicho
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="nicho">Qual o segmento da sua empresa?</Label>
            <Select
              value={formData.nicho}
              onValueChange={(value) => setFormData({ ...formData, nicho: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o segmento" />
              </SelectTrigger>
              <SelectContent>
                {NICHOS.map((nicho) => (
                  <SelectItem key={nicho.value} value={nicho.value}>
                    {nicho.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.nicho === "outro" && (
            <div>
              <Label htmlFor="nichoOutro">Especifique o segmento</Label>
              <Input
                id="nichoOutro"
                placeholder="Descreva seu segmento"
                value={formData.nichoOutro}
                onChange={(e) => setFormData({ ...formData, nichoOutro: e.target.value })}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bloco C - Links da Empresa */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-primary" />
            Links da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="linkPrincipal" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Link do Cardápio/Loja (Principal)
            </Label>
            <Input
              id="linkPrincipal"
              placeholder="https://..."
              value={formData.linkPrincipal}
              onChange={(e) => setFormData({ ...formData, linkPrincipal: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Este link será usado como padrão nas campanhas
            </p>
          </div>

          <div>
            <Label htmlFor="linkSecundario" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Link do Cardápio/Loja (Secundário)
            </Label>
            <Input
              id="linkSecundario"
              placeholder="https://..."
              value={formData.linkSecundario}
              onChange={(e) => setFormData({ ...formData, linkSecundario: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="instagram" className="flex items-center gap-2">
              <Instagram className="h-4 w-4" />
              Instagram
            </Label>
            <Input
              id="instagram"
              placeholder="@suaempresa"
              value={formData.instagram}
              onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bloco D - Horários de Funcionamento */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Horários de Funcionamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {DIAS_SEMANA.map((dia) => (
              <div
                key={dia.key}
                className={`p-4 rounded-lg border transition-colors ${
                  horarios[dia.key].aberto
                    ? "border-border bg-card"
                    : "border-border/50 bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">{dia.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {horarios[dia.key].aberto ? "Aberto" : "Fechado"}
                    </span>
                    <Switch
                      checked={horarios[dia.key].aberto}
                      onCheckedChange={(checked) => updateHorario(dia.key, "aberto", checked)}
                    />
                  </div>
                </div>

                {horarios[dia.key].aberto && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Horário 1</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={horarios[dia.key].horario1Inicio}
                          onChange={(e) => updateHorario(dia.key, "horario1Inicio", e.target.value)}
                          className="w-full"
                        />
                        <span className="text-muted-foreground">às</span>
                        <Input
                          type="time"
                          value={horarios[dia.key].horario1Fim}
                          onChange={(e) => updateHorario(dia.key, "horario1Fim", e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Horário 2 (opcional)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={horarios[dia.key].horario2Inicio}
                          onChange={(e) => updateHorario(dia.key, "horario2Inicio", e.target.value)}
                          className="w-full"
                        />
                        <span className="text-muted-foreground">às</span>
                        <Input
                          type="time"
                          value={horarios[dia.key].horario2Fim}
                          onChange={(e) => updateHorario(dia.key, "horario2Fim", e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Footer Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} className="bg-[#25D366] hover:bg-[#25D366]/90" size="lg">
          <Save className="h-4 w-4 mr-2" />
          Salvar Todas as Alterações
        </Button>
      </div>
    </div>
  );
};

export default PerfilEmpresa;
