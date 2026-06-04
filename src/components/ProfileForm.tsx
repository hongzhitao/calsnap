import { useState, useEffect } from 'react';
import type { UserProfile, AppSettings, WeightEntry } from '../types';
import { saveProfile, getProfile, saveSettings, getSettings, saveWeight, getWeightHistory, clearAllData } from '../db';
import { calcDailyTarget, todayStr } from '../utils';

export default function ProfileForm() {
  const [profile, setProfile] = useState<UserProfile>({
    height: 170, weight: 70, age: 30, gender: 'male', goal: 'maintain', dailyTarget: 2000,
  });
  const [settings, setSettings] = useState<AppSettings>({
    aiService: 'claude', apiKey: '', theme: 'dark',
  });
  const [weightInput, setWeightInput] = useState('');
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getProfile().then((p) => { if (p) setProfile(p); });
    getSettings().then((s) => setSettings(s));
    getWeightHistory().then((w) => setWeights(w));
  }, []);

  function updateProfile(field: keyof UserProfile, value: string | number) {
    const updated = { ...profile, [field]: value };
    updated.dailyTarget = calcDailyTarget(updated);
    setProfile(updated);
  }

  async function handleSaveProfile() {
    await saveProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSaveSettings() {
    await saveSettings(settings);
    document.body.classList.toggle('light', settings.theme === 'light');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleAddWeight() {
    const w = parseFloat(weightInput);
    if (isNaN(w) || w <= 0) return;
    const entry: WeightEntry = { date: todayStr(), weight: w };
    await saveWeight(entry);
    setWeights((prev) => [...prev, entry].sort((a, b) => a.date.localeCompare(b.date)));
    setWeightInput('');
    const updated = { ...profile, weight: w };
    updated.dailyTarget = calcDailyTarget(updated);
    setProfile(updated);
    await saveProfile(updated);
  }

  const latestWeight = weights.length > 0 ? weights[weights.length - 1].weight : profile.weight;
  const weightTrend = weights.length >= 2
    ? (weights[weights.length - 1].weight - weights[0].weight).toFixed(1)
    : null;

  return (
    <div className="px-4 pb-8">
      <h2 className="text-xl font-bold px-1 pt-2 pb-4">我的</h2>

      {/* Personal Info */}
      <section className="bg-surface rounded-2xl p-4 mb-4 light:bg-white light:shadow-sm">
        <h3 className="text-sm font-semibold mb-3 opacity-50">个人档案</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="身高 (cm)" value={profile.height} onChange={(v) => updateProfile('height', Number(v))} />
          <Field label="体重 (kg)" value={latestWeight} readOnly />
          <Field label="年龄" value={profile.age} onChange={(v) => updateProfile('age', Number(v))} />
          <div>
            <label className="text-[10px] opacity-40 font-medium uppercase">性别</label>
            <select
              value={profile.gender}
              onChange={(e) => updateProfile('gender', e.target.value)}
              className="w-full bg-bg rounded-lg px-3 py-2 text-sm mt-0.5 light:bg-gray-100"
            >
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] opacity-40 font-medium uppercase">目标</label>
            <select
              value={profile.goal}
              onChange={(e) => updateProfile('goal', e.target.value)}
              className="w-full bg-bg rounded-lg px-3 py-2 text-sm mt-0.5 light:bg-gray-100"
            >
              <option value="lose">减脂</option>
              <option value="maintain">维持</option>
              <option value="gain">增肌</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] opacity-40 font-medium uppercase">每日目标</label>
            <div className="bg-bg rounded-lg px-3 py-2 text-sm mt-0.5 font-bold text-primary light:bg-gray-100">
              {profile.dailyTarget.toLocaleString()} kcal
            </div>
          </div>
        </div>
        {weightTrend && (
          <p className="text-xs mt-3 opacity-40">
            体重趋势：{Number(weightTrend) > 0 ? '↑' : '↓'} {Math.abs(Number(weightTrend))} kg（自{weights[0].date}）
          </p>
        )}
        <button
          onClick={handleSaveProfile}
          className="mt-3 w-full py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition"
        >
          保存档案
        </button>
      </section>

      {/* Weight Input */}
      <section className="bg-surface rounded-2xl p-4 mb-4 light:bg-white light:shadow-sm">
        <h3 className="text-sm font-semibold mb-3 opacity-50">记录体重</h3>
        <div className="flex gap-2">
          <input
            type="number"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            placeholder="今日体重 (kg)"
            className="flex-1 bg-bg rounded-lg px-3 py-2 text-sm light:bg-gray-100"
            inputMode="decimal"
          />
          <button
            onClick={handleAddWeight}
            className="bg-primary text-white px-5 py-2 rounded-full text-sm font-semibold"
          >
            记录
          </button>
        </div>
        {weights.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {weights.slice(-7).map((w) => (
              <span key={w.date} className="text-[10px] bg-bg px-2 py-0.5 rounded-full opacity-40 light:bg-gray-100">
                {w.date.slice(5)}: {w.weight}kg
              </span>
            ))}
          </div>
        )}
      </section>

      {/* AI Settings */}
      <section className="bg-surface rounded-2xl p-4 mb-4 light:bg-white light:shadow-sm">
        <h3 className="text-sm font-semibold mb-3 opacity-50">AI 设置</h3>
        <div className="mb-3">
          <label className="text-[10px] opacity-40 font-medium uppercase">AI 服务</label>
          <select
            value={settings.aiService}
            onChange={(e) => setSettings({ ...settings, aiService: e.target.value as 'claude' | 'openai' })}
            className="w-full bg-bg rounded-lg px-3 py-2 text-sm mt-0.5 light:bg-gray-100"
          >
            <option value="claude">Claude (Anthropic)</option>
            <option value="openai">OpenAI (GPT-4o)</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] opacity-40 font-medium uppercase">API Key</label>
          <input
            type="password"
            value={settings.apiKey}
            onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
            placeholder="sk-..."
            className="w-full bg-bg rounded-lg px-3 py-2 text-sm mt-0.5 light:bg-gray-100"
          />
        </div>
        <button
          onClick={handleSaveSettings}
          className="mt-3 w-full py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition"
        >
          保存设置
        </button>
      </section>

      {/* Theme */}
      <section className="bg-surface rounded-2xl p-4 mb-4 light:bg-white light:shadow-sm">
        <h3 className="text-sm font-semibold mb-3 opacity-50">外观</h3>
        <div className="flex gap-2">
          {(['dark', 'light'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSettings({ ...settings, theme: t })}
              className={`flex-1 py-2 rounded-full text-sm font-semibold ${
                settings.theme === t
                  ? 'bg-primary text-white'
                  : 'bg-bg opacity-40 light:bg-gray-100'
              }`}
            >
              {t === 'dark' ? '🌙 暗色' : '☀️ 亮色'}
            </button>
          ))}
        </div>
      </section>

      {/* Danger Zone */}
      <section className="bg-surface rounded-2xl p-4 light:bg-white light:shadow-sm">
        <button
          onClick={async () => {
            if (window.confirm('确认清除所有数据？此操作不可恢复。')) {
              await clearAllData();
              window.location.reload();
            }
          }}
          className="w-full py-2 rounded-full border border-red-500/30 text-red-400 text-sm font-semibold"
        >
          清除所有数据
        </button>
      </section>

      {saved && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-green-500 text-white px-5 py-2 rounded-full text-sm font-semibold shadow-lg z-50">
          ✓ 已保存
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: number;
  onChange?: (v: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] opacity-40 font-medium uppercase">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        className={`w-full bg-bg rounded-lg px-3 py-2 text-sm mt-0.5 light:bg-gray-100 ${
          readOnly ? 'opacity-60' : ''
        }`}
        inputMode="decimal"
      />
    </div>
  );
}
