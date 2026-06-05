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

// ─── Low-level fetch helpers ───

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
    messages.push({
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageBase64, detail: 'low' } },
        { type: 'text', text: userText },
      ],
    });
  } else {
    messages.push({ role: 'user', content: userText });
  }

  const body: any = { max_tokens: maxTokens, messages };
  if (model) body.model = model;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
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
  isCustomEndpoint = false,
): Promise<string> {
  // If it's a custom endpoint (like Ark Plan), use it as-is.
  // Otherwise append /messages for standard Anthropic URL.
  const url = isCustomEndpoint ? baseUrl : (baseUrl || 'https://api.anthropic.com/v1') + '/messages';

  const content: any[] = [{ type: 'text', text: userText }];
  if (imageBase64) {
    const mediaType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    content.unshift({
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: imageBase64.split(',')[1] },
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  // Custom endpoints (Ark) may need Bearer, standard Anthropic uses x-api-key
  if (isCustomEndpoint) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    // Also send x-api-key as fallback
    headers['x-api-key'] = apiKey;
  } else {
    headers['x-api-key'] = apiKey;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return (await res.json()).content[0].text;
}

// ─── Parse AI JSON response ───

function parseAIResponse(text: string): AIResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse AI response as JSON');
  const parsed = JSON.parse(jsonMatch[0]);
  return { foods: parsed.foods || [], totalCalories: parsed.totalCalories || 0 };
}

function parseGymResponse(text: string): { name: string; description: string; exercises: string[] } {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse equipment result');
  const parsed = JSON.parse(jsonMatch[0]);
  return { name: parsed.name || '未知器械', description: parsed.description || '', exercises: parsed.exercises || [] };
}

// ─── Provider resolution ───

interface Provider {
  type: 'openai-compat' | 'claude' | 'doubao';
  url: string;
  model: string;
  isCustomEndpoint: boolean;
}

function getProvider(settings: AppSettings): Provider {
  if (settings.aiService === 'claude') {
    return { type: 'claude', url: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-6', isCustomEndpoint: false };
  }
  if (settings.aiService === 'doubao') {
    const customUrl = settings.model || '';
    const rawUrl = customUrl || 'https://ark.cn-beijing.volces.com/api/v3';
    const url = import.meta.env.DEV
      ? '/api/proxy' + (customUrl ? new URL(rawUrl).pathname : '/api/v3')
      : rawUrl;
    return { type: 'doubao', url, model: 'ark-code-latest', isCustomEndpoint: !!customUrl };
  }
  const urls: Record<string, string> = {
    openai: 'https://api.openai.com/v1/chat/completions',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    deepseek: 'https://api.deepseek.com/v1/chat/completions',
  };
  const models: Record<string, string> = { openai: 'gpt-4o', qwen: 'qwen-plus', deepseek: 'deepseek-chat' };
  return { type: 'openai-compat', url: urls[settings.aiService], model: models[settings.aiService] || 'gpt-4o', isCustomEndpoint: false };
}

// ─── Unified call ───

async function call(settings: AppSettings, system: string, userText: string, imageBase64?: string, maxTokens = 1024): Promise<string> {
  const p = getProvider(settings);

  if (p.type === 'claude' || p.type === 'doubao') {
    return fetchAnthropicCompat(p.url, settings.apiKey, p.model, system, userText, imageBase64, maxTokens, p.isCustomEndpoint);
  }

  return fetchOpenAICompat(p.url, settings.apiKey, p.model, system, userText, imageBase64, maxTokens);
}

// ─── Public API ───

export async function recognizeFood(imageBase64: string, settings: AppSettings): Promise<AIResult> {
  if (settings.aiService === 'deepseek') {
    throw new Error('DeepSeek 不支持图片识别，请切换其他 AI 服务');
  }
  return parseAIResponse(await call(settings, SYS_RECOGNIZE, 'Analyze this meal photo and return the food items with calorie estimates.', imageBase64));
}

export async function recognizeFoodFromText(description: string, settings: AppSettings): Promise<AIResult> {
  return parseAIResponse(await call(settings, SYS_TEXT, `Describe what you ate: ${description}`, undefined, 1024));
}

export async function getDietaryAdvice(
  input: {
    profile: { height: number; weight: number; age: number; gender: string; goal: string; dailyTarget: number };
    meals: { date: string; mealType: string; foods: { name: string; calories: number }[]; totalCalories: number }[];
    weightHistory: { date: string; weight: number }[];
  },
  settings: AppSettings,
): Promise<string> {
  return call(settings, SYS_ADVICE, `Here is my data:\n${JSON.stringify(input, null, 2)}\n\nPlease provide dietary advice based on this.`, undefined, 1500);
}

export interface GymResult {
  name: string;
  description: string;
  exercises: string[];
}

export async function identifyEquipment(imageBase64: string, settings: AppSettings): Promise<GymResult> {
  if (settings.aiService === 'deepseek') {
    throw new Error('DeepSeek 不支持图片识别，请切换其他 AI 服务');
  }
  return parseGymResponse(await call(settings, SYS_GYM, 'Identify this gym equipment and suggest exercises.', imageBase64, 512));
}
