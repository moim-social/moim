import { Card, CardContent } from "~/components/ui/card";

const STEPS = ["Event Details", "Questions / Create"] as const;

export function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <Card className="rounded-lg">
      <CardContent className="py-5">
        <div className="relative flex justify-between">
          {/* Connecting line behind circles */}
          <div className="absolute top-4 left-0 right-0 flex items-center px-12">
            <div className={`h-px flex-1 ${currentStep > 0 ? "bg-primary" : "bg-border"}`} />
          </div>
          {STEPS.map((label, idx) => {
            const isCompleted = idx < currentStep;
            const isActive = idx === currentStep;
            return (
              <div key={label} className="relative z-10 flex flex-col items-center gap-1.5">
                <div
                  className={`size-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    isCompleted || isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <span>{String(idx + 1).padStart(2, "0")}</span>
                  )}
                </div>
                <span
                  className={`text-xs whitespace-nowrap ${
                    isActive || isCompleted ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
