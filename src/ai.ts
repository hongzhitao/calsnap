import type { AppSettings, AIResult } from './types';

const SYS_RECOGNIZE = `你是营养师 AI。分析食物照片，识别所有食物项。对每项估算份量（克或常用单位）和卡路里。仅返回有效 JSON，不要其他文字。

格式：
{
  "foods": [
    { "name": "食物名称（中文）", "portion": "估算份量", "calories": 数值 }
  ],
  "totalCalories": 数值
}

估算要精确但保守。不确定的食物在名称中注明。`;

const SYS_TEXT = `你是营养师 AI。用户用自然语言描述了他们吃的食物。识别所有食物项，估算每项的份量和卡路里。仅返回有效 JSON，不要其他文字。

格式：
{
  "foods": [
    { "name": "食物名称（中文）", "portion": "估算份量", "calories": 数值 }
  ],
  "totalCalories": 数值
}

估算要精确但保守。如果用户说"一碗米饭"，估算约 200g / 230 kcal。如果用户说"一份番茄炒蛋"，估算约 250g / 180 kcal。`;

const SYS_ADVICE = `You are a certified dietitian and nutrition coach. You will receive:
1. User profile (height, weight, age, gender, goal, daily target)
2. Recent meal history (last 7 days)
3. Weight history

Analyze their eating patterns and provide personalized dietary advice in Chinese. Structure your response:
1. 总体评价 (1-2 sentences overall assessment)
2. 营养分析 (macro balance, key gaps, patterns)
3. 具体建议 (3-5 actionable suggestions)
4. 风险提醒 (any health concerns)

Keep it concise, actionable, and encouraging. Max 400 words.`;

const SYS_GYM = `You are a fitness equipment expert. Analyze the photo and identify the gym machine or equipment. Return ONLY valid JSON, no other text.

Format:
{
  "name": "equipment name in Chinese",
  "description": "one-line description in Chinese",
  "exercises": ["exercise name 1 in Chinese", "exercise name 2", "exercise name 3"]
}

Identify the equipment precisely. For exercises, list 3-4 common movements people do on this equipment. Keep descriptions concise.`;

// ─── Helpers ───

function isDev(): boolean {
  try { return import.meta.env.DEV; } catch { return false; }
}

function resolveUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  // In dev mode, route through Vite proxy to avoid CORS for Ark URLs
  if (isDev() && rawUrl.includes('ark.cn-beijing.volces.com')) {
    try {
      return '/api/proxy' + new URL(rawUrl).pathname;
    } catch {
      return rawUrl;
    }
  }
  return rawUrl;
}

async function fetchOpenAICompat(
  url: string,
  apiKey: string,
  model: string,
  system: string,
  userText: string,
  imageBase64?: string,
  maxTokens = 1024,
): Promise<string> {
  const messages: any[] = [{ role: 'system', content: system }];
  if (imageBase64) {
    messages.push({ role: 'user', content: [
      { type: 'image_url', image_url: { url: imageBase64, detail: 'low' } },
      { type: 'text', text: userText },
    ]});
  } else {
    messages.push({ role: 'user', content: userText });
  }

  const body: any = { max_tokens: maxTokens, messages };
  if (model) body.model = model;

  const finalUrl = resolveUrl(url) || url;
  const res = await fetch(finalUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '(empty)');
    throw new Error(`${model || 'API'} error ${res.status}: ${body} (url: ${finalUrl})`);
  }
  return (await res.json()).choices[0].message.content;
}

async function fetchAnthropicCompat(
  baseUrl: string,
  apiKey: string,
  model: string,
  system: string,
  userText: string,
  imageBase64?: string,
  maxTokens = 1024,
): Promise<string> {
  // Check if this is an Ark Plan endpoint BEFORE resolveUrl (which mangles it to proxy path)
  const isArk = baseUrl.includes('ark.cn-beijing.volces.com');

  // Build the real target URL (/messages appended for Anthropic format)
  const apiUrl = baseUrl + (baseUrl.endsWith('/') ? 'messages' : '/messages');

  if (isDev()) {
    console.log('[AI] Calling:', apiUrl, 'model:', model);
  }

  const content: any[] = [{ type: 'text', text: userText }];
  if (imageBase64) {
    const mediaType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    content.unshift({
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: imageBase64.split(',')[1] },
    });
  }

  // Ark Plan uses x-api-key only (no Bearer); real Anthropic uses both
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (isArk) {
    headers['x-api-key'] = apiKey;
  } else {
    headers['anthropic-version'] = '2023-06-01';
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['x-api-key'] = apiKey;
  }

  const bodyObj = { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] };

  // In dev mode, route Ark calls through server-side relay (pure server-to-server, no CORS, no proxy issues)
  if (isDev() && isArk) {
    const relayRes = await fetch('/api/ark-relay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: apiUrl, headers, body: bodyObj }),
    });
    const relayData = await relayRes.json();
    if (relayData.status !== 200) {
      throw new Error(`API error ${relayData.status}: ${relayData.body} (url: ${apiUrl})`);
    }
    return JSON.parse(relayData.body).content[0].text;
  }

  const url = resolveUrl(baseUrl) + (baseUrl.endsWith('/') ? 'messages' : '/messages');
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyObj),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '(empty)');
    throw new Error(`API error ${res.status}: ${body} (url: ${url})`);
  }
  return (await res.json()).content[0].text;
}

// ─── Parse ───

function parseAIResponse(text: string): AIResult {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Failed to parse AI response as JSON');
  const p = JSON.parse(m[0]);
  return { foods: p.foods || [], totalCalories: p.totalCalories || 0 };
}

function parseGym(text: string) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Failed to parse equipment result');
  const p = JSON.parse(m[0]);
  return { name: p.name || '未知器械', description: p.description || '', exercises: p.exercises || [] };
}

// ─── Provider ───

function getConfig(settings: AppSettings): { type: 'openai' | 'anthropic'; url: string; model: string } {
  switch (settings.aiService) {
    case 'openai':
      return { type: 'openai', url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' };
    case 'qwen':
      return { type: 'openai', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-plus' };
    case 'deepseek':
      return { type: 'openai', url: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' };
    case 'doubao':
      // Custom Plan URL → Anthropic format (like CC Switch: /api/plan → /api/plan/messages)
      if (settings.model) {
        return { type: 'anthropic', url: settings.model, model: 'ark-code-latest' };
      }
      return { type: 'openai', url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', model: 'doubao-seed-2-0-mini-260428' };
    case 'claude':
    default:
      return { type: 'anthropic', url: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-6' };
  }
}

// ─── Unified call ───

async function call(settings: AppSettings, system: string, userText: string, imageBase64?: string, maxTokens = 1024): Promise<string> {
  const cfg = getConfig(settings);

  if (cfg.type === 'anthropic') {
    return fetchAnthropicCompat(cfg.url, settings.apiKey, cfg.model, system, userText, imageBase64, maxTokens);
  }
  return fetchOpenAICompat(cfg.url, settings.apiKey, cfg.model, system, userText, imageBase64, maxTokens);
}

// ─── Public ───

export async function recognizeFood(imageBase64: string, settings: AppSettings): Promise<AIResult> {
  if (settings.aiService === 'deepseek') throw new Error('DeepSeek 不支持图片识别');
  return parseAIResponse(await call(settings, SYS_RECOGNIZE, 'Analyze this meal photo.', imageBase64));
}

export async function recognizeFoodFromText(desc: string, settings: AppSettings): Promise<AIResult> {
  return parseAIResponse(await call(settings, SYS_TEXT, `What I ate: ${desc}`, undefined, 1024));
}

export async function getDietaryAdvice(input: {
  profile: { height: number; weight: number; age: number; gender: string; goal: string; dailyTarget: number };
  meals: { date: string; mealType: string; foods: { name: string; calories: number }[]; totalCalories: number }[];
  weightHistory: { date: string; weight: number }[];
}, settings: AppSettings): Promise<string> {
  return call(settings, SYS_ADVICE, `My data:\n${JSON.stringify(input, null, 2)}\n\nGive dietary advice.`, undefined, 1500);
}

export interface GymResult { name: string; description: string; exercises: string[]; }

export async function identifyEquipment(imageBase64: string, settings: AppSettings): Promise<GymResult> {
  if (settings.aiService === 'deepseek') throw new Error('DeepSeek 不支持图片识别');
  return parseGym(await call(settings, SYS_GYM, 'Identify gym equipment.', imageBase64, 512));
}
