import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  trend?: number[];
}

export const StatsCard = ({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
}: StatsCardProps) => {
  return (
    <Card className="bg-card border-border hover:shadow-glow transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <div className="space-y-1">
              <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
              {change && (
                <p
                  className={cn(
                    "text-xs font-medium flex items-center gap-1",
                    changeType === "positive" && "text-success",
                    changeType === "negative" && "text-destructive",
                    changeType === "neutral" && "text-muted-foreground"
                  )}
                >
                  {change}
                </p>
              )}
            </div>
          </div>
          <div className="p-3 bg-primary/10 rounded-xl">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
