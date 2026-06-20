import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type Metric = {
  label: string;
  value: string | number;
  detail?: string;
};

export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">{metric.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-semibold">{metric.value}</div>
            {metric.detail ? <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

