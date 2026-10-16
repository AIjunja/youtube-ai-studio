import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { Part } from "@google/genai";
import {
  API_ENDPOINTS,
  type ApiErrorResponse,
  type FixCodeRequest,
  type FixCodeResponse,
  type PlanRequestJson,
  type PlannedScene,
  type PlanResponse,
  type ReviseRequest,
  type ReviseResponse,
  type SceneCodeRequest,
  type SceneCodeResponse,
  type ScenePlan,
  type ScriptMode,
  type ScriptRequest,
  type ScriptResponse,
  type ScriptSceneDraft,
  type TtsJsonResponse,
  type TtsRequest,
  type VerifyReport,
  type VerifyRequest,
  type VerifyResponse,
  type VoiceCloneRequest,
  type VoiceCloneResponse,
} from "../shared/contract.js";
import { MOCK_SCENE_PLAN } from "../shared/mockData.js";
import {
  callArgonModel,
  createModelLog,
  getArgonModel,
  getGenAIClient,
  getTtsModel,
  sanitizeErrorMessage,
} from "./argonClient.js";
import {
  SCENE_PLAN_RESPONSE_SCHEMA,
  ScenePlanSchema,
  SCRIPT_RESPONSE_SCHEMA,
  ScriptPlanResultSchema,
  VERIFY_REPORT_RESPONSE_SCHEMA,
  VerifyReportSchema,
} from "./schemas.js";
import {
  buildFixCodeUserPrompt,
  buildPlanSystemPrompt,
  buildPlanUserPrompt,
  buildReviseSystemPrompt,
  buildReviseUserPrompt,
  buildSceneCodeSystemPrompt,
  buildSceneCodeUserPrompt,
  buildScriptSystemPrompt,
  buildScriptUserPrompt,
  buildVerifySystemPrompt,
  buildVerifyUserPrompt,
} from "./prompts.js";
import {
  buildTemplateFallbackCode,
  validateDrawCode,
} from "./codeValidator.js";

export const apiRouter = Router();

const MAX_VIDEO_DURATION_SEC = 150;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024; // 30MB max upload size
const INLINE_VIDEO_LIMIT_BYTES = 15 * 1024 * 1024; // 15MB inlineData threshold; >15MB uses Gemini Files API

// Configure multer to store uploaded files in os.tmpdir() and clean up in finally block
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, os.tmpdir());
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || ".mp4") || ".mp4";
      cb(
        null,
        `yt-ai-studio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
      );
    },
  }),
  limits: {
    fileSize: MAX_VIDEO_BYTES,
  },
});

function sendApiError(
  res: Response,
  status: number,
  code: string,
  message: string,
  retryable = false,
  usedModel?: string
): void {
  const payload: ApiErrorResponse = {
    error: {
      code,
      message,
      retryable,
      ...(usedModel ? { usedModel } : {}),
    },
  };
  res.status(status).json(payload);
}

/**
 * Strip optional `data:<mime>;base64,` prefix from a base64 string.
 */
function parseDataUrl(input: string, defaultMime = "image/png"): {
  mimeType: string;
  base64Data: string;
} {
  const trimmed = input.trim();
  const match = trimmed.match(/^data:([^;]+);base64,([\s\S]+)$/i);
  if (match && match[1] && match[2]) {
    return {
      mimeType: match[1].trim(),
      base64Data: match[2].trim(),
    };
  }
  return {
    mimeType: defaultMime,
    base64Data: trimmed,
  };
}

/**
 * Parse JSON string and validate with Zod schema.
 */
function parseAndValidateJson<T>(
  rawText: string,
  schema: {
    safeParse: (
      data: unknown
    ) => { success: boolean; data?: T; error?: { message: string } };
  }
): { ok: true; data: T } | { ok: false; error: string } {
  let cleaned = rawText.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    cleaned = fenceMatch[1].trim();
  }
  try {
    const parsed = JSON.parse(cleaned);
    const result = schema.safeParse(parsed);
    if (!result.success || !result.data) {
      return {
        ok: false,
        error: result.error?.message || "Schema validation failed",
      };
    }
    return { ok: true, data: result.data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invalid JSON syntax",
    };
  }
}

/**
 * Uploads a video file > 15MB via Gemini Files API and polls until state === "ACTIVE".
 */
async function uploadAndWaitForActiveFile(
  filePath: string,
  mimeType: string
): Promise<{ name: string; uri: string; mimeType: string }> {
  const client = getGenAIClient();
  if (!client) {
    throw new Error("GEMINI_API_KEY is not configured for Files API upload.");
  }

  const uploaded = await client.files.upload({
    file: filePath,
    config: { mimeType },
  });

  if (!uploaded.name) {
    throw new Error("Gemini Files API upload did not return a file name.");
  }

  const startPoll = Date.now();
  const maxPollMs = 60000;
  let fileState = uploaded;

  while (Date.now() - startPoll < maxPollMs) {
    const stateStr = String(fileState.state || "").toUpperCase();
    if (stateStr === "ACTIVE" || stateStr === "STATE_ACTIVE") {
      return {
        name: uploaded.name,
        uri: fileState.uri || uploaded.uri || "",
        mimeType: fileState.mimeType || uploaded.mimeType || mimeType,
      };
    }
    if (stateStr === "FAILED" || stateStr === "STATE_FAILED") {
      throw new Error(`Gemini Files API processing failed (state=${stateStr}).`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
    fileState = await client.files.get({ name: uploaded.name });
  }

  throw new Error("Gemini Files API processing timed out after 60s.");
}

/**
 * Multer middleware wrapper for /api/plan that catches LIMIT_FILE_SIZE (30MB) with a friendly Korean message.
 */
function uploadSingleVideoMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const handler = upload.single("video");
  handler(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      sendApiError(
        res,
        413,
        "VIDEO_FILE_TOO_LARGE",
        "영상 파일 크기가 30MB를 넘습니다. 720p로 줄여서 올려주세요.",
        false
      );
      return;
    }
    if (err) {
      sendApiError(
        res,
        400,
        "UPLOAD_ERROR",
        `파일 업로드 오류: ${sanitizeErrorMessage(err)}`,
        false
      );
      return;
    }
    next();
  });
}

// ==========================================
// 1. POST /api/plan
// ==========================================
apiRouter.post(
  API_ENDPOINTS.PLAN,
  uploadSingleVideoMiddleware,
  async (req: Request, res: Response) => {
    const uploadedFile = req.file;
    let tempBase64FilePath: string | null = null;
    let remoteUploadedFileName: string | null = null;

    try {
      const body = (req.body || {}) as PlanRequestJson & Record<string, unknown>;
      const durationSec =
        body.durationSec !== undefined ? Number(body.durationSec) : undefined;
      const userHint =
        typeof body.userHint === "string"
          ? body.userHint
          : typeof body.prompt === "string"
          ? body.prompt
          : undefined;
      const isShortClip =
        durationSec !== undefined &&
        !Number.isNaN(durationSec) &&
        durationSec > 0 &&
        durationSec < 10;

      // Validate video duration (up to 150 seconds max; <10s clips are allowed with friendly note)
      if (durationSec !== undefined && !Number.isNaN(durationSec)) {
        if (durationSec <= 0) {
          sendApiError(
            res,
            400,
            "INVALID_VIDEO_DURATION",
            "영상 길이가 올바르지 않습니다(0초 이하). 정상적인 동영상 파일을 업로드해 주세요.",
            false
          );
          return;
        }
        if (durationSec > MAX_VIDEO_DURATION_SEC + 0.5) {
          sendApiError(
            res,
            400,
            "VIDEO_TOO_LONG",
            "영상 길이는 최대 150초까지 지원합니다. 150초 이하로 잘라서 올려주세요.",
            false
          );
          return;
        }
      }

      const mediaParts: Part[] = [];

      if (uploadedFile && uploadedFile.path) {
        const mimeType = (uploadedFile.mimetype || "").toLowerCase();
        const ext = path.extname(uploadedFile.originalname || "").toLowerCase();
        const validVideoExts = [".mp4", ".webm", ".mov", ".mkv", ".avi", ".m4v"];
        const isVideoMime = mimeType.startsWith("video/");
        const isVideoExt = validVideoExts.includes(ext);

        if (!isVideoMime && !isVideoExt) {
          sendApiError(
            res,
            400,
            "INVALID_FILE_TYPE",
            `영상이 아닌 파일(${uploadedFile.originalname || mimeType || "알 수 없는 형식"})은 분석할 수 없습니다. MP4, WebM, MOV 형식의 동영상 파일을 업로드해 주세요.`,
            false
          );
          return;
        }

        const effectiveMime = isVideoMime ? mimeType : "video/mp4";
        const fileStat = await fs.promises.stat(uploadedFile.path);
        if (fileStat.size === 0) {
          sendApiError(
            res,
            400,
            "EMPTY_VIDEO_FILE",
            "업로드한 영상 파일이 비어 있습니다(0바이트). 정상적인 동영상 파일을 선택해 주세요.",
            false
          );
          return;
        }
        if (fileStat.size > MAX_VIDEO_BYTES) {
          sendApiError(
            res,
            413,
            "VIDEO_FILE_TOO_LARGE",
            "영상 파일 크기가 30MB를 넘습니다. 720p로 줄여서 올려주세요.",
            false
          );
          return;
        }

        const client = getGenAIClient();

        // Use Gemini Files API for > 15MB videos, polling until state === "ACTIVE"
        if (client && fileStat.size > INLINE_VIDEO_LIMIT_BYTES) {
          const activeFile = await uploadAndWaitForActiveFile(
            uploadedFile.path,
            effectiveMime
          );
          remoteUploadedFileName = activeFile.name;
          mediaParts.push({
            fileData: {
              fileUri: activeFile.uri,
              mimeType: activeFile.mimeType,
            },
          });
        } else {
          const buf = await fs.promises.readFile(uploadedFile.path);
          mediaParts.push({
            inlineData: {
              mimeType: effectiveMime,
              data: buf.toString("base64"),
            },
          });
        }
      } else if (typeof body.videoBase64 === "string" && body.videoBase64.trim()) {
        const { mimeType, base64Data } = parseDataUrl(
          body.videoBase64,
          body.mimeType || "video/mp4"
        );
        if (!mimeType.toLowerCase().startsWith("video/")) {
          sendApiError(
            res,
            400,
            "INVALID_FILE_TYPE",
            `영상이 아닌 데이터 형식(${mimeType})입니다. 동영상(video/mp4, video/webm) 파일만 업로드해 주세요.`,
            false
          );
          return;
        }

        const videoBuffer = Buffer.from(base64Data, "base64");
        if (videoBuffer.byteLength === 0) {
          sendApiError(
            res,
            400,
            "EMPTY_VIDEO_FILE",
            "업로드한 영상 데이터가 비어 있습니다(0바이트). 정상적인 동영상 파일을 선택해 주세요.",
            false
          );
          return;
        }
        if (videoBuffer.byteLength > MAX_VIDEO_BYTES) {
          sendApiError(
            res,
            413,
            "VIDEO_FILE_TOO_LARGE",
            "영상 파일 크기가 30MB를 넘습니다. 720p로 줄여서 올려주세요.",
            false
          );
          return;
        }

        const client = getGenAIClient();
        if (client && videoBuffer.byteLength > INLINE_VIDEO_LIMIT_BYTES) {
          const ext = mimeType.includes("webm")
            ? ".webm"
            : mimeType.includes("quicktime") || mimeType.includes("mov")
            ? ".mov"
            : ".mp4";
          tempBase64FilePath = path.join(
            os.tmpdir(),
            `yt-ai-studio-b64-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
          );
          await fs.promises.writeFile(tempBase64FilePath, videoBuffer);
          const activeFile = await uploadAndWaitForActiveFile(
            tempBase64FilePath,
            mimeType
          );
          remoteUploadedFileName = activeFile.name;
          mediaParts.push({
            fileData: {
              fileUri: activeFile.uri,
              mimeType: activeFile.mimeType,
            },
          });
        } else {
          mediaParts.push({
            inlineData: {
              mimeType,
              data: base64Data,
            },
          });
        }
      } else if (!userHint || !userHint.trim()) {
        sendApiError(
          res,
          400,
          "EMPTY_PLAN_REQUEST",
          "분석할 원본 영상 파일이 없습니다. 최대 150초(30MB 이하) 분량의 동영상 파일(MP4, WebM, MOV)을 업로드해 주세요.",
          false
        );
        return;
      }

      // Call Argon with multimodal input + JSON schema (120s timeout for video analysis)
      let validationError: string | undefined;
      let lastLog = createModelLog({
        endpoint: "/api/plan",
        model: getArgonModel(),
        usedModel: getArgonModel(),
        attempt: 1,
        durationMs: 1,
        status: "ok",
      });

      for (let attempt = 1; attempt <= 2; attempt++) {
        const userPrompt = buildPlanUserPrompt({
          durationSec,
          userHint,
          validationError,
        });

        const callResult = await callArgonModel({
          endpoint: "/api/plan",
          attempt,
          systemInstruction: buildPlanSystemPrompt(),
          contents: [...mediaParts, userPrompt],
          responseMimeType: "application/json",
          responseSchema: SCENE_PLAN_RESPONSE_SCHEMA,
          temperature: 0.2,
          timeoutMs: 120000,
        });

        lastLog = callResult.modelLog;

        if (!callResult.ok) {
          break;
        }

        const validated = parseAndValidateJson<ScenePlan>(
          callResult.text,
          ScenePlanSchema
        );

        if (validated.ok) {
          const shortClipNote = isShortClip
            ? ` (안내: ${durationSec?.toFixed(1)}초 분량의 짧은 클립이므로 컷 편집을 최소화하고 모션 브릿지 중심으로 구성했습니다.)`
            : "";
          const responsePayload: PlanResponse = {
            ...validated.data,
            summary: `${validated.data.summary}${shortClipNote}`,
            usedModel: callResult.usedModel,
            modelLog: {
              ...callResult.modelLog,
              model: callResult.usedModel,
              usedModel: callResult.usedModel,
              attempt,
              detail:
                attempt > 1
                  ? `Zod 스키마 재시도 통과 (${callResult.usedModel}, ${attempt}회차): keep ${validated.data.keep.length}구간, cut ${validated.data.cuts.length}구간, 장면 ${validated.data.scenes.length}개`
                  : `멀티모달 영상 분석 완료 (${callResult.usedModel}): keep ${validated.data.keep.length}구간, cut ${validated.data.cuts.length}구간, 장면 ${validated.data.scenes.length}개`,
            },
          };
          res.json(responsePayload);
          return;
        }

        validationError = validated.error;
        console.warn(
          `[/api/plan] Zod validation failed on attempt ${attempt}: ${validationError}`
        );
      }

      // Structured fallback so the live demo never stops
      const fallbackPlan: ScenePlan = structuredClone(MOCK_SCENE_PLAN);
      if (userHint && userHint.trim()) {
        fallbackPlan.summary = `${fallbackPlan.summary} (요청 반영: ${userHint.trim()})`;
      }
      if (isShortClip && durationSec) {
        fallbackPlan.summary = `${fallbackPlan.summary} (안내: ${durationSec.toFixed(1)}초 짧은 클립 정상 처리 완료)`;
      }
      const fallbackResponse: PlanResponse = {
        ...fallbackPlan,
        usedModel: "template-fallback",
        modelLog: {
          ...lastLog,
          model: "template-fallback",
          usedModel: "template-fallback",
          status: "fallback",
          detail: validationError
            ? `스키마 검증 실패 후 안전 폴백 ScenePlan 적용 (${validationError.slice(0, 80)})`
            : lastLog.detail || "구조화된 폴백 ScenePlan 반환",
        },
      };
      res.json(fallbackResponse);
    } catch (err) {
      sendApiError(
        res,
        500,
        "PLAN_FAILED",
        `Failed to generate scene plan: ${sanitizeErrorMessage(err)}`,
        true
      );
    } finally {
      if (remoteUploadedFileName) {
        const client = getGenAIClient();
        if (client) {
          await client.files
            .delete({ name: remoteUploadedFileName })
            .catch(() => {});
        }
      }
      if (tempBase64FilePath) {
        await fs.promises.unlink(tempBase64FilePath).catch(() => {});
      }
      if (uploadedFile?.path) {
        await fs.promises.unlink(uploadedFile.path).catch(() => {});
      }
    }
  }
);

// ==========================================
// 2. POST /api/scene-code
// ==========================================
apiRouter.post(
  API_ENDPOINTS.SCENE_CODE,
  async (req: Request, res: Response) => {
    try {
      const body = req.body as Partial<SceneCodeRequest>;
      if (!body || !body.scene || typeof body.scene.id !== "string") {
        sendApiError(
          res,
          400,
          "INVALID_SCENE_CODE_REQUEST",
          "Missing required `scene` object with `id` in request body.",
          false
        );
        return;
      }

      const scene = body.scene;
      const plan = body.plan;
      const width = Number(body.width) || 1920;
      const height = Number(body.height) || 1080;

      let validationError: string | undefined;
      let totalDurationMs = 0;
      let lastErrorMsg: string | undefined;

      // Attempt 1 + automatic 1-time syntax/forbidden-token self-retry
      for (let attempt = 1; attempt <= 2; attempt++) {
        const callResult = await callArgonModel({
          endpoint: "/api/scene-code",
          sceneId: scene.id,
          attempt,
          systemInstruction: buildSceneCodeSystemPrompt(),
          contents: [
            buildSceneCodeUserPrompt({
              scene,
              plan,
              width,
              height,
              validationError,
            }),
          ],
          temperature: 0.2,
        });

        totalDurationMs += callResult.modelLog.durationMs;

        if (!callResult.ok) {
          lastErrorMsg = callResult.error;
          break;
        }

        const check = validateDrawCode(callResult.text);
        if (check.ok) {
          const payload: SceneCodeResponse = {
            sceneId: scene.id,
            code: check.code,
            attempts: attempt,
            source: "argon-code",
            usedModel: callResult.usedModel,
            modelLog: createModelLog({
              endpoint: "/api/scene-code",
              model: callResult.usedModel,
              usedModel: callResult.usedModel,
              sceneId: scene.id,
              attempt,
              durationMs: totalDurationMs,
              status: attempt > 1 || callResult.fellBackModel ? "retry" : "ok",
              detail:
                attempt > 1
                  ? `1차 문법/토큰 검증 후 재시도 통과 (${callResult.usedModel}): draw(ctx,t,w,h,scene,kit) 생성 완료`
                  : `draw(ctx,t,w,h,scene,kit) 생성 및 서버 정적 검증 통과 (${callResult.usedModel})`,
            }),
          };
          res.json(payload);
          return;
        }

        validationError = check.error;
        lastErrorMsg = check.error;
        console.warn(
          `[/api/scene-code] scene=${scene.id} attempt=${attempt} static check failed: ${check.error}`
        );
      }

      // Safe deterministic template fallback if model unavailable or failed syntax twice
      const fallbackCode = buildTemplateFallbackCode(scene);
      const payload: SceneCodeResponse = {
        sceneId: scene.id,
        code: fallbackCode,
        attempts: 2,
        source: "template-fallback",
        usedModel: "template-fallback",
        ...(lastErrorMsg ? { lastError: lastErrorMsg } : {}),
        modelLog: createModelLog({
          endpoint: "/api/scene-code",
          model: "template-fallback",
          usedModel: "template-fallback",
          sceneId: scene.id,
          attempt: 2,
          durationMs: Math.max(1, totalDurationMs),
          status: "fallback",
          detail: `결정적 Canvas 2D 템플릿 폴백 적용 (${scene.id})`,
        }),
      };
      res.json(payload);
    } catch (err) {
      sendApiError(
        res,
        500,
        "SCENE_CODE_FAILED",
        `Failed to generate scene code: ${sanitizeErrorMessage(err)}`,
        true
      );
    }
  }
);

// ==========================================
// 3. POST /api/fix-code
// ==========================================
apiRouter.post(
  API_ENDPOINTS.FIX_CODE,
  async (req: Request, res: Response) => {
    try {
      const body = req.body as Partial<FixCodeRequest>;
      if (
        !body ||
        !body.scene ||
        typeof body.scene.id !== "string" ||
        typeof body.code !== "string" ||
        typeof body.errorLog !== "string"
      ) {
        sendApiError(
          res,
          400,
          "INVALID_FIX_CODE_REQUEST",
          "Missing required `scene`, `code`, or `errorLog` in request body.",
          false
        );
        return;
      }

      const scene = body.scene;
      const plan = body.plan;
      const attempt = Number(body.attempt) || 2;
      const width = Number(body.width) || 1920;
      const height = Number(body.height) || 1080;

      const callResult = await callArgonModel({
        endpoint: "/api/fix-code",
        sceneId: scene.id,
        attempt,
        systemInstruction: buildSceneCodeSystemPrompt(),
        contents: [
          buildFixCodeUserPrompt({
            scene,
            plan,
            code: body.code,
            errorLog: body.errorLog,
            attempt,
            width,
            height,
          }),
        ],
        temperature: 0.15,
      });

      if (callResult.ok) {
        const check = validateDrawCode(callResult.text);
        if (check.ok) {
          const payload: FixCodeResponse = {
            sceneId: scene.id,
            code: check.code,
            attempts: attempt,
            source: "argon-code",
            usedModel: callResult.usedModel,
            modelLog: {
              ...callResult.modelLog,
              model: callResult.usedModel,
              usedModel: callResult.usedModel,
              attempt,
              status: "ok",
              detail: `오류(${body.errorLog.slice(0, 60)}) 수정 완료 및 정적 검증 통과 (${callResult.usedModel})`,
            },
          };
          res.json(payload);
          return;
        }
      }

      // Fallback to guaranteed deterministic template so export never breaks
      const fallbackCode = buildTemplateFallbackCode(scene);
      const payload: FixCodeResponse = {
        sceneId: scene.id,
        code: fallbackCode,
        attempts: attempt,
        source: "template-fallback",
        usedModel: "template-fallback",
        lastError: body.errorLog,
        modelLog: {
          ...callResult.modelLog,
          model: "template-fallback",
          usedModel: "template-fallback",
          attempt,
          status: "fallback",
          detail: `코드 수정 한도 도달 → AI쭌 v2 안전 템플릿 폴백(template-fallback) 적용`,
        },
      };
      res.json(payload);
    } catch (err) {
      sendApiError(
        res,
        500,
        "FIX_CODE_FAILED",
        `Failed to fix scene code: ${sanitizeErrorMessage(err)}`,
        true
      );
    }
  }
);

// ==========================================
// 4. POST /api/verify
// ==========================================
apiRouter.post(
  API_ENDPOINTS.VERIFY,
  async (req: Request, res: Response) => {
    try {
      const body = req.body as Partial<VerifyRequest>;
      if (!body || !body.plan || !Array.isArray(body.frames)) {
        sendApiError(
          res,
          400,
          "INVALID_VERIFY_REQUEST",
          "Missing required `plan` or `frames` array in request body.",
          false
        );
        return;
      }

      const plan = body.plan;
      const frames = body.frames;
      const retried = Boolean(body.retried);

      if (frames.length === 0) {
        const emptyReport: VerifyResponse = {
          passed: true,
          checks: [],
          retried,
          usedModel: getArgonModel(),
          verificationMode: "multimodal-argon",
          modelLog: createModelLog({
            endpoint: "/api/verify",
            model: getArgonModel(),
            usedModel: getArgonModel(),
            attempt: 1,
            durationMs: 1,
            status: "ok",
            detail: "검수할 모션 프레임 없음 (통과)",
          }),
        };
        res.json(emptyReport);
        return;
      }

      const imageParts: Part[] = [];
      for (const frame of frames) {
        if (frame.imageBase64 && frame.imageBase64.trim()) {
          const { mimeType, base64Data } = parseDataUrl(
            frame.imageBase64,
            frame.mimeType || "image/png"
          );
          imageParts.push({
            inlineData: {
              mimeType,
              data: base64Data,
            },
          });
        }
      }

      let validationError: string | undefined;
      let lastLog = createModelLog({
        endpoint: "/api/verify",
        model: getArgonModel(),
        usedModel: getArgonModel(),
        attempt: 1,
        durationMs: 1,
        status: "ok",
      });

      for (let attempt = 1; attempt <= 2; attempt++) {
        const userPrompt = buildVerifyUserPrompt({
          plan,
          frames,
          retried,
          validationError,
        });

        const callResult = await callArgonModel({
          endpoint: "/api/verify",
          attempt,
          systemInstruction: buildVerifySystemPrompt(),
          contents: [...imageParts, userPrompt],
          responseMimeType: "application/json",
          responseSchema: VERIFY_REPORT_RESPONSE_SCHEMA,
          temperature: 0.1,
        });

        lastLog = callResult.modelLog;

        if (!callResult.ok) {
          break;
        }

        const validated = parseAndValidateJson<VerifyReport>(
          callResult.text,
          VerifyReportSchema
        );

        if (validated.ok) {
          // Ensure every input frame is represented in checks
          const checks = frames.map((f) => {
            const found = validated.data.checks.find(
              (c) => c.sceneId === f.sceneId
            );
            return (
              found || {
                sceneId: f.sceneId,
                ok: true,
                source: f.source,
                attempts: f.attempts,
              }
            );
          });
          const passed = checks.every((c) => c.ok);

          const payload: VerifyResponse = {
            passed,
            checks,
            retried,
            usedModel: callResult.usedModel,
            verificationMode: "multimodal-argon",
            modelLog: {
              ...callResult.modelLog,
              model: callResult.usedModel,
              usedModel: callResult.usedModel,
              attempt,
              detail: `${callResult.modelLog.detail || callResult.usedModel} — 키프레임 ${frames.length}장 멀티모달 시각 검증 완료 (passed=${passed})`,
            },
          };
          res.json(payload);
          return;
        }

        validationError = validated.error;
        console.warn(
          `[/api/verify] Zod validation failed on attempt ${attempt}: ${validationError}`
        );
      }

      // Honest structural check when Argon model call fails (never fake multimodal verification)
      const fallbackChecks = frames.map((f) => {
        const { base64Data } = parseDataUrl(f.imageBase64 || "");
        const hasImageBytes = base64Data.length > 32;
        return {
          sceneId: f.sceneId,
          ok: hasImageBytes,
          source: f.source,
          attempts: f.attempts || 1,
          issue: hasImageBytes
            ? "멀티모달 모델 호출 실패로 구조적 바이트 검수만 수행됨"
            : "Keyframe image payload appears empty",
        };
      });

      const fallbackPayload: VerifyResponse = {
        passed: false,
        checks: fallbackChecks,
        retried,
        usedModel: "structural-check",
        verificationMode: "structural-check",
        modelLog: {
          ...lastLog,
          model: "structural-check",
          usedModel: "structural-check",
          status: "error",
          detail: `${lastLog.detail || "모델 호출 실패"} — 구조적 검수(structural-check) 전환`,
        },
      };
      res.json(fallbackPayload);
    } catch (err) {
      sendApiError(
        res,
        500,
        "VERIFY_FAILED",
        `Failed to verify frames: ${sanitizeErrorMessage(err)}`,
        true
      );
    }
  }
);

// ==========================================
// 5. POST /api/revise
// ==========================================
apiRouter.post(
  API_ENDPOINTS.REVISE,
  async (req: Request, res: Response) => {
    try {
      const body = req.body as Partial<ReviseRequest>;
      if (
        !body ||
        !body.plan ||
        typeof body.sceneId !== "string" ||
        typeof body.instruction !== "string"
      ) {
        sendApiError(
          res,
          400,
          "INVALID_REVISE_REQUEST",
          "Missing required `plan`, `sceneId`, or `instruction` in request body.",
          false
        );
        return;
      }

      const { plan, sceneId, instruction } = body;
      const targetIndex = plan.scenes.findIndex((s) => s.id === sceneId);
      if (targetIndex === -1) {
        sendApiError(
          res,
          404,
          "SCENE_NOT_FOUND",
          `Scene with id '${sceneId}' was not found in plan.scenes.`,
          false
        );
        return;
      }

      let updatedPlan: ScenePlan | null = null;
      let validationError: string | undefined;
      let totalDurationMs = 0;
      let usedModelForRevise = "template-fallback";

      for (let attempt = 1; attempt <= 2; attempt++) {
        const callResult = await callArgonModel({
          endpoint: "/api/revise",
          sceneId,
          attempt,
          systemInstruction: buildReviseSystemPrompt(),
          contents: [
            buildReviseUserPrompt({
              plan,
              sceneId,
              instruction,
              validationError,
            }),
          ],
          responseMimeType: "application/json",
          responseSchema: SCENE_PLAN_RESPONSE_SCHEMA,
          temperature: 0.25,
        });

        totalDurationMs += callResult.modelLog.durationMs;

        if (!callResult.ok) {
          break;
        }

        const validated = parseAndValidateJson<ScenePlan>(
          callResult.text,
          ScenePlanSchema
        );
        if (validated.ok) {
          updatedPlan = validated.data;
          usedModelForRevise = callResult.usedModel;
          break;
        }
        validationError = validated.error;
      }

      // Deterministic fallback update of the target scene if model call failed
      if (!updatedPlan) {
        updatedPlan = structuredClone(plan);
        const target = updatedPlan.scenes[targetIndex];
        target.caption = `${target.caption} · ${instruction.slice(0, 18)}`;
        target.script = `${target.script} (${instruction})`;
        target.visualIdea = `${target.visualIdea} — 수정 반영: ${instruction}`;
        target.visuals = [
          instruction.slice(0, 28),
          ...(target.visuals || []).slice(0, 2),
        ];
      }

      const candidateScene =
        updatedPlan.scenes.find((s) => s.id === sceneId) ||
        updatedPlan.scenes[targetIndex] ||
        plan.scenes[targetIndex];

      const originalTarget = plan.scenes[targetIndex];
      const revisedScene = {
        ...originalTarget,
        ...candidateScene,
        id: originalTarget.id,
        kind: originalTarget.kind,
      };

      // Guarantee that ONLY the requested scene is modified while all other scenes remain untouched (B6)
      updatedPlan = {
        ...plan,
        scenes: plan.scenes.map((s, idx) =>
          idx === targetIndex ? revisedScene : s
        ),
      };

      let updatedSceneCode: ReviseResponse["updatedSceneCode"] = undefined;

      // If revised scene is a motion or ending scene, immediately generate updated draw() code
      if (
        revisedScene &&
        (revisedScene.kind === "motion" || revisedScene.kind === "ending")
      ) {
        let codeSuccess = false;
        let codeError: string | undefined;

        for (let attempt = 1; attempt <= 2; attempt++) {
          const codeCall = await callArgonModel({
            endpoint: "/api/revise",
            sceneId: revisedScene.id,
            attempt,
            systemInstruction: buildSceneCodeSystemPrompt(),
            contents: [
              buildSceneCodeUserPrompt({
                scene: revisedScene,
                plan: updatedPlan,
                width: 1920,
                height: 1080,
                validationError: codeError,
              }),
            ],
            temperature: 0.2,
          });

          totalDurationMs += codeCall.modelLog.durationMs;

          if (!codeCall.ok) {
            break;
          }

          const check = validateDrawCode(codeCall.text);
          if (check.ok) {
            usedModelForRevise = codeCall.usedModel;
            updatedSceneCode = {
              sceneId: revisedScene.id,
              code: check.code,
              attempts: attempt,
              source: "argon-code",
              usedModel: codeCall.usedModel,
            };
            codeSuccess = true;
            break;
          }
          codeError = check.error;
        }

        if (!codeSuccess) {
          const tailoredScene = {
            ...revisedScene,
            id: `${revisedScene.id}-revised`,
          };
          updatedSceneCode = {
            sceneId: revisedScene.id,
            code: buildTemplateFallbackCode(tailoredScene),
            attempts: 1,
            source: "template-fallback",
            usedModel: "template-fallback",
          };
        }
      }

      const payload: ReviseResponse = {
        plan: updatedPlan,
        ...(updatedSceneCode ? { updatedSceneCode } : {}),
        usedModel: usedModelForRevise,
        modelLog: createModelLog({
          endpoint: "/api/revise",
          model: usedModelForRevise,
          usedModel: usedModelForRevise,
          sceneId,
          attempt: 1,
          durationMs: Math.max(1, totalDurationMs),
          status: usedModelForRevise === "template-fallback" ? "fallback" : "ok",
          detail: `장면(${sceneId}) 수정 지시 반영 완료 (${usedModelForRevise}): "${instruction.slice(0, 40)}"`,
        }),
      };

      res.json(payload);
    } catch (err) {
      sendApiError(
        res,
        500,
        "REVISE_FAILED",
        `Failed to revise scene: ${sanitizeErrorMessage(err)}`,
        true
      );
    }
  }
);

// ==========================================
// 6. POST /api/voice/clone
// ==========================================
apiRouter.post(
  API_ENDPOINTS.VOICE_CLONE,
  upload.single("audio"),
  async (req: Request, res: Response) => {
    const startMs = Date.now();
    const ttsModel = getTtsModel();
    const uploadedAudio = req.file;

    try {
      const body = (req.body || {}) as Partial<VoiceCloneRequest> &
        Record<string, unknown>;
      const consent =
        body.consent === true ||
        body.consentConfirmed === true ||
        String(body.consent).toLowerCase() === "true" ||
        String(body.consentConfirmed).toLowerCase() === "true";

      if (!consent) {
        sendApiError(
          res,
          400,
          "CONSENT_REQUIRED",
          "목소리 복제를 위해 본인 음성 동의 체크가 필요합니다.",
          false,
          ttsModel
        );
        return;
      }

      const label =
        typeof body.label === "string" && body.label.trim()
          ? body.label.trim()
          : "내 목소리";

      let audioBase64 = "";
      let mimeType = "audio/wav";

      const rawInputBase64 =
        (typeof body.audioBase64 === "string" && body.audioBase64.trim()
          ? body.audioBase64
          : typeof body.referenceAudioBase64 === "string" &&
            body.referenceAudioBase64.trim()
          ? body.referenceAudioBase64
          : "") || "";

      if (uploadedAudio && uploadedAudio.path) {
        const buf = await fs.promises.readFile(uploadedAudio.path);
        audioBase64 = buf.toString("base64");
        mimeType = uploadedAudio.mimetype || "audio/wav";
      } else if (rawInputBase64) {
        const parsed = parseDataUrl(
          rawInputBase64,
          body.mimeType || "audio/wav"
        );
        audioBase64 = parsed.base64Data;
        mimeType = parsed.mimeType;
      }

      if (!audioBase64) {
        sendApiError(
          res,
          400,
          "VOICE_CLONE_FAILED",
          "음성 복제 실패 (동의 문구 낭독 또는 10~30초 WAV/MP3 음성 샘플이 필요합니다): 음성 데이터가 비어 있습니다.",
          false,
          ttsModel
        );
        return;
      }

      let consentBase64 = audioBase64;
      let consentMime = mimeType;
      if (
        typeof body.consentAudioBase64 === "string" &&
        body.consentAudioBase64.trim()
      ) {
        const parsedConsent = parseDataUrl(
          body.consentAudioBase64,
          body.consentMimeType || mimeType
        );
        consentBase64 = parsedConsent.base64Data;
        consentMime = parsedConsent.mimeType;
      }

      const apiKey = (
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        ""
      ).trim();

      if (!apiKey) {
        sendApiError(
          res,
          422,
          "VOICE_CLONE_FAILED",
          "음성 복제 실패 (동의 문구 낭독 또는 10~30초 WAV/MP3 음성 샘플이 필요합니다): GEMINI_API_KEY가 설정되어 있지 않습니다.",
          false,
          ttsModel
        );
        return;
      }

      const upstreamRes = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/voices",
        {
          method: "POST",
          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            replicated: {
              model: `models/${ttsModel}`,
              referenceAudio: {
                mimeType,
                data: audioBase64,
              },
              voiceCloningConsent: {
                mimeType: consentMime,
                data: consentBase64,
              },
            },
          }),
        }
      );

      const rawBody = await upstreamRes.text();
      let parsedBody: Record<string, unknown> = {};
      try {
        parsedBody = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        parsedBody = { raw: rawBody };
      }

      if (!upstreamRes.ok) {
        const upstreamErrorObj = parsedBody.error as
          | Record<string, unknown>
          | undefined;
        const upstreamMessage = sanitizeErrorMessage(
          upstreamErrorObj?.message || rawBody || `HTTP ${upstreamRes.status}`
        );
        console.warn(`[/api/voice/clone] Upstream voice replication failed: ${upstreamMessage}. Providing graceful Kore fallback voice.`);
        
        // Return fallback Kore voice so creator is never blocked from proceeding
        const durationMs = Date.now() - startMs;
        const responsePayload: VoiceCloneResponse = {
          voiceId: "Kore",
          label: `${label} (기본 음성 대체)`,
          usedModel: ttsModel,
          modelLog: createModelLog({
            endpoint: "/api/voice/clone",
            model: ttsModel,
            usedModel: ttsModel,
            attempt: 1,
            durationMs,
            status: "fallback",
            detail: `음성 복제 API 오류 (${upstreamMessage.slice(0, 80)}); 기본 음성(Kore)으로 원활히 연결됨`,
          }),
        };
        res.json(responsePayload);
        return;
      }

      const voiceId =
        typeof parsedBody.name === "string" && parsedBody.name.trim()
          ? parsedBody.name.trim()
          : "";

      if (!voiceId) {
        sendApiError(
          res,
          422,
          "VOICE_CLONE_FAILED",
          "음성 복제 실패 (동의 문구 낭독 또는 10~30초 WAV/MP3 음성 샘플이 필요합니다): 서버 응답에 생성된 voiceId(name)가 없습니다.",
          true,
          ttsModel
        );
        return;
      }

      const durationMs = Date.now() - startMs;
      const responsePayload: VoiceCloneResponse = {
        voiceId,
        label,
        usedModel: ttsModel,
        modelLog: createModelLog({
          endpoint: "/api/voice/clone",
          model: ttsModel,
          usedModel: ttsModel,
          attempt: 1,
          durationMs,
          status: "ok",
          detail: `음성 복제 성공 (${voiceId}, model=${ttsModel})`,
        }),
      };

      res.json(responsePayload);
    } catch (err) {
      sendApiError(
        res,
        422,
        "VOICE_CLONE_FAILED",
        `음성 복제 실패 (동의 문구 낭독 또는 10~30초 WAV/MP3 음성 샘플이 필요합니다): ${sanitizeErrorMessage(err)}`,
        true,
        ttsModel
      );
    } finally {
      if (uploadedAudio?.path) {
        await fs.promises.unlink(uploadedAudio.path).catch(() => {});
      }
    }
  }
);

// ==========================================
// 7. POST /api/script
// ==========================================
apiRouter.post(
  API_ENDPOINTS.SCRIPT,
  async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as Partial<ScriptRequest>;
      const mode: ScriptMode =
        body.mode === "from-scratch" ? "from-scratch" : "append";
      const plan = body.plan;
      const topic = typeof body.topic === "string" ? body.topic.trim() : "";
      const notes = typeof body.notes === "string" ? body.notes.trim() : "";
      const targetSceneCount =
        typeof body.targetSceneCount === "number" && body.targetSceneCount > 0
          ? Math.min(10, Math.max(1, Math.round(body.targetSceneCount)))
          : mode === "append"
          ? 2
          : 5;

      if (mode === "from-scratch" && !topic && !notes && !plan) {
        sendApiError(
          res,
          400,
          "INVALID_SCRIPT_REQUEST",
          "새 영상 대본 생성(from-scratch)을 위해 주제(topic) 또는 메모(notes)를 입력해 주세요.",
          false
        );
        return;
      }

      let validationError: string | undefined;
      let lastLog = createModelLog({
        endpoint: "/api/script",
        model: getArgonModel(),
        usedModel: getArgonModel(),
        attempt: 1,
        durationMs: 1,
        status: "ok",
      });

      for (let attempt = 1; attempt <= 2; attempt++) {
        const callResult = await callArgonModel({
          endpoint: "/api/script",
          attempt,
          systemInstruction: buildScriptSystemPrompt(mode),
          contents: [
            buildScriptUserPrompt({
              mode,
              plan,
              topic,
              notes,
              targetSceneCount,
              validationError,
            }),
          ],
          responseMimeType: "application/json",
          responseSchema: SCRIPT_RESPONSE_SCHEMA,
          temperature: 0.3,
        });

        lastLog = callResult.modelLog;

        if (!callResult.ok) {
          break;
        }

        const validated = parseAndValidateJson<{
          summary: string;
          language: string;
          scenes: Array<ScriptSceneDraft & { narration?: string; script?: string; kind?: "original" | "motion" | "ending" }>;
          uncertainFacts: string[];
        }>(callResult.text, ScriptPlanResultSchema);

        if (validated.ok) {
          const drafts: ScriptSceneDraft[] = validated.data.scenes.map(
            (s, idx) => {
              const textScript = s.script || s.narration || s.caption;
              return {
                id: s.id || `scene-${mode}-${idx + 1}`,
                kind: s.kind || "motion",
                durationSec: Number(s.durationSec) || 4.0,
                script: textScript,
                narration: textScript,
                caption: s.caption,
                visualIdea: s.visualIdea,
                template: s.template || (s.kind === "ending" ? "ending" : "diagram"),
                visuals:
                  s.visuals && s.visuals.length > 0
                    ? s.visuals
                    : [s.caption, "핵심 포인트"],
              };
            }
          );

          const plannedFromDrafts: PlannedScene[] = drafts.map((d) => ({
            id: d.id,
            kind: d.kind || "motion",
            durationSec: d.durationSec,
            script: d.script || d.narration || d.caption,
            caption: d.caption,
            visualIdea: d.visualIdea,
            template: d.template,
            visuals: d.visuals,
          }));

          let mergedPlan: ScenePlan;
          if (mode === "append" && plan) {
            const existingNonEnding = plan.scenes.filter(
              (s) => s.kind !== "ending"
            );
            const existingEnding = plan.scenes.filter(
              (s) => s.kind === "ending"
            );
            const newNonEnding = plannedFromDrafts.filter(
              (s) => s.kind !== "ending"
            );
            const newEnding = plannedFromDrafts.filter(
              (s) => s.kind === "ending"
            );
            mergedPlan = {
              ...plan,
              summary: validated.data.summary || plan.summary,
              scenes: [
                ...existingNonEnding,
                ...newNonEnding,
                ...(newEnding.length > 0 ? newEnding : existingEnding),
              ],
              uncertainFacts: Array.from(
                new Set([
                  ...(plan.uncertainFacts || []),
                  ...(validated.data.uncertainFacts || []),
                ])
              ),
              mode: "edit-plus-script",
            };
          } else {
            let cursor = 0;
            const transcript = drafts.map((d) => {
              const start = Number(cursor.toFixed(1));
              const end = Number((cursor + d.durationSec).toFixed(1));
              cursor = end;
              return { start, end, text: d.script || d.narration || d.caption };
            });
            mergedPlan = {
              summary:
                validated.data.summary ||
                `${topic || "AI 모션그래픽"} 전체 구성 기획안`,
              language: validated.data.language || "ko",
              transcript,
              keep: [],
              cuts: [],
              gaps: [],
              scenes: plannedFromDrafts,
              uncertainFacts: validated.data.uncertainFacts || [],
              mode: "script-only",
            };
          }

          const payload: ScriptResponse = {
            mode,
            scenes: drafts,
            plan: mergedPlan,
            usedModel: callResult.usedModel,
            modelLog: {
              ...callResult.modelLog,
              model: callResult.usedModel,
              usedModel: callResult.usedModel,
              attempt,
              detail: `AI 대본 생성 완료 (${mode}, ${drafts.length}개 장면, model=${callResult.usedModel})`,
            },
          };
          res.json(payload);
          return;
        }

        validationError = validated.error;
      }

      // Deterministic fallback script generation
      const baseTitle = topic || plan?.summary || "AI 핵심 요약";
      const fallbackDrafts: ScriptSceneDraft[] =
        mode === "append"
          ? [
              {
                id: `scene-append-${Date.now().toString().slice(-4)}-1`,
                kind: "motion",
                durationSec: 4.2,
                script: `${baseTitle}에서 놓치기 쉬운 핵심 포인트를 한눈에 비교해 볼게요.`,
                narration: `${baseTitle}에서 놓치기 쉬운 핵심 포인트를 한눈에 비교해 볼게요.`,
                caption: `${baseTitle.slice(0, 14)} 핵심 비교`,
                visualIdea: "좌우 2열 카드로 핵심 차이점과 라임 하이라이트 강조",
                template: "compare",
                visuals: ["기존 방식 한계", "AI 자동화 해결", "실전 체크리스트"],
              },
              {
                id: `scene-append-${Date.now().toString().slice(-4)}-2`,
                kind: "ending",
                durationSec: 3.5,
                script:
                  "오늘 정리한 3가지 원칙만 기억하시면 바로 실전에 적용할 수 있습니다.",
                narration:
                  "오늘 정리한 3가지 원칙만 기억하시면 바로 실전에 적용할 수 있습니다.",
                caption: "실전 적용 3원칙 요약",
                visualIdea: "다크 배경 엔딩 요약 카드 및 CTA",
                template: "ending",
                visuals: ["구조화 기획", "모션 코드 생성", "멀티모달 검증"],
              },
            ]
          : [
              {
                id: "scene-scratch-1",
                kind: "motion",
                durationSec: 4.0,
                script: `${baseTitle}, 왜 지금 가장 중요한지 핵심만 빠르게 짚어보겠습니다.`,
                narration: `${baseTitle}, 왜 지금 가장 중요한지 핵심만 빠르게 짚어보겠습니다.`,
                caption: `${baseTitle.slice(0, 16)} 핵심 훅`,
                visualIdea: "키네틱 타이포 슬램 타이틀과 라임 배지 등장",
                template: "kinetic",
                visuals: [baseTitle.slice(0, 16), "핵심 문제 정의", "실전 해법"],
              },
              {
                id: "scene-scratch-2",
                kind: "motion",
                durationSec: 4.5,
                script:
                  "복잡하게 얽힌 과정을 3단계 파이프라인으로 나누면 훨씬 명확해집니다.",
                narration:
                  "복잡하게 얽힌 과정을 3단계 파이프라인으로 나누면 훨씬 명확해집니다.",
                caption: "3단계 작동 원리 도식",
                visualIdea: "단계별 플로우 다이어그램과 화살표 애니메이션",
                template: "diagram",
                visuals: ["01 입력 분석", "02 코드 합성", "03 시각 검증"],
              },
              {
                id: "scene-scratch-3",
                kind: "ending",
                durationSec: 3.8,
                script:
                  "지금 바로 스튜디오에서 직접 실행해 보고 결과를 확인해 보세요.",
                narration:
                  "지금 바로 스튜디오에서 직접 실행해 보고 결과를 확인해 보세요.",
                caption: "핵심 요약 & 다음 단계",
                visualIdea: "다크 펀치 요약 카드와 구독/실행 CTA",
                template: "ending",
                visuals: ["빠른 실행", "정확한 검증", "MP4 바로 추출"],
              },
            ];

      const fallbackPlanned: PlannedScene[] = fallbackDrafts.map((d) => ({
        id: d.id,
        kind: d.kind || "motion",
        durationSec: d.durationSec,
        script: d.script || d.narration || d.caption,
        caption: d.caption,
        visualIdea: d.visualIdea,
        template: d.template,
        visuals: d.visuals,
      }));

      const fallbackPlan: ScenePlan =
        mode === "append" && plan
          ? {
              ...plan,
              scenes: [
                ...plan.scenes.filter((s) => s.kind !== "ending"),
                ...fallbackPlanned,
              ],
              mode: "edit-plus-script",
            }
          : {
              summary: `${baseTitle} — AI 모션그래픽 대본 기획`,
              language: "ko",
              transcript: fallbackDrafts.map((d, i) => ({
                start: i * 4,
                end: (i + 1) * 4,
                text: d.script || d.narration || d.caption,
              })),
              keep: [],
              cuts: [],
              gaps: [],
              scenes: fallbackPlanned,
              uncertainFacts: [],
              mode: "script-only",
            };

      const fallbackPayload: ScriptResponse = {
        mode,
        scenes: fallbackDrafts,
        plan: fallbackPlan,
        usedModel: "template-fallback",
        modelLog: {
          ...lastLog,
          model: "template-fallback",
          usedModel: "template-fallback",
          status: "fallback",
          detail: `AI 대본 안전 폴백 적용 (${mode}, ${fallbackDrafts.length}개 장면)`,
        },
      };
      res.json(fallbackPayload);
    } catch (err) {
      sendApiError(
        res,
        500,
        "SCRIPT_FAILED",
        `Failed to generate script: ${sanitizeErrorMessage(err)}`,
        true
      );
    }
  }
);

// ==========================================
// 8. POST /api/tts (Gemini 3.8 Flash TTS + WAV Header + Semaphore)
// ==========================================

const MAX_CONCURRENT_TTS = 3;
let activeTtsCount = 0;
const ttsWaitQueue: Array<() => void> = [];

async function acquireTtsSlot(): Promise<void> {
  if (activeTtsCount < MAX_CONCURRENT_TTS) {
    activeTtsCount++;
    return;
  }
  await new Promise<void>((resolve) => {
    ttsWaitQueue.push(() => {
      activeTtsCount++;
      resolve();
    });
  });
}

function releaseTtsSlot(): void {
  activeTtsCount = Math.max(0, activeTtsCount - 1);
  const next = ttsWaitQueue.shift();
  if (next) {
    next();
  }
}

/**
 * Wraps raw PCM audio bytes with a standard 44-byte RIFF/WAVE header if not already present.
 */
export function ensureWavBuffer(
  audioBytes: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  if (
    audioBytes.byteLength >= 12 &&
    audioBytes.toString("ascii", 0, 4) === "RIFF" &&
    audioBytes.toString("ascii", 8, 12) === "WAVE"
  ) {
    return audioBytes;
  }

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = audioBytes.byteLength;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, audioBytes]);
}

function estimateWavDurationSec(
  wavBuffer: Buffer,
  defaultSampleRate = 24000
): number {
  if (wavBuffer.byteLength <= 44) {
    return 1.0;
  }
  const sampleRate = wavBuffer.readUInt32LE(24) || defaultSampleRate;
  const numChannels = wavBuffer.readUInt16LE(22) || 1;
  const bitsPerSample = wavBuffer.readUInt16LE(34) || 16;
  const bytesPerSec = Math.max(1, sampleRate * numChannels * (bitsPerSample / 8));
  const pcmBytes = wavBuffer.byteLength - 44;
  return Number(Math.max(0.5, pcmBytes / bytesPerSec).toFixed(2));
}

apiRouter.post(
  API_ENDPOINTS.TTS,
  async (req: Request, res: Response) => {
    await acquireTtsSlot();
    const startMs = Date.now();
    const ttsModel = getTtsModel();

    try {
      const body = (req.body || {}) as Partial<TtsRequest> & {
        format?: "wav" | "json";
      };
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!text) {
        sendApiError(
          res,
          400,
          "EMPTY_TTS_TEXT",
          "음성으로 합성할 대사(text)가 비어 있습니다.",
          false,
          ttsModel
        );
        return;
      }

      const rawVoiceId =
        typeof body.voiceId === "string" && body.voiceId.trim()
          ? body.voiceId.trim()
          : "Kore";
      const stylePrompt =
        typeof body.style === "string" && body.style.trim()
          ? body.style.trim()
          : "친근하고 명확한 유튜브 크리에이터 AI쭌 톤으로 자연스럽게 읽어주세요.";
      const wantsJson =
        body.format === "json" ||
        req.query.format === "json" ||
        (req.headers.accept || "").includes("application/json");

      const apiKey = (
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        ""
      ).trim();

      if (!apiKey) {
        sendApiError(
          res,
          422,
          "TTS_API_KEY_MISSING",
          "GEMINI_API_KEY가 설정되어 있지 않아 TTS 음성을 합성할 수 없습니다.",
          false,
          ttsModel
        );
        return;
      }

      let rawAudioBuffer: Buffer | null = null;
      let sampleRate = 24000;
      let usedVoiceId = rawVoiceId;

      // 1. If voiceId is a replicated voice resource ("voices/..."), try /v1beta/interactions first
      if (rawVoiceId.startsWith("voices/")) {
        try {
          const interactionRes = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/interactions",
            {
              method: "POST",
              headers: {
                "x-goog-api-key": apiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: ttsModel,
                input: `${stylePrompt}\n\n${text}`,
                responseModalities: ["AUDIO"],
                generationConfig: {
                  speechConfig: {
                    voiceConfig: {
                      replicatedVoiceConfig: {
                        voiceName: rawVoiceId,
                      },
                    },
                  },
                },
              }),
            }
          );

          if (interactionRes.ok) {
            const data = (await interactionRes.json()) as Record<string, unknown>;
            const outputs = (data.outputs || data.candidates) as
              | Array<Record<string, unknown>>
              | undefined;
            const b64 = extractAudioBase64FromResponse(outputs || data);
            if (b64) {
              rawAudioBuffer = Buffer.from(b64.data, "base64");
              sampleRate = b64.sampleRate || 24000;
            }
          }
        } catch (interErr) {
          console.warn(
            `[/api/tts] Replicated voice interaction fallback to prebuilt voice: ${sanitizeErrorMessage(interErr)}`
          );
        }
      }

      // 2. Standard Gemini TTS generateContent call with prebuiltVoiceConfig (Kore / Puck / Aoede)
      if (!rawAudioBuffer) {
        const validPrebuilt = ["Kore", "Puck", "Aoede", "Charon", "Fenrir"];
        const prebuiltName = validPrebuilt.includes(rawVoiceId)
          ? rawVoiceId
          : "Kore";
        usedVoiceId = prebuiltName;

        const client = getGenAIClient();
        if (client) {
          const ttsResponse = await client.models.generateContent({
            model: ttsModel,
            contents: [
              {
                role: "user",
                parts: [{ text: `${stylePrompt}\n\n발화 대본: ${text}` }],
              },
            ],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: prebuiltName,
                  },
                },
              },
            },
          });

          const extracted = extractAudioBase64FromResponse(ttsResponse);
          if (extracted) {
            rawAudioBuffer = Buffer.from(extracted.data, "base64");
            sampleRate = extracted.sampleRate || 24000;
          }
        }
      }

      if (!rawAudioBuffer || rawAudioBuffer.byteLength === 0) {
        sendApiError(
          res,
          502,
          "TTS_SYNTHESIS_FAILED",
          `TTS 모델(${ttsModel})에서 오디오 바이트를 반환하지 않았습니다.`,
          true,
          ttsModel
        );
        return;
      }

      const wavBuffer = ensureWavBuffer(rawAudioBuffer, sampleRate, 1, 16);
      const durationSec = estimateWavDurationSec(wavBuffer, sampleRate);
      const durationMs = Date.now() - startMs;

      res.setHeader("X-Used-Model", ttsModel);
      res.setHeader("X-Voice-Id", usedVoiceId);
      res.setHeader("X-Audio-Duration-Sec", String(durationSec));

      if (wantsJson) {
        const jsonPayload: TtsJsonResponse = {
          audioBase64: wavBuffer.toString("base64"),
          mimeType: "audio/wav",
          durationSec,
          voiceId: usedVoiceId,
          usedModel: ttsModel,
          modelLog: createModelLog({
            endpoint: "/api/tts",
            model: ttsModel,
            usedModel: ttsModel,
            sceneId: body.sceneId,
            attempt: 1,
            durationMs,
            status: "ok",
            detail: `TTS 합성 완료 (${usedVoiceId}, ${durationSec}s, model=${ttsModel})`,
          }),
        };
        res.json(jsonPayload);
        return;
      }

      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Content-Length", String(wavBuffer.byteLength));
      res.status(200).send(wavBuffer);
    } catch (err) {
      sendApiError(
        res,
        500,
        "TTS_FAILED",
        `TTS 음성 합성에 실패했습니다: ${sanitizeErrorMessage(err)}`,
        true,
        ttsModel
      );
    } finally {
      releaseTtsSlot();
    }
  }
);

/**
 * Helper to recursively locate inlineData `{ data, mimeType }` from a Gemini AUDIO response.
 */
function extractAudioBase64FromResponse(
  obj: unknown
): { data: string; mimeType: string; sampleRate?: number } | null {
  if (!obj || typeof obj !== "object") {
    return null;
  }
  const record = obj as Record<string, unknown>;

  if (
    record.inlineData &&
    typeof record.inlineData === "object" &&
    typeof (record.inlineData as Record<string, unknown>).data === "string"
  ) {
    const inline = record.inlineData as Record<string, unknown>;
    const mimeType = String(inline.mimeType || "audio/pcm");
    const rateMatch = mimeType.match(/rate=(\d+)/i);
    return {
      data: String(inline.data),
      mimeType,
      sampleRate: rateMatch ? Number(rateMatch[1]) : 24000,
    };
  }

  for (const val of Object.values(record)) {
    if (Array.isArray(val)) {
      for (const item of val) {
        const found = extractAudioBase64FromResponse(item);
        if (found) return found;
      }
    } else if (val && typeof val === "object") {
      const found = extractAudioBase64FromResponse(val);
      if (found) return found;
    }
  }

  return null;
}
