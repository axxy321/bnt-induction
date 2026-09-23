import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { DriverBundle, DriverFormInput, DocumentType, QuizQuestion, QuizSubmitResult } from "../../types";
import { Step1Profile } from "./Step1Profile";
import { Step2Documents } from "./Step2Documents";
import { Step3Modules } from "./Step3Modules";
import { Step4Quiz } from "./Step4Quiz";
import { Step5Declaration } from "./Step5Declaration";
import { Step6Certificate } from "./Step6Certificate";

interface DriverWizardProps {
  bundle: DriverBundle;
  currentStep: number;
  onSetStep: (step: number) => void;
  onSaveProfile: (input: DriverFormInput) => Promise<any>;
  onUploadDocument: (type: DocumentType, file: File) => Promise<any>;
  onToggleModule: (module: any) => Promise<any>;
  onStartModule: (module: any) => Promise<any>;
  onSubmitQuiz: (answers: Record<number, number>) => Promise<QuizSubmitResult>;
  onSaveDeclaration: (accepted: boolean, signature: string) => Promise<any>;
  onGenerateCertificate: () => Promise<{ pdfBase64: string }>;
  onSubmitFeedback: (input: { clarityRating: number; issues: string }) => Promise<any>;
  quizQuestions: QuizQuestion[];
  loading: boolean;
}

const stepLabels = [
  "1. Profile Details",
  "2. AU Documents",
  "3. Safety Modules",
  "4. Knowledge Quiz",
  "5. Legal Sign-Off",
  "6. Site Pass & Cert"
];

export function DriverWizard({
  bundle,
  currentStep,
  onSetStep,
  onSaveProfile,
  onUploadDocument,
  onToggleModule,
  onStartModule,
  onSubmitQuiz,
  onSaveDeclaration,
  onGenerateCertificate,
  onSubmitFeedback,
  quizQuestions,
  loading
}: DriverWizardProps) {
  const maxCompletedStep = bundle.progress?.completedStepIds?.length
    ? Math.max(...bundle.progress.completedStepIds)
    : 0;
  const highestAllowedStep = Math.min(6, maxCompletedStep + 1);
  const progressPercent = Math.round((currentStep / 6) * 100);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* High-Tech Stepper Header */}
      <div className="bg-slate-900/90 backdrop-blur-2xl border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/30">
                BNT Logistics Heavy Vehicle Driver Induction
              </span>
            </div>
            <h2 className="text-xl font-black text-white mt-1 font-heading">
              {stepLabels[currentStep - 1]}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs text-slate-400 font-medium block">Progress</span>
              <span className="text-emerald-400 font-extrabold font-mono text-sm">{progressPercent}% Complete</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-white font-mono shadow-inner">
              {currentStep}/6
            </div>
          </div>
        </div>

        {/* Progress Bar Line */}
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500 transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Step Buttons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
          {stepLabels.map((label, idx) => {
            const stepNum = idx + 1;
            const isActive = currentStep === stepNum;
            const isCompleted = bundle.progress?.completedStepIds?.includes(stepNum);
            const isAccessible = stepNum <= highestAllowedStep;

            return (
              <button
                key={stepNum}
                onClick={() => isAccessible && onSetStep(stepNum)}
                disabled={!isAccessible}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-center truncate ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-400 scale-[1.02]"
                    : isCompleted
                    ? "bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900/50"
                    : isAccessible
                    ? "bg-slate-800/80 text-slate-300 border border-slate-700 hover:bg-slate-700/60"
                    : "bg-slate-900/40 text-slate-500 border border-slate-800/50 cursor-not-allowed opacity-60"
                }`}
              >
                <span>{label}</span>
                {isCompleted && <Check className="w-3.5 h-3.5 ml-1 text-emerald-400 font-bold inline" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Step Container */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
        >
          {currentStep === 1 && (
            <Step1Profile
              driver={bundle.driver}
              onSave={async (input) => {
                await onSaveProfile(input);
                onSetStep(2);
              }}
              loading={false}
            />
          )}

          {currentStep === 2 && (
            <Step2Documents
              documents={bundle.documents}
              onUpload={onUploadDocument}
              onContinue={() => onSetStep(3)}
              loading={loading}
            />
          )}

          {currentStep === 3 && (
            <Step3Modules
              modules={bundle.learningProgress}
              onToggleModule={onToggleModule}
              onStartModule={onStartModule}
              onContinue={() => onSetStep(4)}
              loading={loading}
            />
          )}

          {currentStep === 4 && (
            <Step4Quiz
              questions={quizQuestions}
              onSubmitQuiz={onSubmitQuiz}
              onContinue={() => onSetStep(5)}
              loading={loading}
            />
          )}

          {currentStep === 5 && (
            <Step5Declaration
              initialSignature={bundle.declaration?.signature}
              initialAccepted={bundle.declaration?.accepted}
              onSaveDeclaration={onSaveDeclaration}
              onContinue={() => onSetStep(6)}
              loading={loading}
            />
          )}

          {currentStep === 6 && (
            <Step6Certificate
              driver={bundle.driver}
              certificate={bundle.certificate}
              feedback={bundle.feedback}
              onGenerateCertificate={onGenerateCertificate}
              onSubmitFeedback={onSubmitFeedback}
              loading={loading}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

