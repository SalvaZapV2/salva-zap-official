import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Users, Tag, TrendingUp } from "lucide-react";
import { TemplateCategory, calculateCampaignCost } from "@/lib/pricing";

interface CostEstimatorProps {
  category: TemplateCategory;
  contactCount: number;
  pricePerMessage: number;
}

export function CostEstimator({ category, contactCount, pricePerMessage }: CostEstimatorProps) {
  const { totalUSD, totalBRL } = calculateCampaignCost(contactCount, pricePerMessage);

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

  return (
    <Card className="bg-card border-border shadow-elegant sticky top-8">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Cost Estimate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template Category */}
        <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Tag className="h-4 w-4" />
            Category
          </div>
          <Badge className={getCategoryColor(category)}>
            {category}
          </Badge>
        </div>

        {/* Contact Count */}
        <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            Contacts
          </div>
          <span className="font-semibold">{contactCount.toLocaleString()}</span>
        </div>

        {/* Unit Price */}
        <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            Unit Price
          </div>
          <span className="font-semibold">${pricePerMessage.toFixed(4)}</span>
        </div>

        {/* Divider */}
        <div className="border-t border-border my-4" />

        {/* Total Cost USD */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total (USD)</span>
            <span className="text-2xl font-bold text-foreground">
              ${totalUSD.toFixed(2)}
            </span>
          </div>

          {/* Total Cost BRL */}
          <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
            <span className="text-sm text-muted-foreground">Total (BRL)</span>
            <span className="text-xl font-bold text-primary">
              R$ {totalBRL.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Info Note */}
        <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/30">
          <p className="font-medium mb-1">💡 Pricing Notes:</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>Official Meta WhatsApp pricing</li>
            <li>Exchange rate: 1 USD = 5.85 BRL</li>
            <li>Final cost may vary by region</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
