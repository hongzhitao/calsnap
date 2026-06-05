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

// ─── Unified OpenAI-compatible call (used by OpenAI, Qwen, DeepSeek, Doubao) ───
async function chatCompat(
  settings: AppSettings,
  opts: {
    url: string;
    model: string;
    system: string;
    userText: string;
    imageBase64?: string;
    maxTokens?: number;
  }
): Promise<string> {
  const { url, model, system, userText, imageBase64, maxTokens = 1024 } = opts;
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

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${model} API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// ─── Claude-specific call ───
async function chatClaude(
  apiKey: string,
  opts: {
    system: string;
    userText: string;
    imageBase64?: string;
    maxTokens?: number;
  }
): Promise<string> {
  const { system, userText, imageBase64, maxTokens = 1024 } = opts;
  const content: any[] = [{ type: 'text', text: userText }];

  if (imageBase64) {
    const mediaType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    content.unshift({
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: imageBase64.split(',')[1] },
    });
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.content[0].text;
}

// ─── Parse AI JSON response ───
function parseAIResponse(text: string): AIResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse AI response as JSON');
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    foods: parsed.foods || [],
    totalCalories: parsed.totalCalories || 0,
  };
}

// ─── Provider resolution ───
function getProvider(settings: AppSettings): {
  type: 'openai-compat' | 'claude';
  url?: string;
  model: string;
} {
  if (settings.aiService === 'claude') {
    return { type: 'claude', model: 'claude-sonnet-4-6' };
  }
  if (settings.aiService === 'doubao') {
    return {
      type: 'openai-compat',
      url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      model: settings.model || 'doubao-seed-2-0-mini-260428',
    };
  }
  // openai / qwen / deepseek
  const urls: Record<string, string> = {
    openai: 'https://api.openai.com/v1/chat/completions',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    deepseek: 'https://api.deepseek.com/v1/chat/completions',
  };
  const models: Record<string, string> = {
    openai: 'gpt-4o',
    qwen: 'qwen-plus',
    deepseek: 'deepseek-chat',
  };
  return {
    type: 'openai-compat',
    url: urls[settings.aiService],
    model: models[settings.aiService] || 'gpt-4o',
  };
}

// ─── Public API ───
export async function recognizeFood(
  imageBase64: string,
  settings: AppSettings
): Promise<AIResult> {
  if (settings.aiService === 'deepseek') {
    throw new Error('DeepSeek 不支持图片识别，请切换为 Claude、OpenAI、Qwen 或 豆包');
  }

  const provider = getProvider(settings);
  const text = provider.type === 'claude'
    ? await chatClaude(settings.apiKey, {
        system: SYS_RECOGNIZE,
        userText: 'Analyze this meal photo and return the food items with calorie estimates.',
        imageBase64,
      })
    : await chatCompat(settings, {
        url: provider.url!,
        model: provider.model,
        system: SYS_RECOGNIZE,
        userText: 'Analyze this meal photo and return the food items with calorie estimates.',
        imageBase64,
      });

  return parseAIResponse(text);
}

export async function recognizeFoodFromText(
  description: string,
  settings: AppSettings
): Promise<AIResult> {
  const provider = getProvider(settings);
  const text = provider.type === 'claude'
    ? await chatClaude(settings.apiKey, {
        system: SYS_TEXT,
        userText: `Describe what you ate: ${description}`,
        maxTokens: 1024,
      })
    : await chatCompat(settings, {
        url: provider.url!,
        model: provider.model,
        system: SYS_TEXT,
        userText: `Describe what you ate: ${description}`,
        maxTokens: 1024,
      });

  return parseAIResponse(text);
}

export async function getDietaryAdvice(
  input: {
    profile: { height: number; weight: number; age: number; gender: string; goal: string; dailyTarget: number };
    meals: { date: string; mealType: string; foods: { name: string; calories: number }[]; totalCalories: number }[];
    weightHistory: { date: string; weight: number }[];
  },
  settings: AppSettings
): Promise<string> {
  const userPrompt = `Here is my data:\n${JSON.stringify(input, null, 2)}\n\nPlease provide dietary advice based on this.`;
  const provider = getProvider(settings);

  return provider.type === 'claude'
    ? await chatClaude(settings.apiKey, { system: SYS_ADVICE, userText: userPrompt, maxTokens: 1500 })
    : await chatCompat(settings, {
        url: provider.url!,
        model: provider.model,
        system: SYS_ADVICE,
        userText: userPrompt,
        maxTokens: 1500,
      });
}
