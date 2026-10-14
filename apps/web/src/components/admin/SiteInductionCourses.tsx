import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Layers,
  Plus,
  Trash2,
  Edit3,
  Copy,
  ArrowUp,
  ArrowDown,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Upload,
  FileText,
  Image as ImageIcon,
  HelpCircle,
  Eye,
  CheckSquare,
  Type,
  Lock,
  Unlock,
  Sparkles,
  ExternalLink,
  Download,
  X,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  BookOpen
} from "lucide-react";
import { useAppState } from "../../state/AppContext";
import { InductionCourse, InductionSlide, SlideQuestion as QuizQuestion } from "../../types";
import {
  getInductionCourses,
  createInductionCourse,
  updateInductionCourse,
  deleteInductionCourse,
  publishInductionCourse,
  getCourseSlides,
  createSlide,
  updateSlide,
  deleteSlide,
  reorderSlides,
  uploadInductionAsset,
  getSlideQuestions,
  createSlideQuestion,
  updateSlideQuestion,
  deleteSlideQuestion,
  getCourseTemplates,
  markCourseAsTemplate,
  cloneCourse,
  publishCourseToDrivers
} from "../../lib/api";

type TextSizeOption = "small" | "regular" | "large" | "xlarge" | "headline";

export function SiteInductionCourses() {
  const { t } = useTranslation();
  const { session } = useAppState();

  // Courses state
  const [courses, setCourses] = useState<InductionCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [slides, setSlides] = useState<InductionSlide[]>([]);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [slideQuestions, setSlideQuestions] = useState<Record<string, QuizQuestion[]>>({});

  // Loading & UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState<"template" | "scratch">("template");
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseDescription, setNewCourseDescription] = useState("");
  // Real templates are loaded from the courses flagged as templates; empty until
  // they arrive (and until an admin marks one).
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishVersionLabel, setPublishVersionLabel] = useState("1.1");
  const [publishRevisionNotes, setPublishRevisionNotes] = useState("");

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);
  const [previewCountdown, setPreviewCountdown] = useState(0);
  const [previewTimerActive, setPreviewTimerActive] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({});
  const [previewErrors, setPreviewErrors] = useState<Record<string, string>>({});
  const [previewCompleted, setPreviewCompleted] = useState(false);

  // Question editing modal
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [questionPrompt, setQuestionPrompt] = useState("");
  const [questionType, setQuestionType] = useState<"single_choice" | "multiple_choice" | "text_input">("single_choice");
  const [questionPlacement, setQuestionPlacement] = useState<"below_slide" | "separate_page">("below_slide");
  const [questionOptions, setQuestionOptions] = useState<string[]>(["Option 1", "Option 2", "Option 3", "Option 4"]);
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState<number>(0);
  const [correctAnswerIndices, setCorrectAnswerIndices] = useState<number[]>([0]);
  const [acceptedAnswers, setAcceptedAnswers] = useState<string[]>([]);
  const [questionExplanation, setQuestionExplanation] = useState("");

  // Template / site-variant state
  const [templateCourses, setTemplateCourses] = useState<Array<{ id: string; title: string; description?: string }>>([]);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneSourceId, setCloneSourceId] = useState<string>("");
  const [cloneTitle, setCloneTitle] = useState("");
  const [cloneSiteTag, setCloneSiteTag] = useState("global");
  const [templateBusy, setTemplateBusy] = useState(false);

  // Audio player state for editor
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // File upload input refs
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  const showToastMsg = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const currentCourse = courses.find((c) => c.id === selectedCourseId) || courses[0] || null;
  const currentSlide = slides.find((s) => s.id === selectedSlideId) || slides[0] || null;
  const currentQuestions = currentSlide ? slideQuestions[currentSlide.id] || [] : [];

  // Fetch courses
  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getInductionCourses(session || ({} as any));
      setCourses(data);
      if (data.length > 0) {
        const targetId = selectedCourseId && data.some((c) => c.id === selectedCourseId) ? selectedCourseId : data[0].id;
        setSelectedCourseId(targetId);
      }
    } catch (err: any) {
      showToastMsg(err.message || "Failed to load courses", "error");
    } finally {
      setLoading(false);
    }
  }, [session, selectedCourseId]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  // Fetch slides for selected course
  const loadSlides = useCallback(
    async (courseId: string) => {
      try {
        const slideData = await getCourseSlides(session || ({} as any), courseId);
        setSlides(slideData);
        if (slideData.length > 0) {
          const currentValid = selectedSlideId && slideData.some((s) => s.id === selectedSlideId);
          setSelectedSlideId(currentValid ? selectedSlideId : slideData[0].id);

          // Load questions for each slide
          for (const s of slideData) {
            const qs = await getSlideQuestions(session || ({} as any), s.id);
            setSlideQuestions((prev) => ({ ...prev, [s.id]: qs }));
          }
        } else {
          setSelectedSlideId(null);
        }
      } catch (err: any) {
        console.error("Failed to load slides:", err);
      }
    },
    [session, selectedSlideId]
  );

  useEffect(() => {
    if (selectedCourseId) {
      loadSlides(selectedCourseId);
    }
  }, [selectedCourseId, loadSlides]);

  // Reset audio playback on slide switch
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlayingAudio(false);
    setAudioProgress(0);
  }, [selectedSlideId]);

  // Handle Course Creation
  const handleCreateCourse = async () => {
    if (!newCourseTitle.trim()) {
      showToastMsg("Please provide a course title", "error");
      return;
    }
    setSaving(true);
    try {
      // A real template now performs a full deep copy — slides, media and
      // questions — instead of creating an empty course.
      if (createMode === "template" && selectedTemplateId) {
        const result = await cloneCourse(session || ({} as any), selectedTemplateId, {
          title: newCourseTitle.trim(),
          siteTag: "global"
        });
        showToastMsg(
          `Created from template with ${result?.slidesCopied ?? 0} slide(s) and ${result?.questionsCopied ?? 0} question(s).`,
          "success"
        );
        setShowCreateModal(false);
        setNewCourseTitle("");
        setNewCourseDescription("");
        await loadCourses();
        const createdId = result?.course?.id;
        if (createdId) setSelectedCourseId(createdId);
        return;
      }

      const created = await createInductionCourse(session || ({} as any), {
        title: newCourseTitle.trim(),
        description: newCourseDescription.trim()
      });
      showToastMsg("Induction course created successfully!", "success");
      setShowCreateModal(false);
      setNewCourseTitle("");
      setNewCourseDescription("");
      await loadCourses();
      setSelectedCourseId(created.id);
    } catch (err: any) {
      showToastMsg(err.message || "Failed to create course", "error");
    } finally {
      setSaving(false);
    }
  };

  // Handle Course Deletion
  const handleDeleteCourse = async (courseId: string) => {
    if (!window.confirm("Are you sure you want to delete this induction course? This action cannot be undone.")) return;
    try {
      await deleteInductionCourse(session || ({} as any), courseId);
      showToastMsg("Course deleted", "success");
      await loadCourses();
    } catch (err: any) {
      showToastMsg(err.message || "Failed to delete course", "error");
    }
  };

  // ------------------------------------------------------------
  // Templates / site variants / publish
  // ------------------------------------------------------------

  const loadTemplates = useCallback(async () => {
    try {
      const data = await getCourseTemplates(session || ({} as any));
      setTemplateCourses(Array.isArray(data) ? data : []);
    } catch {
      setTemplateCourses([]);
    }
  }, [session]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleToggleTemplate = async () => {
    if (!currentCourse) return;
    setTemplateBusy(true);
    try {
      const next = !currentCourse.isTemplate;
      await markCourseAsTemplate(session || ({} as any), currentCourse.id, next);
      showToastMsg(next ? "Marked as a reusable template." : "Template flag removed.", "success");
      await loadCourses();
      await loadTemplates();
    } catch (err: any) {
      showToastMsg(err.message || "Failed to update template flag", "error");
    } finally {
      setTemplateBusy(false);
    }
  };

  const handleOpenCloneModal = async () => {
    await loadTemplates();
    const first = templateCourses[0];
    setCloneSourceId(currentCourse?.id ?? first?.id ?? "");
    setCloneTitle("");
    setCloneSiteTag("global");
    setShowCloneModal(true);
  };

  const handleClone = async () => {
    const sourceId = cloneSourceId || currentCourse?.id;
    if (!sourceId) {
      showToastMsg("Choose a template to copy from", "error");
      return;
    }
    if (!cloneTitle.trim()) {
      showToastMsg("Enter a name for the new site induction", "error");
      return;
    }
    setTemplateBusy(true);
    try {
      const result = await cloneCourse(session || ({} as any), sourceId, {
        title: cloneTitle.trim(),
        siteTag: cloneSiteTag.trim() || "global"
      });
      showToastMsg(
        `Created with ${result?.slidesCopied ?? 0} slide(s) and ${result?.questionsCopied ?? 0} question(s).`,
        "success"
      );
      setShowCloneModal(false);
      await loadCourses();
      const createdId = result?.course?.id;
      if (createdId) setSelectedCourseId(createdId);
    } catch (err: any) {
      showToastMsg(err.message || "Failed to create site variant", "error");
    } finally {
      setTemplateBusy(false);
    }
  };

  const handlePublishToDrivers = async () => {
    if (!currentCourse) return;
    if (!window.confirm(
      `Publish "${currentCourse.title}" to drivers?\n\n` +
      `Its slides are copied into the modules drivers already see, tagged as "${currentCourse.siteTag ?? 'global'}". ` +
      `Existing shared modules are not changed.`
    )) return;
    setTemplateBusy(true);
    try {
      const result = await publishCourseToDrivers(session || ({} as any), currentCourse.id);
      showToastMsg(result?.message ?? "Published to drivers.", "success");
      await loadCourses();
    } catch (err: any) {
      showToastMsg(err.message || "Failed to publish", "error");
    } finally {
      setTemplateBusy(false);
    }
  };

  // Handle Course Publishing
  const handlePublishCourse = async () => {
    if (!currentCourse) return;
    setSaving(true);
    try {
      await publishInductionCourse(session || ({} as any), currentCourse.id, {
        versionLabel: publishVersionLabel.trim() || "1.0",
        revisionNotes: publishRevisionNotes.trim()
      });
      showToastMsg("Course version published successfully!", "success");
      setShowPublishModal(false);
      await loadCourses();
    } catch (err: any) {
      showToastMsg(err.message || "Failed to publish course", "error");
    } finally {
      setSaving(false);
    }
  };

  // Slide Creation
  const handleAddSlide = async () => {
    if (!currentCourse) return;
    const nextOrder = slides.length + 1;
    setSaving(true);
    try {
      const newSlide = await createSlide(session || ({} as any), currentCourse.id, {
        slideOrder: nextOrder,
        slideType: "mixed",
        title: `Slide ${nextOrder}: New Site Protocol`,
        contentJson: {
          body: "Enter the detailed instructions or safety standards for this slide here.",
          textSize: "regular"
        },
        forcedWaitSeconds: 5
      });
      showToastMsg("New slide added", "success");
      await loadSlides(currentCourse.id);
      setSelectedSlideId(newSlide.id);
    } catch (err: any) {
      showToastMsg(err.message || "Failed to add slide", "error");
    } finally {
      setSaving(false);
    }
  };

  // Slide Deletion
  const handleDeleteSlide = async (slideId: string) => {
    if (!currentCourse) return;
    if (slides.length <= 1) {
      showToastMsg("A course must have at least one slide", "error");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this slide?")) return;
    try {
      await deleteSlide(session || ({} as any), currentCourse.id, slideId);
      showToastMsg("Slide deleted", "success");
      await loadSlides(currentCourse.id);
    } catch (err: any) {
      showToastMsg(err.message || "Failed to delete slide", "error");
    }
  };

  // Slide Reordering
  const handleMoveSlide = async (index: number, direction: "up" | "down") => {
    if (!currentCourse) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= slides.length) return;

    const reordered = [...slides];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const slideOrders = reordered.map((s, idx) => ({ id: s.id, slideOrder: idx + 1 }));
    setSlides(reordered);

    try {
      await reorderSlides(session || ({} as any), currentCourse.id, slideOrders);
    } catch (err: any) {
      showToastMsg("Failed to reorder slides", "error");
      await loadSlides(currentCourse.id);
    }
  };

  // Duplicate Slide
  const handleDuplicateSlide = async (slide: InductionSlide) => {
    if (!currentCourse) return;
    setSaving(true);
    try {
      const nextOrder = slides.length + 1;
      const created = await createSlide(session || ({} as any), currentCourse.id, {
        slideOrder: nextOrder,
        slideType: slide.slideType,
        title: `${slide.title} (Copy)`,
        contentJson: { ...slide.contentJson },
        audioUrl: slide.audioUrl || undefined,
        videoUrl: slide.videoUrl || undefined,
        forcedWaitSeconds: slide.forcedWaitSeconds
      });
      // Clone questions
      const existingQs = slideQuestions[slide.id] || [];
      for (const q of existingQs) {
        await createSlideQuestion(session || ({} as any), created.id, {
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer ?? q.correct_answer ?? 0,
          correctAnswers: q.correctAnswers,
          explanation: q.explanation,
          category: q.category,
          isCritical: q.isCritical ?? q.is_critical,
          questionType: q.questionType,
          placement: q.placement,
          sortOrder: q.sortOrder ?? q.sort_order ?? 1
        });
      }
      showToastMsg("Slide duplicated with all questions", "success");
      await loadSlides(currentCourse.id);
      setSelectedSlideId(created.id);
    } catch (err: any) {
      showToastMsg(err.message || "Failed to duplicate slide", "error");
    } finally {
      setSaving(false);
    }
  };

  // Update current slide field
  const handleUpdateCurrentSlide = async (updates: Partial<InductionSlide> | { contentJsonUpdates: Record<string, any> }) => {
    if (!currentCourse || !currentSlide) return false;

    let payload: Partial<InductionSlide> = {};
    if ("contentJsonUpdates" in updates) {
      payload = {
        contentJson: {
          ...currentSlide.contentJson,
          ...updates.contentJsonUpdates
        }
      };
    } else {
      payload = updates;
    }

    // Optimistic update - update local state immediately
    const optimisticSlide = { ...currentSlide, ...payload };
    setSlides((prev) => prev.map((s) => (s.id === currentSlide.id ? optimisticSlide : s)));

    try {
      const updated = await updateSlide(session || ({} as any), currentCourse.id, currentSlide.id, payload);
      // Sync with server response
      setSlides((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      return true;
    } catch (err: any) {
      // Revert on error
      setSlides((prev) => prev.map((s) => (s.id === currentSlide.id ? currentSlide : s)));
      showToastMsg("Failed to save slide change", "error");
      return false;
    }
  };

  // Asset Uploads (Image, Document, Audio Voiceover)
  const handleUploadAsset = async (file: File, type: "image" | "document" | "audio") => {
    if (!currentSlide) return;
    setSaving(true);
    try {
      const folder = type === "audio" ? "voiceovers" : type === "image" ? "slide-images" : "documents";
      const { url } = await uploadInductionAsset(session || ({} as any), file, folder);

      if (type === "audio") {
        if (!await handleUpdateCurrentSlide({ audioUrl: url })) return;
        showToastMsg("Audio voiceover uploaded successfully!", "success");
      } else if (type === "image") {
        if (!await handleUpdateCurrentSlide({
          contentJsonUpdates: {
            imageUrl: url,
            imageCaption: file.name.replace(/\.[^/.]+$/, "")
          }
        })) return;
        showToastMsg("Image attached to slide", "success");
      } else if (type === "document") {
        if (!await handleUpdateCurrentSlide({
          contentJsonUpdates: {
            docUrl: url,
            docName: file.name
          }
        })) return;
        showToastMsg("Document attached to slide", "success");
      }
    } catch (err: any) {
      showToastMsg(err.message || "Upload failed", "error");
    } finally {
      setSaving(false);
    }
  };

  // Audio Playback in Editor
  const togglePlayAudio = () => {
    if (!audioRef.current && currentSlide?.audioUrl) {
      audioRef.current = new Audio(currentSlide.audioUrl);
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) {
          setAudioProgress(audioRef.current.currentTime);
          setAudioDuration(audioRef.current.duration || 0);
        }
      };
      audioRef.current.onended = () => {
        setIsPlayingAudio(false);
        setAudioProgress(0);
      };
    }

    if (audioRef.current) {
      if (isPlayingAudio) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioRef.current.play().then(() => setIsPlayingAudio(true)).catch((e) => {
          console.warn("Audio play blocked:", e);
          setIsPlayingAudio(false);
        });
      }
    }
  };

  // Knowledge Checks / Question Management
  const handleOpenAddQuestion = () => {
    setEditingQuestion(null);
    setQuestionPrompt("");
    setQuestionType("single_choice");
    setQuestionPlacement("below_slide");
    setQuestionOptions(["Option 1", "Option 2", "Option 3", "Option 4"]);
    setCorrectAnswerIndex(0);
    setCorrectAnswerIndices([0]);
    setAcceptedAnswers([]);
    setQuestionExplanation("");
    setShowQuestionModal(true);
  };

  const handleOpenEditQuestion = (q: QuizQuestion) => {
    setEditingQuestion(q);
    setQuestionPrompt(q.question);
    setQuestionType(q.questionType || "single_choice");
    setQuestionPlacement(q.placement || "below_slide");
    setQuestionOptions(q.options && q.options.length > 0 ? [...q.options] : ["Option 1", "Option 2"]);
    setCorrectAnswerIndex(q.correctAnswer ?? q.correct_answer ?? 0);
    setCorrectAnswerIndices(q.correctAnswers || [q.correctAnswer ?? q.correct_answer ?? 0]);
    setAcceptedAnswers(q.acceptedAnswers || []);
    setQuestionExplanation(q.explanation || "");
    setShowQuestionModal(true);
  };

  const handleSaveQuestion = async () => {
    if (!currentSlide || !questionPrompt.trim()) {
      showToastMsg("Please provide question text", "error");
      return;
    }

    const payload = {
      question: questionPrompt.trim(),
      options: questionType === "text_input" ? [] : questionOptions.filter((opt) => opt.trim() !== ""),
      correctAnswer: correctAnswerIndex,
      correctAnswers: questionType === "multiple_choice" ? correctAnswerIndices : [correctAnswerIndex],
      acceptedAnswers: questionType === "text_input" ? acceptedAnswers.filter((a) => a.trim() !== "") : [],
      explanation: questionExplanation.trim(),
      category: "Site Rules",
      isCritical: false,
      questionType,
      placement: questionPlacement,
      sortOrder: (slideQuestions[currentSlide.id]?.length || 0) + 1
    };

    setSaving(true);
    try {
      if (editingQuestion) {
        await updateSlideQuestion(session || ({} as any), currentSlide.id, editingQuestion.id, payload);
        showToastMsg("Question updated", "success");
      } else {
        await createSlideQuestion(session || ({} as any), currentSlide.id, payload);
        showToastMsg("Knowledge check question added", "success");
      }
      setShowQuestionModal(false);
      // Reload slide questions
      const qs = await getSlideQuestions(session || ({} as any), currentSlide.id);
      setSlideQuestions((prev) => ({ ...prev, [currentSlide.id]: qs }));
    } catch (err: any) {
      showToastMsg(err.message || "Failed to save question", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (qId: string | number) => {
    if (!currentSlide) return;
    if (!window.confirm("Delete this question?")) return;
    try {
      await deleteSlideQuestion(session || ({} as any), currentSlide.id, qId);
      showToastMsg("Question removed", "success");
      const qs = await getSlideQuestions(session || ({} as any), currentSlide.id);
      setSlideQuestions((prev) => ({ ...prev, [currentSlide.id]: qs }));
    } catch (err: any) {
      showToastMsg(err.message || "Failed to delete question", "error");
    }
  };

  // ==========================================================
  // Interactive Preview / Inductee Test Player
  // ==========================================================
  const startPreview = () => {
    if (slides.length === 0) {
      showToastMsg("Add at least one slide to preview the course", "error");
      return;
    }
    setPreviewSlideIndex(0);
    setPreviewAnswers({});
    setPreviewErrors({});
    setPreviewCompleted(false);
    setShowPreviewModal(true);
    initPreviewSlide(0);
  };

  const initPreviewSlide = (idx: number) => {
    const slide = slides[idx];
    if (!slide) return;

    if (slide.forcedWaitSeconds && slide.forcedWaitSeconds > 0) {
      setPreviewCountdown(slide.forcedWaitSeconds);
      setPreviewTimerActive(true);
    } else {
      setPreviewCountdown(0);
      setPreviewTimerActive(false);
    }
  };

  // Preview Countdown Timer Effect
  useEffect(() => {
    if (!showPreviewModal || !previewTimerActive || previewCountdown <= 0) return;
    const interval = setInterval(() => {
      setPreviewCountdown((prev) => {
        if (prev <= 1) {
          setPreviewTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showPreviewModal, previewTimerActive, previewCountdown]);

  const handlePreviewNext = () => {
    const slide = slides[previewSlideIndex];
    if (!slide) return;

    // Check forced wait timer
    if (previewCountdown > 0) {
      showToastMsg(`Slide locked for compliance review: ${previewCountdown}s remaining`, "error");
      return;
    }

    // Validate questions on this slide
    const qs = slideQuestions[slide.id] || [];
    let hasError = false;
    const newErrors: Record<string, string> = {};

    for (const q of qs) {
      const qAns = previewAnswers[String(q.id)];
      if (q.questionType === "text_input") {
        if (!qAns || typeof qAns !== "string" || qAns.trim().length === 0) {
          newErrors[String(q.id)] = "Please type your confirmation or response to proceed.";
          hasError = true;
        }
      } else if (q.questionType === "multiple_choice") {
        const correctList = q.correctAnswers || [q.correctAnswer ?? q.correct_answer ?? 0];
        const selectedList = Array.isArray(qAns) ? qAns : [];
        if (selectedList.length === 0) {
          newErrors[String(q.id)] = "Please select at least one checkbox option.";
          hasError = true;
        } else {
          // Check if matches correct answers
          const isMatch =
            correctList.length === selectedList.length &&
            correctList.every((val) => selectedList.includes(val));
          if (!isMatch) {
            newErrors[String(q.id)] = q.explanation
              ? `Incorrect answer: ${q.explanation}`
              : "Incorrect selection. Please review the slide and try again.";
            hasError = true;
          }
        }
      } else {
        // single_choice
        const correct = q.correctAnswer ?? q.correct_answer ?? 0;
        if (qAns === undefined || qAns === null) {
          newErrors[String(q.id)] = "Please select an answer.";
          hasError = true;
        } else if (Number(qAns) !== correct) {
          newErrors[String(q.id)] = q.explanation
            ? `Incorrect: ${q.explanation}`
            : "Incorrect answer. Please select the correct option.";
          hasError = true;
        }
      }
    }

    if (hasError) {
      setPreviewErrors(newErrors);
      return;
    }

    setPreviewErrors({});

    if (previewSlideIndex < slides.length - 1) {
      const nextIdx = previewSlideIndex + 1;
      setPreviewSlideIndex(nextIdx);
      initPreviewSlide(nextIdx);
    } else {
      setPreviewCompleted(true);
    }
  };

  const handlePreviewPrev = () => {
    if (previewSlideIndex > 0) {
      const prevIdx = previewSlideIndex - 1;
      setPreviewSlideIndex(prevIdx);
      initPreviewSlide(prevIdx);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            padding: "12px 24px",
            borderRadius: "12px",
            background: toast.type === "success" ? "#10b981" : "#ef4444",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "0.95rem",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: "10px"
          }}
        >
          {toast.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {/* Main Top Header */}
      <div
        className="glass"
        style={{
          padding: "24px",
          borderRadius: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #2563eb, #1e3a5f)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff"
            }}
          >
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>
                {t("site_inductions_title", "Site Inductions & Course Builder")}
              </h2>
              {currentCourse && (
                <span
                  style={{
                    background: currentCourse.isCurrent ? "rgba(34, 197, 94, 0.15)" : "rgba(234, 179, 8, 0.15)",
                    color: currentCourse.isCurrent ? "#16a34a" : "#ca8a04",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: "20px",
                    border: `1px solid ${currentCourse.isCurrent ? "rgba(34, 197, 94, 0.3)" : "rgba(234, 179, 8, 0.3)"}`
                  }}
                >
                  {currentCourse.isCurrent ? "● Published Active (v" + currentCourse.versionLabel + ")" : "Draft (v" + currentCourse.versionLabel + ")"}
                </span>
              )}
              {currentCourse?.isTemplate && (
                <span
                  style={{
                    background: "rgba(168, 85, 247, 0.15)",
                    color: "#c084fc",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: "20px",
                    border: "1px solid rgba(168, 85, 247, 0.3)"
                  }}
                >
                  {t("badge_template", "Template — hidden from drivers")}
                </span>
              )}
            </div>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
              {t("site_inductions_subtitle", "Create custom induction courses, configure slide audio voiceovers, lock forced-wait timers, and build interactive knowledge checks.")}
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Course Selector Dropdown */}
          <select
            value={selectedCourseId || ""}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            style={{
              padding: "10px 14px",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text)",
              fontWeight: 600,
              fontSize: "0.88rem",
              cursor: "pointer"
            }}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.isCurrent ? "Live v" + c.versionLabel : "Draft"})
              </option>
            ))}
          </select>

          {/* New Course Button */}
          <button
            onClick={() => {
              setNewCourseTitle("");
              setNewCourseDescription("");
              setShowCreateModal(true);
            }}
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "none",
              background: "#1e3a5f",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "0.88rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <Plus className="w-4 h-4" /> {t("btn_create_course", "Create Course")}
          </button>

          {/* Mark as template / remove template */}
          {currentCourse && (
            <button
              onClick={() => void handleToggleTemplate()}
              disabled={templateBusy}
              title={currentCourse.isTemplate ? "Stop using this as a template" : "Use this course as a reusable template"}
              style={{
                padding: "10px 16px",
                borderRadius: "12px",
                border: "1px solid rgba(168,85,247,.4)",
                background: currentCourse.isTemplate ? "rgba(168,85,247,.18)" : "rgba(168,85,247,.08)",
                color: "#c084fc",
                fontWeight: 700,
                fontSize: "0.88rem",
                cursor: templateBusy ? "not-allowed" : "pointer",
                opacity: templateBusy ? 0.6 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              {currentCourse.isTemplate ? <X className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {currentCourse.isTemplate ? t("btn_unmark_template", "Unmark Template") : t("btn_mark_template", "Mark as Template")}
            </button>
          )}

          {/* Create a site variant from a template */}
          <button
            onClick={() => void handleOpenCloneModal()}
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "1px solid #2563eb",
              background: "rgba(37, 99, 235, 0.1)",
              color: "#2563eb",
              fontWeight: 700,
              fontSize: "0.88rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <Layers className="w-4 h-4" /> {t("btn_new_site_from_template", "New Site from Template")}
          </button>

          {/* Publish this course's slides to drivers */}
          {currentCourse && (
            <button
              onClick={() => void handlePublishToDrivers()}
              disabled={templateBusy}
              style={{
                padding: "10px 16px",
                borderRadius: "12px",
                border: "none",
                background: "#2563eb",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "0.88rem",
                cursor: templateBusy ? "not-allowed" : "pointer",
                opacity: templateBusy ? 0.6 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <Sparkles className="w-4 h-4" /> {t("btn_publish_to_drivers", "Publish to Drivers")}
            </button>
          )}

          {/* Preview / Test Induction Button */}
          <button
            onClick={startPreview}
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "1px solid #2563eb",
              background: "rgba(37, 99, 235, 0.1)",
              color: "#2563eb",
              fontWeight: 700,
              fontSize: "0.88rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <Eye className="w-4 h-4" /> {t("btn_test_induction", "Test Induction")}
          </button>

          {/* Publish Button */}
          {currentCourse && (
            <button
              onClick={() => {
                setPublishVersionLabel(currentCourse.versionLabel || "1.1");
                setPublishRevisionNotes("");
                setShowPublishModal(true);
              }}
              style={{
                padding: "10px 16px",
                borderRadius: "12px",
                border: "none",
                background: "#22c55e",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "0.88rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <CheckCircle2 className="w-4 h-4" /> {t("btn_publish_version", "Publish Version")}
            </button>
          )}

          {/* Delete Course Button */}
          {currentCourse && courses.length > 1 && (
            <button
              onClick={() => handleDeleteCourse(currentCourse.id)}
              style={{
                padding: "10px 12px",
                borderRadius: "12px",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                background: "rgba(239, 68, 68, 0.1)",
                color: "#ef4444",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center"
              }}
              title="Delete this course"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Course Builder Layout: Slide List (Left) + Slide Editor (Right) */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "24px", alignItems: "start" }}>
        {/* Left Sidebar: Sequential Slide Management */}
        <div
          className="glass"
          style={{
            padding: "20px",
            borderRadius: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ fontSize: "1rem" }}>{t("slides_outline", "Course Slides")}</strong>
              <div className="muted" style={{ fontSize: "0.78rem" }}>
                {slides.length} {slides.length === 1 ? "slide" : "slides"} total
              </div>
            </div>
            <button
              onClick={handleAddSlide}
              disabled={saving}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "none",
                background: "#2563eb",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "0.8rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px"
              }}
            >
              <Plus className="w-3.5 h-3.5" /> Add Slide
            </button>
          </div>

          {/* Slide List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "650px", overflowY: "auto" }}>
            {slides.map((s, idx) => {
              const isSelected = s.id === selectedSlideId;
              const hasAudio = Boolean(s.audioUrl);
              const hasWait = Boolean(s.forcedWaitSeconds && s.forcedWaitSeconds > 0);
              const qCount = (slideQuestions[s.id] || []).length;

              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedSlideId(s.id)}
                  style={{
                    padding: "12px",
                    borderRadius: "14px",
                    border: isSelected ? "2px solid #2563eb" : "1px solid var(--border)",
                    background: isSelected ? "rgba(37, 99, 235, 0.08)" : "var(--bg-elevated)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    transition: "all 0.15s ease"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          width: "22px",
                          height: "22px",
                          borderRadius: "50%",
                          background: isSelected ? "#2563eb" : "rgba(148,163,184,0.2)",
                          color: isSelected ? "#fff" : "var(--muted)",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}
                      >
                        {idx + 1}
                      </span>
                      <strong
                        style={{
                          fontSize: "0.88rem",
                          color: isSelected ? "#2563eb" : "var(--text)",
                          lineHeight: 1.25,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "180px"
                        }}
                      >
                        {s.title}
                      </strong>
                    </div>

                    {/* Up / Down Controls */}
                    <div style={{ display: "flex", gap: "2px" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleMoveSlide(idx, "up")}
                        disabled={idx === 0}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: idx === 0 ? "not-allowed" : "pointer",
                          opacity: idx === 0 ? 0.3 : 0.8,
                          padding: "2px"
                        }}
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveSlide(idx, "down")}
                        disabled={idx === slides.length - 1}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: idx === slides.length - 1 ? "not-allowed" : "pointer",
                          opacity: idx === slides.length - 1 ? 0.3 : 0.8,
                          padding: "2px"
                        }}
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Feature Badges for slide (Audio, Timer, Questions) */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", fontSize: "0.72rem" }}>
                    {hasAudio && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                          padding: "2px 6px",
                          borderRadius: "6px",
                          background: "rgba(168, 85, 247, 0.12)",
                          color: "#9333ea",
                          fontWeight: 600
                        }}
                      >
                        <Volume2 className="w-3 h-3" /> Audio
                      </span>
                    )}

                    {hasWait && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                          padding: "2px 6px",
                          borderRadius: "6px",
                          background: "rgba(249, 115, 22, 0.12)",
                          color: "#ea580c",
                          fontWeight: 600
                        }}
                      >
                        <Clock className="w-3 h-3" /> {s.forcedWaitSeconds}s lock
                      </span>
                    )}

                    {qCount > 0 && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                          padding: "2px 6px",
                          borderRadius: "6px",
                          background: "rgba(59, 130, 246, 0.12)",
                          color: "#2563eb",
                          fontWeight: 600
                        }}
                      >
                        <HelpCircle className="w-3 h-3" /> {qCount} check{qCount > 1 ? "s" : ""}
                      </span>
                    )}

                    {/* Duplicate & Delete Mini Buttons */}
                    <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleDuplicateSlide(s)}
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)", padding: "2px" }}
                        title="Duplicate slide"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteSlide(s.id)}
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: "#ef4444", padding: "2px" }}
                        title="Delete slide"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Stage: Detailed Slide Editor */}
        {currentSlide ? (
          <div
            className="glass"
            style={{
              padding: "28px",
              borderRadius: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "24px"
            }}
          >
            {/* Slide Title & Basic Type */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: "16px", alignItems: "flex-end" }}>
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                  {t("label_slide_title", "Slide Title")}
                </label>
                <input
                  type="text"
                  value={currentSlide.title}
                  onChange={(e) => handleUpdateCurrentSlide({ title: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-elevated)",
                    color: "var(--text)",
                    fontWeight: 700,
                    fontSize: "1rem"
                  }}
                  placeholder="e.g. 1. Site Access & Speed Limits"
                />
              </div>

              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                  {t("label_slide_type", "Slide Format")}
                </label>
                <select
                  value={currentSlide.slideType}
                  onChange={(e) => handleUpdateCurrentSlide({ slideType: e.target.value as any })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-elevated)",
                    color: "var(--text)",
                    fontWeight: 600,
                    fontSize: "0.88rem"
                  }}
                >
                  <option value="mixed">Mixed Media & Text</option>
                  <option value="text">Text Only</option>
                  <option value="image">Image Focus</option>
                  <option value="pdf">Document / Policy</option>
                  <option value="question">Knowledge Check Slide</option>
                </select>
              </div>
            </div>

            {/* Feature 2: Text Size Controls */}
            <div
              style={{
                background: "rgba(148,163,184,0.06)",
                padding: "16px",
                borderRadius: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                  <Type className="w-4 h-4 text-blue-500" /> {t("label_text_size", "Text Size Adjustment")}
                </span>
                <span className="muted" style={{ fontSize: "0.78rem" }}>
                  Adjusts content font size for mobile & in-cab tablet readability
                </span>
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {(
                  [
                    { key: "small", label: "Small (14px)" },
                    { key: "regular", label: "Regular (16px)" },
                    { key: "large", label: "Large (18px)" },
                    { key: "xlarge", label: "Extra Large (22px)" },
                    { key: "headline", label: "Headline (26px)" }
                  ] as const
                ).map((size) => {
                  const currentSize = currentSlide.contentJson?.textSize || "regular";
                  const isSelected = currentSize === size.key;
                  return (
                    <button
                      key={size.key}
                      onClick={() => handleUpdateCurrentSlide({ contentJsonUpdates: { textSize: size.key } })}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        border: isSelected ? "2px solid #2563eb" : "1px solid var(--border)",
                        background: isSelected ? "#2563eb" : "var(--bg-elevated)",
                        color: isSelected ? "#ffffff" : "var(--text)",
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                      }}
                    >
                      {size.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Slide Body Text */}
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                {t("label_slide_content", "Slide Instructions & Safety Protocols")}
              </label>
              <textarea
                rows={5}
                value={currentSlide.contentJson?.body || ""}
                onChange={(e) => handleUpdateCurrentSlide({ contentJsonUpdates: { body: e.target.value } })}
                placeholder="Detail the mandatory safety procedures, Chain of Responsibility policies, or site instructions..."
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-elevated)",
                  color: "var(--text)",
                  fontSize:
                    currentSlide.contentJson?.textSize === "small"
                      ? "0.88rem"
                      : currentSlide.contentJson?.textSize === "large"
                      ? "1.12rem"
                      : currentSlide.contentJson?.textSize === "xlarge"
                      ? "1.35rem"
                      : currentSlide.contentJson?.textSize === "headline"
                      ? "1.6rem"
                      : "1rem",
                  lineHeight: 1.5,
                  resize: "vertical"
                }}
              />
            </div>

            {/* Safety Warning Callout Banner (Optional) */}
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                {t("label_safety_callout", "Highlighted Safety Warning Box (Optional)")}
              </label>
              <input
                type="text"
                value={currentSlide.contentJson?.warningCallout || ""}
                onChange={(e) => handleUpdateCurrentSlide({ contentJsonUpdates: { warningCallout: e.target.value } })}
                placeholder="e.g. CRITICAL: 10 km/h yard speed limit is radar-enforced. Speeding triggers immediate site expulsion."
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  background: "rgba(239, 68, 68, 0.05)",
                  color: "var(--text)",
                  fontSize: "0.9rem"
                }}
              />
            </div>

            {/* Feature 4: Audio Voiceover Upload */}
            <div
              style={{
                background: "rgba(148,163,184,0.06)",
                padding: "18px",
                borderRadius: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: "0.92rem", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Volume2 className="w-4 h-4 text-purple-500" /> {t("label_voiceover", "Slide Audio Voiceover")}
                  </strong>
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.78rem" }}>
                    Upload spoken voiceover (MP3, WAV, M4A) for inductees with English as second language
                  </p>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleUploadAsset(e.target.files[0], "audio");
                    }}
                  />
                  <button
                    onClick={() => audioInputRef.current?.click()}
                    disabled={saving}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "10px",
                      border: "1px solid #a855f7",
                      background: "rgba(168, 85, 247, 0.1)",
                      color: "#9333ea",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload Voiceover
                  </button>

                  {currentSlide.audioUrl && (
                    <button
                      onClick={() => handleUpdateCurrentSlide({ audioUrl: null })}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "10px",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        background: "rgba(239, 68, 68, 0.1)",
                        color: "#ef4444",
                        cursor: "pointer"
                      }}
                      title="Remove Voiceover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Audio Player in Editor */}
              {currentSlide.audioUrl ? (
                <div
                  style={{
                    background: "var(--bg-elevated)",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px"
                  }}
                >
                  <button
                    onClick={togglePlayAudio}
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      border: "none",
                      background: "#9333ea",
                      color: "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 600 }}>Audio Voiceover Preview</span>
                      <span className="muted font-mono">
                        {Math.floor(audioProgress)}s / {Math.floor(audioDuration) || "--"}s
                      </span>
                    </div>
                    <div style={{ height: "6px", background: "rgba(148,163,184,0.2)", borderRadius: "3px", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${audioDuration > 0 ? (audioProgress / audioDuration) * 100 : 0}%`,
                          background: "#9333ea",
                          transition: "width 0.1s linear"
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: "0.82rem", color: "var(--muted)", fontStyle: "italic" }}>
                  No voiceover attached to this slide yet. Click Upload Voiceover to add an MP3/WAV narration.
                </div>
              )}
            </div>

            {/* Feature 5: Forced Wait Option */}
            <div
              style={{
                background: "rgba(148,163,184,0.06)",
                padding: "18px",
                borderRadius: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: "0.92rem", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Lock className="w-4 h-4 text-orange-500" /> {t("label_forced_wait", "Forced Wait Lock Timer")}
                  </strong>
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.78rem" }}>
                    Locks the slide for a minimum number of seconds before user can click 'Next'
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input
                    type="number"
                    min="0"
                    max="300"
                    value={currentSlide.forcedWaitSeconds || 0}
                    onChange={(e) => handleUpdateCurrentSlide({ forcedWaitSeconds: Math.max(0, parseInt(e.target.value) || 0) })}
                    style={{
                      width: "80px",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--bg-elevated)",
                      color: "var(--text)",
                      fontWeight: 700,
                      textAlign: "center"
                    }}
                  />
                  <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>seconds</span>
                </div>
              </div>

              {/* Quick Presets */}
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <span className="muted" style={{ fontSize: "0.78rem" }}>Quick Presets:</span>
                {[0, 5, 10, 15, 30, 60].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => handleUpdateCurrentSlide({ forcedWaitSeconds: sec })}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: (currentSlide.forcedWaitSeconds || 0) === sec ? "1px solid #ea580c" : "1px solid var(--border)",
                      background: (currentSlide.forcedWaitSeconds || 0) === sec ? "#ea580c" : "var(--bg-elevated)",
                      color: (currentSlide.forcedWaitSeconds || 0) === sec ? "#ffffff" : "var(--text)",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    {sec === 0 ? "None (0s)" : `${sec}s`}
                  </button>
                ))}
              </div>
            </div>

            {/* Feature 2: Attach Images or Documents */}
            <div
              style={{
                background: "rgba(148,163,184,0.06)",
                padding: "18px",
                borderRadius: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "14px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: "0.92rem", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FileText className="w-4 h-4 text-emerald-500" /> {t("label_attachments", "Image & Document Attachments")}
                  </strong>
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.78rem" }}>
                    Attach yard maps, SWMS policies, safety signs, or site evacuation diagrams
                  </p>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleUploadAsset(e.target.files[0], "image");
                    }}
                  />
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    disabled={saving}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #10b981",
                      background: "rgba(16, 185, 129, 0.1)",
                      color: "#10b981",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <ImageIcon className="w-3.5 h-3.5" /> Attach Image
                  </button>

                  <input
                    ref={documentInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleUploadAsset(e.target.files[0], "document");
                    }}
                  />
                  <button
                    onClick={() => documentInputRef.current?.click()}
                    disabled={saving}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #3b82f6",
                      background: "rgba(59, 130, 246, 0.1)",
                      color: "#2563eb",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <FileText className="w-3.5 h-3.5" /> Attach Document
                  </button>
                </div>
              </div>

              {/* Preview Attached Image */}
              {currentSlide.contentJson?.imageUrl && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)"
                  }}
                >
                  <img
                    src={currentSlide.contentJson.imageUrl}
                    alt="Attached"
                    style={{ width: "64px", height: "48px", objectFit: "cover", borderRadius: "6px" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                      {currentSlide.contentJson.imageCaption || "Attached Diagram / Photo"}
                    </div>
                    <span className="muted" style={{ fontSize: "0.75rem" }}>
                      Image displays on slide presentation
                    </span>
                  </div>
                  <button
                    onClick={() => handleUpdateCurrentSlide({ contentJsonUpdates: { imageUrl: null, imageCaption: null } })}
                    style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", padding: "4px" }}
                    title="Remove image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Preview Attached Document */}
              {currentSlide.contentJson?.docUrl && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)"
                  }}
                >
                  <FileText className="w-6 h-6 text-blue-500" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                      {currentSlide.contentJson.docName || "Site Safety Document"}
                    </div>
                    <span className="muted" style={{ fontSize: "0.75rem" }}>
                      Available for inductees to view and download
                    </span>
                  </div>
                  <button
                    onClick={() => handleUpdateCurrentSlide({ contentJsonUpdates: { docUrl: null, docName: null } })}
                    style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", padding: "4px" }}
                    title="Remove document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Feature 3: Knowledge Checks / Questions Management */}
            <div
              style={{
                background: "rgba(148,163,184,0.06)",
                padding: "20px",
                borderRadius: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "14px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: "1rem", display: "flex", alignItems: "center", gap: "6px" }}>
                    <HelpCircle className="w-4 h-4 text-blue-500" /> {t("label_knowledge_checks", "Knowledge Checks (Questions)")}
                  </strong>
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.8rem" }}>
                    Test inductees directly below the slide or on a separate assessment page
                  </p>
                </div>

                <button
                  onClick={handleOpenAddQuestion}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#2563eb",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Question
                </button>
              </div>

              {/* Questions List */}
              {currentQuestions.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {currentQuestions.map((q, idx) => (
                    <div
                      key={q.id}
                      style={{
                        padding: "14px",
                        borderRadius: "12px",
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "12px"
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "6px",
                              background: q.questionType === "text_input" ? "rgba(168, 85, 247, 0.12)" : "rgba(34, 197, 94, 0.12)",
                              color: q.questionType === "text_input" ? "#9333ea" : "#16a34a",
                              fontWeight: 700,
                              fontSize: "0.72rem"
                            }}
                          >
                            {q.questionType === "text_input"
                              ? "Text Input Question"
                              : q.questionType === "multiple_choice"
                              ? "Checkbox Question"
                              : "Single Choice Question"}
                          </span>

                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "6px",
                              background: "rgba(148, 163, 184, 0.15)",
                              color: "var(--muted)",
                              fontWeight: 600,
                              fontSize: "0.72rem"
                            }}
                          >
                            Placement: {q.placement === "separate_page" ? "Separate Page" : "Below Slide"}
                          </span>
                        </div>

                        <div style={{ fontWeight: 700, fontSize: "0.9rem", marginTop: "2px" }}>
                          {idx + 1}. {q.question}
                        </div>

                        {q.questionType !== "text_input" && (
                          <div className="muted" style={{ fontSize: "0.78rem" }}>
                            Options: {q.options.join(" | ")}
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          onClick={() => handleOpenEditQuestion(q)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: "1px solid var(--border)",
                            background: "transparent",
                            color: "var(--text)",
                            cursor: "pointer",
                            fontSize: "0.78rem"
                          }}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            background: "rgba(239, 68, 68, 0.1)",
                            color: "#ef4444",
                            cursor: "pointer",
                            fontSize: "0.78rem"
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "16px", textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
                  No knowledge check questions added to this slide yet. Click "+ Add Question" to configure validation.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="glass" style={{ padding: "40px", textAlign: "center", borderRadius: "20px" }}>
            <p className="muted">Select or create a slide to begin editing.</p>
          </div>
        )}
      </div>

      {/* ======================================================= */}
      {/* MODAL 1: Create Induction Course (Scratch vs Template)  */}
      {/* ======================================================= */}
      {showCloneModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "20px"
          }}
        >
          <div
            className="glass"
            style={{
              width: "100%",
              maxWidth: "600px",
              padding: "28px",
              borderRadius: "24px",
              boxShadow: "0 25px 60px rgba(0,0,0,0.3)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800 }}>{t("clone_modal_title", "New Site Induction from Template")}</h3>
              <button onClick={() => setShowCloneModal(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <p className="muted" style={{ fontSize: "0.84rem", margin: "0 0 18px" }}>
              {t("clone_modal_sub", "Every slide is copied — videos, images, documents, voiceovers, timers and questions. Only edit what differs for this site.")}
            </p>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--color-muted)", display: "block", marginBottom: "6px" }}>
                {t("clone_source", "Copy from template")}
              </label>
              <select
                value={cloneSourceId}
                onChange={(e) => setCloneSourceId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-elevated)",
                  color: "var(--text)",
                  fontWeight: 600,
                  fontSize: "0.88rem"
                }}
              >
                <option value="">{t("clone_pick_template", "Select a template...")}</option>
                {currentCourse && !currentCourse.isTemplate && (
                  <option value={currentCourse.id}>{currentCourse.title} ({t("label_current_course", "current course")})</option>
                )}
                {templateCourses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              {templateCourses.length === 0 && (
                <p className="muted" style={{ fontSize: "0.75rem", margin: "8px 0 0" }}>
                  {t("clone_no_templates", "No templates yet. Open a finished course and click “Mark as Template”.")}
                </p>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: "14px", marginBottom: "20px" }}>
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--color-muted)", display: "block", marginBottom: "6px" }}>
                  {t("clone_new_title", "New site induction name")}
                </label>
                <input
                  type="text"
                  value={cloneTitle}
                  onChange={(e) => setCloneTitle(e.target.value)}
                  placeholder={t("clone_new_title_ph", "e.g. Sydney Norton Site Induction")}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-elevated)",
                    color: "var(--text)",
                    fontWeight: 600,
                    fontSize: "0.88rem"
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--color-muted)", display: "block", marginBottom: "6px" }}>
                  {t("clone_site_tag", "Site tag")}
                </label>
                <input
                  type="text"
                  value={cloneSiteTag}
                  onChange={(e) => setCloneSiteTag(e.target.value.replace(/\s+/g, "_").toLowerCase())}
                  placeholder="sydney_norton"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-elevated)",
                    color: "var(--text)",
                    fontWeight: 600,
                    fontSize: "0.88rem"
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="btn" onClick={() => setShowCloneModal(false)}>{t("cancel", "Cancel")}</button>
              <button
                onClick={() => void handleClone()}
                disabled={templateBusy || !cloneSourceId || !cloneTitle.trim()}
                style={{
                  padding: "10px 18px",
                  borderRadius: "12px",
                  border: "none",
                  background: templateBusy || !cloneSourceId || !cloneTitle.trim() ? "#94a3b8" : "#1e3a5f",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  cursor: templateBusy ? "not-allowed" : "pointer"
                }}
              >
                {templateBusy ? t("clone_creating", "Creating...") : t("clone_create", "Create Site Induction")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "20px"
          }}
        >
          <div
            className="glass"
            style={{
              width: "100%",
              maxWidth: "600px",
              padding: "28px",
              borderRadius: "24px",
              boxShadow: "0 25px 60px rgba(0,0,0,0.3)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800 }}>Create Induction Course</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Template vs Scratch Tabs */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                background: "rgba(148,163,184,0.1)",
                padding: "4px",
                borderRadius: "12px",
                marginBottom: "20px"
              }}
            >
              <button
                type="button"
                onClick={() => setCreateMode("template")}
                style={{
                  padding: "10px",
                  borderRadius: "10px",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  background: createMode === "template" ? "#2563eb" : "transparent",
                  color: createMode === "template" ? "#ffffff" : "var(--muted)"
                }}
              >
                Use Pre-Built Template
              </button>
              <button
                type="button"
                onClick={() => setCreateMode("scratch")}
                style={{
                  padding: "10px",
                  borderRadius: "10px",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  background: createMode === "scratch" ? "#2563eb" : "transparent",
                  color: createMode === "scratch" ? "#ffffff" : "var(--muted)"
                }}
              >
                Create From Scratch
              </button>
            </div>

            {/* Template Picker — real templates only (courses flagged as templates) */}
            {createMode === "template" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)" }}>Choose a template:</label>
                {templateCourses.length === 0 ? (
                  <p className="muted" style={{ fontSize: "0.82rem", margin: 0 }}>
                    {t("create_no_templates", "No templates yet. Finish a course, click “Mark as Template”, then use the “New Site from Template” button to copy it.")}
                  </p>
                ) : (
                  templateCourses.map((tmpl) => {
                    const isSelected = selectedTemplateId === tmpl.id;
                    return (
                      <div
                        key={tmpl.id}
                        onClick={() => {
                          setSelectedTemplateId(tmpl.id);
                          if (!newCourseTitle) setNewCourseTitle(tmpl.title);
                        }}
                        style={{
                          padding: "14px",
                          borderRadius: "12px",
                          border: isSelected ? "2px solid #2563eb" : "1px solid var(--border)",
                          background: isSelected ? "rgba(37,99,235,0.08)" : "var(--bg-elevated)",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px"
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{tmpl.title}</div>
                          {tmpl.description && (
                            <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.8rem" }}>{tmpl.description}</p>
                          )}
                        </div>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "6px",
                            background: "rgba(168,85,247,.15)",
                            color: "#c084fc",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            whiteSpace: "nowrap"
                          }}
                        >
                          {t("label_template", "Template")}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  Course Title:
                </label>
                <input
                  type="text"
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  placeholder="e.g. BNT Logistics Heavy Vehicle Driver Induction"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-elevated)",
                    color: "var(--text)",
                    fontWeight: 600
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  Description / Overview:
                </label>
                <textarea
                  rows={3}
                  value={newCourseDescription}
                  onChange={(e) => setNewCourseDescription(e.target.value)}
                  placeholder="Summary of compliance learning objectives, target depot locations, and requirements..."
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-elevated)",
                    color: "var(--text)",
                    resize: "vertical"
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCourse}
                  disabled={saving}
                  style={{
                    padding: "10px 24px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#2563eb",
                    color: "#ffffff",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  {saving ? "Creating..." : "Create Course"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL 2: Question / Knowledge Check Editor Modal       */}
      {/* ======================================================= */}
      {showQuestionModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "20px"
          }}
        >
          <div
            className="glass"
            style={{
              width: "100%",
              maxWidth: "640px",
              padding: "28px",
              borderRadius: "24px",
              boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
              maxHeight: "90vh",
              overflowY: "auto"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800 }}>
                {editingQuestion ? "Edit Knowledge Check Question" : "Add Knowledge Check Question"}
              </h3>
              <button onClick={() => setShowQuestionModal(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Question Type Selection */}
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                  Question Type:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                  {[
                    { key: "single_choice", label: "Single Choice" },
                    { key: "multiple_choice", label: "Checkbox (Multi)" },
                    { key: "text_input", label: "Open Text Input" }
                  ].map((tItem) => (
                    <button
                      key={tItem.key}
                      type="button"
                      onClick={() => setQuestionType(tItem.key as any)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: questionType === tItem.key ? "2px solid #2563eb" : "1px solid var(--border)",
                        background: questionType === tItem.key ? "rgba(37,99,235,0.1)" : "var(--bg-elevated)",
                        color: questionType === tItem.key ? "#2563eb" : "var(--text)",
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        cursor: "pointer"
                      }}
                    >
                      {tItem.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Placement Selection */}
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                  Placement:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[
                    { key: "below_slide", label: "Below Slide (Same Page)" },
                    { key: "separate_page", label: "Separate Page (Dedicated Step)" }
                  ].map((pItem) => (
                    <button
                      key={pItem.key}
                      type="button"
                      onClick={() => setQuestionPlacement(pItem.key as any)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: questionPlacement === pItem.key ? "2px solid #2563eb" : "1px solid var(--border)",
                        background: questionPlacement === pItem.key ? "rgba(37,99,235,0.1)" : "var(--bg-elevated)",
                        color: questionPlacement === pItem.key ? "#2563eb" : "var(--text)",
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        cursor: "pointer"
                      }}
                    >
                      {pItem.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Text */}
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                  Question Prompt:
                </label>
                <textarea
                  rows={2}
                  value={questionPrompt}
                  onChange={(e) => setQuestionPrompt(e.target.value)}
                  placeholder="e.g. What is the maximum yard speed limit for heavy vehicles inside BNT Logistics terminals?"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-elevated)",
                    color: "var(--text)",
                    fontWeight: 600,
                    resize: "vertical"
                  }}
                />
              </div>

              {/* Options for single_choice and multiple_choice */}
              {questionType !== "text_input" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)" }}>
                      Options & Correct Answer:
                    </label>
                    <button
                      type="button"
                      onClick={() => setQuestionOptions([...questionOptions, `Option ${questionOptions.length + 1}`])}
                      style={{ border: "none", background: "transparent", color: "#2563eb", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}
                    >
                      + Add Option
                    </button>
                  </div>

                  {questionOptions.map((opt, oi) => {
                    const isChecked =
                      questionType === "multiple_choice"
                        ? correctAnswerIndices.includes(oi)
                        : correctAnswerIndex === oi;

                    return (
                      <div key={oi} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <input
                          type={questionType === "multiple_choice" ? "checkbox" : "radio"}
                          name="correct_answer"
                          checked={isChecked}
                          onChange={() => {
                            if (questionType === "multiple_choice") {
                              if (correctAnswerIndices.includes(oi)) {
                                setCorrectAnswerIndices(correctAnswerIndices.filter((idx) => idx !== oi));
                              } else {
                                setCorrectAnswerIndices([...correctAnswerIndices, oi]);
                              }
                            } else {
                              setCorrectAnswerIndex(oi);
                            }
                          }}
                          style={{ cursor: "pointer", width: "18px", height: "18px" }}
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...questionOptions];
                            newOpts[oi] = e.target.value;
                            setQuestionOptions(newOpts);
                          }}
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            borderRadius: "8px",
                            border: "1px solid var(--border)",
                            background: "var(--bg-elevated)",
                            color: "var(--text)"
                          }}
                        />
                        {questionOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              setQuestionOptions(questionOptions.filter((_, idx) => idx !== oi));
                              setCorrectAnswerIndices(correctAnswerIndices.filter((idx) => idx !== oi));
                            }}
                            style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer" }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <span className="muted" style={{ fontSize: "0.75rem" }}>
                    Mark the radio button or checkbox next to the correct answer(s).
                  </span>
                </div>
              )}

              {/* Text Input Feedback Hint */}
              {questionType === "text_input" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ padding: "12px", borderRadius: "10px", background: "rgba(168, 85, 247, 0.08)", fontSize: "0.82rem" }}>
                    <strong>Open-Ended Text Question:</strong> Inductee must type a response or feedback into an input box before proceeding.
                  </div>

                  <div>
                    <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                      Accepted answers (leave empty to accept any response)
                    </label>
                    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                      {acceptedAnswers.map((ans, ai) => (
                        <div key={ai} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input
                            type="text"
                            value={ans}
                            onChange={(e) => {
                              const next = [...acceptedAnswers];
                              next[ai] = e.target.value;
                              setAcceptedAnswers(next);
                            }}
                            placeholder="e.g. 10 km/h"
                            style={{
                              flex: 1,
                              padding: "8px 12px",
                              borderRadius: "8px",
                              border: "1px solid var(--border)",
                              background: "var(--bg-elevated)",
                              color: "var(--text)",
                              fontSize: "0.88rem"
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setAcceptedAnswers(acceptedAnswers.filter((_, i) => i !== ai))}
                            style={{ border: "none", background: "transparent", cursor: "pointer", color: "#f87171", padding: "6px" }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setAcceptedAnswers([...acceptedAnswers, ""])}
                        style={{
                          alignSelf: "flex-start",
                          padding: "7px 12px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          background: "transparent",
                          color: "var(--text)",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        + Add accepted answer
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Explanation */}
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  Explanation / Review Feedback:
                </label>
                <textarea
                  rows={2}
                  value={questionExplanation}
                  onChange={(e) => setQuestionExplanation(e.target.value)}
                  placeholder="Explanation shown to inductee when reviewing compliance rules..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-elevated)",
                    color: "var(--text)",
                    fontSize: "0.88rem",
                    resize: "vertical"
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuestion}
                  disabled={saving}
                  style={{
                    padding: "10px 24px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#2563eb",
                    color: "#ffffff",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  {saving ? "Saving..." : "Save Question"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL 3: Publish Induction Course Modal                */}
      {/* ======================================================= */}
      {showPublishModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "20px"
          }}
        >
          <div
            className="glass"
            style={{
              width: "100%",
              maxWidth: "500px",
              padding: "28px",
              borderRadius: "24px",
              boxShadow: "0 25px 60px rgba(0,0,0,0.3)"
            }}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: "1.25rem", fontWeight: 800 }}>Publish Course Version</h3>
            <p className="muted" style={{ margin: "0 0 20px", fontSize: "0.88rem" }}>
              Publishing will make this course the active compliance baseline for all site drivers.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  Version Label:
                </label>
                <input
                  type="text"
                  value={publishVersionLabel}
                  onChange={(e) => setPublishVersionLabel(e.target.value)}
                  placeholder="e.g. 1.1 or 2026.1"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-elevated)",
                    color: "var(--text)",
                    fontWeight: 700
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  Revision Notes:
                </label>
                <textarea
                  rows={3}
                  value={publishRevisionNotes}
                  onChange={(e) => setPublishRevisionNotes(e.target.value)}
                  placeholder="Details of safety updates, regulatory changes, or new speed limit protocols..."
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-elevated)",
                    color: "var(--text)",
                    resize: "vertical"
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePublishCourse}
                  disabled={saving}
                  style={{
                    padding: "10px 24px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#22c55e",
                    color: "#ffffff",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  {saving ? "Publishing..." : "Confirm & Publish"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL 4: Interactive Test Induction / Course Player     */}
      {/* ======================================================= */}
      {showPreviewModal && slides[previewSlideIndex] && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(8px)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "24px"
          }}
        >
          <div
            className="glass"
            style={{
              width: "100%",
              maxWidth: "840px",
              maxHeight: "92vh",
              overflowY: "auto",
              padding: "36px",
              borderRadius: "28px",
              boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
              gap: "24px"
            }}
          >
            {/* Header: Progress & Close */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#2563eb"
                  }}
                >
                  Induction Mode: {currentCourse?.title}
                </span>
                <h3 style={{ margin: "4px 0 0", fontSize: "1.3rem", fontWeight: 800 }}>
                  {slides[previewSlideIndex].title}
                </h3>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span
                  style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    background: "rgba(148,163,184,0.15)",
                    fontSize: "0.85rem",
                    fontWeight: 700
                  }}
                >
                  Slide {previewSlideIndex + 1} of {slides.length}
                </span>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)" }}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ height: "6px", background: "rgba(148,163,184,0.2)", borderRadius: "3px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${((previewSlideIndex + 1) / slides.length) * 100}%`,
                  background: "#2563eb",
                  transition: "width 0.3s ease"
                }}
              />
            </div>

            {previewCompleted ? (
              /* Completion Screen */
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div
                  style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "50%",
                    background: "rgba(34, 197, 94, 0.15)",
                    color: "#16a34a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 20px"
                  }}
                >
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 style={{ fontSize: "1.6rem", fontWeight: 800, margin: "0 0 10px" }}>
                  Induction Completed Successfully!
                </h2>
                <p className="muted" style={{ maxWidth: "500px", margin: "0 auto 28px", fontSize: "0.95rem" }}>
                  You have reviewed all {slides.length} slides, waited through mandatory timers, and answered all knowledge check questions.
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
                  <button
                    onClick={() => {
                      setPreviewSlideIndex(0);
                      setPreviewCompleted(false);
                      initPreviewSlide(0);
                    }}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      background: "transparent",
                      color: "var(--text)",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    <RotateCcw className="w-4 h-4" /> Restart Test
                  </button>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    style={{
                      padding: "10px 24px",
                      borderRadius: "12px",
                      border: "none",
                      background: "#2563eb",
                      color: "#ffffff",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            ) : (
              /* Slide Content Display */
              <>
                {/* Feature 4: Audio Voiceover in Test Player */}
                {slides[previewSlideIndex].audioUrl && (
                  <div
                    style={{
                      padding: "14px 18px",
                      borderRadius: "14px",
                      background: "rgba(168, 85, 247, 0.1)",
                      border: "1px solid rgba(168, 85, 247, 0.25)",
                      display: "flex",
                      alignItems: "center",
                      gap: "14px"
                    }}
                  >
                    <Volume2 className="w-6 h-6 text-purple-600 flex-shrink-0" />
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: "0.88rem", color: "#9333ea", display: "block" }}>
                        Audio Narration Available
                      </strong>
                      <span className="muted" style={{ fontSize: "0.78rem" }}>
                        Listen to the slide spoken instructions
                      </span>
                    </div>
                    <audio controls src={slides[previewSlideIndex].audioUrl} style={{ height: "36px" }} />
                  </div>
                )}

                {/* Feature 2: Image Attachment Display */}
                {slides[previewSlideIndex].contentJson?.imageUrl && (
                  <div style={{ borderRadius: "16px", overflow: "hidden", border: "1px solid var(--border)" }}>
                    <img
                      src={slides[previewSlideIndex].contentJson.imageUrl}
                      alt="Slide Visual"
                      style={{ width: "100%", maxHeight: "320px", objectFit: "cover" }}
                    />
                    {slides[previewSlideIndex].contentJson.imageCaption && (
                      <div
                        style={{
                          padding: "8px 14px",
                          background: "var(--bg-elevated)",
                          fontSize: "0.8rem",
                          color: "var(--muted)",
                          borderTop: "1px solid var(--border)"
                        }}
                      >
                        {slides[previewSlideIndex].contentJson.imageCaption}
                      </div>
                    )}
                  </div>
                )}

                {/* Feature 2: Text Size Rendering */}
                <div
                  style={{
                    fontSize:
                      slides[previewSlideIndex].contentJson?.textSize === "small"
                        ? "0.9rem"
                        : slides[previewSlideIndex].contentJson?.textSize === "large"
                        ? "1.2rem"
                        : slides[previewSlideIndex].contentJson?.textSize === "xlarge"
                        ? "1.4rem"
                        : slides[previewSlideIndex].contentJson?.textSize === "headline"
                        ? "1.65rem"
                        : "1.05rem",
                    lineHeight: 1.6,
                    color: "var(--text)"
                  }}
                >
                  {slides[previewSlideIndex].contentJson?.body}
                </div>

                {/* Bullet Points */}
                {slides[previewSlideIndex].contentJson?.bulletPoints &&
                  slides[previewSlideIndex].contentJson.bulletPoints.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: "24px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {slides[previewSlideIndex].contentJson.bulletPoints.map((pt: string, pi: number) => (
                        <li key={pi} style={{ fontSize: "0.95rem" }}>
                          {pt}
                        </li>
                      ))}
                    </ul>
                  )}

                {/* Warning Callout Box */}
                {slides[previewSlideIndex].contentJson?.warningCallout && (
                  <div
                    style={{
                      padding: "14px 18px",
                      borderRadius: "12px",
                      background: "rgba(239, 68, 68, 0.08)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      color: "#b91c1c",
                      fontSize: "0.92rem",
                      fontWeight: 700
                    }}
                  >
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span>{slides[previewSlideIndex].contentJson.warningCallout}</span>
                  </div>
                )}

                {/* Feature 2: Document Attachment Download Link */}
                {slides[previewSlideIndex].contentJson?.docUrl && (
                  <div
                    style={{
                      padding: "12px 18px",
                      borderRadius: "12px",
                      background: "rgba(59, 130, 246, 0.08)",
                      border: "1px solid rgba(59, 130, 246, 0.25)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div>
                        <strong style={{ fontSize: "0.88rem" }}>
                          {slides[previewSlideIndex].contentJson.docName || "Mandatory Policy Document"}
                        </strong>
                        <div className="muted" style={{ fontSize: "0.75rem" }}>
                          Review or download before proceeding
                        </div>
                      </div>
                    </div>
                    <a
                      href={slides[previewSlideIndex].contentJson.docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        background: "#2563eb",
                        color: "#ffffff",
                        textDecoration: "none",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      <Download className="w-3.5 h-3.5" /> View / Download
                    </a>
                  </div>
                )}

                {/* Feature 3: Knowledge Checks (Below Slide & Separate Page) */}
                {slideQuestions[slides[previewSlideIndex].id] &&
                  slideQuestions[slides[previewSlideIndex].id].length > 0 && (
                    <div
                      style={{
                        marginTop: "16px",
                        padding: "20px",
                        borderRadius: "16px",
                        background: "rgba(148,163,184,0.06)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <HelpCircle className="w-5 h-5 text-blue-600" />
                        <strong style={{ fontSize: "1rem" }}>Knowledge Check Assessment</strong>
                      </div>

                      {slideQuestions[slides[previewSlideIndex].id].map((q) => {
                        const err = previewErrors[String(q.id)];
                        const qAns = previewAnswers[String(q.id)];

                        return (
                          <div
                            key={q.id}
                            style={{
                              padding: "16px",
                              borderRadius: "12px",
                              background: "var(--bg-elevated)",
                              border: err ? "1px solid #ef4444" : "1px solid var(--border)",
                              display: "flex",
                              flexDirection: "column",
                              gap: "10px"
                            }}
                          >
                            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{q.question}</div>

                            {/* Single Choice Radio Options */}
                            {q.questionType === "single_choice" && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {q.options.map((opt, oi) => (
                                  <label
                                    key={oi}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "10px",
                                      padding: "8px 12px",
                                      borderRadius: "8px",
                                      background: qAns === oi ? "rgba(37,99,235,0.08)" : "transparent",
                                      cursor: "pointer"
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name={`preview_q_${q.id}`}
                                      checked={qAns === oi}
                                      onChange={() => {
                                        setPreviewAnswers({ ...previewAnswers, [String(q.id)]: oi });
                                        if (previewErrors[String(q.id)]) {
                                          const copy = { ...previewErrors };
                                          delete copy[String(q.id)];
                                          setPreviewErrors(copy);
                                        }
                                      }}
                                    />
                                    <span style={{ fontSize: "0.9rem" }}>{opt}</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {/* Multiple Choice Checkbox Options */}
                            {q.questionType === "multiple_choice" && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {q.options.map((opt, oi) => {
                                  const selectedList = Array.isArray(qAns) ? qAns : [];
                                  const isChecked = selectedList.includes(oi);

                                  return (
                                    <label
                                      key={oi}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                        padding: "8px 12px",
                                        borderRadius: "8px",
                                        background: isChecked ? "rgba(37,99,235,0.08)" : "transparent",
                                        cursor: "pointer"
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          const nextList = isChecked
                                            ? selectedList.filter((item: number) => item !== oi)
                                            : [...selectedList, oi];
                                          setPreviewAnswers({ ...previewAnswers, [String(q.id)]: nextList });
                                          if (previewErrors[String(q.id)]) {
                                            const copy = { ...previewErrors };
                                            delete copy[String(q.id)];
                                            setPreviewErrors(copy);
                                          }
                                        }}
                                      />
                                      <span style={{ fontSize: "0.9rem" }}>{opt}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}

                            {/* Open Text Input Question */}
                            {q.questionType === "text_input" && (
                              <div>
                                <textarea
                                  rows={3}
                                  value={typeof qAns === "string" ? qAns : ""}
                                  onChange={(e) => {
                                    setPreviewAnswers({ ...previewAnswers, [String(q.id)]: e.target.value });
                                    if (previewErrors[String(q.id)]) {
                                      const copy = { ...previewErrors };
                                      delete copy[String(q.id)];
                                      setPreviewErrors(copy);
                                    }
                                  }}
                                  placeholder="Type your response or confirmation here..."
                                  style={{
                                    width: "100%",
                                    padding: "10px 14px",
                                    borderRadius: "8px",
                                    border: "1px solid var(--border)",
                                    background: "var(--bg)",
                                    color: "var(--text)",
                                    fontSize: "0.9rem"
                                  }}
                                />
                              </div>
                            )}

                            {err && (
                              <div
                                style={{
                                  fontSize: "0.82rem",
                                  color: "#ef4444",
                                  fontWeight: 600,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px"
                                }}
                              >
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                {err}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                {/* Feature 5: Forced Wait Status Banner */}
                {previewCountdown > 0 && (
                  <div
                    style={{
                      padding: "12px 18px",
                      borderRadius: "12px",
                      background: "rgba(249, 115, 22, 0.1)",
                      border: "1px solid rgba(249, 115, 22, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      color: "#c2410c"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Lock className="w-5 h-5 flex-shrink-0" />
                      <div>
                        <strong style={{ fontSize: "0.88rem" }}>Compliance Timer Active</strong>
                        <div style={{ fontSize: "0.78rem" }}>
                          Please review the material. You cannot continue until the timer expires.
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "6px 14px",
                        borderRadius: "20px",
                        background: "#ea580c",
                        color: "#ffffff",
                        fontWeight: 800,
                        fontSize: "0.9rem"
                      }}
                    >
                      ⏱ {previewCountdown}s
                    </div>
                  </div>
                )}

                {/* Navigation Buttons: Previous & Next */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
                  <button
                    onClick={handlePreviewPrev}
                    disabled={previewSlideIndex === 0}
                    style={{
                      padding: "12px 22px",
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      background: "transparent",
                      color: "var(--text)",
                      fontWeight: 700,
                      cursor: previewSlideIndex === 0 ? "not-allowed" : "pointer",
                      opacity: previewSlideIndex === 0 ? 0.3 : 1,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    <ChevronLeft className="w-5 h-5" /> Previous Slide
                  </button>

                  <button
                    onClick={handlePreviewNext}
                    disabled={previewCountdown > 0}
                    style={{
                      padding: "12px 28px",
                      borderRadius: "12px",
                      border: "none",
                      background: previewCountdown > 0 ? "rgba(148,163,184,0.4)" : "#2563eb",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      cursor: previewCountdown > 0 ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      transition: "all 0.2s ease"
                    }}
                  >
                    {previewCountdown > 0 ? (
                      <>
                        <Lock className="w-4 h-4" /> Locked ({previewCountdown}s)
                      </>
                    ) : (
                      <>
                        {previewSlideIndex === slides.length - 1 ? "Complete Induction" : "Next Slide"}{" "}
                        <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
