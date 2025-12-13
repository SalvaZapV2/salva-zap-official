import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Send,
  Calendar,
  DollarSign,
  Users,
  Clock,
  AlertCircle,
  Upload,
  FileSpreadsheet,
  X,
  Plus,
  Pencil,
  Trash2,
  Download,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useActiveWaba } from "@/hooks/use-active-waba";
import type { Template, CampaignCost } from "@/lib/types";

interface ContactList {
  id: string;
  name: string;
  numbers: string[];
  lastUpdate: string;
}

const NovaCampanha = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preSelectedTemplate = searchParams.get("template");
  const { activeWaba } = useActiveWaba();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    templateId: preSelectedTemplate || "",
    contacts: "",
    selectedListId: "",
    speed: "moderate",
    storeLink: "https://minhaloja.com.br/cardapio",
    scheduleType: "now",
    scheduleDate: "",
  });

  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [isCreateListModalOpen, setIsCreateListModalOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListContacts, setNewListContacts] = useState("");
  const [newListFile, setNewListFile] = useState<File | null>(null);

  // Mock contact lists
  const [contactLists, setContactLists] = useState<ContactList[]>([
    {
      id: "1",
      name: "Clientes VIP",
      numbers: ["5511999999999", "5511888888888", "5511777777777"],
      lastUpdate: "10/12/2024",
    },
    {
      id: "2",
      name: "Leads de Instagram",
      numbers: ["5511666666666", "5511555555555"],
      lastUpdate: "08/12/2024",
    },
  ]);

  // Mock templates
  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["templates", activeWaba?.id],
    queryFn: () => api.getTemplates(activeWaba!.id),
    enabled: !!activeWaba?.id,
  });

  const selectedTemplate = templates.find((t) => t.id === formData.templateId);
  const selectedList = contactLists.find((l) => l.id === formData.selectedListId);

  // Calcular contatos (da lista selecionada + manuais)
  const manualContactCount = formData.contacts
    .split("\n")
    .filter((line) => line.trim()).length;
  const listContactCount = selectedList?.numbers.length || 0;
  const contactCount = listContactCount + manualContactCount;
  const [cost, setCost] = useState<CampaignCost | null>(null);

  useEffect(() => {
    const fetchCost = async () => {
      if (!contactCount || !activeWaba) {
        setCost(null);
        return;
      }
      try {
        const pricing = await api.getCampaignCost(
          formData.templateId || null,
          contactCount
        );
        setCost(pricing);
      } catch (error) {
        setCost(null);
      }
    };
    fetchCost();
  }, [contactCount, formData.templateId, activeWaba]);

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      if (!activeWaba) throw new Error("Conecte uma conta WABA");
      const contacts = [
        ...(selectedList?.numbers || []),
        ...formData.contacts
          .split("\n")
          .map((c) => c.trim())
          .filter(Boolean),
      ];
      if (!contacts.length) {
        throw new Error("Adicione pelo menos um contato");
      }
      const sanitized = Array.from(
        new Set(contacts.map((c) => c.replace(/\D/g, "")).filter((c) => c.length >= 10))
      );
      if (!sanitized.length) {
        throw new Error("Nenhum número válido encontrado");
      }
      return api.createCampaign(activeWaba.id, formData.templateId || null, sanitized);
    },
    onSuccess: () => {
      toast({
        title: "Campanha criada",
        description: "Sua campanha foi enviada para processamento",
      });
      queryClient.invalidateQueries({ queryKey: ["campaigns", activeWaba?.id] });
      navigate("/campanhas");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar campanha",
        description: error?.message || "Tente novamente",
        variant: "destructive",
      });
    },
  });

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validExtensions = [".csv", ".xlsx", ".xls"];
      const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      
      if (!validExtensions.includes(extension)) {
        toast({
          title: "Formato inválido",
          description: "Use arquivos CSV ou XLSX",
          variant: "destructive",
        });
        return;
      }

      setImportedFile(file);
      const mockContacts = "5511999999999\n5511888888888\n5511777777777\n5511666666666\n5511555555555";
      setFormData({ ...formData, contacts: mockContacts });
      
      toast({
        title: "Arquivo importado",
        description: `${file.name} - 5 contatos encontrados`,
      });
    }
  };

  const handleRemoveFile = () => {
    setImportedFile(null);
    setFormData({ ...formData, contacts: "" });
  };

  const handleListSelect = (listId: string) => {
    setFormData({ ...formData, selectedListId: listId });
    if (listId) {
      const list = contactLists.find(l => l.id === listId);
      toast({
        title: "Lista selecionada",
        description: `${list?.name} - ${list?.numbers.length || 0} contatos`,
      });
    }
  };

  const handleCreateListFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewListFile(file);
      // Mock: simula leitura do arquivo
      setNewListContacts("5511999999999\n5511888888888\n5511777777777");
    }
  };

  const handleCreateList = () => {
    if (!newListName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe um nome para a lista",
        variant: "destructive",
      });
      return;
    }

    const contacts = newListContacts.split("\n").filter(c => c.trim());
    if (contacts.length === 0) {
      toast({
        title: "Contatos obrigatórios",
        description: "Adicione pelo menos um contato à lista",
        variant: "destructive",
      });
      return;
    }

    // Remove duplicados e valida formato
    const uniqueContacts = [...new Set(contacts.map(c => c.trim().replace(/\D/g, "")))];
    const validContacts = uniqueContacts.filter(c => c.length >= 10 && c.length <= 15);

    const newList: ContactList = {
      id: String(contactLists.length + 1),
      name: newListName,
      numbers: validContacts,
      lastUpdate: new Date().toLocaleDateString("pt-BR"),
    };

    setContactLists([...contactLists, newList]);
    setIsCreateListModalOpen(false);
    setNewListName("");
    setNewListContacts("");
    setNewListFile(null);

    toast({
      title: "Lista criada",
      description: `${newList.name} com ${validContacts.length} contatos`,
    });
  };

  const handleDeleteList = (listId: string) => {
    setContactLists(contactLists.filter(l => l.id !== listId));
    if (formData.selectedListId === listId) {
      setFormData({ ...formData, selectedListId: "" });
    }
    toast({
      title: "Lista excluída",
      description: "A lista de contatos foi removida",
    });
  };

  const handleDownloadList = (list: ContactList) => {
    // Mock: em produção, baixaria do backend
    toast({
      title: "Download iniciado",
      description: `Baixando ${list.name}.csv`,
    });
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.templateId || contactCount === 0) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos necessários",
        variant: "destructive",
      });
      return;
    }

    createCampaignMutation.mutate();
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/campanhas")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Criar Campanha</h1>
          <p className="text-muted-foreground mt-1">
            Configure e envie sua campanha de mensagens
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulário */}
        <div className="lg:col-span-2 space-y-6">
          {/* Nome da Campanha */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Informações da Campanha</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nome da Campanha</Label>
                <Input
                  id="name"
                  placeholder="Ex: Promoção de Natal"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="template">Selecionar Mensagem Aprovada</Label>
                <Select
                  value={formData.templateId}
                  onValueChange={(value) => setFormData({ ...formData, templateId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma mensagem" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center gap-2">
                          <span>{template.name}</span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {template.status || template.language}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="storeLink">Link da Loja / Cardápio</Label>
                <Input
                  id="storeLink"
                  placeholder="https://..."
                  value={formData.storeLink}
                  onChange={(e) => setFormData({ ...formData, storeLink: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Este link será usado nas variáveis da mensagem
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Contatos */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Lista de Contatos
                </div>
                <Dialog open={isCreateListModalOpen} onOpenChange={setIsCreateListModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Criar Lista
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Lista de Contatos</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="listName">Nome da Lista</Label>
                        <Input
                          id="listName"
                          placeholder="Ex: Clientes Premium"
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                        />
                      </div>

                      <div>
                        <Label>Importar CSV/XLSX</Label>
                        <div className="relative mt-1">
                          <input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleCreateListFileImport}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <Button variant="outline" className="w-full">
                            <Upload className="h-4 w-4 mr-2" />
                            {newListFile ? newListFile.name : "Selecionar arquivo"}
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="listContacts">Ou cole os números</Label>
                        <Textarea
                          id="listContacts"
                          placeholder="Cole os números aqui (um por linha)&#10;5511999999999&#10;5511888888888"
                          rows={5}
                          value={newListContacts}
                          onChange={(e) => setNewListContacts(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Duplicados serão removidos automaticamente
                        </p>
                      </div>

                      <Button className="w-full bg-[#25D366] hover:bg-[#25D366]/90" onClick={handleCreateList}>
                        Salvar Lista
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dropdown de Listas */}
              <div>
                <Label>Selecionar Lista de Contatos</Label>
                <Select
                  value={formData.selectedListId}
                  onValueChange={handleListSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma lista salva" />
                  </SelectTrigger>
                  <SelectContent>
                    {contactLists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        <div className="flex items-center gap-2">
                          <span>{list.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {list.numbers.length} contatos
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Lista de Listas Salvas */}
              {contactLists.length > 0 && (
                <div className="border rounded-lg divide-y">
                  {contactLists.map((list) => (
                    <div key={list.id} className="flex items-center justify-between p-3">
                      <div>
                        <p className="font-medium">{list.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {list.numbers.length} contatos • Atualizado em {list.lastUpdate}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleDownloadList(list)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteList(list.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Importar arquivo adicional */}
              <div>
                {importedFile ? (
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{importedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {manualContactCount} contatos adicionais
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleRemoveFile}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileImport}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Button variant="outline" className="w-full">
                      <Upload className="h-4 w-4 mr-2" />
                      Importar Contatos (CSV, XLSX)
                    </Button>
                  </div>
                )}
              </div>

              {/* Contatos manuais complementares */}
              <div className="relative">
                <div className="absolute left-0 right-0 top-0 flex items-center justify-center">
                  <span className="bg-card px-2 text-xs text-muted-foreground">ou adicione manualmente</span>
                </div>
                <div className="border-t pt-4 mt-2">
                  <Label htmlFor="contacts">Números Adicionais</Label>
                  <Textarea
                    id="contacts"
                    placeholder="Cole números adicionais aqui (um por linha)&#10;5511999999999"
                    rows={4}
                    value={formData.contacts}
                    onChange={(e) => setFormData({ ...formData, contacts: e.target.value })}
                  />
                </div>
              </div>

              {/* Total de contatos */}
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total de Contatos</span>
                  <span className="font-bold">{contactCount.toLocaleString()}</span>
                </div>
                {selectedList && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {listContactCount} da lista "{selectedList.name}" + {manualContactCount} adicionais
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Velocidade de Envio */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Velocidade de Envio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={formData.speed}
                onValueChange={(value) => setFormData({ ...formData, speed: value })}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/30">
                  <RadioGroupItem value="fast" id="fast" />
                  <Label htmlFor="fast" className="flex-1 cursor-pointer">
                    <span className="font-medium">Rápida</span>
                    <p className="text-sm text-muted-foreground">
                      Máximo de mensagens por segundo (recomendado para listas pequenas)
                    </p>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/30">
                  <RadioGroupItem value="moderate" id="moderate" />
                  <Label htmlFor="moderate" className="flex-1 cursor-pointer">
                    <span className="font-medium">Moderada</span>
                    <p className="text-sm text-muted-foreground">
                      Balanceada para evitar bloqueios (recomendado)
                    </p>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/30">
                  <RadioGroupItem value="safe" id="safe" />
                  <Label htmlFor="safe" className="flex-1 cursor-pointer">
                    <span className="font-medium">Segura</span>
                    <p className="text-sm text-muted-foreground">
                      Envio mais lento, ideal para contas novas
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Agendamento */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Quando Enviar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={formData.scheduleType}
                onValueChange={(value) => setFormData({ ...formData, scheduleType: value })}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="now" id="now" />
                  <Label htmlFor="now">Enviar agora</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="schedule" id="schedule" />
                  <Label htmlFor="schedule">Agendar envio</Label>
                </div>
              </RadioGroup>

              {formData.scheduleType === "schedule" && (
                <div className="pt-2">
                  <Label htmlFor="scheduleDate">Data e Hora</Label>
                  <Input
                    id="scheduleDate"
                    type="datetime-local"
                    value={formData.scheduleDate}
                    onChange={(e) => setFormData({ ...formData, scheduleDate: e.target.value })}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Card de Custo */}
        <div className="space-y-6">
          <Card className="bg-card border-border sticky top-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-[#25D366]" />
                Custo Estimado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cost ? (
                <>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Modelo de precificação</span>
                      <Badge variant="outline" className="capitalize">
                        {cost.pricingModel}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total de Contatos</span>
                      <span className="font-medium">
                        {cost.contactCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Custo por Envio</span>
                      <span className="font-medium">
                        ${cost.costPerMessage.toFixed(4)} / R${" "}
                        {(cost.brlCost / cost.contactCount).toFixed(4)}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between">
                      <span className="font-semibold">Total USD</span>
                      <span className="font-bold text-lg">${cost.usdCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="font-semibold">Total BRL</span>
                      <span className="font-bold text-lg text-[#25D366]">
                        R$ {cost.brlCost.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    Selecione uma mensagem e adicione contatos para ver o custo estimado
                  </p>
                </div>
              )}

              <Button
                className="w-full bg-[#25D366] hover:bg-[#25D366]/90"
                size="lg"
                onClick={handleSubmit}
                disabled={
                  !formData.name ||
                  !formData.templateId ||
                  contactCount === 0 ||
                  !activeWaba ||
                  createCampaignMutation.isPending
                }
              >
                <Send className="h-4 w-4 mr-2" />
                {formData.scheduleType === "now" ? "Enviar Agora" : "Agendar Envio"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default NovaCampanha;