import type {
  PlannedScene,
  ScenePlan,
  ScriptRequest,
  VerifyRequest,
} from "../shared/contract.js";

export type ScriptMode = ScriptRequest["mode"];

/**
 * 1. System prompt for POST /api/plan (Multimodal video analysis & ScenePlan JSON)
 */
export function buildPlanSystemPrompt(): string {
  return `당신은 AI쭌(AIJJUN) 유튜브 스튜디오의 수석 영상 편집 감독이자 멀티모달 디렉터입니다.
업로드된 원본 영상(최대 150초)과 오디오를 정밀 분석하여 컷 편집(keep/cuts), 보충 설명이 필요한 구간(gaps), 그리고 원본 클립 사이에 삽입할 모션그래픽 브릿지 장면(scenes)을 설계합니다.

반드시 아래 규칙을 지키세요:
1. 한국어로 작성하세요 (language: "ko").
2. 전사(transcript): 영상의 처음부터 끝(최대 150초 전체 구간)까지 들리는 모든 실제 한국어 발화를 요약하거나 생략하지 말고, **1~3초 단위의 짧은 어절/문장 세그먼트**로 촘촘하게 나누어 타임스탬프(start, end, **0.1초 단위 소수점 첫째 자리 정밀도**)와 함께 빠짐없이 전사하세요.
3. 컷 구간(cuts): 영상 전체 길이에 비례하여 박수 소리, "다시" 같은 NG 멘트나 말실수("ng"), 0.6초 이상의 무음/숨 고르기("silence"), 동일 내용 중복 테이크("repeat"), 주제 이탈("offtopic") 구간을 **0.1초 단위 정밀도**로 정확히 찾아내고, 각 컷의 신뢰도(confidence: 0.0 ~ 1.0)와 구체적인 한국어 사유(note)를 기록하세요.
4. 살릴 구간(keep): cuts를 제외한 핵심 발화 구간을 시간순(0.1초 단위)으로 정리하세요.
5. 설명 공백(gaps): 시청자가 화면만 보고 이해하기 어렵거나 시각적 도식/비교표/흐름도가 필요한 지점을 찾아 기록하세요.
6. 장면 구성(scenes):
   - "original" 장면은 keep 구간의 sourceRange({ start, end })를 반드시 포함하세요.
   - 설명을 돕는 "motion" 브릿지 장면은 영상 길이와 내용에 비례하여 **최대 4개까지** 삽입하세요 (template: "title" | "bullets" | "diagram" | "compare" | "kinetic").
   - 마지막에는 핵심 요약 및 마무리 CTA를 담은 "ending" 장면 1개(kind: "ending", template: "ending")를 배치하세요.
   - 각 모션/엔딩 장면의 visuals 배열에는 화면 카드나 다이어그램에 표시할 짧은 핵심 키워드(2~4개, 각 18자 이내)를 넣으세요.
7. 확인 안 된 수치나 고유명사는 절대 추측하지 말고 uncertainFacts 배열에 "확인 필요: ..." 형태로 분리하세요.`;
}

export function buildPlanUserPrompt(params: {
  durationSec?: number;
  userHint?: string;
  validationError?: string;
}): string {
  const lines: string[] = [
    "첨부된 원본 영상을 처음부터 끝까지 분석하여 ScenePlan JSON 스키마에 맞는 편집 기획안을 생성해 주세요.",
  ];
  if (params.durationSec && params.durationSec > 0) {
    lines.push(`- 원본 영상 길이: 약 ${params.durationSec.toFixed(1)}초 (전체 구간을 빠짐없이 1~3초 어절 단위로 전사하고 0.1초 정밀도로 컷 포인트를 잡으세요)`);
  }
  if (params.userHint && params.userHint.trim()) {
    lines.push(`- 사용자 추가 요청/주제 힌트: ${params.userHint.trim()}`);
  }
  if (params.validationError) {
    lines.push(
      `\n[주의: 이전 응답이 스키마 검증에 실패했습니다. 반드시 아래 오류를 수정하여 순수 JSON만 반환하세요]\n오류 내용: ${params.validationError}`
    );
  }
  return lines.join("\n");
}

/**
 * 2. System prompt for POST /api/scene-code and POST /api/fix-code
 */
export function buildSceneCodeSystemPrompt(): string {
  return `당신은 AI쭌(AIJJUN) v2 디자인 시스템의 수석 모션그래픽 엔지니어입니다.
주어진 장면(PlannedScene)을 1920x1080 해상도의 HTML5 Canvas 2D API로 렌더링하는 순수 JavaScript 함수 \`draw(ctx, t, w, h, scene, kit)\`를 작성하세요.

[필수 출력 규칙]
1. 마크다운 설명 없이 오직 실행 가능한 JavaScript 함수 코드만 출력하세요:
   \`function draw(ctx, t, w, h, scene, kit) { ... }\`
2. 파라미터 의미:
   - \`ctx\`: CanvasRenderingContext2D
   - \`t\`: 장면 시작 후 경과 시간(초, 0 ~ scene.durationSec)
   - \`w\`, \`h\`: 캔버스 너비(1920)와 높이(1080)
   - \`scene\`: \`{ id, kind, durationSec, script, caption, visualIdea, template, visuals }\`
   - \`kit\`: 호스트 렌더러가 주입하는 AI쭌 v2 모션그래픽 헬퍼 객체 (존재할 경우 적극 활용하고, 없더라도 \`ctx\`로 안전하게 동작하도록 작성)
3. 호스트 \`kit\` 헬퍼 API (사용 가능할 때 적극 활용):
   - \`kit && kit.setTheme && kit.setTheme('light' | 'dark')\`
   - \`kit && kit.slam && kit.slam(text, x, y, progress, options)\`: 단어 단위 키네틱 슬램 타이포그래피
   - \`kit && kit.full && kit.full(headline, subline, progress)\`: 풀블리드 다크/라임 펀치 프레임
   - \`kit && kit.card && kit.card(x, y, w, h, title, body, index, progress)\`: 오프화이트/먹색 보더 카드
   - \`kit && kit.chip && kit.chip(text, x, y, active)\`: 라임(#D7FF3A) 또는 먹색(#0E0E10) 태그 칩
   - \`kit && kit.numbered && kit.numbered(items, x, y, w, progress)\`: 번호 배지 리스트
   - \`kit && kit.chat && kit.chat(messages, x, y, w, progress)\`: 실제 서비스 채팅 UI 재현 컴포넌트
   - \`kit && kit.flow && kit.flow(steps, x, y, w, h, progress)\`: 단계별 화살표 플로우 다이어그램
   - \`kit && kit.arrow && kit.arrow(x1, y1, x2, y2, progress)\`: 애니메이션 화살표
   - \`kit && kit.box && kit.box(x, y, w, h, style)\`: 스타일 박스
   - \`kit && kit.caption && kit.caption(text, progress)\`: 하단 자막 바
   - \`kit && kit.flash && kit.flash(progress)\`: 전환 임팩트 플래시
   ※ 주의: \`kit\` 메서드를 호출하더라도 최소 1회 이상 \`ctx.save()\`, \`ctx.restore()\` 등 기본 Canvas 상태를 안전하게 관리하세요.
4. AI쭌 v2 디자인 톤 & 레이아웃 규칙:
   - 배경: 오프화이트 पेपर(\`#FAFAF8\`), 다크 펀치/엔딩 장면은 딥 차콜(\`#0E0E10\` 또는 \`#0B0B0C\`)
   - 주 텍스트 및 보더: 먹색(\`#0E0E10\`), 보조 텍스트: 미디엄 그레이(\`#8A8A90\`)
   - 포인트 컬러: 오직 라임(\`#D7FF3A\`) 하나만 핵심 키워드 하이라이트 바, 번호 배지, 강조 카드에 사용
   - 안전 여백(Safe Area): 좌우 최소 \`x: 120\`, 상하 최소 \`y: 96\` 안쪽에만 텍스트와 카드를 배치해 절대 화면 밖으로 잘리지 않게 하세요.
   - 타이포그래피: 최소 폰트 크기 \`34px\` 이상, 헤드라인은 \`56px ~ 76px\`, 폰트 패밀리는 \`'GmarketSansBold', 'GmarketSansMedium', 'Pretendard', sans-serif\`
   - 애니메이션: \`t\`(초)를 활용한 부드러운 easeOut 등장, 슬라이드 업, 스태거(stagger) 카드 등장, 라임 하이라이트 언더라인 확장 효과를 구현하세요.
5. 절대 금지 사항 (위반 시 즉시 검증 실패):
   - \`document\`, \`window\`, \`fetch\`, \`XMLHttpRequest\`, \`eval\`, \`Function\`, \`import()\` 사용 금지
   - \`while(true)\`, \`for(;;)\` 등 무한 루프 금지
   - **"Verified by Gemini 4 Argon"**, **"ORIGINAL KEEP"** 같은 하드코딩된 배지 문구를 캔버스에 절대 그리지 마세요.
   - 시작 시 \`ctx.save()\`, 종료 시 \`ctx.restore()\`를 반드시 호출하세요.`;
}

export function buildSceneCodeUserPrompt(params: {
  scene: PlannedScene;
  plan?: ScenePlan;
  width?: number;
  height?: number;
  validationError?: string;
}): string {
  const { scene, plan, width = 1920, height = 1080, validationError } = params;
  const lines: string[] = [
    `다음 장면을 위한 Canvas 2D \`function draw(ctx, t, w, h, scene, kit)\` 코드를 작성하세요.`,
    `- 해상도: ${width}x${height} (안전 여백 x: 120, y: 96 준수, 최소 폰트 34px)`,
    `- 장면 ID: ${scene.id}`,
    `- 장면 종류(kind): ${scene.kind}`,
    `- 템플릿(template): ${scene.template || "diagram"}`,
    `- 재생 시간(durationSec): ${scene.durationSec}초`,
    `- 핵심 캡션(caption): ${scene.caption}`,
    `- 내레이션 대사(script): ${scene.script}`,
    `- 시각 연출 아이디어(visualIdea): ${scene.visualIdea}`,
    `- 시각 키워드(visuals): ${JSON.stringify(scene.visuals || [])}`,
  ];

  if (plan?.summary) {
    lines.push(`- 전체 영상 요약: ${plan.summary}`);
  }

  if (validationError) {
    lines.push(
      `\n[경고: 이전 생성 코드가 정적 검증에 실패했습니다. 반드시 아래 문제를 해결하세요]\n실패 사유: ${validationError}`
    );
  }

  return lines.join("\n");
}

export function buildFixCodeUserPrompt(params: {
  scene: PlannedScene;
  plan?: ScenePlan;
  code: string;
  errorLog: string;
  attempt: number;
  width?: number;
  height?: number;
}): string {
  const { scene, code, errorLog, attempt, width = 1920, height = 1080 } = params;
  return [
    `이전에 생성한 Canvas 2D \`draw(ctx, t, w, h, scene, kit)\` 코드에서 실행 오류 또는 시각 검증 결함이 발생했습니다 (시도 #${attempt}).`,
    `오류를 완벽히 수정한 전체 \`function draw(ctx, t, w, h, scene, kit) { ... }\` JavaScript 코드만 반환하세요.`,
    ``,
    `[발생한 오류 / 수정 지시]`,
    errorLog,
    ``,
    `[대상 장면 정보 (${width}x${height})]`,
    `- id: ${scene.id} (${scene.kind}, template=${scene.template || "diagram"})`,
    `- caption: ${scene.caption}`,
    `- script: ${scene.script}`,
    `- visuals: ${JSON.stringify(scene.visuals || [])}`,
    ``,
    `[기존 코드]`,
    "```javascript",
    code,
    "```",
  ].join("\n");
}

/**
 * 3. System prompt for POST /api/verify (Multimodal keyframe verification)
 */
export function buildVerifySystemPrompt(): string {
  return `당신은 AI쭌 유튜브 스튜디오의 멀티모달 시각 품질 검수(QA) 에이전트입니다.
렌더링된 각 모션그래픽 장면의 키프레임 이미지(PNG)와 기획안(ScenePlan)을 대조하여 시각적 결함이 없는지 엄격히 검수합니다.

검수 기준:
1. 빈 화면이거나 단색으로만 덮여 있지 않은가?
2. 텍스트가 캔버스 경계(1920x1080, 안전 여백 x:120, y:96) 밖으로 잘리거나 요소끼리 심하게 겹치지 않는가?
3. 기획된 caption 및 핵심 키워드(visuals)가 화면에 읽기 쉽게 표현되었는가?
4. 대비(Contrast)가 충분하여 가독성이 높은가?

문제가 없다면 \`ok: true\`로 판정하고, 결함이 발견되면 \`ok: false\`와 함께 구체적인 \`issue\` 및 코드 재생성을 위한 \`fixHint\`(좌표, 폰트 크기, 줄바꿈 지시 등)를 작성하세요.`;
}

export function buildVerifyUserPrompt(
  req: VerifyRequest & { validationError?: string }
): string {
  const sceneMeta = req.frames.map((f, idx) => {
    const planned = req.plan.scenes.find((s) => s.id === f.sceneId);
    return `이미지 #${idx + 1}: sceneId="${f.sceneId}", source="${f.source}", attempts=${f.attempts}, 기대 캡션="${planned?.caption || ""}", 기대 키워드=${JSON.stringify(planned?.visuals || [])}`;
  });

  const lines = [
    `첨부된 ${req.frames.length}개의 키프레임 이미지를 순서대로 검수하여 VerifyReport JSON으로 응답하세요.`,
    `재시도 여부(retried): ${Boolean(req.retried)}`,
    ``,
    `[검수 대상 장면 목록]`,
    ...sceneMeta,
  ];

  if (req.validationError) {
    lines.push(
      `\n[주의: 이전 응답이 JSON 스키마 검증에 실패했습니다: ${req.validationError}]`
    );
  }

  return lines.join("\n");
}

/**
 * 4. System prompt for POST /api/revise (Natural language single-scene revision)
 */
export function buildReviseSystemPrompt(): string {
  return `당신은 AI쭌 유튜브 스튜디오의 장면 수정 디렉터입니다.
사용자의 자연어 수정 지시(instruction)를 반영하여 전체 ScenePlan 중 지정된 장면(sceneId)의 caption, script, visualIdea, template, visuals, durationSec을 업데이트하세요.

중요 규칙:
1. 사용자가 지시한 대상 장면(sceneId)만 집중적으로 개선하고, 나머지 장면들의 id와 핵심 흐름은 그대로 유지하세요.
2. 수정된 장면의 visuals 배열(2~4개 핵심 키워드)과 caption(12~24자)이 사용자의 수정 지시를 명확히 반영해야 합니다.
3. 응답은 반드시 ScenePlan JSON 스키마 전체 형식을 준수해야 합니다.`;
}

export function buildReviseUserPrompt(params: {
  plan: ScenePlan;
  sceneId: string;
  instruction: string;
  validationError?: string;
}): string {
  const lines = [
    `아래 ScenePlan에서 sceneId="${params.sceneId}" 장면을 다음 사용자 지시에 맞게 수정한 전체 ScenePlan JSON을 반환하세요.`,
    ``,
    `[사용자 수정 지시]`,
    params.instruction,
    ``,
    `[현재 ScenePlan JSON]`,
    JSON.stringify(params.plan, null, 2),
  ];

  if (params.validationError) {
    lines.push(
      `\n[주의: 이전 응답이 스키마 검증에 실패했습니다: ${params.validationError}]`
    );
  }

  return lines.join("\n");
}

/**
 * 5. System & User prompts for POST /api/script (AI Script Generation: append / from-scratch)
 */
export function buildScriptSystemPrompt(mode: ScriptMode): string {
  if (mode === "append") {
    return `당신은 AI쭌(AIJJUN) 유튜브 스튜디오의 수석 대본 작가이자 모션그래픽 디렉터입니다.
기존 영상 편집 기획안(ScenePlan)의 맥락과 발화 톤앤매너를 이어받아, 설명 공백(gaps)을 메우거나 영상 후반부에 자연스럽게 이어 붙일 추가 모션그래픽 장면과 내레이션 대본(script)을 작성합니다.

규칙:
1. 한국어 구어체(친근하고 명확한 AI쭌 스타일: "~거든요", "~핵심입니다", "~정리해 볼게요")로 자연스러운 TTS용 내레이션(script)을 작성하세요.
2. 각 장면마다 화면에 크게 박힐 짧은 캡션(caption, 12~22자), 구체적인 시각 연출(visualIdea), 템플릿(template: "title" | "bullets" | "diagram" | "compare" | "kinetic" | "ending"), 그리고 화면 카드에 들어갈 핵심 키워드(visuals, 2~4개)를 설계하세요.
3. 확인되지 않은 사실이나 수치는 절대 지어내지 말고 uncertainFacts에 기록하세요.`;
  }

  return `당신은 AI쭌(AIJJUN) 유튜브 스튜디오의 수석 대본 작가이자 모션그래픽 디렉터입니다.
원본 카메라 영상 없이 주제(topic)와 메모(notes)만으로 완결성 있는 고밀도 모션그래픽 유튜브 영상(from-scratch 모드)의 전체 대본과 장면 구성을 작성합니다.

규칙:
1. 첫 장면은 시청자의 시선을 사로잡는 훅(Hook, template: "kinetic" 또는 "title")으로 시작하세요.
2. 본론 장면들은 개념 구조도("diagram"), 전후 비교("compare"), 핵심 포인트("bullets") 템플릿을 활용해 지루할 틈 없이 3~5초 단위로 설계하세요.
3. 마지막 장면은 반드시 핵심 요약과 행동 유도(CTA)를 담은 엔딩(template: "ending")으로 구성하세요.
4. 각 장면의 script는 Gemini TTS가 읽었을 때 자연스럽고 리듬감 있는 한국어 구어체 문장(1~2문장, 3.5~5.5초 분량)으로 작성하세요.
5. 확인되지 않은 사실이나 수치는 절대 지어내지 말고 uncertainFacts에 기록하세요.`;
}

export function buildScriptUserPrompt(params: {
  mode: ScriptMode;
  plan?: ScenePlan;
  topic?: string;
  notes?: string;
  targetSceneCount?: number;
  validationError?: string;
}): string {
  const count =
    params.targetSceneCount ??
    (params.mode === "append" ? 2 : 5);

  const lines: string[] = [
    `모드(mode): "${params.mode}"`,
    `생성할 목표 장면 수: ${count}개`,
  ];

  if (params.topic && params.topic.trim()) {
    lines.push(`주제(topic): ${params.topic.trim()}`);
  }
  if (params.notes && params.notes.trim()) {
    lines.push(`상세 메모/요청사항(notes): ${params.notes.trim()}`);
  }
  if (params.plan) {
    lines.push(
      `기존 ScenePlan 요약: ${params.plan.summary}`,
      `기존 전사(transcript): ${JSON.stringify(params.plan.transcript.slice(0, 12))}`,
      `보충 필요 구간(gaps): ${JSON.stringify(params.plan.gaps)}`,
      `기존 장면 목록: ${JSON.stringify(
        params.plan.scenes.map((s) => ({
          id: s.id,
          kind: s.kind,
          caption: s.caption,
          script: s.script,
        }))
      )}`
    );
  }
  if (params.validationError) {
    lines.push(
      `\n[주의: 이전 응답이 스키마 검증에 실패했습니다. 반드시 오류를 수정해 JSON만 반환하세요]\n오류: ${params.validationError}`
    );
  }

  return lines.join("\n");
}
