'use client';

import { cn } from '@/lib/utils';

interface ProgressBarProps {
  currentStep: number;
}

const STEPS = [
  { label: 'Format', step: 0 },
  { label: 'JD', step: 1 },
  { label: 'Header', step: 2 },
  { label: 'Summary', step: 3 },
  { label: 'Highlights', step: 4 },
  { label: 'Position 1', step: 5 },
  { label: 'Position 2', step: 6 },
  { label: 'Positions 3-6', step: 7 },
  { label: 'Export', step: 8 },
];

export function ProgressBar({ currentStep }: ProgressBarProps) {
  return (
    <div className="w-full bg-zinc-900 border-b border-zinc-800 py-3 px-4">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        {STEPS.map((step, index) => (
          <div key={step.step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  currentStep > step.step
                    ? 'bg-green-600 text-white'
                    : currentStep === step.step
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-700 text-zinc-400'
                )}
              >
                {currentStep > step.step ? '✓' : step.step + 1}
              </div>
              <span
                className={cn(
                  'mt-1 text-xs',
                  currentStep >= step.step ? 'text-zinc-300' : 'text-zinc-500'
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  'w-8 h-0.5 mx-1',
                  currentStep > step.step ? 'bg-green-600' : 'bg-zinc-700'
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
