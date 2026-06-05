import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  ClipboardList,
  User,
  Camera,
  Plus,
  X,
  Zap,
  Ellipsis,
  Signal,
  Wifi,
  Battery,
  CheckCircle2,
} from 'lucide-react';
import type { TabId, MealRecord, UserProfile, FoodItem } from './types';
import { getMealsByDate, getProfile, getSettings, saveMeal } from './db';
import { todayStr, uid } from './utils';
import { recognizeFood, recognizeFoodFromText } from './ai';
import HistoryList from './components/HistoryList';
import ProfileForm from './components/ProfileForm';

function StatusBar() {
  return (
    <div className="flex h-[44px] items-end justify-between px-7 pb-2 text-[13px] font-semibold text-black">
      <span>9:41</span>
      <div className="flex items-center gap-1.5">
        <Signal size={14} strokeWidth={2.6} />
        <Wifi size={14} strokeWidth={2.6} />
        <Battery size={17} strokeWidth={2.4} />
      </div>
    </div>
  );
}

function BigCalorieRing({ current, target }: { current: number; target: number }) {
  const ratio = Math.min(current / target, 1);
  const r = 98;
  const c = 2 * Math.PI * r;
  const offset = c - ratio * c;

  return (
    <div className="relative mx-auto h-[250px] w-[250px]">
      <svg viewBox="0 0 240 240" className="h-full w-full -rotate-90">
        <circle cx="120" cy="120" r={r} fill="none" stroke="#eef1ed" strokeWidth="17" />
        <motion.circle
          cx="120"
          cy="120"
          r={r}
          fill="none"
          stroke="url(#calGradient)"
          strokeWidth="17"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.35, ease: 'easeOut' }}
          style={{ filter: 'drop-shadow(0 8px 18px rgba(34,197,94,0.18))' }}
        />
        <defs>
          <linearGradient id="calGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#86efac" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
        </defs>
      </svg>

      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.55, ease: 'easeOut' }}
      >
        <div className="text-[56px] font-extrabold leading-none tracking-[-2.8px] text-black">
          {current.toLocaleString()}
        </div>
        <div className="mt-1 text-[13px] font-medium text-[#6b7280]">今天 · 还可以吃</div>
        <div className="mt-0.5 text-[12px] font-semibold text-black">目标 {target.toLocaleString()} kcal</div>
      </motion.div>
    </div>
  );
}

function MacroTile({ emoji, title, value, max, color, unit, delay }: {
  emoji: string;
  title: string;
  value: number;
  max: number;
  color: string;
  unit: string;
  delay: number;
}) {
  const pct = Math.min(value / max, 1);
  return (
    <motion.div
      className="min-w-0 rounded-[24px] bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.035)]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.42, ease: 'easeOut' }}
    >
      <div className="mb-1 text-[20px] leading-none">{emoji}</div>
      <div className="text-[11px] font-medium text-[#6b7280]">{title}</div>
      <div className="mt-0.5 text-[16px] font-bold leading-none text-black">
        {value}<span className="ml-0.5 text-[10px] font-medium text-[#6b7280]">/{max}{unit}</span>
      </div>
      <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-[#eef1ed]">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ delay: delay + 0.2, duration: 0.7, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  );
}

function FoodRecord({ image, name, time, kcal, delay }: {
  image: string;
  name: string;
  time: string;
  kcal: number;
  delay: number;
}) {
  return (
    <motion.div
      className="flex items-center gap-3 rounded-[24px] bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.035)]"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.42, ease: 'easeOut' }}
    >
      <img src={image} alt={name} className="h-[48px] w-[48px] flex-shrink-0 rounded-[18px] object-cover" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-bold text-black">{name}</div>
        <div className="mt-0.5 text-[12px] font-medium text-[#6b7280]">{time}</div>
      </div>
      <div className="text-right text-[14px] font-extrabold text-black">
        {kcal}<span className="ml-0.5 text-[10px] font-semibold text-[#6b7280]">kcal</span>
      </div>
    </motion.div>
  );
}

function AvocadoDecor() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[78px] h-[190px] overflow-hidden">
      <motion.img
        src="https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=420&h=420&fit=crop"
        alt="avocado"
        className="absolute -right-10 top-0 h-[150px] w-[150px] rotate-[18deg] rounded-full object-cover opacity-90 blur-[0.2px]"
        initial={{ opacity: 0, scale: 0.96, y: -8 }}
        animate={{ opacity: 0.9, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
      <motion.img
        src="https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=420&h=420&fit=crop"
        alt="avocado"
        className="absolute -left-14 top-[64px] h-[118px] w-[118px] -rotate-[24deg] rounded-full object-cover opacity-75 blur-[0.3px]"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 0.75, scale: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.7, ease: 'easeOut' }}
      />
    </div>
  );
}

function CameraModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<'camera' | 'text' | 'loading' | 'confirm'>('camera');
  const [photo, setPhoto] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [result, setResult] = useState<{ foods: FoodItem[]; totalCalories: number } | null>(null);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const previewUrl = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=900&h=1200&fit=crop';

  async function analyzePhoto(dataUrl: string) {
    if (!settings?.apiKey) {
      setError('请先在「我的」页面配置 API Key');
      return;
    }
    setStep('loading');
    try {
      const r = await recognizeFood(dataUrl, settings);
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
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhoto(dataUrl);
      analyzePhoto(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function saveResult() {
    if (!result) return;
    await saveMeal({
      id: uid(),
      date: todayStr(),
      mealType: 'lunch',
      foods: result.foods,
      totalCalories: result.totalCalories,
      photoUrl: photo || '',
      createdAt: Date.now(),
    });
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        <img src={previewUrl} alt="camera" className="h-full w-full object-cover" />
        {step === 'loading' && (
          <>
            <div
              className="absolute left-0 right-0 z-10 h-[4px] animate-scan"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(134,239,172,0.58), rgba(34,197,94,0.75), rgba(134,239,172,0.58), transparent)',
                boxShadow: '0 0 18px rgba(34,197,94,0.45), 0 0 46px rgba(34,197,94,0.18)',
              }}
            />
            <motion.div
              className="absolute bottom-8 left-5 right-5 rounded-[28px] bg-[#064e3b]/72 p-5 text-white backdrop-blur-2xl"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.48, ease: 'easeOut' }}
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 size={25} />
                <div>
                  <div className="text-[13px] font-medium opacity-80">识别中...</div>
                  <div className="text-[17px] font-bold">三文鱼牛油果沙拉</div>
                  <div className="text-[13px] font-semibold text-[#86efac]">约523 kcal</div>
                </div>
              </div>
            </motion.div>
          </>
        )}

        <div className="absolute left-4 right-4 top-12 flex items-center justify-between">
          <div className="flex gap-2">
            <button onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/28 text-white backdrop-blur-2xl">
              <X size={20} />
            </button>
            <button onClick={() => setFlash(!flash)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/28 text-white backdrop-blur-2xl">
              <Zap size={19} />
            </button>
          </div>
          <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white/28 text-white backdrop-blur-2xl">
            <Ellipsis size={20} />
          </button>
        </div>
      </div>

      <div className="relative -mt-8 rounded-t-[34px] bg-white px-5 pb-8 pt-7 shadow-[0_-12px_34px_rgba(15,23,42,0.08)]">
        {step === 'camera' && (
          <div className="flex flex-col items-center gap-4">
            <input id="food-camera-input" type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
            <label htmlFor="food-camera-input" className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[#22c55e] shadow-[0_10px_28px_rgba(34,197,94,0.24)]">
              <Camera size={31} className="text-white" />
            </label>
            <div className="text-[13px] font-medium text-[#6b7280]">拍照识别食物</div>
            <button onClick={() => setStep('text')} className="h-12 w-full rounded-[18px] border border-gray-200 text-[14px] font-semibold text-[#1f2937]">
              ✏️ 文字描述吃了什么
            </button>
            {error && <div className="text-center text-[12px] text-red-500">{error}</div>}
          </div>
        )}

        {step === 'text' && (
          <div>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="例如：一碗米饭、番茄炒蛋、鸡胸肉200g"
              className="h-[120px] w-full resize-none rounded-[22px] bg-gray-50 p-4 text-[16px] outline-none"
              autoFocus
            />
            {error && <div className="mt-2 text-center text-[12px] text-red-500">{error}</div>}
            <div className="mt-4 flex gap-3">
              <button onClick={() => setStep('camera')} className="h-12 flex-1 rounded-[18px] border border-gray-200 text-[14px] font-semibold text-[#1f2937]">返回</button>
              <button onClick={analyzeText} disabled={!textInput.trim()} className="h-12 flex-1 rounded-[18px] bg-[#22c55e] text-[14px] font-semibold text-white disabled:opacity-40">开始识别</button>
            </div>
          </div>
        )}

        {step === 'confirm' && result && (
          <div>
            <div className="mb-2 text-[16px] font-bold text-black">识别结果</div>
            {result.foods.map((food, index) => (
              <div key={index} className="flex justify-between border-b border-gray-100 py-2.5 text-[14px]">
                <span className="text-[#1f2937]">{food.name} <span className="text-[12px] text-[#6b7280]">{food.portion}</span></span>
                <span className="font-bold text-black">{food.calories} kcal</span>
              </div>
            ))}
            <div className="flex justify-between py-3 text-[16px] font-extrabold">
              <span>总计</span>
              <span className="text-[#22c55e]">{result.totalCalories} kcal</span>
            </div>
            <div className="mt-3 flex gap-3">
              <button onClick={() => { setResult(null); setStep('camera'); }} className="h-12 flex-1 rounded-[18px] border border-gray-200 text-[14px] font-semibold">重来</button>
              <button onClick={saveResult} className="h-12 flex-1 rounded-[18px] bg-[#22c55e] text-[14px] font-semibold text-white">保存记录</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<TabId>('dashboard');
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const loadDashboard = useCallback(async () => {
    const [todayMeals, prof] = await Promise.all([getMealsByDate(todayStr()), getProfile()]);
    setMeals(todayMeals);
    setProfile(prof ?? null);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const totalCalories = meals.reduce((sum, meal) => sum + meal.totalCalories, 0);
  const dailyTarget = profile?.dailyTarget ?? 1680;
  const remaining = Math.max(dailyTarget - totalCalories, 0);

  const protein = Math.round(totalCalories * 0.3 / 4);
  const fat = Math.round(totalCalories * 0.25 / 9);
  const carbs = Math.round(totalCalories * 0.45 / 4);

  const demoRecords = meals.length > 0 ? meals.slice(0, 3).map((meal, index) => ({
    id: meal.id,
    name: meal.foods.map((f) => f.name).join(' · '),
    time: new Date(meal.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    kcal: meal.totalCalories,
    image: `https://picsum.photos/seed/food-${index + 1}/96/96`,
  })) : [
    { id: 'demo-1', name: '三文鱼牛油果沙拉', time: '12:30', kcal: 523, image: 'https://picsum.photos/seed/salmon-avocado/96/96' },
    { id: 'demo-2', name: '希腊酸奶碗', time: '08:15', kcal: 328, image: 'https://picsum.photos/seed/yogurt-bowl/96/96' },
    { id: 'demo-3', name: '牛油果奶昔', time: '07:45', kcal: 201, image: 'https://picsum.photos/seed/avocado-smoothie/96/96' },
  ];

  const navItems: { id: TabId; label: string; icon: any }[] = [
    { id: 'dashboard', label: '首页', icon: Home },
    { id: 'history', label: '记录', icon: ClipboardList },
    { id: 'profile', label: '我的', icon: User },
  ];

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-white">
      {tab === 'dashboard' && (
        <main className="relative flex flex-1 flex-col bg-white pb-[96px]">
          <StatusBar />
          <AvocadoDecor />

          <section className="relative z-10 px-5 pt-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[28px] font-extrabold leading-tight tracking-[-1.1px] text-black">今日饮食</div>
                <div className="mt-1 text-[13px] font-medium text-[#6b7280]">{todayStr()}</div>
              </div>
              {profile && (
                <div className="rounded-full bg-[#dcfce7] px-3 py-1.5 text-[12px] font-bold text-[#16a34a]">
                  {{ lose: '减脂中', maintain: '维持中', gain: '增肌中' }[profile.goal]}
                </div>
              )}
            </div>
          </section>

          <section className="relative z-10 mt-1">
            <BigCalorieRing current={remaining} target={dailyTarget} />
          </section>

          <section className="relative z-10 grid grid-cols-4 gap-2 px-4">
            <MacroTile emoji="🔥" title="已摄入" value={totalCalories || 1052} max={dailyTarget} color="#22c55e" unit="kcal" delay={0.35} />
            <MacroTile emoji="🍗" title="蛋白质" value={protein || 72} max={120} color="#22c55e" unit="g" delay={0.45} />
            <MacroTile emoji="🥑" title="脂肪" value={fat || 47} max={65} color="#f59e0b" unit="g" delay={0.55} />
            <MacroTile emoji="🍚" title="碳水" value={carbs || 96} max={170} color="#22c55e" unit="g" delay={0.65} />
          </section>

          <section className="relative z-10 mt-5 px-4">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-[17px] font-extrabold text-black">今日记录</h2>
              <button onClick={() => setShowCamera(true)} className="flex h-9 items-center gap-1.5 rounded-full bg-[#dcfce7] px-3 text-[13px] font-bold text-[#16a34a]">
                <Plus size={15} strokeWidth={2.6} />
                添加食物
              </button>
            </div>
            <div className="space-y-2.5">
              {demoRecords.map((record, index) => (
                <FoodRecord key={record.id} {...record} delay={0.78 + index * 0.12} />
              ))}
            </div>
          </section>
        </main>
      )}

      {tab === 'history' && <HistoryList />}
      {tab === 'profile' && <ProfileForm />}

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] pb-[env(safe-area-inset-bottom)]">
        <div className="relative border-t border-white/60 bg-white/82 px-5 pb-2 pt-3 shadow-[0_-8px_28px_rgba(15,23,42,0.045)] backdrop-blur-2xl">
          <button
            onClick={() => setShowCamera(true)}
            className="absolute left-1/2 top-[-32px] flex h-[68px] w-[68px] -translate-x-1/2 items-center justify-center rounded-full border-[6px] border-white bg-[#22c55e] shadow-[0_12px_32px_rgba(34,197,94,0.28)]"
          >
            <Camera size={26} strokeWidth={2.6} className="text-white" />
          </button>
          <div className="grid grid-cols-3 items-end">
            {navItems.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button key={id} onClick={() => setTab(id)} className={`flex min-h-[50px] flex-col items-center justify-center gap-1 text-[10px] font-bold ${active ? 'text-[#22c55e]' : 'text-[#6b7280]'}`}>
                  <Icon size={22} strokeWidth={active ? 2.7 : 2.2} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {showCamera && <CameraModal onClose={() => setShowCamera(false)} onSaved={loadDashboard} />}
      </AnimatePresence>
    </div>
  );
}
