import { z } from "zod";
import { Type, type Schema } from "@google/genai";

// ==========================================
// 1. Zod Schemas (strict validation of contract.ts)
// ==========================================

export const CutReasonSchema = z.enum(["ng", "silence", "repeat", "offtopic"]);

export const SceneKindSchema = z.enum(["original", "motion", "ending"]);

export const SceneTemplateSchema = z.enum([
  "title",
  "bullets",
  "diagram",
  "compare",
  "kinetic",
  "ending",
]);

export const TranscriptSegmentSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string(),
});

export const TimeRangeSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
});

export const CutSuggestionSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  reason: CutReasonSchema,
  confidence: z.number().min(0).max(1),
  note: z.string().optional(),
});

export const ExplanationGapSchema = z.object({
  atSec: z.number().min(0),
  missing: z.string(),
});

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

export const SceneCodeSourceSchema = z.enum(["argon-code", "template-fallback"]);

export const SceneVerifyCheckSchema = z.object({
  sceneId: z.string().min(1),
  ok: z.boolean(),
  source: SceneCodeSourceSchema,
  attempts: z.number().int().min(1),
  issue: z.string().optional(),
});

export const VerifyReportSchema = z.object({
  passed: z.boolean(),
  checks: z.array(SceneVerifyCheckSchema),
  retried: z.boolean(),
});

// ==========================================
// 2. Gemini responseSchema (JSON Schema for @google/genai)
// ==========================================

export const SCENE_PLAN_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description:
        "Brief Korean summary of the recorded video, cuts detected, and missing explanations added.",
    },
    language: {
      type: Type.STRING,
      description: "Primary language code, e.g. 'ko' or 'en'.",
    },
    transcript: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          start: { type: Type.NUMBER, description: "Start timestamp in seconds" },
          end: { type: Type.NUMBER, description: "End timestamp in seconds" },
          text: { type: Type.STRING, description: "Spoken text or sound event" },
        },
        required: ["start", "end", "text"],
      },
    },
    keep: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          start: { type: Type.NUMBER },
          end: { type: Type.NUMBER },
        },
        required: ["start", "end"],
      },
    },
    cuts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          start: { type: Type.NUMBER },
          end: { type: Type.NUMBER },
          reason: {
            type: Type.STRING,
            enum: ["ng", "silence", "repeat", "offtopic"],
          },
          confidence: {
            type: Type.NUMBER,
            description:
              "Confidence from 0.0 to 1.0. Include cuts < 0.7 as suggestions.",
          },
          note: { type: Type.STRING },
        },
        required: ["start", "end", "reason", "confidence"],
      },
    },
    gaps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          atSec: { type: Type.NUMBER },
          missing: {
            type: Type.STRING,
            description:
              "Explanation or visual diagram that is missing for viewer comprehension.",
          },
        },
        required: ["atSec", "missing"],
      },
    },
    scenes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          kind: {
            type: Type.STRING,
            enum: ["original", "motion", "ending"],
          },
          durationSec: { type: Type.NUMBER },
          script: { type: Type.STRING },
          caption: { type: Type.STRING },
          visualIdea: { type: Type.STRING },
          sourceRange: {
            type: Type.OBJECT,
            properties: {
              start: { type: Type.NUMBER },
              end: { type: Type.NUMBER },
            },
            required: ["start", "end"],
          },
          template: {
            type: Type.STRING,
            enum: ["title", "bullets", "diagram", "compare", "kinetic", "ending"],
          },
          visuals: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["id", "kind", "durationSec", "script", "caption", "visualIdea"],
      },
    },
    uncertainFacts: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
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
};

export const VERIFY_REPORT_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    passed: {
      type: Type.BOOLEAN,
      description: "True if all inspected keyframes are readable, non-empty, and match their scene plan.",
    },
    retried: {
      type: Type.BOOLEAN,
    },
    checks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sceneId: { type: Type.STRING },
          ok: { type: Type.BOOLEAN },
          source: {
            type: Type.STRING,
            enum: ["argon-code", "template-fallback"],
          },
          attempts: { type: Type.INTEGER },
          issue: {
            type: Type.STRING,
            description: "Optional description of visual issue (e.g., blank frame, text overlap, low contrast).",
          },
        },
        required: ["sceneId", "ok", "source", "attempts"],
      },
    },
  },
  required: ["passed", "checks", "retried"],
};
