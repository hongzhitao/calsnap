import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, ClipboardList, User, X, Zap, Ellipsis,
  CheckCircle2, Plus, Camera, Wifi, Signal, Battery,
} from 'lucide-react';
import type { TabId, MealRecord, UserProfile, FoodItem } from './types';
import { getMealsByDate, getProfile, getSettings, saveMeal } from './db';
import { todayStr, uid } from './utils';
import { recognizeFood, recognizeFoodFromText } from './ai';
import HistoryList from './components/HistoryList';
import ProfileForm from './components/ProfileForm';
import AiAdvice from './components/AiAdvice';

// ─── iOS Status Bar ───
function StatusBar() {
  return (
    <div className="safe-top flex items-center justify-between px-6 py-2 text-black text-[13px] font-semibold bg-transparent">
      <span>9:41</span>
      <div className="flex items-center gap-1.5">
        <Signal size={13} strokeWidth={2.5} />
        <Wifi size={13} strokeWidth={2.5} />
        <Battery size={15} strokeWidth={2.5} />
      </div>
    </div>
  );
}

// ─── Scan Line Animation ───
function ScanLine() {
  return (
    <div className="absolute left-0 right-0 h-[3px] z-10 pointer-events-none animate-scan"
      style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(134,239,172,0.5) 20%, rgba(34,197,94,0.6) 50%, rgba(134,239,172,0.5) 80%, transparent 100%)',
        boxShadow: '0 0 16px rgba(34,197,94,0.35), 0 0 40px rgba(34,197,94,0.15)',
        top: '0%',
      }}
    />
  );
}

// ─── 180° Arc Gauge ───
function ArcGauge({ current, target }: { current: number; target: number }) {
  const ratio = Math.min(current / target, 1);
  const CENTER = 140;
  const RADIUS = 105;
  const circumference = Math.PI * RADIUS;

  return (
    <div className="relative flex justify-center items-center py-3">
      <svg
        viewBox="0 0 280 165"
        className="w-[260px] h-auto"
      >
        {/* Background arc */}
        <path
          d={`M ${CENTER - RADIUS} 140 A ${RADIUS} ${RADIUS} 0 0 1 ${CENTER + RADIUS} 140`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="22"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <motion.path
          d={`M ${CENTER - RADIUS} 140 A ${RADIUS} ${RADIUS} 0 0 1 ${CENTER + RADIUS} 140`}
          fill="none"
          stroke="url(#arcGrad)"
          strokeWidth="22"
          strokeLinecap="round"
          strokeDasharray={`${ratio * circumference} ${circumference * 2}`}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="arc-glow"
        />
        {/* End dot */}
        <motion.circle
          cx={CENTER + RADIUS}
          cy={140}
          r="6"
          fill="white"
          stroke="#22c55e"
          strokeWidth="3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.95 }}
          transition={{ delay: 1.2, duration: 0.3 }}
          style={{ filter: 'drop-shadow(0 0 6px rgba(34,197,94,0.5))' }}
        />
        <defs>
          <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#86efac" />
            <stop offset="50%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
        </defs>
      </svg>

      {/* Center text */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%] text-center pointer-events-none">
        <motion.div
          className="text-[52px] font-extrabold text-black leading-none tracking-[-2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          {current.toLocaleString()}
        </motion.div>
        <div className="text-[12px] text-text-muted mt-0.5 font-medium">
          今天 · 还可以吃
        </div>
        <div className="text-[11px] text-text-muted font-medium">
          目标 {target.toLocaleString()} kcal
        </div>
      </div>
    </div>
  );
}

// ─── Macro Bar ───
function MacroBar({
  label, current, target, color, unit = 'g', delay
}: {
  label: string; current: number; target: number; color: string; unit?: string; delay: number;
}) {
  const pct = Math.min((current / target) * 100, 100);
  return (
    <motion.div
      className="mb-3"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
    >
      <div className="flex justify-between text-[13px] font-medium mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="text-black font-semibold">{current}<span className="text-text-muted font-normal">/{target}{unit}</span></span>
      </div>
      <div className="h-[6px] bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: delay + 0.2, duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  );
}

// ─── Food Entry Row ───
function FoodRow({ name, time, kcal, emoji, delay }: {
  name: string; time: string; kcal: number; emoji: string; delay: number;
}) {
  return (
    <motion.div
      className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
    >
      <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center text-lg">
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-black truncate">{name}</div>
        <div className="text-[11px] text-text-muted">{time}</div>
      </div>
      <div className="text-[15px] font-bold text-black">{kcal}<span className="text-[11px] text-text-muted font-normal ml-0.5">kcal</span></div>
    </motion.div>
  );
}

// ─── Camera View ───
function CameraView({ onClose, onResult }: { onClose: () => void; onResult: (foods: FoodItem[]) => void }) {
  const [step, setStep] = useState<'camera' | 'text' | 'loading' | 'confirm'>('camera');
  const [photo, setPhoto] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [result, setResult] = useState<{ foods: FoodItem[]; totalCalories: number } | null>(null);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [showFlash, setShowFlash] = useState(false);
  const fileRef = useState<any>(null);

  useEffect(() => {
    getSettings().then(s => setSettings(s));
  }, []);

  const foodUrl = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=1000&fit=crop';

  async function analyze(photoData: string) {
    if (!settings?.apiKey) { setError('请先配置 API Key'); return; }
    setStep('loading');
    try {
      const r = await recognizeFood(photoData, settings);
      setResult(r);
      setStep('confirm');
    } catch (e: any) {
      setError(e.message || '识别失败');
      setStep('camera');
    }
  }

  async function analyzeText() {
    if (!textInput.trim() || !settings?.apiKey) return;
    setStep('loading');
    try {
      const r = await recognizeFoodFromText(textInput, settings);
      setResult(r);
      setStep('confirm');
    } catch (e: any) {
      setError(e.message || '识别失败');
      setStep('text');
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhoto(dataUrl);
      analyze(dataUrl);
    };
    reader.readAsDataURL(f);
  }

  async function handleSave() {
    if (!result) return;
    const meal: MealRecord = {
      id: uid(),
      date: todayStr(),
      mealType: 'lunch',
      foods: result.foods,
      totalCalories: result.totalCalories,
      photoUrl: photo || '',
      createdAt: Date.now(),
    };
    await saveMeal(meal);
    onResult(result.foods);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Camera area */}
      <div className="relative flex-1 bg-gray-900 overflow-hidden">
        {step === 'loading' ? (
          <>
            <img src={foodUrl} alt="" className="w-full h-full object-cover opacity-70" />
            <ScanLine />
            {/* Floating overlay card */}
            <motion.div
              className="absolute bottom-8 left-4 right-4 glass-dark rounded-3xl p-5 text-white"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 size={24} className="text-primary" />
                <div>
                  <div className="text-[13px] opacity-80">识别中...</div>
                  <div className="text-[17px] font-bold">三文鱼牛油果沙拉</div>
                  <div className="text-[13px] text-primary-light font-semibold">约523 kcal</div>
                </div>
              </div>
            </motion.div>
          </>
        ) : (
          <img src={foodUrl} alt="" className="w-full h-full object-cover" />
        )}

        {/* Top floating buttons */}
        <div className="absolute top-12 left-4 right-4 flex justify-between items-start safe-top">
          <div className="flex gap-2">
            <button onClick={onClose} className="glass w-10 h-10 rounded-full flex items-center justify-center">
              <X size={18} className="text-white" />
            </button>
            <button
              onClick={() => setShowFlash(!showFlash)}
              className={`glass w-10 h-10 rounded-full flex items-center justify-center ${showFlash ? 'bg-white/30' : ''}`}
            >
              <Zap size={18} className="text-white" />
            </button>
          </div>
          <button className="glass w-10 h-10 rounded-full flex items-center justify-center">
            <Ellipsis size={18} className="text-white" />
          </button>
        </div>
      </div>

      {/* Bottom action area */}
      <div className="bg-white rounded-t-4xl -mt-8 relative z-10 shadow-soft-up px-5 pt-6 pb-8 safe-bottom">
        {step === 'camera' && (
          <div className="flex flex-col items-center gap-4">
            <input
              type="file" accept="image/*" capture="environment"
              onChange={handleFile} className="hidden" id="cam-input"
            />
            <label htmlFor="cam-input"
              className="w-[72px] h-[72px] rounded-full bg-gradient-to-b from-primary-light to-primary flex items-center justify-center shadow-glow cursor-pointer active:scale-95 transition-transform"
            >
              <Camera size={30} className="text-white" />
            </label>
            <p className="text-[13px] text-text-muted font-medium">点击拍照识别食物</p>
            <div className="flex items-center gap-4 w-full max-w-xs">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-text-muted">或</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <button
              onClick={() => setStep('text')}
              className="w-full max-w-xs py-3 rounded-2xl border border-gray-200 text-[14px] font-medium text-text-secondary flex items-center justify-center gap-2 active:bg-gray-50"
            >
              ✏️ 文字描述吃了什么
            </button>
          </div>
        )}

        {step === 'text' && (
          <div>
            <textarea
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder="描述一下你吃了什么...&#10;例如：一碗米饭、番茄炒蛋、鸡胸肉200g"
              className="w-full bg-gray-50 rounded-2xl p-4 text-[14px] min-h-[100px] resize-none outline-none"
              autoFocus
            />
            {error && <p className="text-red-500 text-[12px] mt-2 text-center">{error}</p>}
            <div className="flex gap-3 mt-3">
              <button onClick={() => { setStep('camera'); setTextInput(''); setError(''); }}
                className="flex-1 py-2.5 rounded-2xl border border-gray-200 text-[14px] font-medium text-text-secondary">返回</button>
              <button onClick={analyzeText} disabled={!textInput.trim()}
                className="flex-1 py-2.5 rounded-2xl bg-primary text-white text-[14px] font-semibold disabled:opacity-40">开始识别</button>
            </div>
          </div>
        )}

        {step === 'confirm' && result && (
          <div>
            <div className="text-[15px] font-bold text-black mb-2">识别结果</div>
            {result.foods.map((f, i) => (
              <div key={i} className="flex justify-between py-2.5 border-b border-gray-100 text-[14px]">
                <span className="text-text-secondary">{f.name} <span className="text-text-muted text-[12px]">{f.portion}</span></span>
                <span className="font-semibold text-black">{f.calories} kcal</span>
              </div>
            ))}
            <div className="flex justify-between py-3 text-[16px] font-bold">
              <span className="text-black">总计</span>
              <span className="text-primary">{result.totalCalories.toLocaleString()} kcal</span>
            </div>
            <div className="flex gap-3 mt-3">
              <button onClick={() => { setResult(null); setPhoto(null); setTextInput(''); setStep('camera'); }}
                className="flex-1 py-2.5 rounded-2xl border border-gray-200 text-[14px] font-medium text-text-secondary">重来</button>
              <button onClick={handleSave}
                className="flex-1 py-2.5 rounded-2xl bg-primary text-white text-[14px] font-semibold">保存记录</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState<TabId>('dashboard');
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const loadDashboard = useCallback(async () => {
    const [todayMeals, prof] = await Promise.all([
      getMealsByDate(todayStr()),
      getProfile(),
    ]);
    setMeals(todayMeals);
    setProfile(prof ?? null);
  }, []);

  useEffect(() => {
    loadDashboard();
    getSettings().then(s => {
      document.body.classList.toggle('light', s.theme === 'light');
    });
  }, [loadDashboard]);

  const totalCalories = meals.reduce((s, m) => s + m.totalCalories, 0);
  const dailyTarget = profile?.dailyTarget ?? 2000;
  const remaining = Math.max(dailyTarget - totalCalories, 0);

  // Macro estimates from today's meals
  const proteinG = Math.round(totalCalories * 0.30 / 4);
  const fatG = Math.round(totalCalories * 0.25 / 9);
  const carbsG = Math.round(totalCalories * 0.45 / 4);

  // Demo food records (merge with real data)
  const displayMeals = meals.length > 0 ? meals.slice(0, 3) : [];

  const TABS: { id: TabId; label: string; icon: any }[] = [
    { id: 'dashboard', label: '首页', icon: Home },
    { id: 'history', label: '记录', icon: ClipboardList },
    { id: 'profile', label: '我的', icon: User },
  ];

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {tab === 'dashboard' && (
        <div className="flex-1 flex flex-col">
          <StatusBar />

          {/* Header */}
          <div className="flex items-end justify-between px-5 pt-1 pb-4">
            <div>
              <div className="text-[28px] font-extrabold text-black tracking-[-1px]">今日饮食</div>
              <div className="text-[13px] text-text-muted font-medium">{todayStr()}</div>
            </div>
            {profile && (
              <span className="text-[12px] bg-black/5 text-text-secondary px-3 py-1.5 rounded-full font-semibold">
                🎯 {{ lose: '减脂中', maintain: '维持中', gain: '增肌中' }[profile.goal]}
              </span>
            )}
          </div>

          {/* Arc Gauge */}
          <ArcGauge current={totalCalories} target={dailyTarget} />

          {/* Macro bars */}
          <div className="px-5 mt-1">
            <MacroBar label="已摄入" current={totalCalories} target={dailyTarget} color="#22c55e" unit="kcal" delay={0.4} />
            <MacroBar label="蛋白质" current={proteinG} target={120} color="#22c55e" delay={0.6} />
            <MacroBar label="脂肪" current={fatG} target={65} color="#f59e0b" delay={0.8} />
            <MacroBar label="碳水" current={carbsG} target={170} color="#16a34a" delay={1.0} />
          </div>

          {/* Today's Records */}
          <div className="flex-1 px-5 mt-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[16px] font-bold text-black">今日记录</h3>
              <button
                onClick={() => setShowCamera(true)}
                className="flex items-center gap-1.5 text-[13px] font-semibold text-primary active:opacity-70"
              >
                <Plus size={16} />
                添加食物
              </button>
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-soft">
              {displayMeals.length === 0 ? (
                <div className="flex flex-col items-center py-8 opacity-30">
                  <span className="text-4xl mb-2">🍽️</span>
                  <p className="text-[13px] font-medium">今天还没记录饮食</p>
                  <p className="text-[11px] mt-1">点击右上角开始记录</p>
                </div>
              ) : (
                displayMeals.map((m, i) => (
                  <FoodRow
                    key={m.id}
                    name={m.foods.map(f => f.name).join(' · ')}
                    time={new Date(m.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    kcal={m.totalCalories}
                    emoji="🥗"
                    delay={1.2 + i * 0.15}
                  />
                ))
              )}
            </div>

            {/* AI Advice */}
            <div className="mt-4 mb-24">
              <AiAdvice />
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && <HistoryList />}
      {tab === 'profile' && <ProfileForm />}

      {/* ─── Bottom Nav ─── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 safe-bottom">
        <div className="glass border-t border-gray-200/50">
          {/* Floating camera button */}
          <div className="relative h-0 flex justify-center">
            <button
              onClick={() => setShowCamera(true)}
              className="absolute -top-7 w-[56px] h-[56px] rounded-full bg-primary flex items-center justify-center shadow-glow active:scale-95 transition-transform"
              style={{ boxShadow: '0 4px 24px rgba(34,197,94,0.35)' }}
            >
              <Camera size={24} className="text-white" />
            </button>
          </div>

          <div className="flex justify-around items-center px-4 pt-3 pb-2">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex flex-col items-center gap-0.5 py-1 px-5 min-w-[44px] min-h-[44px] justify-center ${
                    active ? 'text-primary' : 'text-text-muted'
                  }`}
                >
                  <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                  <span className="text-[10px] font-semibold">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Camera modal */}
      <AnimatePresence>
        {showCamera && (
          <CameraView onClose={() => setShowCamera(false)} onResult={() => loadDashboard()} />
        )}
      </AnimatePresence>
    </div>
  );
}
