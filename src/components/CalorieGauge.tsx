interface CalorieGaugeProps {
  current: number;
  target: number;
}

export default function CalorieGauge({ current, target }: CalorieGaugeProps) {
  const ratio = Math.min(current / target, 1);
  const dashLength = ratio * 330;
  const remaining = Math.max(target - current, 0);

  return (
    <div className="flex justify-center py-2 relative">
      <svg viewBox="0 0 280 165" className="w-[250px] h-auto" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF6B35" />
            <stop offset="50%" stopColor="#FF8C42" />
            <stop offset="100%" stopColor="#FFB347" />
          </linearGradient>
        </defs>
        {/* Background track */}
        <path
          d="M 35 140 A 105 105 0 0 1 245 140"
          fill="none"
          stroke="#2a2a3a"
          strokeWidth="20"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d="M 35 140 A 105 105 0 0 1 245 140"
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="20"
          strokeLinecap="round"
          strokeDasharray={`${dashLength} 530`}
        />
        {/* Tick marks */}
        {[
          { lx1: -105, ly1: -8, lx2: -105, ly2: -22 },
          { lx1: -52.5, ly1: -84, lx2: -49, ly2: -97 },
          { lx1: 0, ly1: -106, lx2: 0, ly2: -119 },
          { lx1: 52.5, ly1: -84, lx2: 49, ly2: -97 },
          { lx1: 105, ly1: -8, lx2: 105, ly2: -22 },
        ].map((t, i) => (
          <g key={i} transform="translate(140,140)" textAnchor="middle" fill="#555" fontSize="7">
            <line x1={t.lx1} y1={t.ly1} x2={t.lx2} y2={t.ly2} stroke="#444" strokeWidth="0.8" />
          </g>
        ))}
      </svg>
      {/* Center text overlay */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[52%] text-center pointer-events-none">
        <div className="text-[42px] font-bold text-primary leading-none tracking-[-1.5px]">
          {current.toLocaleString()}
        </div>
        <div className="text-[11px] opacity-35 mt-0.5 font-medium">/ {target.toLocaleString()} 千卡</div>
        {remaining > 0 && (
          <div className="text-xs text-primary-pale mt-1 font-semibold">还可 {remaining.toLocaleString()}</div>
        )}
      </div>
    </div>
  );
}
