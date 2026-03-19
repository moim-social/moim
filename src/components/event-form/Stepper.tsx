const STEPS = ["Event Details", "Questions / Create"] as const;

export function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex">
      {STEPS.map((label, idx) => {
        const isCompleted = idx < currentStep;
        const isActive = idx === currentStep;
        return (
          <div key={label} className="flex-1 text-center">
            <div className={`text-[11px] font-semibold uppercase tracking-wide pb-2 ${
              isCompleted || isActive ? "font-extrabold text-foreground" : "text-[#bbb]"
            }`}>
              {idx + 1} &middot; {label}
            </div>
            <div className={`h-[3px] ${isCompleted || isActive ? "bg-foreground" : "bg-[#e5e5e5]"}`} />
          </div>
        );
      })}
    </div>
  );
}
