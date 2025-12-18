import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileCheck,
  Megaphone,
  Copy,
  CheckCircle,
  Plus,
  DollarSign,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useActiveWaba } from "@/hooks/use-active-waba";
import type { Template, TemplateCategory } from "@/lib/types";

const MensagensAprovadas = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeWaba } = useActiveWaba();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [templatePrompt, setTemplatePrompt] = useState("");

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["templates", activeWaba?.id],
    queryFn: () => api.getTemplates(activeWaba!.id),
    enabled: !!activeWaba?.id,
  });

  // Filter only approved templates
  const approvedTemplates = templates.filter((t) => t.status === "approved");

  // Helper functions to extract data from history
  const getCategory = (template: Template): TemplateCategory => {
    const history = template.history as any;
    if (history?.category) return history.category;
    if (history?.metaResponse?.category) return history.metaResponse.category;
    return "UTILITY"; // default
  };

  const getContentPreview = (template: Template): string => {
    const history = template.history as any;
    if (history?.components) {
      const bodyComponent = history.components.find((c: any) => c.type === "BODY");
      if (bodyComponent?.text) return bodyComponent.text;
    }
    if (history?.metaResponse?.components) {
      const bodyComponent = history.metaResponse.components.find((c: any) => c.type === "BODY");
      if (bodyComponent?.text) return bodyComponent.text;
    }
    return "—";
  };

  const getApprovedAt = (template: Template): string => {
    const history = template.history as any;
    if (history?.approved) {
      return new Date(history.approved).toLocaleDateString("pt-BR");
    }
    if (template.updatedAt && template.status === "approved") {
      return new Date(template.updatedAt).toLocaleDateString("pt-BR");
    }
    return "—";
  };

  const getPrice = (category: TemplateCategory): number => {
    // WhatsApp pricing per message (in USD)
    switch (category) {
      case "MARKETING":
        return 0.0358;
      case "UTILITY":
        return 0.03;
      case "AUTHENTICATION":
        return 0.025;
      default:
        return 0.03;
    }
  };

  const getCategoryLabel = (category: TemplateCategory): string => {
    switch (category) {
      case "MARKETING":
        return "Marketing";
      case "UTILITY":
        return "Utilidade";
      case "AUTHENTICATION":
        return "Autenticação";
      default:
        return category;
    }
  };

  const getCategoryColor = (category: TemplateCategory): string => {
    switch (category) {
      case "MARKETING":
        return "bg-primary/20 text-primary border-primary/30";
      case "UTILITY":
        return "bg-info/20 text-info border-info/30";
      case "AUTHENTICATION":
        return "bg-warning/20 text-warning border-warning/30";
      default:
        return "bg-muted/20 text-muted-foreground";
    }
  };

  const submitTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!activeWaba) throw new Error("Nenhuma conta WABA conectada");

      const name = `auto_template_${Date.now()}`;
      const payload = {
        name,
        language: "pt_BR",
        category: "MARKETING",
        components: [
          {
            type: "BODY",
            text: templatePrompt,
          },
        ],
      };

      return api.submitTemplate(activeWaba.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates", activeWaba?.id] });
      setIsGenerating(false);
      setIsModalOpen(false);
      setTemplatePrompt("");
      toast({
        title: "Template enviado",
        description: "Template enviado para aprovação na Meta",
      });
    },
    onError: (error: any) => {
      setIsGenerating(false);
      toast({
        title: "Erro ao enviar template",
        description: error?.message || "Tente novamente",
        variant: "destructive",
      });
    },
  });

  const handleCopyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copiado!",
      description: "Conteúdo copiado para a área de transferência",
    });
  };

  const handleUseCampaign = (templateId: string) => {
    navigate(`/campanhas/nova?template=${templateId}`);
  };

  const handleGenerateTemplates = () => {
    if (!templatePrompt.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Descreva o que você deseja comunicar",
        variant: "destructive",
      });
      return;
    }
    setIsGenerating(true);
    submitTemplateMutation.mutate();
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mensagens Aprovadas</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas Mensagens Aprovadas pelo WhatsApp para envio em massa
          </p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#25D366] hover:bg-[#25D366]/90">
              <Plus className="h-4 w-4 mr-2" />
              Criar Mensagem
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Gerar Templates com IA
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Campo único de intenção */}
              <div className="space-y-2">
                <Label htmlFor="templatePrompt">Descreva o que você deseja comunicar</Label>
                <Textarea
                  id="templatePrompt"
                  placeholder="Ex: Quero avisar meus clientes sobre uma promoção de 20% em pizzas neste fim de semana..."
                  rows={5}
                  value={templatePrompt}
                  onChange={(e) => setTemplatePrompt(e.target.value)}
                  disabled={isGenerating}
                />
                <p className="text-xs text-muted-foreground">
                  A IA irá gerar 10 variações de templates e enviar automaticamente para aprovação da Meta
                </p>
              </div>

              {/* Botão de Gerar */}
              <Button
                className="w-full bg-[#25D366] hover:bg-[#25D366]/90"
                onClick={handleGenerateTemplates}
                disabled={isGenerating || !templatePrompt.trim() || !activeWaba}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando templates...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Gerar Templates
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Os templates serão automaticamente classificados e enviados para aprovação
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Card */}
      <Card className="bg-muted/30 border-border">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-success mt-0.5" />
            <div>
              <p className="text-sm font-medium">Apenas Mensagens Aprovadas pela Meta</p>
              <p className="text-sm text-muted-foreground">
                Esta lista exibe somente as mensagens que foram aprovadas oficialmente. 
                Templates rejeitados ou pendentes não aparecem aqui.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      {approvedTemplates.length > 0 ? (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-success" />
              Mensagens Disponíveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Aprovado em</TableHead>
                  <TableHead>Preview</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedTemplates.map((template) => {
                  const category = getCategory(template);
                  const content = getContentPreview(template);
                  const approvedAt = getApprovedAt(template);
                  const price = getPrice(category);
                  
                  return (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>
                        <Badge className={getCategoryColor(category)}>
                          {getCategoryLabel(category)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span>{price.toFixed(4)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{approvedAt}</TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="text-sm text-muted-foreground truncate">
                          {content}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyContent(content)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleUseCampaign(template.id)}
                            className="bg-[#25D366] hover:bg-[#25D366]/90"
                          >
                            <Megaphone className="h-4 w-4 mr-1" />
                            Usar em Campanha
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <FileCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Nenhuma mensagem aprovada
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Você ainda não possui mensagens aprovadas pela Meta. 
              Clique em "Criar Mensagem" para gerar templates com IA.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MensagensAprovadas;