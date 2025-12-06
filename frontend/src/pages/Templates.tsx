import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus,
  Search,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  Edit,
  Trash2,
} from "lucide-react";

const Templates = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [wabaAccountId, setWabaAccountId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("en");
  const [templateCategory, setTemplateCategory] = useState("MARKETING");
  const [templateBody, setTemplateBody] = useState("");
  const queryClient = useQueryClient();

  // Use React Query for shops to enable automatic refresh
  const { data: shops = [] } = useQuery({
    queryKey: ['shops'],
    queryFn: () => api.getShops(),
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    // Get first shop's WABA account
    if (shops.length > 0 && shops[0].waba && shops[0].waba.length > 0) {
      setWabaAccountId(shops[0].waba[0].id);
    }
  }, [shops]);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates', wabaAccountId],
    queryFn: () => wabaAccountId ? api.getTemplates(wabaAccountId) : Promise.resolve([]),
    enabled: !!wabaAccountId,
  });

  const submitTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!wabaAccountId) {
        throw new Error("Please connect a WhatsApp Business Account first. Go to Onboarding page to connect.");
      }
      if (!templateName.trim()) throw new Error("Template name is required");
      if (!templateBody.trim()) throw new Error("Template body is required");

      const templateData = {
        name: templateName,
        language: templateLanguage,
        category: templateCategory,
        components: [
          {
            type: "BODY",
            text: templateBody,
          },
        ],
      };

      return api.submitTemplate(wabaAccountId, templateData);
    },
    onSuccess: () => {
      toast.success("Template submitted successfully!");
      setIsDialogOpen(false);
      setTemplateName("");
      setTemplateBody("");
      queryClient.invalidateQueries({ queryKey: ['templates', wabaAccountId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to submit template");
    },
  });

  const filteredTemplates = templates.filter((template: any) =>
    template.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const templateDisplay = filteredTemplates.map((template: any) => ({
    id: template.id,
    name: template.name,
    language: template.language,
    category: "MARKETING", // Default category
    status: template.status,
    created_at: template.createdAt,
    components: template.history ? [] : [], // Components would come from template structure
  }));

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle2 className="h-4 w-4" />;
      case "submitted":
        return <Clock className="h-4 w-4" />;
      case "rejected":
        return <XCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-success/20 text-success border-success/30";
      case "submitted":
        return "bg-warning/20 text-warning border-warning/30";
      case "rejected":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "bg-muted/20 text-muted-foreground border-muted/30";
    }
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground mt-1">
            Manage your WhatsApp message templates
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90 transition-opacity">
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Submit New Template</DialogTitle>
              <DialogDescription>
                Create and submit a new WhatsApp message template to Meta for approval.
              </DialogDescription>
            </DialogHeader>
            {!wabaAccountId ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground mb-4">
                  You need to connect a WhatsApp Business Account first to submit templates.
                </p>
                <Button onClick={() => {
                  setIsDialogOpen(false);
                  navigate('/onboarding');
                }}>
                  Go to Onboarding
                </Button>
              </div>
            ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  placeholder="hello_world"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="lowercase"
                />
                <p className="text-xs text-muted-foreground">
                  Use lowercase letters, numbers, and underscores only
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template-language">Language</Label>
                  <Select value={templateLanguage} onValueChange={setTemplateLanguage}>
                    <SelectTrigger id="template-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English (en)</SelectItem>
                      <SelectItem value="pt_BR">Portuguese - Brazil (pt_BR)</SelectItem>
                      <SelectItem value="es">Spanish (es)</SelectItem>
                      <SelectItem value="fr">French (fr)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-category">Category</Label>
                  <Select value={templateCategory} onValueChange={setTemplateCategory}>
                    <SelectTrigger id="template-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MARKETING">MARKETING</SelectItem>
                      <SelectItem value="UTILITY">UTILITY</SelectItem>
                      <SelectItem value="AUTHENTICATION">AUTHENTICATION</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-body">Message Body</Label>
                <Textarea
                  id="template-body"
                  placeholder="Hello {{1}}, welcome to our service!"
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  className="min-h-[150px]"
                />
                <p className="text-xs text-muted-foreground">
                  Use {"{{1}}"}, {"{{2}}"}, etc. for variable placeholders
                </p>
              </div>
            </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={submitTemplateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => submitTemplateMutation.mutate()}
                disabled={submitTemplateMutation.isPending || !templateName.trim() || !templateBody.trim() || !wabaAccountId}
                className="bg-gradient-primary hover:opacity-90"
              >
                {submitTemplateMutation.isPending ? "Submitting..." : "Submit Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates by name, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">All Status</Button>
            <Button variant="outline">All Categories</Button>
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
      ) : templateDisplay.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No templates found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templateDisplay.map((template) => (
          <Card
            key={template.id}
            className="bg-card border-border hover:shadow-glow transition-all duration-300"
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {template.language}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {template.category}
                    </Badge>
                  </div>
                </div>
                <Badge className={`${getStatusColor(template.status)} flex items-center gap-1`}>
                  {getStatusIcon(template.status)}
                  {template.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template Preview */}
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                {template.components.map((component, idx) => (
                  <div key={idx}>
                    {component.type === "HEADER" && (
                      <p className="font-semibold text-sm">{component.text}</p>
                    )}
                    {component.type === "BODY" && (
                      <p className="text-sm text-muted-foreground">{component.text}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">
                  Created: {new Date(template.created_at).toLocaleDateString()}
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm">
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Templates;
