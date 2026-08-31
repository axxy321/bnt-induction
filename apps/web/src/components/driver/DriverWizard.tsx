import { motion, AnimatePresence } from "framer-motion";
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
  "5. Declaration",
  "6. Certificate"
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

  return (
    <div style={{ width: "100%", maxWidth: "960px", margin: "0 auto", padding: "0 16px" }}>
      {/* Wizard Header / Navigation bar */}
      <div
        className="glass"
        style={{
          padding: "16px 20px",
          borderRadius: "16px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px"
        }}
      >
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", width: "100%", paddingBottom: "4px" }}>
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
                style={{
                  flex: 1,
                  minWidth: "125px",
                  padding: "10px 14px",
                  borderRadius: "12px",
                  border: isActive
                    ? "2px solid #2563eb"
                    : isCompleted
                    ? "1px solid rgba(34, 197, 94, 0.4)"
                    : "1px solid #cbd5e1",
                  background: isActive
                    ? "#2563eb"
                    : isCompleted
                    ? "rgba(34, 197, 94, 0.12)"
                    : "var(--bg-elevated, #ffffff)",
                  color: isActive
                    ? "#ffffff"
                    : isCompleted
                    ? "#166534"
                    : "#1e293b",
                  fontWeight: isActive || isCompleted ? 800 : 700,
                  fontSize: "0.84rem",
                  cursor: isAccessible ? "pointer" : "not-allowed",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  opacity: !isAccessible ? 0.75 : 1,
                  boxShadow: isActive ? "0 6px 16px rgba(37,99,235,0.25)" : "none",
                  transition: "all 0.18s ease"
                }}
              >
                {label} {isCompleted && "✓"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {currentStep === 1 && (
            <Step1Profile
              driver={bundle.driver}
              onSave={async (input) => {
                onSetStep(2);
                onSaveProfile(input).catch((err) => console.error("Profile save background notice:", err));
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
