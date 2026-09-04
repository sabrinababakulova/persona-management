export interface StatsCardProps {
  title: string;
  value: string;
  href: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  period: string;
}
