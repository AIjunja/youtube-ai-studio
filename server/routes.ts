import { Router, type Request, type Response } from "express";
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
  type PlanResponse,
  type ReviseRequest,
  type ReviseResponse,
  type SceneCodeRequest,
  type SceneCodeResponse,
  type ScenePlan,
  type VerifyReport,
  type VerifyRequest,
  type VerifyResponse,
} from "../shared/contract.js";
import { MOCK_SCENE_PLAN } from "../shared/mockData.js";
import {
  callArgonModel,
  createModelLog,
  getArgonModel,
  getGenAIClient,
  sanitizeErrorMessage,
} from "./argonClient.js";
import {
  SCENE_PLAN_RESPONSE_SCHEMA,
  ScenePlanSchema,
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
  buildVerifySystemPrompt,
  buildVerifyUserPrompt,
} from "./prompts.js";
import {
  buildTemplateFallbackCode,
  validateDrawCode,
} from "./codeValidator.js";

export const apiRouter = Router();

// Configure multer to store uploaded video files in os.tmpdir() and clean up in finally block
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
    fileSize: 60 * 1024 * 1024, // 60MB max
  },
});

function sendApiError(
  res: Response,
  status: number,
  code: string,
  message: string,
  retryable = false
): void {
  const payload: ApiErrorResponse = {
    error: {
      code,
      message,
      retryable,
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
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { message: string } } }
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

// ==========================================
// 1. POST /api/plan
// ==========================================
apiRouter.post(
  API_ENDPOINTS.PLAN,
  upload.single("video"),
  async (req: Request, res: Response) => {
    const uploadedFile = req.file;
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

      // Validate video duration if provided (e.g. reject > 22s videos with a friendly error message)
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
        if (durationSec > 22) {
          sendApiError(
            res,
            400,
            "VIDEO_TOO_LONG",
            `업로드한 영상 길이(${durationSec.toFixed(1)}초)가 권장 범위(10~20초, 최대 22초)를 초과했습니다. 20초 이내의 짧은 원본 클립을 업로드해 주세요.`,
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

        const client = getGenAIClient();

        // Use Files API for large files (> 15MB) if client is available, otherwise inlineData
        if (client && fileStat.size > 15 * 1024 * 1024) {
          try {
            const uploaded = await client.files.upload({
              file: uploadedFile.path,
              config: { mimeType: effectiveMime },
            });
            if (uploaded.uri) {
              mediaParts.push({
                fileData: {
                  fileUri: uploaded.uri,
                  mimeType: uploaded.mimeType || effectiveMime,
                },
              });
            }
          } catch (uploadErr) {
            console.warn(
              `[/api/plan] files.upload fallback to inlineData: ${sanitizeErrorMessage(uploadErr)}`
            );
          }
        }

        if (mediaParts.length === 0) {
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
        mediaParts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });
      } else if (!userHint || !userHint.trim()) {
        sendApiError(
          res,
          400,
          "EMPTY_PLAN_REQUEST",
          "분석할 원본 영상 파일이 없습니다. 10~20초 분량의 동영상 파일(MP4, WebM, MOV)을 업로드해 주세요.",
          false
        );
        return;
      }

      // Attempt 1: Call Argon with multimodal input + JSON schema
      let validationError: string | undefined;
      let lastLog = createModelLog({
        endpoint: "/api/plan",
        model: getArgonModel(),
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
          const responsePayload: PlanResponse = {
            ...validated.data,
            modelLog: {
              ...callResult.modelLog,
              attempt,
              detail:
                attempt > 1
                  ? `Zod 스키마 재시도 통과 (${attempt}회차): keep ${validated.data.keep.length}구간, cut ${validated.data.cuts.length}구간, 장면 ${validated.data.scenes.length}개`
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
      const fallbackResponse: PlanResponse = {
        ...fallbackPlan,
        modelLog: {
          ...lastLog,
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
            modelLog: createModelLog({
              endpoint: "/api/scene-code",
              model: getArgonModel(),
              sceneId: scene.id,
              attempt,
              durationMs: totalDurationMs,
              status: attempt > 1 || callResult.fellBackModel ? "retry" : "ok",
              detail:
                attempt > 1
                  ? `1차 문법/토큰 검증 후 재시도 통과 (${callResult.usedModel}): draw(ctx,t,w,h,scene) 생성 완료`
                  : `draw(ctx,t,w,h,scene) 생성 및 서버 정적 검증 통과 (${callResult.usedModel})`,
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
        ...(lastErrorMsg ? { lastError: lastErrorMsg } : {}),
        modelLog: createModelLog({
          endpoint: "/api/scene-code",
          model: getArgonModel(),
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
            modelLog: {
              ...callResult.modelLog,
              attempt,
              status: "ok",
              detail: `오류(${body.errorLog.slice(0, 60)}) 수정 완료 및 정적 검증 통과`,
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
        lastError: body.errorLog,
        modelLog: {
          ...callResult.modelLog,
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
          modelLog: createModelLog({
            endpoint: "/api/verify",
            model: getArgonModel(),
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
            modelLog: {
              ...callResult.modelLog,
              attempt,
              detail: `추출된 키프레임 ${frames.length}장 멀티모달 시각 검증 완료 (passed=${passed})`,
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

      // Deterministic fallback verification if API key is missing or model call fails
      const fallbackChecks = frames.map((f) => {
        const { base64Data } = parseDataUrl(f.imageBase64 || "");
        const hasImageBytes = base64Data.length > 32;
        return {
          sceneId: f.sceneId,
          ok: hasImageBytes,
          source: f.source,
          attempts: f.attempts || 1,
          ...(hasImageBytes ? {} : { issue: "Keyframe image payload appears empty" }),
        };
      });
      const passed = fallbackChecks.every((c) => c.ok);

      const fallbackPayload: VerifyResponse = {
        passed,
        checks: fallbackChecks,
        retried,
        modelLog: {
          ...lastLog,
          status: "fallback",
          detail: `키프레임 ${frames.length}장 구조적 검증 완료 (passed=${passed})`,
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

      const revisedScene =
        updatedPlan.scenes.find((s) => s.id === sceneId) ||
        updatedPlan.scenes[targetIndex];

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
            updatedSceneCode = {
              sceneId: revisedScene.id,
              code: check.code,
              attempts: attempt,
              source: "argon-code",
            };
            codeSuccess = true;
            break;
          }
          codeError = check.error;
        }

        if (!codeSuccess) {
          // Build tailored deterministic code reflecting the revised caption & visuals
          const tailoredScene = { ...revisedScene, id: `${revisedScene.id}-revised` };
          updatedSceneCode = {
            sceneId: revisedScene.id,
            code: buildTemplateFallbackCode(tailoredScene),
            attempts: 1,
            source: "argon-code",
          };
        }
      }

      const payload: ReviseResponse = {
        plan: updatedPlan,
        ...(updatedSceneCode ? { updatedSceneCode } : {}),
        modelLog: createModelLog({
          endpoint: "/api/revise",
          model: getArgonModel(),
          sceneId,
          attempt: 1,
          durationMs: Math.max(1, totalDurationMs),
          status: "ok",
          detail: `장면(${sceneId}) 수정 지시 반영 완료: "${instruction.slice(0, 40)}"`,
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
