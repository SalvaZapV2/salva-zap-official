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
  Sparkles,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useActiveWaba } from "@/hooks/use-active-waba";
import type { Template } from "@/lib/types";

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

  const handleCopyName = (name: string) => {
    navigator.clipboard.writeText(name);
    toast({
      title: "Copiado!",
      description: "Nome copiado para a área de transferência",
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
            Gerencie suas mensagens aprovadas pelo WhatsApp para envio em massa
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
                Gerar Template rápido
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="templatePrompt">Conteúdo do corpo</Label>
                <Textarea
                  id="templatePrompt"
                  placeholder="Ex: Olá {{1}}, aqui é da Loja XPTO. Promoção de 20% hoje!"
                  rows={5}
                  value={templatePrompt}
                  onChange={(e) => setTemplatePrompt(e.target.value)}
                  disabled={isGenerating}
                />
                <p className="text-xs text-muted-foreground">
                  Enviaremos este texto como corpo do template (categoria Marketing).
                </p>
              </div>

              <Button
                className="w-full bg-[#25D366] hover:bg-[#25D366]/90"
                onClick={handleGenerateTemplates}
                disabled={isGenerating || !templatePrompt.trim() || !activeWaba}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Enviar para aprovação
                  </>
                )}
              </Button>
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
              <p className="text-sm font-medium">Apenas mensagens aprovadas</p>
              <p className="text-sm text-muted-foreground">
                Mostramos as mensagens aprovadas na Meta. Use-as em campanhas ou envie individualmente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      {templates.length > 0 ? (
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
                  <TableHead>Status</TableHead>
                  <TableHead>Idioma</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {template.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{template.language}</TableCell>
                    <TableCell>
                      {template.createdAt
                        ? new Date(template.createdAt).toLocaleDateString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyName(template.name)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleUseCampaign(template.id)}
                          className="bg-[#25D366] hover:bg-[#25D366]/90"
                          disabled={template.status !== "approved"}
                        >
                          <Megaphone className="h-4 w-4 mr-1" />
                          Usar em Campanha
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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
              Clique em "Criar Mensagem" para enviar um novo template.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MensagensAprovadas;