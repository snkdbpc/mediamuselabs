'use client';

import React from 'react';
import { AppStep } from '../types/mediamind';
import { Upload, SlidersHorizontal, Share2, Check } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: AppStep;
  onStepClick?: (step: AppStep) => void;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, onStepClick }) => {
  const steps: { id: AppStep; name: string; number: number; icon: React.ReactNode }[] = [
    { id: 'upload', name: '1. Upload & Preview', number: 1, icon: <Upload className="w-4 h-4" /> },
    { id: 'choose', name: '2. Generate Social Copy', number: 2, icon: <SlidersHorizontal className="w-4 h-4" /> },
    { id: 'finalize', name: '3. Finalize & Share', number: 3, icon: <Share2 className="w-4 h-4" /> },
  ];

  const getCurrentStepIndex = (): number => {
    if (currentStep === 'upload') return 0;
    if (currentStep === 'choose' || currentStep === 'edit') return 1;
    return 2;
  };

  const activeIdx = getCurrentStepIndex();

  const progressPercentage = activeIdx === 0 ? 33 : activeIdx === 1 ? 66 : 100;

  return (
    <div className="w-full mb-8">
      {/* Step Buttons */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 p-2 glass-card border border-slate-800 shadow-lg">
        {steps.map((step, idx) => {
          const isActive = idx === activeIdx;
          const isCompleted = idx < activeIdx;

          return (
            <div
              key={step.id}
              onClick={() => isCompleted && onStepClick && onStepClick(step.id)}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-xs md:text-sm transition-all duration-300 ${
                isCompleted ? 'cursor-pointer hover:bg-slate-800/80 text-slate-300' : ''
              } ${
                isActive
                  ? 'step-badge-active shadow-lg'
                  : 'bg-slate-900/50 text-slate-400 border border-slate-800'
              }`}
            >
              {isCompleted ? (
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5" />
                </div>
              ) : (
                step.icon
              )}
              <span className="truncate">{step.name}</span>
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-900 rounded-full h-1.5 mt-3 overflow-hidden border border-slate-800/80">
        <div
          className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </div>
  );
};
