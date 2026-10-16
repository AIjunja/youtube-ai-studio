import React, { useEffect, useRef, useState } from "react";
import {
  API_ENDPOINTS,
  type ApiErrorResponse,
  type ModelCallLogEntry,
  type PlannedScene,
  type PlanResponse,
  type ProjectMode,
  type ReviseResponse,
  type SceneCode,
  type ScenePlan,
  type ScriptResponse,
  type TtsJsonResponse,
  type VerifyFrameInput,
  type VerifyReport,
  type VerifyResponse,
  type VoiceCloneResponse,
  type VoiceProfile,
} from "../../../shared/contract";
import {
  MOCK_MODEL_LOGS,
  MOCK_SCENE_CODES,
  MOCK_SCENE_PLAN,
  MOCK_VERIFY_REPORT,
} from "../../../shared/mockData";
import { ensureAllSceneCodes, exportCompositeVideo } from "../render";
import {
  buildInitialSceneCodes,
  renderSceneThumbnailDataUrl,
} from "../utils/canvasPreview";
import { ArgonDirectorPanel } from "./ArgonDirectorPanel";
import {
  CanvasPreviewPlayer,
  type PlayerSeekRequest,
} from "./CanvasPreviewPlayer";
import { TimelineComparison } from "./TimelineComparison";

const VOICE_STORAGE_KEY = "yt_ai_studio_voice_profile";
const MAX_VIDEO_BYTES = 30 * 1024 * 1024; // 30MB
const MAX_VIDEO_DURATION_SEC = 150.5; // 150초

export type FlowType = "upload" | "scratch";
export type WizardStep =
  | "voice"
  | "upload"
  | "scratch-input"
  | "mode-select"
  | "producing"
  | "review"
  | "export";

interface AiCreateViewProps {
  initialFlow?: "upload" | "scratch" | "sample" | null;
  onConsumeInitialFlow?: () => void;
}

function nowTimeStr(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

function loadSavedVoiceProfile(): VoiceProfile | null {
  try {
    const raw = localStorage.getItem(VOICE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VoiceProfile;
    if (parsed && typeof parsed.voiceId === "string") {
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function saveVoiceProfile(profile: VoiceProfile): void {
  try {
    localStorage.setItem(VOICE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

async function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("파일 읽기 실패"));
    reader.readAsDataURL(file);
  });
}

async function probeVideoDurationSec(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    const cleanup = () => {
      URL.revokeObjectURL(url);
      v.remove();
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 4000);
    v.onloadedmetadata = () => {
      clearTimeout(timer);
      const d = Number.isFinite(v.duration) ? v.duration : null;
      cleanup();
      resolve(d);
    };
    v.onerror = () => {
      clearTimeout(timer);
      cleanup();
      resolve(null);
    };
    v.src = url;
  });
}

async function probeAudioDataUrlDurationSec(
  dataUrl: string
): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const timer = setTimeout(() => {
      resolve(null);
    }, 3000);
    audio.onloadedmetadata = () => {
      clearTimeout(timer);
      resolve(Number.isFinite(audio.duration) ? audio.duration : null);
    };
    audio.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    audio.src = dataUrl;
  });
}

/**
 * WebAudio RMS boundary refinement: nudges cut boundaries to nearest low-energy frame
 * so speech is not clipped mid-syllable.
 */
async function refinePlanCutsWithAudio(
  plan: ScenePlan,
  videoFile: File | null
): Promise<ScenePlan> {
  if (!videoFile || plan.cuts.length === 0) return plan;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return plan;
    const arrayBuf = await videoFile.arrayBuffer();
    const ctx = new AudioCtx();
    const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
    const channelData = audioBuf.getChannelData(0);
    const sr = audioBuf.sampleRate;

    const findSilenceNear = (targetSec: number): number => {
      const windowSec = 0.15;
      const stepSec = 0.02;
      let bestSec = targetSec;
      let minRms = Number.POSITIVE_INFINITY;
      for (
        let t = Math.max(0, targetSec - windowSec);
        t <= Math.min(audioBuf.duration, targetSec + windowSec);
        t += stepSec
      ) {
        const i0 = Math.floor(t * sr);
        const i1 = Math.min(channelData.length, i0 + Math.floor(0.02 * sr));
        if (i1 <= i0) continue;
        let sum = 0;
        for (let i = i0; i < i1; i++) {
          sum += channelData[i] * channelData[i];
        }
        const rms = Math.sqrt(sum / (i1 - i0));
        if (rms < minRms) {
          minRms = rms;
          bestSec = Math.round(t * 100) / 100;
        }
      }
      return bestSec;
    };

    const refinedCuts = plan.cuts.map((c) => {
      const start = findSilenceNear(c.start);
      const end = Math.max(start + 0.2, findSilenceNear(c.end));
      return { ...c, start, end };
    });

    await ctx.close().catch(() => {});
    return {
      ...plan,
      cuts: refinedCuts,
    };
  } catch {
    return plan;
  }
}

export const AiCreateView: React.FC<AiCreateViewProps> = ({
  initialFlow,
  onConsumeInitialFlow,
}) => {
  // Voice Profile State
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(() =>
    loadSavedVoiceProfile()
  );
  const [voiceConsentChecked, setVoiceConsentChecked] = useState(false);
  const [voiceAudioFile, setVoiceAudioFile] = useState<File | null>(null);
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [voiceCloning, setVoiceCloning] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Flow & Stepper State
  const [flowType, setFlowType] = useState<FlowType>("upload");
  const [step, setStep] = useState<WizardStep>(() =>
    loadSavedVoiceProfile() ? "upload" : "voice"
  );
  const [projectMode, setProjectMode] =
    useState<ProjectMode>("edit-plus-script");
  const [isSampleMode, setIsSampleMode] = useState(false);

  // Upload / Scratch Inputs
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [probedDurationSec, setProbedDurationSec] = useState<number>(16.0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [shortVideoNotice, setShortVideoNotice] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [scratchTopic, setScratchTopic] = useState("");
  const [scratchNotes, setScratchNotes] = useState("");

  // Production Checklist Progress State
  const [checklistDone, setChecklistDone] = useState<{
    transcribed?: string;
    cutsRefined?: string;
    scriptWritten?: string;
    ttsRead?: string;
    scenesCoded?: string;
    verified?: string;
  }>({});
  const [produceProgressPct, setProduceProgressPct] = useState(0);
  const [produceError, setProduceError] = useState<string | null>(null);

  // Plan, Codes, Verification, Logs (null until produced or sample clicked!)
  const [plan, setPlan] = useState<ScenePlan | null>(null);
  const [basePlanBeforeCutToggles, setBasePlanBeforeCutToggles] =
    useState<ScenePlan | null>(null);
  const [sceneCodes, setSceneCodes] = useState<Record<string, SceneCode>>({});
  const [verifyReport, setVerifyReport] = useState<VerifyReport>({
    passed: false,
    retried: false,
    checks: [],
  });
  const [modelLogs, setModelLogs] = useState<ModelCallLogEntry[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string>("");
  const [activeCutMap, setActiveCutMap] = useState<Record<number, boolean>>({});
  const [seekRequest, setSeekRequest] = useState<PlayerSeekRequest | null>(
    null
  );

  // Revise / Verify / TTS / Export state
  const [revisingSceneId, setRevisingSceneId] = useState<string | null>(null);
  const [ttsLoadingSceneId, setTtsLoadingSceneId] = useState<string | null>(
    null
  );
  const [verifying, setVerifying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedVideoResult, setExportedVideoResult] = useState<{
    url: string;
    filename: string;
    sizeBytes: number;
    ext: "mp4" | "webm";
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const voiceFileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<number | null>(null);

  const appendLog = (entry: Omit<ModelCallLogEntry, "id" | "timestamp">) => {
    const newEntry: ModelCallLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowTimeStr(),
    };
    setModelLogs((prev) => [newEntry, ...prev]);
  };

  // Handle initialFlow prop from Dashboard or Header
  useEffect(() => {
    if (!initialFlow) return;
    onConsumeInitialFlow?.();
    if (initialFlow === "sample") {
      handleLoadSampleExperience();
    } else if (initialFlow === "scratch") {
      setFlowType("scratch");
      setIsSampleMode(false);
      setPlan(null);
      setStep(voiceProfile ? "scratch-input" : "voice");
    } else {
      setFlowType("upload");
      setIsSampleMode(false);
      setPlan(null);
      setStep(voiceProfile ? "upload" : "voice");
    }
  }, [initialFlow, onConsumeInitialFlow, voiceProfile]);

  // Reset to fresh creation flow
  const handleStartFresh = (targetFlow: FlowType = "upload") => {
    setIsSampleMode(false);
    setPlan(null);
    setBasePlanBeforeCutToggles(null);
    setSceneCodes({});
    setExportedVideoResult(null);
    setUploadError(null);
    setShortVideoNotice(null);
    setProduceError(null);
    setSelectedVideoFile(null);
    setUploadedVideoUrl(null);
    setUploadedFileName(null);
    setFlowType(targetFlow);
    if (voiceProfile) {
      setStep(targetFlow === "scratch" ? "scratch-input" : "upload");
    } else {
      setStep("voice");
    }
  };

  // Sample mode loader (ONLY when user clicks [샘플로 체험하기])
  const handleLoadSampleExperience = () => {
    setIsSampleMode(true);
    setUploadError(null);
    setShortVideoNotice(null);
    setProduceError(null);
    setUploadedFileName("sample_take.mp4");
    setProbedDurationSec(16.0);

    const cutMap: Record<number, boolean> = {};
    MOCK_SCENE_PLAN.cuts.forEach((c, idx) => {
      cutMap[idx] = c.confidence >= 0.7;
    });
    setActiveCutMap(cutMap);

    setPlan(MOCK_SCENE_PLAN);
    setBasePlanBeforeCutToggles(MOCK_SCENE_PLAN);
    setSceneCodes(buildInitialSceneCodes(MOCK_SCENE_CODES));
    setVerifyReport(MOCK_VERIFY_REPORT);
    setModelLogs(MOCK_MODEL_LOGS);
    setSelectedSceneId(
      MOCK_SCENE_PLAN.scenes[1]?.id || MOCK_SCENE_PLAN.scenes[0].id
    );
    setStep("review");
  };

  // ==================== STEP 1: VOICE REGISTRATION ====================
  const handleStartMicRecording = async () => {
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
        const recordedFile = new File([blob], "my-voice-10s.webm", {
          type: blob.type,
        });
        setVoiceAudioFile(recordedFile);
        setIsRecordingMic(false);
        if (recordingTimerRef.current) {
          window.clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(200);
      setIsRecordingMic(true);
      setRecordingSec(0);

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSec((prev) => {
          if (prev + 1 >= 10) {
            if (
              mediaRecorderRef.current &&
              mediaRecorderRef.current.state === "recording"
            ) {
              mediaRecorderRef.current.stop();
            }
            return 10;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      setVoiceError(
        `마이크 권한을 사용할 수 없습니다: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  };

  const handleStopMicRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleUseDefaultKoreVoice = () => {
    const profile: VoiceProfile = {
      voiceId: "Kore",
      label: "기본 음성 (Kore)",
      createdAt: new Date().toISOString(),
      isDefault: true,
    };
    saveVoiceProfile(profile);
    setVoiceProfile(profile);
    setVoiceError(null);
    setStep(flowType === "scratch" ? "scratch-input" : "upload");
  };

  const handleRegisterVoiceClone = async () => {
    if (!voiceAudioFile || !voiceConsentChecked) return;
    setVoiceCloning(true);
    setVoiceError(null);
    const t0 = performance.now();

    try {
      const referenceAudioBase64 = await fileToBase64(voiceAudioFile);
      const res = await fetch(API_ENDPOINTS.VOICE_CLONE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceAudioBase64,
          mimeType: voiceAudioFile.type || "audio/webm",
          consentConfirmed: true,
          label: "내 목소리",
        }),
      });

      if (!res.ok) {
        const errBody = (await res
          .json()
          .catch(() => null)) as ApiErrorResponse | null;
        const errMsg =
          errBody?.error?.message || `목소리 등록 실패 (HTTP ${res.status})`;
        appendLog({
          endpoint: "/api/voice/clone",
          model: "voice-clone",
          attempt: 1,
          durationMs: Math.round(performance.now() - t0),
          status: "error",
          detail: errMsg,
        });
        setVoiceError(errMsg);
        return;
      }

      const data = (await res.json()) as VoiceCloneResponse;
      if (data.modelLog) {
        setModelLogs((prev) => [data.modelLog!, ...prev]);
      }
      const profile: VoiceProfile = {
        voiceId: data.voiceId,
        label: data.label || "내 목소리",
        createdAt: new Date().toISOString(),
        isDefault: data.voiceId === "Kore",
      };
      saveVoiceProfile(profile);
      setVoiceProfile(profile);
      setStep(flowType === "scratch" ? "scratch-input" : "upload");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "목소리 등록 중 네트워크 오류가 발생했습니다.";
      setVoiceError(msg);
    } finally {
      setVoiceCloning(false);
    }
  };

  // ==================== STEP 2: VIDEO UPLOAD VALIDATION ====================
  const handleVideoFileSelected = async (file: File) => {
    if (!file) return;
    setUploadError(null);
    setShortVideoNotice(null);

    const isVideoExt = /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(file.name);
    const isVideoMime = file.type.startsWith("video/");
    if (!isVideoMime && !isVideoExt) {
      setUploadError(
        `지원하지 않는 파일 형식입니다 (${file.name}). MP4, WebM, MOV 동영상 파일을 올려주세요.`
      );
      return;
    }

    // 1) File size check: Max 30MB
    if (file.size > MAX_VIDEO_BYTES) {
      setUploadError("파일 크기가 30MB를 넘습니다. 720p로 줄여서 올려주세요.");
      return;
    }

    // 2) Video duration check via <video> metadata
    const durationSec = await probeVideoDurationSec(file);
    if (durationSec !== null && durationSec > MAX_VIDEO_DURATION_SEC) {
      setUploadError(
        "영상 길이는 최대 150초까지 올릴 수 있어요. 150초 이하로 잘라서 올려주세요."
      );
      return;
    }

    if (durationSec !== null && durationSec < 10) {
      setShortVideoNotice(
        "10초 미만의 짧은 영상이네요. 설명 장면을 추가하면 더 풍성해져요."
      );
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedVideoFile(file);
    setUploadedVideoUrl(objectUrl);
    setUploadedFileName(file.name);
    setProbedDurationSec(durationSec ?? 16.0);
    setIsSampleMode(false);
    setStep("mode-select");
  };

  // ==================== TTS HELPER (Concurrency <= 3) ====================
  const synthesizeSceneTtsInternal = async (
    scene: PlannedScene,
    voiceId: string
  ): Promise<PlannedScene> => {
    const text = (scene.script || scene.caption || "").trim();
    if (!text) return scene;
    const t0 = performance.now();
    try {
      const res = await fetch(API_ENDPOINTS.TTS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voiceId,
          sceneId: scene.id,
          format: "json",
        }),
      });
      if (!res.ok) {
        throw new Error(`TTS HTTP ${res.status}`);
      }
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = (await res.json()) as TtsJsonResponse;
        if (data.modelLog) {
          setModelLogs((prev) => [data.modelLog!, ...prev]);
        }
        const dataUrl = `data:${data.mimeType || "audio/wav"};base64,${data.audioBase64}`;
        const actualDur = await probeAudioDataUrlDurationSec(dataUrl);
        return {
          ...scene,
          audioBase64: data.audioBase64,
          audioUrl: dataUrl,
          durationSec:
            actualDur && actualDur > 1.0
              ? Math.round(actualDur * 10) / 10
              : data.durationSec || scene.durationSec,
        };
      } else {
        const blob = await res.blob();
        const b64 = await fileToBase64(blob);
        const url = URL.createObjectURL(blob);
        const actualDur = await probeAudioDataUrlDurationSec(url);
        appendLog({
          endpoint: "/api/tts",
          model: res.headers.get("X-Used-Model") || "gemini-tts",
          usedModel: res.headers.get("X-Used-Model") || undefined,
          sceneId: scene.id,
          attempt: 1,
          durationMs: Math.round(performance.now() - t0),
          status: "ok",
          detail: `장면 음성 합성 완료 (${scene.id})`,
        });
        return {
          ...scene,
          audioBase64: b64,
          audioUrl: url,
          durationSec:
            actualDur && actualDur > 1.0
              ? Math.round(actualDur * 10) / 10
              : scene.durationSec,
        };
      }
    } catch (err) {
      appendLog({
        endpoint: "/api/tts",
        model: "gemini-tts",
        sceneId: scene.id,
        attempt: 1,
        durationMs: Math.round(performance.now() - t0),
        status: "error",
        detail: `음성 합성 실패: ${err instanceof Error ? err.message : String(err)}`,
      });
      return scene;
    }
  };

  const synthesizeAllAiScenesTts = async (
    targetPlan: ScenePlan,
    voiceId: string
  ): Promise<ScenePlan> => {
    const updatedScenes = [...targetPlan.scenes];
    const aiIndices = updatedScenes
      .map((s, idx) => (s.kind === "motion" || s.kind === "ending" ? idx : -1))
      .filter((idx) => idx >= 0);

    // Concurrency limit = 3
    const concurrency = 3;
    for (let i = 0; i < aiIndices.length; i += concurrency) {
      const batch = aiIndices.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map((sceneIdx) =>
          synthesizeSceneTtsInternal(updatedScenes[sceneIdx], voiceId)
        )
      );
      batch.forEach((sceneIdx, bIdx) => {
        updatedScenes[sceneIdx] = results[bIdx];
      });
    }

    return {
      ...targetPlan,
      scenes: updatedScenes,
    };
  };

  // ==================== STEP 4: AI PRODUCTION PIPELINE ====================
  const handleRunProduction = async (modeOverride?: ProjectMode) => {
    const activeMode = modeOverride || projectMode;
    setStep("producing");
    setProduceError(null);
    setChecklistDone({});
    setProduceProgressPct(8);

    const activeVoiceId = voiceProfile?.voiceId || "Kore";

    try {
      let workingPlan: ScenePlan;

      if (activeMode === "script-only") {
        // Flow B: Script-only creation from topic + notes
        setProduceProgressPct(20);
        const t0 = performance.now();
        const res = await fetch(API_ENDPOINTS.SCRIPT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "from-scratch",
            topic: scratchTopic.trim() || "AI 자동화 핵심 요약",
            notes: scratchNotes.trim(),
          }),
        });

        if (!res.ok) {
          const errBody = (await res
            .json()
            .catch(() => null)) as ApiErrorResponse | null;
          throw new Error(
            errBody?.error?.message || `대본 생성 요청 실패 (HTTP ${res.status})`
          );
        }

        const scriptData = (await res.json()) as ScriptResponse;
        if (scriptData.modelLog) {
          setModelLogs((prev) => [scriptData.modelLog!, ...prev]);
        } else {
          appendLog({
            endpoint: "/api/script",
            model: scriptData.usedModel || "gemini",
            attempt: 1,
            durationMs: Math.round(performance.now() - t0),
            status: "ok",
            detail: `주제 대본 작성 완료 (${scriptData.scenes.length}개 장면)`,
          });
        }

        const mappedScenes: PlannedScene[] = (scriptData.scenes || []).map(
          (draft, idx, arr) => ({
            id: draft.id || `scene-scratch-${idx + 1}`,
            kind:
              draft.template === "ending" || idx === arr.length - 1
                ? "ending"
                : "motion",
            durationSec: draft.durationSec || 3.5,
            script: draft.script,
            caption: draft.caption,
            visualIdea: draft.visualIdea,
            template: draft.template,
            visuals: draft.visuals,
          })
        );

        workingPlan = scriptData.plan
          ? {
              ...scriptData.plan,
              mode: "script-only",
              scenes:
                scriptData.plan.scenes?.length > 0
                  ? scriptData.plan.scenes
                  : mappedScenes,
            }
          : {
              mode: "script-only",
              language: "ko",
              summary: scratchTopic.trim() || "AI 자동화 핵심 요약",
              transcript: [],
              keep: [],
              cuts: [],
              gaps: [],
              scenes: mappedScenes,
              uncertainFacts: [],
            };

        setChecklistDone((prev) => ({
          ...prev,
          scriptWritten: `빠진 설명 대본을 썼어요 (${workingPlan.scenes.length}개 장면)`,
        }));
      } else {
        // Flow A: Upload Video -> /api/plan
        if (!selectedVideoFile) {
          throw new Error("업로드된 영상 파일이 없습니다.");
        }

        const t0 = performance.now();
        const formData = new FormData();
        formData.append("video", selectedVideoFile);
        formData.append(
          "durationSec",
          String(Math.round(probedDurationSec * 10) / 10)
        );
        formData.append("mode", activeMode);
        formData.append("voiceId", activeVoiceId);

        const res = await fetch(API_ENDPOINTS.PLAN, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errBody = (await res
            .json()
            .catch(() => null)) as ApiErrorResponse | null;
          throw new Error(
            errBody?.error?.message || `영상 분석 요청 실패 (HTTP ${res.status})`
          );
        }

        const planData = (await res.json()) as PlanResponse;
        if (planData.modelLog) {
          setModelLogs((prev) => [planData.modelLog!, ...prev]);
        } else {
          appendLog({
            endpoint: "/api/plan",
            model: "gemini",
            attempt: 1,
            durationMs: Math.round(performance.now() - t0),
            status: "ok",
            detail: `원본 영상 분석 완료 (${planData.transcript.length}구절)`,
          });
        }

        workingPlan = {
          ...planData,
          mode: activeMode,
        };

        setChecklistDone((prev) => ({
          ...prev,
          transcribed: `말을 받아 적었어요 (${workingPlan.transcript.length}구절)`,
        }));
        setProduceProgressPct(30);

        // Step 4-2: Refine cut boundaries with WebAudio RMS
        workingPlan = await refinePlanCutsWithAudio(
          workingPlan,
          selectedVideoFile
        );
        setChecklistDone((prev) => ({
          ...prev,
          cutsRefined: `말이 끊긴 곳 ${workingPlan.cuts.length}군데를 다듬었어요`,
        }));
        setProduceProgressPct(45);

        // Step 4-3: If edit-plus-script, call /api/script to enrich narration scripts
        if (activeMode === "edit-plus-script") {
          const ts0 = performance.now();
          const scriptRes = await fetch(API_ENDPOINTS.SCRIPT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "append",
              plan: workingPlan,
            }),
          });
          if (scriptRes.ok) {
            const scriptData = (await scriptRes.json()) as ScriptResponse;
            if (scriptData.modelLog) {
              setModelLogs((prev) => [scriptData.modelLog!, ...prev]);
            }
            if (scriptData.plan) {
              workingPlan = {
                ...scriptData.plan,
                mode: activeMode,
              };
            } else if (
              Array.isArray(scriptData.scenes) &&
              scriptData.scenes.length > 0
            ) {
              const appended: PlannedScene[] = scriptData.scenes.map(
                (draft, idx) => ({
                  id: draft.id || `scene-append-${idx + 1}`,
                  kind: draft.template === "ending" ? "ending" : "motion",
                  durationSec: draft.durationSec || 3.5,
                  script: draft.script,
                  caption: draft.caption,
                  visualIdea: draft.visualIdea,
                  template: draft.template,
                  visuals: draft.visuals,
                })
              );
              const existingIds = new Set(workingPlan.scenes.map((s) => s.id));
              const merged = [...workingPlan.scenes];
              for (const sc of appended) {
                const idx = merged.findIndex((m) => m.id === sc.id);
                if (idx >= 0) {
                  merged[idx] = { ...merged[idx], ...sc };
                } else if (!existingIds.has(sc.id)) {
                  merged.splice(Math.max(0, merged.length - 1), 0, sc);
                }
              }
              workingPlan = {
                ...workingPlan,
                scenes: merged,
              };
            }
          } else {
            appendLog({
              endpoint: "/api/script",
              model: "gemini",
              attempt: 1,
              durationMs: Math.round(performance.now() - ts0),
              status: "fallback",
              detail: `보충 대본 API 응답 오류 (HTTP ${scriptRes.status}) — 기본 분석 대본을 유지합니다.`,
            });
          }

          setChecklistDone((prev) => ({
            ...prev,
            scriptWritten: `빠진 설명 대본을 썼어요`,
          }));
          setProduceProgressPct(60);
        }
      }

      // Step 4-4: If edit-plus-script or script-only, synthesize TTS for motion/ending scenes
      if (
        activeMode === "edit-plus-script" ||
        activeMode === "script-only"
      ) {
        workingPlan = await synthesizeAllAiScenesTts(
          workingPlan,
          activeVoiceId
        );
        setChecklistDone((prev) => ({
          ...prev,
          ttsRead: `내 목소리로 대본을 읽었어요`,
        }));
        setProduceProgressPct(75);
      }

      // Initialize cut toggle map (confidence >= 0.7 -> cut applied)
      const initialCutMap: Record<number, boolean> = {};
      workingPlan.cuts.forEach((c, idx) => {
        initialCutMap[idx] = c.confidence >= 0.7;
      });
      setActiveCutMap(initialCutMap);
      setPlan(workingPlan);
      setBasePlanBeforeCutToggles(workingPlan);

      // Step 4-5: Generate & validate Canvas 2D motion scene codes
      const motionCount = workingPlan.scenes.filter(
        (s) => s.kind === "motion" || s.kind === "ending"
      ).length;
      const validatedResult = await ensureAllSceneCodes(workingPlan, {
        onLog: (logEntry) => {
          setModelLogs((prev) => [logEntry, ...prev]);
        },
      });
      const nextCodes: Record<string, SceneCode> = {
        ...validatedResult.sceneCodes,
      };
      setSceneCodes(nextCodes);
      setChecklistDone((prev) => ({
        ...prev,
        scenesCoded: `설명 장면 ${motionCount}개를 만들었어요`,
      }));
      setProduceProgressPct(90);

      // Step 4-6: Visual verification (/api/verify)
      await runVerifyWithFrames(workingPlan, nextCodes);
      setChecklistDone((prev) => ({
        ...prev,
        verified: `완성 화면을 확인했어요`,
      }));
      setProduceProgressPct(100);

      const firstSceneId =
        workingPlan.scenes.find((s) => s.kind === "motion")?.id ||
        workingPlan.scenes[0]?.id ||
        "";
      setSelectedSceneId(firstSceneId);
      setStep("review");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "AI 제작 중 오류가 발생했습니다.";
      setProduceError(msg);
      appendLog({
        endpoint: activeMode === "script-only" ? "/api/script" : "/api/plan",
        model: "gemini",
        attempt: 1,
        durationMs: 0,
        status: "error",
        detail: msg,
      });
    }
  };

  // ==================== VERIFY FRAMES ====================
  const runVerifyWithFrames = async (
    targetPlan: ScenePlan | null = plan,
    targetCodes: Record<string, SceneCode> = sceneCodes
  ) => {
    if (!targetPlan) return;
    setVerifying(true);
    const t0 = performance.now();
    const targetScenes = targetPlan.scenes.filter(
      (s) => s.kind === "motion" || s.kind === "ending"
    );

    const frames: VerifyFrameInput[] = targetScenes.map((s) => {
      const codeObj = targetCodes[s.id];
      return {
        sceneId: s.id,
        imageBase64: renderSceneThumbnailDataUrl(s, codeObj),
        mimeType: "image/jpeg",
        source: codeObj?.source || "argon-code",
        attempts: codeObj?.attempts || 1,
      };
    });

    try {
      const res = await fetch(API_ENDPOINTS.VERIFY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: targetPlan,
          frames,
          retried: false,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as VerifyResponse;
      if (data && Array.isArray(data.checks)) {
        setVerifyReport(data);
        if (data.modelLog) {
          setModelLogs((prev) => [data.modelLog!, ...prev]);
        } else {
          appendLog({
            endpoint: "/api/verify",
            model: data.usedModel || "gemini",
            usedModel: data.usedModel,
            attempt: 1,
            durationMs: Math.round(performance.now() - t0),
            status: data.passed ? "ok" : "retry",
            detail: `화면 확인 완료 (통과 여부: ${data.passed})`,
          });
        }
      }
    } catch (err) {
      const structuralReport: VerifyReport = {
        passed: frames.every((f) => f.imageBase64.length > 100),
        retried: false,
        verificationMode: "structural-check",
        checks: frames.map((f) => ({
          sceneId: f.sceneId,
          ok: f.imageBase64.length > 100,
          reason: "서버 검증 호출 실패로 브라우저 구조 검증 수행",
          source: f.source,
          attempts: f.attempts,
        })),
      };
      setVerifyReport(structuralReport);
      appendLog({
        endpoint: "/api/verify",
        model: "structural-check",
        attempt: 1,
        durationMs: Math.round(performance.now() - t0),
        status: "fallback",
        detail: `시각 검증 서버 응답 실패 (${
          err instanceof Error ? err.message : String(err)
        }) — 구조 검증으로 대체됨`,
      });
    } finally {
      setVerifying(false);
    }
  };

  // ==================== INTERACTIVE REVIEW HANDLERS ====================
  const handleUpdateTranscriptText = (index: number, newText: string) => {
    setPlan((prev) => {
      if (!prev) return prev;
      const nextTranscript = prev.transcript.map((item, idx) =>
        idx === index ? { ...item, text: newText } : item
      );
      return {
        ...prev,
        transcript: nextTranscript,
      };
    });
  };

  const handleUpdateSceneText = (
    sceneId: string,
    updates: { caption?: string; script?: string }
  ) => {
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        scenes: prev.scenes.map((sc) =>
          sc.id === sceneId ? { ...sc, ...updates } : sc
        ),
      };
    });
  };

  // Toggle cut segment (restore or cut) and update composite scenes
  const handleToggleCut = (cutIndex: number) => {
    if (!plan) return;
    const cut = plan.cuts[cutIndex];
    if (!cut) return;

    const currentlyCut =
      activeCutMap[cutIndex] !== undefined
        ? activeCutMap[cutIndex]
        : cut.confidence >= 0.7;
    const nextIsCut = !currentlyCut;

    setActiveCutMap((prev) => ({
      ...prev,
      [cutIndex]: nextIsCut,
    }));

    const restoredSceneId = `restored-cut-${cutIndex}`;

    if (!nextIsCut) {
      // Restore cut into plan.scenes in chronological order
      const restoredScene: PlannedScene = {
        id: restoredSceneId,
        kind: "original",
        durationSec: Math.max(0.5, Math.round((cut.end - cut.start) * 10) / 10),
        caption: `복원된 구간 (${cut.start.toFixed(1)}~${cut.end.toFixed(1)}초)`,
        script: cut.note || "복원된 원본 발화 구간",
        visualIdea: "원본 화면 유지",
        sourceRange: { start: cut.start, end: cut.end },
      };

      setPlan((prev) => {
        if (!prev) return prev;
        if (prev.scenes.some((s) => s.id === restoredSceneId)) return prev;
        const nextScenes = [...prev.scenes];
        let insertIdx = nextScenes.findIndex(
          (s) =>
            s.kind === "original" &&
            s.sourceRange &&
            s.sourceRange.start > cut.start
        );
        if (insertIdx < 0) {
          insertIdx = Math.max(0, nextScenes.length - 1);
        }
        nextScenes.splice(insertIdx, 0, restoredScene);
        return {
          ...prev,
          scenes: nextScenes,
        };
      });
    } else {
      // Remove restored cut scene
      setPlan((prev) => {
        if (!prev) return prev;
        const filtered = prev.scenes.filter((s) => s.id !== restoredSceneId);
        return {
          ...prev,
          scenes:
            filtered.length > 0
              ? filtered
              : basePlanBeforeCutToggles?.scenes || prev.scenes,
        };
      });
    }
  };

  const handlePreviewCutInRaw = (startSec: number) => {
    setSeekRequest({
      time: Math.max(0, startSec),
      tab: "original",
      nonce: Date.now(),
    });
  };

  const handleSynthesizeSingleSceneTts = async (
    scene: PlannedScene,
    autoPlay = false
  ) => {
    setTtsLoadingSceneId(scene.id);
    try {
      const updated = await synthesizeSceneTtsInternal(
        scene,
        voiceProfile?.voiceId || "Kore"
      );
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          scenes: prev.scenes.map((s) => (s.id === scene.id ? updated : s)),
        };
      });
      if (autoPlay && updated.audioUrl) {
        const audio = new Audio(updated.audioUrl);
        await audio.play().catch(() => {});
      }
    } finally {
      setTtsLoadingSceneId(null);
    }
  };

  const handleReviseScene = async (
    scene: PlannedScene,
    instruction: string
  ) => {
    if (!plan) return;
    setRevisingSceneId(scene.id);
    setSelectedSceneId(scene.id);
    const t0 = performance.now();
    const currentCodeObj = sceneCodes[scene.id];

    try {
      const res = await fetch(API_ENDPOINTS.REVISE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          sceneId: scene.id,
          instruction,
          currentCode: currentCodeObj?.code,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as ReviseResponse;
      let nextPlan = data.plan || plan;

      if (data.updatedSceneCode) {
        setSceneCodes((prev) => ({
          ...prev,
          [scene.id]: data.updatedSceneCode!,
        }));
      }

      if (data.modelLog) {
        setModelLogs((prev) => [data.modelLog!, ...prev]);
      } else {
        appendLog({
          endpoint: "/api/revise",
          model: "gemini",
          sceneId: scene.id,
          attempt: (currentCodeObj?.attempts || 1) + 1,
          durationMs: Math.round(performance.now() - t0),
          status: "ok",
          detail: `장면 수정 완료: "${instruction}"`,
        });
      }

      // If script changed and we use TTS, re-synthesize TTS for this scene
      const updatedScene = nextPlan.scenes.find((s) => s.id === scene.id);
      if (
        updatedScene &&
        updatedScene.script !== scene.script &&
        (nextPlan.mode === "edit-plus-script" ||
          nextPlan.mode === "script-only")
      ) {
        const withTts = await synthesizeSceneTtsInternal(
          updatedScene,
          voiceProfile?.voiceId || "Kore"
        );
        nextPlan = {
          ...nextPlan,
          scenes: nextPlan.scenes.map((s) =>
            s.id === scene.id ? withTts : s
          ),
        };
      }

      setPlan(nextPlan);
    } catch (err) {
      appendLog({
        endpoint: "/api/revise",
        model: "gemini",
        sceneId: scene.id,
        attempt: (currentCodeObj?.attempts || 1) + 1,
        durationMs: Math.round(performance.now() - t0),
        status: "error",
        detail: `장면 수정 실패: ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
    } finally {
      setRevisingSceneId(null);
    }
  };

  // ==================== STEP 6: EXPORT VIDEO ====================
  const handleExportVideo = async () => {
    if (!plan || exporting) return;
    setExporting(true);
    setExportProgress(2);
    setStep("export");
    const t0 = performance.now();

    try {
      let tempVideoEl: HTMLVideoElement | null = null;
      if (uploadedVideoUrl) {
        tempVideoEl = document.createElement("video");
        tempVideoEl.src = uploadedVideoUrl;
        tempVideoEl.crossOrigin = "anonymous";
        tempVideoEl.playsInline = true;
        tempVideoEl.preload = "auto";
        await new Promise<void>((resolve) => {
          if (!tempVideoEl) return resolve();
          tempVideoEl.onloadeddata = () => resolve();
          tempVideoEl.onerror = () => resolve();
          window.setTimeout(() => resolve(), 2500);
        });
      }

      const result = await exportCompositeVideo({
        plan,
        sceneCodes,
        videoElement: tempVideoEl,
        width: 1280,
        height: 720,
        fps: 30,
        onProgress: (pct: number) => {
          setExportProgress(Math.max(2, Math.min(99, Math.round(pct))));
        },
      });

      const ext: "mp4" | "webm" = result.mimeType.includes("mp4")
        ? "mp4"
        : "webm";
      setExportProgress(100);
      setExportedVideoResult({
        url: result.url,
        filename: result.filename || `youtube-ai-studio-output.${ext}`,
        sizeBytes: result.blob.size,
        ext,
      });

      appendLog({
        endpoint: "/api/verify",
        model: "compositor",
        attempt: 1,
        durationMs: Math.round(performance.now() - t0),
        status: "ok",
        detail: `완성 영상 내보내기 완료 (${(result.blob.size / 1024).toFixed(0)} KB, ${ext.toUpperCase()})`,
      });
    } catch (err) {
      appendLog({
        endpoint: "/api/verify",
        model: "compositor",
        attempt: 1,
        durationMs: Math.round(performance.now() - t0),
        status: "error",
        detail: `내보내기 실패: ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
    } finally {
      setExporting(false);
    }
  };

  // Determine Stepper labels based on Flow A vs Flow B
  const stepperItems: { id: WizardStep; label: string }[] =
    flowType === "scratch"
      ? [
          { id: "voice", label: "1. 내 목소리" },
          { id: "scratch-input", label: "2. 주제 입력" },
          { id: "producing", label: "3. AI 제작" },
          { id: "review", label: "4. 검토" },
          { id: "export", label: "5. 내보내기" },
        ]
      : [
          { id: "voice", label: "1. 내 목소리" },
          { id: "upload", label: "2. 영상 업로드" },
          { id: "mode-select", label: "3. 완성 방식 선택" },
          { id: "producing", label: "4. AI 제작" },
          { id: "review", label: "5. 검토" },
          { id: "export", label: "6. 내보내기" },
        ];

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:px-8 max-w-[1600px] w-full mx-auto space-y-5">
      {/* Sample Mode Banner (ONLY shown when user clicked [샘플로 체험하기]) */}
      {isSampleMode && (
        <div className="p-3.5 rounded-[4px] bg-[#282828] border border-[#3ea6ff] flex flex-wrap items-center justify-between gap-3">
          <div className="text-[14px] text-[#f1f1f1]">
            샘플 데이터로 체험 중입니다 — 실제 내 영상을 올리려면{" "}
            <strong className="font-medium">[새로 만들기]</strong>를 누르세요.
          </div>
          <button
            type="button"
            onClick={() => handleStartFresh("upload")}
            className="px-3.5 py-1.5 rounded-[4px] bg-[#3ea6ff] hover:bg-[#65b8ff] text-[#0f0f0f] text-[13px] font-medium cursor-pointer"
          >
            새로 만들기
          </button>
        </div>
      )}

      {/* Top Bar: Page Title + Stepper + Saved Voice Bar */}
      <div className="bg-[#282828] border border-[#3e3e3e] rounded-[8px] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[20px] font-medium text-[#f1f1f1]">AI 편집</h1>

          {/* Stepper */}
          <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
            {stepperItems.map((item, idx) => {
              const isCurrent = step === item.id;
              return (
                <React.Fragment key={item.id}>
                  <span
                    className={`px-2.5 py-1 rounded-[4px] ${
                      isCurrent
                        ? "bg-[#3ea6ff] text-[#0f0f0f] font-medium"
                        : "bg-[#181818] text-[#aaaaaa]"
                    }`}
                  >
                    {item.label}
                  </span>
                  {idx < stepperItems.length - 1 && (
                    <span className="text-[#717171]">→</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Right Controls: Saved Voice Indicator + Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {voiceProfile && step !== "voice" && (
            <div className="px-3 py-1.5 rounded-[4px] bg-[#181818] border border-[#3e3e3e] text-[13px] text-[#f1f1f1] flex items-center gap-2">
              <span>목소리: {voiceProfile.label} ✓</span>
              <button
                type="button"
                onClick={() => setStep("voice")}
                className="text-[#3ea6ff] hover:underline text-[12px] cursor-pointer"
              >
                목소리 바꾸기
              </button>
            </div>
          )}

          {(step === "review" || step === "export") && (
            <>
              <button
                type="button"
                onClick={() => handleStartFresh("upload")}
                className="px-3.5 py-2 rounded-[4px] bg-[#181818] hover:bg-[#323232] border border-[#3e3e3e] text-[13px] text-[#f1f1f1] cursor-pointer"
              >
                새로 만들기
              </button>
              <button
                type="button"
                disabled={exporting}
                onClick={handleExportVideo}
                className="px-4 py-2 rounded-[4px] bg-[#3ea6ff] hover:bg-[#65b8ff] text-[#0f0f0f] text-[14px] font-medium cursor-pointer disabled:opacity-60"
              >
                {exporting
                  ? `내보내는 중... ${exportProgress}%`
                  : "내보내기 (MP4/WebM)"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ==================== STEP 1: 내 목소리 ==================== */}
      {step === "voice" && (
        <div className="max-w-[680px] mx-auto bg-[#282828] border border-[#3e3e3e] rounded-[8px] p-6 space-y-5">
          <div>
            <h2 className="text-[18px] font-medium text-[#f1f1f1]">
              1. 내 목소리 등록
            </h2>
            <p className="text-[14px] text-[#aaaaaa] mt-1">
              10~30초 분량의 내 목소리를 올리거나 마이크로 녹음하면, 빠진 설명 장면을 내 목소리로 자연스럽게 읽어줍니다.
            </p>
          </div>

          <input
            ref={voiceFileInputRef}
            type="file"
            accept="audio/*,video/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setVoiceAudioFile(f);
                setVoiceError(null);
              }
              e.target.value = "";
            }}
            className="hidden"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => voiceFileInputRef.current?.click()}
              className="p-4 rounded-[4px] bg-[#181818] hover:bg-[#323232] border border-[#3e3e3e] text-left space-y-1 cursor-pointer"
            >
              <div className="flex items-center gap-2 text-[14px] font-medium text-[#f1f1f1]">
                <span className="material-symbols-outlined text-[20px] text-[#3ea6ff]">
                  upload_file
                </span>
                <span>음성/영상 파일 선택</span>
              </div>
              <p className="text-[12px] text-[#aaaaaa]">
                10~30초 분량의 wav, mp3, webm, mp4 파일
              </p>
            </button>

            <button
              type="button"
              onClick={
                isRecordingMic ? handleStopMicRecording : handleStartMicRecording
              }
              className="p-4 rounded-[4px] bg-[#181818] hover:bg-[#323232] border border-[#3e3e3e] text-left space-y-1 cursor-pointer"
            >
              <div className="flex items-center gap-2 text-[14px] font-medium text-[#f1f1f1]">
                <span
                  className={`material-symbols-outlined text-[20px] ${
                    isRecordingMic ? "text-[#ff4e45]" : "text-[#3ea6ff]"
                  }`}
                >
                  mic
                </span>
                <span>
                  {isRecordingMic
                    ? `녹음 중 (${recordingSec}초 / 10초) — 중지`
                    : "마이크로 10초 녹음"}
                </span>
              </div>
              <p className="text-[12px] text-[#aaaaaa]">
                아래 동의 문구를 자연스럽게 읽어주세요
              </p>
            </button>
          </div>

          {voiceAudioFile && (
            <div className="p-3 rounded-[4px] bg-[#181818] border border-[#3ea6ff] text-[13px] text-[#f1f1f1] flex items-center justify-between">
              <span>선택된 음성: {voiceAudioFile.name}</span>
              <button
                type="button"
                onClick={() => setVoiceAudioFile(null)}
                className="text-[12px] text-[#aaaaaa] hover:text-[#f1f1f1] cursor-pointer"
              >
                다시 선택
              </button>
            </div>
          )}

          {/* Consent Box */}
          <div className="p-4 rounded-[4px] bg-[#181818] border border-[#3e3e3e] space-y-3">
            <div className="text-[12px] text-[#aaaaaa]">
              동의 문구 예시: &ldquo;나는 이 음성의 소유자이며 구글이 이 음성을 사용하여 음성 합성 모델을 생성할 것을 허용합니다.&rdquo;
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={voiceConsentChecked}
                onChange={(e) => setVoiceConsentChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#3ea6ff] cursor-pointer"
              />
              <span className="text-[14px] text-[#f1f1f1]">
                본인의 목소리이며 AI 음성 합성에 사용하는 것에 동의합니다.
              </span>
            </label>
          </div>

          {voiceError && (
            <div className="p-3.5 rounded-[4px] bg-[#181818] border border-[#ff4e45] space-y-2">
              <div className="text-[13px] text-[#f1f1f1]">{voiceError}</div>
              <button
                type="button"
                onClick={handleUseDefaultKoreVoice}
                className="px-3 py-1.5 rounded-[4px] bg-[#282828] hover:bg-[#323232] border border-[#3e3e3e] text-[13px] text-[#3ea6ff] font-medium cursor-pointer"
              >
                기본 음성(Kore)으로 진행하기
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleUseDefaultKoreVoice}
              className="px-3.5 py-2 rounded-[4px] hover:bg-[#323232] text-[14px] text-[#aaaaaa] hover:text-[#f1f1f1] cursor-pointer"
            >
              기본 음성(Kore) 사용
            </button>

            <button
              type="button"
              disabled={!voiceAudioFile || !voiceConsentChecked || voiceCloning}
              onClick={handleRegisterVoiceClone}
              className="px-5 py-2 rounded-[4px] bg-[#3ea6ff] hover:bg-[#65b8ff] text-[#0f0f0f] text-[14px] font-medium cursor-pointer disabled:opacity-40"
            >
              {voiceCloning ? "목소리 등록 중..." : "목소리 등록하기"}
            </button>
          </div>
        </div>
      )}

      {/* ==================== STEP 2 (Flow A): 영상 업로드 ==================== */}
      {step === "upload" && (
        <div className="max-w-[680px] mx-auto bg-[#282828] border border-[#3e3e3e] rounded-[8px] p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-[#3e3e3e] pb-4">
            <h2 className="text-[18px] font-medium text-[#f1f1f1]">
              동영상 업로드
            </h2>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleVideoFileSelected(f);
              e.target.value = "";
            }}
            className="hidden"
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleVideoFileSelected(f);
            }}
            className={`py-12 px-6 rounded-[4px] border border-dashed flex flex-col items-center text-center transition-colors ${
              isDragging
                ? "border-[#3ea6ff] bg-[#323232]"
                : "border-[#3e3e3e] bg-[#181818]"
            }`}
          >
            <div className="w-24 h-24 rounded-full bg-[#282828] flex items-center justify-center mb-5">
              <span className="material-symbols-outlined text-[44px] text-[#aaaaaa]">
                upload
              </span>
            </div>

            <p className="text-[15px] font-medium text-[#f1f1f1]">
              동영상 파일을 드래그 앤 드롭하여 업로드
            </p>
            <p className="text-[13px] text-[#aaaaaa] mt-1">
              최대 150초 · 30MB 이하 (초과 시 720p 권장)
            </p>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 px-5 py-2.5 rounded-[4px] bg-[#3ea6ff] hover:bg-[#65b8ff] text-[#0f0f0f] text-[14px] font-medium cursor-pointer"
            >
              파일 선택
            </button>
          </div>

          {uploadError && (
            <div className="p-3.5 rounded-[4px] bg-[#181818] border border-[#ff4e45] text-[13px] text-[#f1f1f1]">
              {uploadError}
            </div>
          )}

          <div className="pt-2 border-t border-[#3e3e3e] flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setFlowType("scratch");
                setStep("scratch-input");
              }}
              className="text-[14px] text-[#3ea6ff] hover:underline font-medium cursor-pointer"
            >
              영상 없이 처음부터 만들기
            </button>

            <button
              type="button"
              onClick={handleLoadSampleExperience}
              className="text-[13px] text-[#aaaaaa] hover:text-[#f1f1f1] cursor-pointer"
            >
              샘플로 체험하기
            </button>
          </div>
        </div>
      )}

      {/* ==================== STEP 2 (Flow B): 주제 입력 ==================== */}
      {step === "scratch-input" && (
        <div className="max-w-[680px] mx-auto bg-[#282828] border border-[#3e3e3e] rounded-[8px] p-6 space-y-5">
          <div>
            <h2 className="text-[18px] font-medium text-[#f1f1f1]">
              영상 없이 처음부터 만들기
            </h2>
            <p className="text-[14px] text-[#aaaaaa] mt-1">
              영상을 따로 찍지 않아도 주제와 메모만 적으면 AI가 대본을 쓰고 내 목소리와 모션 그래픽으로 영상을 완성합니다.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-[#f1f1f1] block">
              영상 주제
            </label>
            <input
              type="text"
              value={scratchTopic}
              onChange={(e) => setScratchTopic(e.target.value)}
              placeholder="예: 촬영 없이 AI로 유튜브 설명 영상 만드는 방법"
              className="w-full bg-[#181818] border border-[#3e3e3e] focus:border-[#3ea6ff] rounded-[4px] px-3 py-2 text-[14px] text-[#f1f1f1] placeholder-[#717171] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-[#f1f1f1] block">
              핵심 내용 (몇 줄 메모)
            </label>
            <textarea
              rows={4}
              value={scratchNotes}
              onChange={(e) => setScratchNotes(e.target.value)}
              placeholder="영상에 꼭 들어가야 할 핵심 내용이나 순서를 편하게 적어주세요."
              className="w-full bg-[#181818] border border-[#3e3e3e] focus:border-[#3ea6ff] rounded-[4px] px-3 py-2 text-[14px] text-[#f1f1f1] placeholder-[#717171] focus:outline-none resize-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setFlowType("upload");
                  setStep("upload");
                }}
                className="text-[13px] text-[#aaaaaa] hover:text-[#f1f1f1] cursor-pointer"
              >
                원본 영상 업로드로 전환
              </button>
              <button
                type="button"
                onClick={handleLoadSampleExperience}
                className="text-[13px] text-[#aaaaaa] hover:text-[#f1f1f1] cursor-pointer"
              >
                샘플로 체험하기
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setProjectMode("script-only");
                handleRunProduction("script-only");
              }}
              className="px-5 py-2 rounded-[4px] bg-[#3ea6ff] hover:bg-[#65b8ff] text-[#0f0f0f] text-[14px] font-medium cursor-pointer"
            >
              AI 제작 시작
            </button>
          </div>
        </div>
      )}

      {/* ==================== STEP 3 (Flow A): 완성 방식 선택 ==================== */}
      {step === "mode-select" && (
        <div className="max-w-[680px] mx-auto bg-[#282828] border border-[#3e3e3e] rounded-[8px] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[18px] font-medium text-[#f1f1f1]">
                어떻게 완성할까요?
              </h2>
              <p className="text-[13px] text-[#aaaaaa] mt-0.5">
                선택된 파일: {uploadedFileName} ({probedDurationSec.toFixed(1)}초)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep("upload")}
              className="text-[13px] text-[#3ea6ff] hover:underline cursor-pointer"
            >
              다른 파일 선택
            </button>
          </div>

          {shortVideoNotice && (
            <div className="p-3 rounded-[4px] bg-[#181818] border border-[#3ea6ff] text-[13px] text-[#f1f1f1]">
              {shortVideoNotice}
            </div>
          )}

          <div className="space-y-3">
            {/* Radio Card 1: edit-only */}
            <label
              onClick={() => setProjectMode("edit-only")}
              className={`block p-4 rounded-[4px] border cursor-pointer transition-colors ${
                projectMode === "edit-only"
                  ? "bg-[#1f1f1f] border-[#3ea6ff] border-l-[3px]"
                  : "bg-[#181818] border-[#3e3e3e] hover:bg-[#323232]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="projectMode"
                  checked={projectMode === "edit-only"}
                  onChange={() => setProjectMode("edit-only")}
                  className="accent-[#3ea6ff]"
                />
                <span className="text-[15px] font-medium text-[#f1f1f1]">
                  편집·그래픽만
                </span>
              </div>
              <p className="text-[13px] text-[#aaaaaa] mt-1.5 pl-6">
                내가 한 말은 그대로 두고, NG·침묵 컷 편집 + 자막 + 설명 모션그래픽만 넣습니다.
              </p>
            </label>

            {/* Radio Card 2: edit-plus-script */}
            <label
              onClick={() => setProjectMode("edit-plus-script")}
              className={`block p-4 rounded-[4px] border cursor-pointer transition-colors ${
                projectMode === "edit-plus-script"
                  ? "bg-[#1f1f1f] border-[#3ea6ff] border-l-[3px]"
                  : "bg-[#181818] border-[#3e3e3e] hover:bg-[#323232]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="projectMode"
                  checked={projectMode === "edit-plus-script"}
                  onChange={() => setProjectMode("edit-plus-script")}
                  className="accent-[#3ea6ff]"
                />
                <span className="text-[15px] font-medium text-[#f1f1f1]">
                  대본 추가해서 완성
                </span>
              </div>
              <p className="text-[13px] text-[#aaaaaa] mt-1.5 pl-6">
                빠진 설명 구간에 AI가 대본을 보충하고, 내 목소리로 읽어 자연스럽게 이어 붙입니다.
              </p>
            </label>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="button"
              onClick={() => handleRunProduction(projectMode)}
              className="px-5 py-2.5 rounded-[4px] bg-[#3ea6ff] hover:bg-[#65b8ff] text-[#0f0f0f] text-[14px] font-medium cursor-pointer"
            >
              제작 시작하기
            </button>
          </div>
        </div>
      )}

      {/* ==================== STEP 4: AI 제작 (Progress Checklist) ==================== */}
      {step === "producing" && (
        <div className="max-w-[680px] mx-auto bg-[#282828] border border-[#3e3e3e] rounded-[8px] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-medium text-[#f1f1f1]">
              AI가 영상을 준비하고 있습니다
            </h2>
            <span className="text-[14px] font-mono text-[#f1f1f1]">
              {produceProgressPct}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-[4px] bg-[#181818] overflow-hidden border border-[#3e3e3e]">
            <div
              style={{ width: `${produceProgressPct}%` }}
              className="h-full bg-[#3ea6ff] transition-all duration-300"
            />
          </div>

          {/* Plain Korean Checklist */}
          <div className="space-y-2.5 pt-2">
            {projectMode !== "script-only" && (
              <>
                <div className="flex items-center gap-3 text-[14px]">
                  <span className="text-[#3ea6ff] font-bold">
                    {checklistDone.transcribed ? "✓" : "…"}
                  </span>
                  <span
                    className={
                      checklistDone.transcribed
                        ? "text-[#f1f1f1]"
                        : "text-[#aaaaaa]"
                    }
                  >
                    {checklistDone.transcribed || "말을 받아 적고 있어요"}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[14px]">
                  <span className="text-[#3ea6ff] font-bold">
                    {checklistDone.cutsRefined ? "✓" : "…"}
                  </span>
                  <span
                    className={
                      checklistDone.cutsRefined
                        ? "text-[#f1f1f1]"
                        : "text-[#aaaaaa]"
                    }
                  >
                    {checklistDone.cutsRefined || "말이 끊긴 곳을 다듬고 있어요"}
                  </span>
                </div>
              </>
            )}

            {(projectMode === "edit-plus-script" ||
              projectMode === "script-only") && (
              <>
                <div className="flex items-center gap-3 text-[14px]">
                  <span className="text-[#3ea6ff] font-bold">
                    {checklistDone.scriptWritten ? "✓" : "…"}
                  </span>
                  <span
                    className={
                      checklistDone.scriptWritten
                        ? "text-[#f1f1f1]"
                        : "text-[#aaaaaa]"
                    }
                  >
                    {checklistDone.scriptWritten ||
                      "빠진 설명 대본을 쓰고 있어요"}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[14px]">
                  <span className="text-[#3ea6ff] font-bold">
                    {checklistDone.ttsRead ? "✓" : "…"}
                  </span>
                  <span
                    className={
                      checklistDone.ttsRead
                        ? "text-[#f1f1f1]"
                        : "text-[#aaaaaa]"
                    }
                  >
                    {checklistDone.ttsRead || "내 목소리로 대본을 읽고 있어요"}
                  </span>
                </div>
              </>
            )}

            <div className="flex items-center gap-3 text-[14px]">
              <span className="text-[#3ea6ff] font-bold">
                {checklistDone.scenesCoded ? "✓" : "…"}
              </span>
              <span
                className={
                  checklistDone.scenesCoded
                    ? "text-[#f1f1f1]"
                    : "text-[#aaaaaa]"
                }
              >
                {checklistDone.scenesCoded || "설명 장면을 만들고 있어요"}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[14px]">
              <span className="text-[#3ea6ff] font-bold">
                {checklistDone.verified ? "✓" : "…"}
              </span>
              <span
                className={
                  checklistDone.verified ? "text-[#f1f1f1]" : "text-[#aaaaaa]"
                }
              >
                {checklistDone.verified || "완성 화면을 확인하고 있어요"}
              </span>
            </div>
          </div>

          {produceError && (
            <div className="p-4 rounded-[4px] bg-[#181818] border border-[#3e3e3e] space-y-3">
              <div className="text-[14px] text-[#f1f1f1]">{produceError}</div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleRunProduction(projectMode)}
                  className="px-4 py-2 rounded-[4px] bg-[#3ea6ff] hover:bg-[#65b8ff] text-[#0f0f0f] text-[13px] font-medium cursor-pointer"
                >
                  다시 시도
                </button>
                <button
                  type="button"
                  onClick={handleLoadSampleExperience}
                  className="px-3 py-2 rounded-[4px] bg-[#282828] hover:bg-[#323232] border border-[#3e3e3e] text-[13px] text-[#f1f1f1] cursor-pointer"
                >
                  샘플로 체험하기
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== STEP 5 & 6: 검토 (Review) & 내보내기 (Export) ==================== */}
      {(step === "review" || step === "export") && plan && (
        <div className="space-y-5">
          {/* Export Progress / Result Box */}
          {(exporting || exportedVideoResult) && (
            <div className="p-4 rounded-[8px] bg-[#282828] border border-[#3e3e3e] space-y-3">
              {exporting ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[14px] text-[#f1f1f1]">
                    <span>완성 영상을 내보내고 있습니다 ({exportProgress}%)</span>
                    <span className="text-[13px] text-[#aaaaaa]">
                      영상 길이만큼 걸려요(약 2분). 이 탭을 닫지 마세요
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-[4px] bg-[#181818] overflow-hidden border border-[#3e3e3e]">
                    <div
                      style={{ width: `${exportProgress}%` }}
                      className="h-full bg-[#3ea6ff] transition-all duration-200"
                    />
                  </div>
                </div>
              ) : (
                exportedVideoResult && (
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-[15px] font-medium text-[#f1f1f1]">
                        영상 내보내기가 완료되었습니다
                      </div>
                      <div className="text-[13px] text-[#aaaaaa]">
                        파일명: {exportedVideoResult.filename} (
                        {(exportedVideoResult.sizeBytes / 1024).toFixed(0)} KB)
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <video
                        src={exportedVideoResult.url}
                        controls
                        playsInline
                        className="w-48 h-28 rounded-[4px] bg-black border border-[#3e3e3e] object-contain"
                      />
                      <a
                        href={exportedVideoResult.url}
                        download={exportedVideoResult.filename}
                        className="px-4 py-2 rounded-[4px] bg-[#3ea6ff] hover:bg-[#65b8ff] text-[#0f0f0f] text-[14px] font-medium"
                      >
                        내 컴퓨터에 저장
                      </a>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* 2-Column Layout: Left 4 Tabs (ArgonDirectorPanel) + Right Player & Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: 4 Review Tabs (5 cols on lg) */}
            <div className="lg:col-span-5">
              <ArgonDirectorPanel
                plan={plan}
                sceneCodes={sceneCodes}
                verifyReport={verifyReport}
                modelLogs={modelLogs}
                selectedSceneId={selectedSceneId}
                onSelectScene={setSelectedSceneId}
                activeCutMap={activeCutMap}
                onToggleCut={handleToggleCut}
                onPreviewCutInRaw={handlePreviewCutInRaw}
                onUpdateTranscriptText={handleUpdateTranscriptText}
                onUpdateSceneText={handleUpdateSceneText}
                onSynthesizeSceneTts={handleSynthesizeSingleSceneTts}
                ttsLoadingSceneId={ttsLoadingSceneId}
                onReviseScene={handleReviseScene}
                onRunVerify={() => runVerifyWithFrames(plan, sceneCodes)}
                revisingSceneId={revisingSceneId}
                verifying={verifying}
              />
            </div>

            {/* Right Column: Preview Player + Timeline Bar (7 cols on lg) */}
            <div className="lg:col-span-7 space-y-5">
              <CanvasPreviewPlayer
                plan={plan}
                sceneCodes={sceneCodes}
                verifyReport={verifyReport}
                selectedSceneId={selectedSceneId}
                onSelectScene={setSelectedSceneId}
                uploadedVideoUrl={uploadedVideoUrl}
                uploadedFileName={uploadedFileName}
                rawDurationSec={probedDurationSec}
                seekRequest={seekRequest}
                activeCutMap={activeCutMap}
              />

              <TimelineComparison
                plan={plan}
                selectedSceneId={selectedSceneId}
                onSelectScene={setSelectedSceneId}
                activeCutMap={activeCutMap}
                onToggleCut={handleToggleCut}
                rawDurationSec={probedDurationSec}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
