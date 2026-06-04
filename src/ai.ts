import type { AppSettings, AIResult } from './types';

const SYSTEM_PROMPT = `You are a nutritionist AI. Analyze the food photo and identify all food items. For each item estimate the portion size in grams or common units, and estimate calories. Return ONLY valid JSON, no other text.

Format:
{
  "foods": [
    { "name": "food name", "portion": "estimated amount", "calories": number }
  ],
  "totalCalories": number
}

Be precise but conservative in estimates. If uncertain about a food, note it in the name.`;

const ADVICE_SYSTEM_PROMPT = `You are a certified dietitian and nutrition coach. You will receive:
1. User profile (height, weight, age, gender, goal, daily target)
2. Recent meal history (last 7 days)
3. Weight history

Analyze their eating patterns and provide personalized dietary advice in Chinese. Structure your response:
1. 总体评价 (1-2 sentences overall assessment)
2. 营养分析 (macro balance, key gaps, patterns)
3. 具体建议 (3-5 actionable suggestions)
4. 风险提醒 (any health concerns)

Keep it concise, actionable, and encouraging. Max 400 words.`;

export async function recognizeFood(
  imageBase64: string,
  settings: AppSettings
): Promise<AIResult> {
  if (settings.aiService === 'openai') {
    return callOpenAI(imageBase64, settings.apiKey, SYSTEM_PROMPT);
  }
  if (settings.aiService === 'qwen') {
    return callQwen(imageBase64, settings.apiKey, SYSTEM_PROMPT);
  }
  return callClaude(imageBase64, settings.apiKey, SYSTEM_PROMPT);
}

async function callClaude(
  imageBase64: string,
  apiKey: string,
  systemPrompt: string
): Promise<AIResult> {
  const mediaType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64.split(',')[1] },
            },
            { type: 'text', text: 'Analyze this meal photo and return the food items with calorie estimates.' },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.content[0].text;
  return parseAIResponse(text);
}

async function callOpenAI(
  imageBase64: string,
  apiKey: string,
  systemPrompt: string
): Promise<AIResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageBase64, detail: 'low' } },
            { type: 'text', text: 'Analyze this meal photo and return the food items with calorie estimates.' },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.choices[0].message.content;
  return parseAIResponse(text);
}

// Qwen (DashScope) uses OpenAI-compatible API format
async function callQwen(
  imageBase64: string,
  apiKey: string,
  systemPrompt: string
): Promise<AIResult> {
  const res = await fetch(
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageBase64 } },
              {
                type: 'text',
                text: 'Analyze this meal photo and return the food items with calorie estimates.',
              },
            ],
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Qwen API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.choices[0].message.content;
  return parseAIResponse(text);
}

function parseAIResponse(text: string): AIResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse AI response as JSON');
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    foods: parsed.foods || [],
    totalCalories: parsed.totalCalories || 0,
  };
}

interface AdviceInput {
  profile: { height: number; weight: number; age: number; gender: string; goal: string; dailyTarget: number };
  meals: { date: string; mealType: string; foods: { name: string; calories: number }[]; totalCalories: number }[];
  weightHistory: { date: string; weight: number }[];
}

export async function getDietaryAdvice(input: AdviceInput, settings: AppSettings): Promise<string> {
  const userPrompt = `Here is my data:\n${JSON.stringify(input, null, 2)}\n\nPlease provide dietary advice based on this.`;

  if (settings.aiService === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1500,
        messages: [
          { role: 'system', content: ADVICE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API error ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  if (settings.aiService === 'qwen') {
    const res = await fetch(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          max_tokens: 1500,
          messages: [
            { role: 'system', content: ADVICE_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
        }),
      }
    );
    if (!res.ok) throw new Error(`Qwen API error ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: ADVICE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error ${res.status}`);
  const data = await res.json();
  return data.content[0].text;
}
