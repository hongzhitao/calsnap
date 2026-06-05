import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Scale, Trash2 } from 'lucide-react';
import type { UserProfile, AppSettings, WeightEntry } from '../types';
import { saveProfile, getProfile, saveSettings, getSettings, saveWeight, getWeightHistory, clearAllData } from '../db';
import { calcDailyTarget, todayStr } from '../utils';

const AI_SERVICES = [
  { value: 'claude', label: 'Claude', desc: 'Anthropic' },
  { value: 'openai', label: 'OpenAI', desc: 'GPT-4o' },
  { value: 'qwen', label: 'Qwen', desc: '通义千问' },
  { value: 'doubao', label: '豆包', desc: '火山引擎' },
  { value: 'deepseek', label: 'DeepSeek', desc: '仅文字' },
] as const;

export default function ProfileForm() {
  const [profile, setProfile] = useState<UserProfile>({
    height: 170, weight: 70, age: 30, gender: 'male', goal: 'maintain', dailyTarget: 2000,
  });
  const [settings, setSettings] = useState<AppSettings>({
    aiService: 'claude', apiKey: '', theme: 'light',
  });
  const [weightInput, setWeightInput] = useState('');
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getProfile().then(p => { if (p) setProfile(p); });
    getSettings().then(s => setSettings(s));
    getWeightHistory().then(w => setWeights(w));
  }, []);

  function updateProfile(field: keyof UserProfile, value: string | number) {
    const updated = { ...profile, [field]: value };
    updated.dailyTarget = calcDailyTarget(updated);
    setProfile(updated);
  }

  async function handleSaveProfile() {
    await saveProfile(profile);
    flash();
  }

  async function handleSaveSettings() {
    await saveSettings(settings);
    flash();
  }

  async function handleAddWeight() {
    const w = parseFloat(weightInput);
    if (isNaN(w) || w <= 0) return;
    const entry: WeightEntry = { date: todayStr(), weight: w };
    await saveWeight(entry);
    setWeights(prev => [...prev, entry].sort((a, b) => a.date.localeCompare(b.date)));
    setWeightInput('');
    const updated = { ...profile, weight: w };
    updated.dailyTarget = calcDailyTarget(updated);
    setProfile(updated);
    await saveProfile(updated);
  }

  function flash() { setSaved(true); setTimeout(() => setSaved(false), 2000); }

  const latestWeight = weights.length > 0 ? weights[weights.length - 1].weight : profile.weight;

  return (
    <div className="px-4 pb-24 pt-4">
      <h2 className="text-[24px] font-extrabold text-black tracking-[-0.5px] px-1 pt-2 pb-5">我的</h2>

      {/* Personal Info */}
      <section className="bg-white rounded-3xl p-5 mb-4 shadow-soft">
        <h3 className="text-[14px] font-bold text-black mb-4">个人档案</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="身高 (cm)" value={profile.height} onChange={v => updateProfile('height', Number(v))} />
          <Field label="体重 (kg)" value={profile.weight} onChange={v => updateProfile('weight', Number(v))} />
          <Field label="年龄" value={profile.age} onChange={v => updateProfile('age', Number(v))} />
          <SelectField label="性别" value={profile.gender} onChange={v => updateProfile('gender', v)}
            options={[{ value: 'male', label: '男' }, { value: 'female', label: '女' }]} />
          <SelectField label="目标" value={profile.goal} onChange={v => updateProfile('goal', v)}
            options={[
              { value: 'lose', label: '减脂' },
              { value: 'maintain', label: '维持' },
              { value: 'gain', label: '增肌' },
            ]} />
          <div>
            <label className="text-[11px] text-text-muted font-medium uppercase">每日目标</label>
            <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-[14px] mt-1 font-bold text-primary">
              {profile.dailyTarget.toLocaleString()} kcal
            </div>
          </div>
        </div>
        <motion.button
          onClick={handleSaveProfile}
          whileTap={{ scale: 0.98 }}
          className="mt-4 w-full py-2.5 rounded-2xl bg-primary/10 text-primary text-[14px] font-semibold flex items-center justify-center gap-2 active:bg-primary/20"
        >
          <Save size={16} /> 保存档案
        </motion.button>
      </section>

      {/* Weight Input */}
      <section className="bg-white rounded-3xl p-5 mb-4 shadow-soft">
        <h3 className="text-[14px] font-bold text-black mb-3 flex items-center gap-2">
          <Scale size={16} className="text-primary" /> 记录体重
        </h3>
        <div className="flex gap-2">
          <input type="number" value={weightInput} onChange={e => setWeightInput(e.target.value)}
            placeholder="今日体重 (kg)" inputMode="decimal"
            className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 text-[14px] outline-none" />
          <motion.button onClick={handleAddWeight} whileTap={{ scale: 0.97 }}
            className="bg-primary text-white px-5 py-2.5 rounded-xl text-[14px] font-semibold shadow-glow">
            记录
          </motion.button>
        </div>
        {weights.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {weights.slice(-7).map(w => (
              <span key={w.date} className="text-[11px] bg-gray-50 px-2.5 py-1 rounded-full text-text-muted font-medium">
                {w.date.slice(5)}: {w.weight}kg
              </span>
            ))}
          </div>
        )}
      </section>

      {/* AI Settings */}
      <section className="bg-white rounded-3xl p-5 mb-4 shadow-soft">
        <h3 className="text-[14px] font-bold text-black mb-4">AI 设置</h3>
        <div className="mb-3">
          <label className="text-[11px] text-text-muted font-medium uppercase">AI 服务</label>
          <select
            value={settings.aiService}
            onChange={e => setSettings({ ...settings, aiService: e.target.value as any })}
            className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none"
          >
            {AI_SERVICES.map(s => (
              <option key={s.value} value={s.value}>{s.label} ({s.desc})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-text-muted font-medium uppercase">API Key</label>
          <input type="password" value={settings.apiKey}
            onChange={e => setSettings({ ...settings, apiKey: e.target.value })}
            placeholder="输入 API Key..." className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
        </div>
        {settings.aiService === 'doubao' && (
          <div className="mt-3">
            <label className="text-[11px] text-text-muted font-medium uppercase">Plan 地址（可选）</label>
            <input type="text" value={settings.model || ''}
              onChange={e => setSettings({ ...settings, model: e.target.value })}
              placeholder="留空走默认 Chat API"
              className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
            <p className="text-[11px] text-text-muted mt-1">填 Plan 地址走 Anthropic 格式；留空走标准 Chat API（填 API Key 即可）</p>
          </div>
        )}
        <motion.button onClick={handleSaveSettings} whileTap={{ scale: 0.98 }}
          className="mt-4 w-full py-2.5 rounded-2xl bg-primary/10 text-primary text-[14px] font-semibold flex items-center justify-center gap-2 active:bg-primary/20">
          <Save size={16} /> 保存设置
        </motion.button>
      </section>

      {/* Danger Zone */}
      <section className="bg-white rounded-3xl p-5 shadow-soft">
        <motion.button
          onClick={async () => { if (window.confirm('确认清除所有数据？')) { await clearAllData(); window.location.reload(); } }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-2.5 rounded-2xl border border-red-200 text-red-400 text-[14px] font-semibold flex items-center justify-center gap-2 active:bg-red-50"
        >
          <Trash2 size={16} /> 清除所有数据
        </motion.button>
      </section>

      {saved && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-primary text-white px-6 py-2.5 rounded-2xl text-[14px] font-semibold shadow-glow z-50"
        >
          ✓ 已保存
        </motion.div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, readOnly }: {
  label: string; value: number; onChange?: (v: string) => void; readOnly?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] text-text-muted font-medium uppercase">{label}</label>
      <input type="number" value={value} onChange={e => onChange?.(e.target.value)} readOnly={readOnly}
        className={`w-full bg-gray-50 rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none ${readOnly ? 'opacity-50' : ''}`}
        inputMode="decimal" />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-[11px] text-text-muted font-medium uppercase">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
