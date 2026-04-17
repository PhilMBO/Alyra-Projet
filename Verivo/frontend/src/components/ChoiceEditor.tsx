"use client";

import { useState } from "react";

export interface ChoiceDraft {
  label: string;
  description: string;
}

interface ChoiceEditorProps {
  choices: ChoiceDraft[];
  onChange: (choices: ChoiceDraft[]) => void;
  choiceTypeLabel?: string;   // "candidat" ou "proposition"
}

export function ChoiceEditor({
  choices,
  onChange,
  choiceTypeLabel = "choix",
}: ChoiceEditorProps) {
  const [localError, setLocalError] = useState<string | null>(null);

  const addChoice = () => {
    onChange([...choices, { label: "", description: "" }]);
  };

  const removeChoice = (index: number) => {
    if (choices.length <= 2) {
      setLocalError("Il faut au moins 2 " + choiceTypeLabel + "s");
      return;
    }
    setLocalError(null);
    onChange(choices.filter((_, i) => i !== index));
  };

  const updateChoice = (index: number, patch: Partial<ChoiceDraft>) => {
    onChange(choices.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const moveChoice = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= choices.length) return;
    const next = [...choices];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {choices.map((choice, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded border border-border bg-surface p-3"
        >
          <div className="flex items-start gap-2">
            <span className="mt-2.5 text-sm font-semibold text-text-secondary">
              #{index + 1}
            </span>
            <div className="flex flex-1 flex-col gap-2">
              <input
                type="text"
                value={choice.label}
                onChange={(e) => updateChoice(index, { label: e.target.value })}
                placeholder={`Nom du ${choiceTypeLabel}`}
                required
                maxLength={255}
                className="rounded border border-border bg-background px-3 py-2 text-base focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15"
              />
              <textarea
                value={choice.description}
                onChange={(e) =>
                  updateChoice(index, { description: e.target.value })
                }
                placeholder="Description (optionnelle)"
                rows={2}
                className="rounded border border-border bg-background px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15"
              />
            </div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => moveChoice(index, -1)}
                disabled={index === 0}
                className="rounded px-2 py-1 text-xs hover:bg-border disabled:opacity-30"
                aria-label="Monter"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveChoice(index, 1)}
                disabled={index === choices.length - 1}
                className="rounded px-2 py-1 text-xs hover:bg-border disabled:opacity-30"
                aria-label="Descendre"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeChoice(index)}
                className="rounded px-2 py-1 text-xs text-error hover:bg-error/10"
                aria-label="Supprimer"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      ))}

      {localError && <p className="text-sm text-error">{localError}</p>}

      <button
        type="button"
        onClick={addChoice}
        className="rounded border border-dashed border-border py-2 text-sm text-text-secondary hover:border-secondary hover:text-secondary"
      >
        + Ajouter un {choiceTypeLabel}
      </button>
    </div>
  );
}
