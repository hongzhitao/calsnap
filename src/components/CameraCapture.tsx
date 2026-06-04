import { useState, useRef, useEffect } from 'react';
import type { AppSettings, MealRecord, MealType, AIResult } from '../types';
import { compressImage, todayStr, uid } from '../utils';
import { recognizeFood } from '../ai';
import { saveMeal, getSettings } from '../db';

interface CameraCaptureProps {
  onComplete: (meal?: MealRecord) => void;
}

export default function CameraCapture({ onComplete }: CameraCaptureProps) {
  const [step, setStep] = useState<'camera' | 'preview' | 'loading' | 'confirm'>('camera');
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<AIResult | null>(null);
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [error, setError] = useState('');
  const [settings, setSettingsState] = useState<AppSettings | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setSettingsState(s);
    });
  }, []);

  if (settings && !settings.apiKey) {
    return (
      <div className="fixed inset-0 bg-bg z-50 flex flex-col items-center justify-center p-8 text-center">
        <span className="text-5xl mb-4">🔑</span>
        <h2 className="text-lg font-bold mb-2">请先配置 API Key</h2>
        <p className="text-sm opacity-40 mb-6">在「我的」页面设置 AI 服务的 API Key</p>
        <button
          onClick={() => onComplete()}
          className="bg-primary text-white px-8 py-2.5 rounded-full font-semibold text-sm"
        >
          知道了
        </button>
      </div>
    );
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImage(file).then((dataUrl) => {
      setPhoto(dataUrl);
      setStep('preview');
    });
  }

  async function handleAnalyze() {
    if (!photo || !settings) return;
    setStep('loading');
    setError('');
    try {
      const aiResult = await recognizeFood(photo, settings);
      setResult(aiResult);
      setStep('confirm');
    } catch (e) {
      setError(e instanceof Error ? e.message : '识别失败，请重试');
      setStep('preview');
    }
  }

  async function handleSave() {
    if (!result || !photo || !settings) return;
    const meal: MealRecord = {
      id: uid(),
      date: todayStr(),
      mealType,
      foods: result.foods,
      totalCalories: result.totalCalories,
      photoUrl: photo,
      createdAt: Date.now(),
    };
    await saveMeal(meal);
    onComplete(meal);
  }

  return (
    <div className="fixed inset-0 bg-bg z-50 flex flex-col light:bg-bg-light">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => onComplete()} className="text-sm opacity-50 font-medium">
          取消
        </button>
        <span className="font-semibold text-sm">
          {step === 'camera' && '拍摄食物'}
          {step === 'preview' && '确认照片'}
          {step === 'loading' && '识别中...'}
          {step === 'confirm' && '确认结果'}
        </span>
        <div className="w-10" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {step === 'camera' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 rounded-full bg-gradient-to-b from-primary to-primary-light flex items-center justify-center shadow-lg shadow-primary/30"
            >
              <span className="text-3xl">📷</span>
            </button>
            <p className="text-xs opacity-30 mt-4">点击拍照或从相册选择</p>
          </>
        )}

        {(step === 'preview' || step === 'loading') && photo && (
          <div className="w-full max-w-sm">
            <img src={photo} alt="食物照片" className="w-full rounded-2xl shadow-lg" />
            {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setPhoto(null); setStep('camera'); }}
                className="flex-1 py-2.5 rounded-full border border-surface text-sm font-semibold opacity-50"
              >
                重拍
              </button>
              <button
                onClick={handleAnalyze}
                disabled={step === 'loading'}
                className="flex-1 py-2.5 rounded-full bg-primary text-white text-sm font-semibold disabled:opacity-50"
              >
                {step === 'loading' ? '分析中...' : '开始识别'}
              </button>
            </div>
          </div>
        )}

        {step === 'confirm' && result && (
          <div className="w-full max-w-sm">
            <div className="flex gap-2 mb-4">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setMealType(t)}
                  className={`flex-1 py-1.5 rounded-full text-xs font-semibold ${
                    mealType === t
                      ? 'bg-primary text-white'
                      : 'bg-surface text-white/40 light:bg-gray-100 light:text-gray-400'
                  }`}
                >
                  {{ breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' }[t]}
                </button>
              ))}
            </div>
            <div className="bg-surface rounded-2xl p-4 light:bg-white">
              <div className="text-sm font-semibold mb-2">识别结果</div>
              {result.foods.map((f, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-white/5 text-sm">
                  <span className="opacity-70">{f.name} <span className="opacity-40 text-xs">{f.portion}</span></span>
                  <span className="font-semibold text-primary-light">{f.calories} kcal</span>
                </div>
              ))}
              <div className="flex justify-between pt-3 text-base font-bold">
                <span>总计</span>
                <span className="text-primary">{result.totalCalories.toLocaleString()} kcal</span>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setResult(null); setStep('camera'); }}
                className="flex-1 py-2.5 rounded-full border border-surface text-sm font-semibold opacity-50 light:border-gray-200"
              >
                重新拍摄
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 rounded-full bg-primary text-white text-sm font-semibold"
              >
                保存记录
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
