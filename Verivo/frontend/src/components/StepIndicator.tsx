interface StepIndicatorProps {
  currentStep: number;           // Etape active (1, 2, 3)
  steps: string[];               // Labels : ["Wallet", "Signature", "Organisation"]
}

export function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;

        return (
          <div key={label} className="flex items-center gap-2">
            {/* Cercle numerote */}
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  isCompleted
                    ? "bg-secondary text-white"         // Fait : bleu plein
                    : isCurrent
                      ? "border-2 border-secondary text-secondary"  // En cours : contour bleu
                      : "bg-border text-text-secondary"  // A venir : gris
                }`}
              >
                {isCompleted ? "✓" : stepNumber}
              </div>
              <span
                className={`text-sm ${
                  isCurrent ? "font-semibold text-primary" : "text-text-secondary"
                }`}
              >
                {label}
              </span>
            </div>

            {/* Ligne entre les etapes (sauf apres la derniere) */}
            {index < steps.length - 1 && (
              <div
                className={`h-0.5 w-8 ${
                  isCompleted ? "bg-secondary" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}