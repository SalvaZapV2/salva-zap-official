import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Users, Tag, TrendingUp, Globe, AlertCircle } from "lucide-react";
import { TemplateCategory, calculateCampaignCost } from "@/lib/pricing";
import translations from "@/i18n/pt-BR.json";

interface CampaignCostPreviewProps {
  templateId: string | null;
  category: TemplateCategory;
  contactCount: number;
  pricePerMessage: number;
  contactsByCountry?: Array<{ country: string; count: number }>;
  currency?: "USD" | "BRL";
  isLoading?: boolean;
  error?: string | null;
}

export function CampaignCostPreview({
  category,
  contactCount,
  pricePerMessage,
  contactsByCountry,
  currency = "USD",
  isLoading = false,
  error = null,
}: CampaignCostPreviewProps) {
  const [mounted, setMounted] = useState(false);
  const { totalUSD, totalBRL } = calculateCampaignCost(contactCount, pricePerMessage);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getCategoryColor = (cat: TemplateCategory) => {
    switch (cat) {
      case "MARKETING":
        return "bg-primary/20 text-primary border-primary/30";
      case "UTILITY":
        return "bg-info/20 text-info border-info/30";
      case "AUTHENTICATION":
        return "bg-success/20 text-success border-success/30";
      default:
        return "bg-muted/20 text-muted-foreground border-muted/30";
    }
  };

  const getCategoryLabel = (cat: TemplateCategory) => {
    return translations.templates.category[cat] || cat;
  };

  if (error) {
    return (
      <Card className="bg-card border-border shadow-elegant sticky top-8">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {translations.campaign.cost.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg border border-destructive/30">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-elegant sticky top-8">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {translations.campaign.cost.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <div className="border-t border-border my-4" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!mounted) {
    return null;
  }

  return (
    <Card className="bg-card border-border shadow-elegant sticky top-8 animate-fade-in">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          {translations.campaign.cost.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template Category */}
        <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Tag className="h-4 w-4" />
            {translations.campaign.cost.category}
          </div>
          <Badge className={getCategoryColor(category)}>
            {getCategoryLabel(category)}
          </Badge>
        </div>

        {/* Contact Count */}
        <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {translations.campaign.cost.contactCount}
          </div>
          <span className="font-semibold">{contactCount.toLocaleString("pt-BR")}</span>
        </div>

        {/* Unit Price */}
        <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            {translations.campaign.cost.unitPrice}
          </div>
          <span className="font-semibold">${pricePerMessage.toFixed(4)}</span>
        </div>

        {/* Divider */}
        <div className="border-t border-border my-4" />

        {/* Total Cost USD */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {translations.campaign.cost.totalUsd}
            </span>
            <span className="text-2xl font-bold text-foreground">
              ${totalUSD.toFixed(2)}
            </span>
          </div>

          {/* Total Cost BRL */}
          <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
            <span className="text-sm text-muted-foreground">
              {translations.campaign.cost.totalBrl}
            </span>
            <span className="text-xl font-bold text-primary">
              R$ {totalBRL.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Country Breakdown (if available) */}
        {contactsByCountry && contactsByCountry.length > 1 && (
          <>
            <div className="border-t border-border my-4" />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Globe className="h-4 w-4" />
                {translations.campaign.cost.breakdown}
              </div>
              {contactsByCountry.map((item) => (
                <div
                  key={item.country}
                  className="flex items-center justify-between p-2 bg-background/30 rounded text-sm"
                >
                  <span className="text-muted-foreground">
                    {translations.countries[item.country as keyof typeof translations.countries] || item.country}
                  </span>
                  <span className="font-medium">
                    {item.count.toLocaleString("pt-BR")} contatos
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Info Note */}
        <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/30">
          <p className="font-medium mb-1">{translations.campaign.cost.notes}</p>
          <ul className="space-y-1 ml-4 list-disc">
            {translations.campaign.cost.notesList.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>

        {/* Last Updated */}
        <div className="text-xs text-center text-muted-foreground">
          {translations.campaign.cost.priceUpdatedAt} {new Date().toLocaleString("pt-BR")}
        </div>
      </CardContent>
    </Card>
  );
}
