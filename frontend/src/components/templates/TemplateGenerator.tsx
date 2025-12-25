import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Loader2, Sparkles, Send, Edit, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import translations from "@/i18n/pt-BR.json";

interface GeneratedTemplate {
  id: string;
  text: string;
  category: string;
  variables: string[];
}

interface TemplateGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateSubmitted: () => void;
}

export const TemplateGenerator = ({
  open,
  onOpenChange,
  onTemplateSubmitted,
}: TemplateGeneratorProps) => {
  const { toast } = useToast();
  const t = translations.templates.generator;
  const [step, setStep] = useState<"form" | "variations">("form");
  const [isGenerating, setIsGenerating] = useState(false);
  const [objective, setObjective] = useState("");
  const [category, setCategory] = useState("UTILITY");
  const [tone, setTone] = useState("neutral");
  const [variations, setVariations] = useState<GeneratedTemplate[]>([]);
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!objective.trim()) {
      toast({
        variant: "destructive",
        title: translations.errors.validation,
      });
      return;
    }

    setIsGenerating(true);
    
    // Mock API call - replace with real endpoint
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock 10 variations
      const mockVariations: GeneratedTemplate[] = Array.from({ length: 10 }, (_, i) => ({
        id: `var-${i + 1}`,
        text: `Olá {{1}}! ${objective} Seu código é {{2}}. Esta é a variação ${i + 1}.`,
        category,
        variables: ["{{1}}", "{{2}}"],
      }));

      setVariations(mockVariations);
      setStep("variations");
      toast({
        title: translations.success.templateGenerated,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: translations.errors.templateGenerateFail,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmitTemplate = async (templateId: string) => {
    setSubmitting(templateId);
    
    try {
      // Mock API call - replace with: POST /templates/submit
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast({
        title: translations.success.templateSubmitted,
      });
      
      // Remove from variations list
      setVariations(prev => prev.filter(v => v.id !== templateId));
      
      // If no more variations, close and refresh
      if (variations.length === 1) {
        handleClose();
        onTemplateSubmitted();
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: translations.errors.templateSubmitFail,
      });
    } finally {
      setSubmitting(null);
    }
  };

  const handleDelete = (templateId: string) => {
    setVariations(prev => prev.filter(v => v.id !== templateId));
    if (variations.length === 1) {
      setStep("form");
    }
  };

  const handleClose = () => {
    setStep("form");
    setObjective("");
    setCategory("UTILITY");
    setTone("neutral");
    setVariations([]);
    setShowPreview(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            {t.title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="objective">{t.objective}</Label>
              <Textarea
                id="objective"
                placeholder={t.objectivePlaceholder}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">{t.categoryLabel}</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTILITY">
                      {translations.templates.category.UTILITY}
                    </SelectItem>
                    <SelectItem value="MARKETING">
                      {translations.templates.category.MARKETING}
                    </SelectItem>
                    <SelectItem value="AUTHENTICATION">
                      {translations.templates.category.AUTHENTICATION}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tone">{t.toneLabel}</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">{t.tone.formal}</SelectItem>
                    <SelectItem value="neutral">{t.tone.neutral}</SelectItem>
                    <SelectItem value="friendly">{t.tone.friendly}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-gradient-primary"
              size="lg"
            >
              <span className={isGenerating ? 'inline-flex items-center' : 'hidden'}>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.generating}
              </span>
              <span className={isGenerating ? 'hidden' : 'inline-flex items-center'}>
                <Sparkles className="mr-2 h-4 w-4" />
                {t.generate}
              </span>
            </Button>
          </div>
        )}

        {step === "variations" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{t.variations}</h3>
                <p className="text-sm text-muted-foreground">{t.variationsSubtitle}</p>
              </div>
              <Button variant="outline" onClick={() => setStep("form")}>
                {t.backToList}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {variations.map((variation) => (
                <Card key={variation.id} className="bg-card border-border">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="outline" className="shrink-0">
                        {translations.templates.category[variation.category as keyof typeof translations.templates.category]}
                      </Badge>
                      {variation.variables.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-end">
                          {variation.variables.map((v, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {v}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-muted/30 rounded-lg p-4 min-h-[100px]">
                      <p className="text-sm whitespace-pre-wrap">{variation.text}</p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() =>
                        setShowPreview(showPreview === variation.id ? null : variation.id)
                      }
                    >
                      <Smartphone className="h-4 w-4 mr-2" />
                      {t.previewMobile}
                    </Button>

                    {showPreview === variation.id && (
                      <div className="relative mx-auto w-[280px] h-[480px] bg-background border-4 border-muted rounded-[2rem] overflow-hidden shadow-xl">
                        <div className="absolute top-0 left-0 right-0 h-8 bg-muted flex items-center justify-center">
                          <div className="w-24 h-4 bg-background rounded-full" />
                        </div>
                        <div className="pt-10 px-4 h-full overflow-y-auto">
                          <div className="bg-[#dcf8c6] p-3 rounded-lg rounded-tl-none shadow-sm">
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">
                              {variation.text}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="flex gap-2 border-t pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(variation.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => handleSubmitTemplate(variation.id)}
                      disabled={!!submitting}
                      className="flex-1 bg-gradient-primary"
                      size="sm"
                    >
                        <span className={submitting === variation.id ? 'inline-flex items-center' : 'hidden'}>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t.submitting}
                      </span>
                      <span className={submitting === variation.id ? 'hidden' : 'inline-flex items-center'}>
                        <Send className="mr-2 h-4 w-4" />
                        {t.submitTemplate}
                      </span>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
