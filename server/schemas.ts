import { z } from "zod";
import { Type } from "@google/genai";

// ==========================================
// 1. Zod Schemas (Server-Side Validation)
// ==========================================

export const TimeRangeSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
});

export const TranscriptSegmentSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string().min(1),
});

export const CutReasonSchema = z.enum(["ng", "silence", "repeat", "offtopic"]);

export const CutSuggestionSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  reason: CutReasonSchema,
  confidence: z.number().min(0).max(1),
  note: z.string().optional(),
});

export const ExplanationGapSchema = z.object({
  atSec: z.number().min(0),
  missing: z.string().min(1),
});

export const SceneKindSchema = z.enum(["original", "motion", "ending"]);

export const SceneTemplateSchema = z.enum([
  "title",
  "bullets",
  "diagram",
  "compare",
  "kinetic",
  "ending",
]);

export const PlannedSceneSchema = z.object({
  id: z.string().min(1),
  kind: SceneKindSchema,
  durationSec: z.number().positive(),
  script: z.string(),
  caption: z.string(),
  visualIdea: z.string(),
  sourceRange: TimeRangeSchema.optional(),
  template: SceneTemplateSchema.optional(),
  visuals: z.array(z.string()).optional(),
});

export const ScenePlanSchema = z.object({
  summary: z.string().min(1),
  language: z.string().min(1),
  transcript: z.array(TranscriptSegmentSchema),
  keep: z.array(TimeRangeSchema),
  cuts: z.array(CutSuggestionSchema),
  gaps: z.array(ExplanationGapSchema),
  scenes: z.array(PlannedSceneSchema).min(1),
  uncertainFacts: z.array(z.string()),
});

export const ScriptSceneDraftSchema = z.object({
  id: z.string().min(1),
  script: z.string().min(1),
  caption: z.string().min(1),
  visualIdea: z.string().min(1),
  durationSec: z.number().positive(),
  template: SceneTemplateSchema.optional(),
  visuals: z.array(z.string()).optional(),
  insertAfterSceneId: z.string().optional(),
});

export const ScriptPlanResultSchema = z.object({
  summary: z.string().min(1),
  language: z.string().min(1),
  scenes: z.array(ScriptSceneDraftSchema).min(1),
  uncertainFacts: z.array(z.string()),
});

export const SceneCodeSourceSchema = z.enum([
  "argon-code",
  "template-fallback",
]);

export const VerifySceneCheckSchema = z.object({
  sceneId: z.string().min(1),
  ok: z.boolean(),
  issue: z.string().optional(),
  fixHint: z.string().optional(),
  source: SceneCodeSourceSchema,
  attempts: z.number().int().min(1),
});

export const VerifyReportSchema = z.object({
  passed: z.boolean(),
  checks: z.array(VerifySceneCheckSchema),
  retried: z.boolean(),
});

// ==========================================
// 2. Gemini responseSchema Definitions
// ==========================================

export const SCENE_PLAN_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: [
    "summary",
    "language",
    "transcript",
    "keep",
    "cuts",
    "gaps",
    "scenes",
    "uncertainFacts",
  ],
  properties: {
    summary: {
      type: Type.STRING,
      description: "한 줄 영상 주제 및 편집 방향 요약 (한국어)",
    },
    language: {
      type: Type.STRING,
      description: "주 사용 언어 코드 (예: ko)",
    },
    transcript: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["start", "end", "text"],
        properties: {
          start: { type: Type.NUMBER, description: "시작 시각(초, 0.1초 정밀도)" },
          end: { type: Type.NUMBER, description: "종료 시각(초, 0.1초 정밀도)" },
          text: { type: Type.STRING, description: "실제 한국어 발화 원문 전사 (축약/생략 없이 짧은 어절 1~3초 단위)" },
        },
      },
    },
    keep: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["start", "end"],
        properties: {
          start: { type: Type.NUMBER, description: "살릴 구간 시작(초, 0.1초 정밀도)" },
          end: { type: Type.NUMBER, description: "살릴 구간 종료(초, 0.1초 정밀도)" },
        },
      },
    },
    cuts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["start", "end", "reason", "confidence"],
        properties: {
          start: { type: Type.NUMBER, description: "잘라낼 구간 시작(초, 0.1초 정밀도)" },
          end: { type: Type.NUMBER, description: "잘라낼 구간 종료(초, 0.1초 정밀도)" },
          reason: {
            type: Type.STRING,
            enum: ["ng", "silence", "repeat", "offtopic"],
            description: "컷 사유 (박수/'다시'/말실수는 ng, 0.6초 이상 무음은 silence, 중복 테이크는 repeat, 주제 이탈은 offtopic)",
          },
          confidence: {
            type: Type.NUMBER,
            description: "신뢰도 (0.0 ~ 1.0)",
          },
          note: {
            type: Type.STRING,
            description: "컷 사유 상세 메모 (한국어)",
          },
        },
      },
    },
    gaps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["atSec", "missing"],
        properties: {
          atSec: {
            type: Type.NUMBER,
            description: "보충 설명이 필요한 원본 영상 시각(초)",
          },
          missing: {
            type: Type.STRING,
            description: "빠진 설명이나 시각화가 필요한 내용 (한국어)",
          },
        },
      },
    },
    scenes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: [
          "id",
          "kind",
          "durationSec",
          "script",
          "caption",
          "visualIdea",
        ],
        properties: {
          id: {
            type: Type.STRING,
            description: "고유 장면 ID (예: scene-1-orig, scene-2-motion)",
          },
          kind: {
            type: Type.STRING,
            enum: ["original", "motion", "ending"],
            description: "장면 유형",
          },
          durationSec: {
            type: Type.NUMBER,
            description: "장면 재생 시간(초)",
          },
          script: {
            type: Type.STRING,
            description: "해당 장면의 내레이션/발화 대사",
          },
          caption: {
            type: Type.STRING,
            description: "화면에 크게 표시할 짧은 핵심 자막 (12~24자 이내)",
          },
          visualIdea: {
            type: Type.STRING,
            description: "시각 연출 및 레이아웃 설명",
          },
          sourceRange: {
            type: Type.OBJECT,
            required: ["start", "end"],
            properties: {
              start: { type: Type.NUMBER },
              end: { type: Type.NUMBER },
            },
          },
          template: {
            type: Type.STRING,
            enum: [
              "title",
              "bullets",
              "diagram",
              "compare",
              "kinetic",
              "ending",
            ],
          },
          visuals: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "화면 카드/다이어그램에 들어갈 짧은 키워드 목록 (2~4개)",
          },
        },
      },
    },
    uncertainFacts: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "추측하지 않고 사용자 확인이 필요한 수치/고유명사/팩트 체크 항목",
    },
  },
};

export const SCRIPT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: ["summary", "language", "scenes", "uncertainFacts"],
  properties: {
    summary: {
      type: Type.STRING,
      description: "생성 또는 보강된 대본 및 장면 구성 한 줄 요약",
    },
    language: {
      type: Type.STRING,
      description: "주 사용 언어 코드 (예: ko)",
    },
    scenes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: [
          "id",
          "script",
          "caption",
          "visualIdea",
          "durationSec",
        ],
        properties: {
          id: {
            type: Type.STRING,
            description: "장면 ID (예: scene-append-1, scene-scratch-1)",
          },
          script: {
            type: Type.STRING,
            description: "TTS로 읽을 자연스러운 한국어 구어체 내레이션 대본",
          },
          caption: {
            type: Type.STRING,
            description: "모션그래픽 화면 상단/중앙에 크게 찍힐 핵심 한 줄 자막 (12~22자)",
          },
          visualIdea: {
            type: Type.STRING,
            description: "AI쭌 v2 톤 모션그래픽 시각 연출 아이디어",
          },
          durationSec: {
            type: Type.NUMBER,
            description: "장면 길이(초, 3.0~6.0초 권장)",
          },
          template: {
            type: Type.STRING,
            enum: [
              "title",
              "bullets",
              "diagram",
              "compare",
              "kinetic",
              "ending",
            ],
          },
          visuals: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "모션그래픽 카드/칩에 표시할 핵심 키워드 2~4개",
          },
          insertAfterSceneId: {
            type: Type.STRING,
            description: "append 모드일 때 어느 장면 뒤에 삽입할지 ID (선택)",
          },
        },
      },
    },
    uncertainFacts: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "사용자 확인이 필요한 수치/고유명사",
    },
  },
};

export const VERIFY_REPORT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: ["passed", "checks", "retried"],
  properties: {
    passed: {
      type: Type.BOOLEAN,
      description: "모든 모션 장면 키프레임이 품질 기준을 통과했는지 여부",
    },
    retried: {
      type: Type.BOOLEAN,
      description: "재시도 검증 여부",
    },
    checks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["sceneId", "ok", "source", "attempts"],
        properties: {
          sceneId: { type: Type.STRING },
          ok: {
            type: Type.BOOLEAN,
            description:
              "빈 화면이 아니고, 텍스트 잘림/겹침이 없으며, 기획 캡션과 일치하면 true",
          },
          issue: {
            type: Type.STRING,
            description: "문제가 발견된 경우 구체적인 시각적 결함 설명",
          },
          fixHint: {
            type: Type.STRING,
            description: "코드 재생성 시 수정해야 할 구체적 좌표/폰트/레이아웃 지시",
          },
          source: {
            type: Type.STRING,
            enum: ["argon-code", "template-fallback"],
          },
          attempts: { type: Type.INTEGER },
        },
      },
    },
  },
};
