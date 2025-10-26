import React from "react";

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend?: string;
  trendLabel?: string;
  variant?: "default" | "success" | "warning" | "secondary";
}

const variantStyles = {
  default: {
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-500/10",
  },
  success: {
    bg: "bg-green-500/10",
    text: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-500/10",
  },
  warning: {
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-500/10",
  },
  secondary: {
    bg: "bg-slate-500/10",
    text: "text-slate-600 dark:text-slate-400",
    iconBg: "bg-slate-500/10",
  },
};

export default function StatsCard({
  title,
  value,
  icon,
  trend,
  trendLabel,
  variant = "default",
}: StatsCardProps) {
  const styles = variantStyles[variant];

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-foreground">
            {value.toLocaleString()}
          </p>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-lg ${styles.iconBg}`}>
          <div className={styles.text}>{icon}</div>
        </div>
      </div>

      {(trend || trendLabel) && (
        <div className="mt-4 flex items-center gap-2">
          {trend && (
            <span
              className={`text-xs font-medium ${
                trend.startsWith("+") ? "text-green-600" : "text-red-600"
              }`}>
              {trend}
            </span>
          )}
          {trendLabel && (
            <span className="text-xs text-muted-foreground">{trendLabel}</span>
          )}
        </div>
      )}

      <div
        className={`absolute inset-x-0 bottom-0 h-1 ${styles.bg} transform origin-left scale-x-0 transition-transform group-hover:scale-x-100`}></div>
    </div>
  );
}
