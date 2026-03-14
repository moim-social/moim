import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export function DashboardSection({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader className={action ? "flex flex-row items-center justify-between" : undefined}>
        <CardTitle className="text-base">
          {title}
          {count != null && ` (${count})`}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
