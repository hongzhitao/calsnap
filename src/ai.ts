import type { AppSettings, AIResult } from './types';

const SYS_RECOGNIZE = `You are a nutritionist AI. Analyze the food photo and identify all food items. For each item estimate the portion size in grams or common units, and estimate calories. Return ONLY valid JSON, no other text.

Format:
{
  "foods": [
    { "name": "food name", "portion": "estimated amount", "calories": number }
  ],
  "totalCalories": number
}

Be precise but conservative in estimates. If uncertain about a food, note it in the name.`;

const SYS_TEXT = `You are a nutritionist AI. The user will describe what they ate in natural language. Identify all food items, estimate portion size, and estimate calories for each. Return ONLY valid JSON, no other text.

Format:
{
  "foods": [
    { "name": "food name", "portion": "estimated amount", "calories": number }
  ],
  "totalCalories": number
}

Be precise but conservative in estimates. If the user says "一碗米饭", estimate ~200g and ~230 kcal. If they say "一份番茄炒蛋", estimate ~250g and ~180 kcal.`;

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
  // In dev mode, route through Vite proxy to avoid CORS.
  // Proxy target = https://ark.cn-beijing.volces.com, rewrite strips /api/proxy
  if (isDev()) {
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

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${model || 'API'} error ${res.status}: ${await res.text()}`);
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
  // Anthropic Messages API: append /messages unless URL already contains it
  let url = resolveUrl(baseUrl);
  if (!url.endsWith('/messages')) {
    url += '/messages';
  }

  if (isDev()) {
    console.log('[AI] Calling:', url, 'model:', model);
  }

  const content: any[] = [{ type: 'text', text: userText }];
  if (imageBase64) {
    const mediaType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    content.unshift({
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: imageBase64.split(',')[1] },
    });
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'Authorization': `Bearer ${apiKey}`,
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
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
      // Doubao Ark v3 uses Anthropic Messages API format.
      // Base URL: user-provided custom URL, or default Ark v3 endpoint.
      return {
        type: 'anthropic',
        url: settings.model || 'https://ark.cn-beijing.volces.com/api/v3',
        model: 'ark-code-latest',
      };
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
