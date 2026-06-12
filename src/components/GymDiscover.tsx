import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Search, Loader2, Dumbbell, Sparkles, Image, Play } from 'lucide-react';
import type { AppSettings } from '../types';
import { getSettings } from '../db';
import { identifyEquipment, type GymResult } from '../ai';
import { compressImage } from '../utils';

interface VideoCard {
  exercise: string;
  searchUrl: string;
  coverUrl: string;
  source: 'bilibili';
}

// Real fitness exercise photos from Unsplash (free to use)
const COVER_PHOTOS = [
  'https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1521805103424-d8f843f627d8?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1544033527-b192daee1f5b?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1637341293982-0796cd44e9a5?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1580261450046-d0a30080dc9b?w=400&h=600&fit=crop',
];

const GRADIENT_OVERLAY = 'linear-gradient(0deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.1) 100%)';

function ExerciseCard({ exercise, searchUrl, coverUrl, index }: VideoCard & { index: number }) {
  return (
    <motion.a
      href={searchUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block w-full overflow-hidden rounded-2xl shadow-sm text-left active:scale-[0.97] transition-transform no-underline"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.1, duration: 0.35, ease: 'easeOut' }}
    >
      <div className="aspect-[3/4] overflow-hidden bg-gray-100">
        <img
          src={coverUrl}
          alt={exercise}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0" style={{ background: GRADIENT_OVERLAY }} />
        {/* Platform badge */}
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-[#00a1d6]/85 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
          <Play size={10} />
          视频
        </div>
        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.01] group-hover:opacity-100 transition-opacity">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm">
            <div className="ml-0.5 h-0 w-0 border-b-[8px] border-l-[14px] border-t-[8px] border-b-transparent border-l-green-500 border-t-transparent" />
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <div className="line-clamp-2 text-[13px] font-bold leading-snug text-white drop-shadow-sm">
          {exercise}
        </div>
        <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-white/70">
          <Search size={10} />
          B站搜索教程
        </div>
      </div>
    </motion.a>
  );
}

export default function GymDiscover() {
  const [step, setStep] = useState<'idle' | 'preview' | 'loading' | 'result'>('idle');
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<GymResult | null>(null);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImage(file, 1024, 0.7).then((dataUrl) => {
      setPhoto(dataUrl);
      setStep('preview');
    });
  }

  async function handleIdentify() {
    if (!photo || !settings?.apiKey) {
      setError('请先在「我的」页面配置 API Key');
      return;
    }
    setStep('loading');
    setError('');
    try {
      const r = await identifyEquipment(photo, settings);
      setResult(r);
      setStep('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : '识别失败，请重试');
      setStep('preview');
    }
  }

  function buildVideoCards(result: GymResult): VideoCard[] {
    const baseName = result.name;
    return result.exercises.map((exercise, i) => {
      const query = `${baseName} ${exercise} 教程`;
      return {
        exercise,
        searchUrl: `https://search.bilibili.com/all?keyword=${encodeURIComponent(query)}`,
        coverUrl: COVER_PHOTOS[i % COVER_PHOTOS.length],
        source: 'bilibili',
      };
    });
  }

  function reset() {
    setStep('idle');
    setPhoto(null);
    setResult(null);
    setError('');
  }

  return (
    <div className="flex flex-1 flex-col bg-white pb-24">
      {/* Header */}
      <div className="px-5 pt-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
            <Dumbbell size={18} className="text-green-600" />
          </div>
          <div>
            <h2 className="text-[20px] font-extrabold tracking-[-0.5px] text-black">器械识别</h2>
            <p className="text-[12px] font-medium text-[#6b7280]">拍照识别健身器械，查看教学视频</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col px-4 pt-5">
        <AnimatePresence mode="wait">
          {step === 'idle' && (
            <motion.div
              key="idle"
              className="flex flex-1 flex-col items-center justify-center gap-6"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <div className="relative">
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-green-50">
                  <Dumbbell size={42} className="text-green-500" />
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full bg-green-500 shadow-lg">
                  <Sparkles size={18} className="text-white" />
                </div>
              </div>
              <div className="text-center">
                <div className="text-[17px] font-extrabold text-black">不认识器械？拍一下试试</div>
                <div className="mt-1 text-[13px] font-medium text-[#6b7280]">AI 自动识别器械类型</div>
              </div>

              <div className="flex flex-col items-center gap-3">
                {/* Camera button with label */}
                <label className="relative cursor-pointer">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFile}
                    className="absolute inset-0 w-full h-full opacity-0 z-10 pointer-events-none"
                  />
                  <div className="flex h-14 items-center gap-2 rounded-2xl bg-green-500 px-8 text-[15px] font-bold text-white shadow-[0_8px_24px_rgba(34,197,94,0.28)]">
                    <Camera size={20} />
                    拍照识别器械
                  </div>
                </label>
                {/* Gallery button with label */}
                <label className="relative w-full max-w-[260px] cursor-pointer">
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFile}
                    className="absolute inset-0 w-full h-full opacity-0 z-10 pointer-events-none"
                  />
                  <div className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-gray-200 px-6 text-[14px] font-semibold text-[#6b7280]">
                    <Image size={18} />
                    从相册选择
                  </div>
                </label>
              </div>
              <p className="text-[11px] text-[#6b7280]">例如：史密斯架、蝴蝶机、哈克深蹲机...</p>
            </motion.div>
          )}

          {step === 'preview' && photo && (
            <motion.div
              key="preview"
              className="flex flex-1 flex-col items-center gap-4"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <img src={photo} alt="器械照片" className="w-full max-w-sm rounded-3xl shadow-lg" />
              {error && <p className="text-center text-[13px] font-medium text-red-500">{error}</p>}
              <div className="flex w-full max-w-sm gap-3">
                <button onClick={reset} className="h-12 flex-1 rounded-2xl border border-gray-200 text-[14px] font-semibold text-[#6b7280]">
                  重拍
                </button>
                <button onClick={handleIdentify} className="h-12 flex-1 rounded-2xl bg-green-500 text-[14px] font-semibold text-white shadow-[0_6px_18px_rgba(34,197,94,0.22)]">
                  开始识别
                </button>
              </div>
            </motion.div>
          )}

          {step === 'loading' && (
            <motion.div
              key="loading"
              className="flex flex-1 flex-col items-center justify-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-50">
                <Loader2 size={32} className="animate-spin text-green-500" />
              </div>
              <div className="text-center">
                <div className="text-[16px] font-bold text-black">AI 识别中...</div>
                <div className="mt-1 text-[13px] text-[#6b7280]">正在分析器械类型</div>
              </div>
            </motion.div>
          )}

          {step === 'result' && result && (
            <motion.div
              key="result"
              className="flex flex-1 flex-col"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              {/* Equipment info card */}
              <div className="mb-4 rounded-3xl bg-green-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-green-500 text-white">
                    <Dumbbell size={22} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[18px] font-extrabold text-black">{result.name}</h3>
                    <p className="mt-1 text-[13px] font-medium leading-relaxed text-[#4b5563]">{result.description}</p>
                  </div>
                </div>
              </div>

              {/* Video cards grid */}
              <div className="flex-1">
                <div className="mb-3 flex items-center gap-2">
                  <Play size={16} className="text-[#00a1d6]" />
                  <h4 className="text-[15px] font-bold text-black">教学视频</h4>
                  <span className="text-[12px] text-[#6b7280]">· 点击在浏览器中播放</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {buildVideoCards(result).map((card, i) => (
                    <ExerciseCard key={card.exercise} {...card} index={i} />
                  ))}
                </div>
              </div>

              {/* Retry button */}
              <button
                onClick={reset}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 text-[14px] font-semibold text-[#6b7280]"
              >
                <Camera size={16} />
                重新拍照识别
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
