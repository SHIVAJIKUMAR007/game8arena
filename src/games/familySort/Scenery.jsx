import { memo } from 'react'

// The painted backdrop: sky, clouds, blurred trees and bushes, grass and flowers. Drawn once as SVG so it scales to
// any screen. Each theme is only a palette.
const THEMES = {
  garden: {
    sky: ['#58b8f5', '#a9defa'], cloud: '#ffffff', cloudOpacity: 0.95,
    far: ['#3f9a46', '#52ad4f'], near: ['#2f8a3a', '#6cc04a'], grass: ['#7bd14a', '#3c9a2e'], sun: '#fff7b0', dim: 0,
  },
  sunset: {
    sky: ['#ff9a5a', '#ffd9a0'], cloud: '#ffe3d0', cloudOpacity: 0.9,
    far: ['#8b7a3a', '#a68c3e'], near: ['#6e8a2f', '#98b43c'], grass: ['#b6c64a', '#6f8f2a'], sun: '#fff0a0', dim: 0.04,
  },
  night: {
    sky: ['#101a4a', '#33458f'], cloud: '#aab6e6', cloudOpacity: 0.5,
    far: ['#14402f', '#1d5a3f'], near: ['#17503a', '#2a7a52'], grass: ['#2c7a4a', '#14502f'], sun: '#e8efff', dim: 0.12,
  },
}

const FLOWERS = [
  [40, 330, '#b86be0', 11], [92, 352, '#e04f8f', 9], [150, 318, '#ffd23a', 8], [250, 372, '#ffffff', 8],
  [330, 336, '#ff7a59', 10], [470, 350, '#b86be0', 9], [560, 322, '#ffffff', 8], [640, 360, '#e04f8f', 11],
  [720, 332, '#ffd23a', 9], [770, 366, '#b86be0', 10], [20, 395, '#ffffff', 8], [380, 388, '#ffd23a', 8],
]

function Flower({ x, y, c, r }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-1} y={0} width={2} height={r * 2.4} fill="#2f8a3a" />
      {[0, 72, 144, 216, 288].map(a => (
        <circle key={a} cx={Math.cos((a * Math.PI) / 180) * r * 0.75} cy={Math.sin((a * Math.PI) / 180) * r * 0.75} r={r * 0.55} fill={c} />
      ))}
      <circle r={r * 0.4} fill="#ffb300" />
    </g>
  )
}

function Scenery({ theme = 'garden' }) {
  const t = THEMES[theme] || THEMES.garden
  return (
    <svg className="fs-scenery" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="fs-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={t.sky[0]} /><stop offset="1" stopColor={t.sky[1]} /></linearGradient>
        <linearGradient id="fs-grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={t.grass[0]} /><stop offset="1" stopColor={t.grass[1]} /></linearGradient>
        <radialGradient id="fs-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor={t.sun} stopOpacity=".95" /><stop offset="1" stopColor={t.sun} stopOpacity="0" /></radialGradient>
        <filter id="fs-blur-l" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9" /></filter>
        <filter id="fs-blur-m" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="fs-blur-s"><feGaussianBlur stdDeviation="2" /></filter>
      </defs>
      <rect width="800" height="500" fill="url(#fs-sky)" />
      <circle cx="610" cy="70" r="120" fill="url(#fs-sun)" />
      {theme === 'night' && [[80, 40], [190, 90], [330, 30], [450, 70], [700, 150], [760, 40], [540, 120]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 2 ? 1.5 : 2.2} fill="#fff" opacity=".85" />
      ))}
      <g fill={t.cloud} opacity={t.cloudOpacity} filter="url(#fs-blur-s)">
        <g transform="translate(70 70)"><ellipse rx="64" ry="22" /><ellipse cx="-26" cy="-14" rx="30" ry="22" /><ellipse cx="22" cy="-20" rx="34" ry="26" /></g>
        <g transform="translate(560 54)"><ellipse rx="72" ry="24" /><ellipse cx="-24" cy="-16" rx="32" ry="24" /><ellipse cx="26" cy="-22" rx="38" ry="28" /></g>
        <g transform="translate(330 120) scale(.7)"><ellipse rx="60" ry="20" /><ellipse cx="-20" cy="-14" rx="28" ry="20" /><ellipse cx="20" cy="-18" rx="32" ry="24" /></g>
      </g>
      <g filter="url(#fs-blur-l)">
        {[[40, 190, 120], [190, 170, 130], [350, 190, 110], [520, 165, 135], [680, 185, 125], [790, 175, 100]].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill={t.far[i % 2]} />
        ))}
      </g>
      <g filter="url(#fs-blur-m)">
        {[[20, 300, 70], [120, 320, 60], [270, 305, 55], [430, 315, 62], [590, 300, 58], [720, 312, 72], [800, 300, 60]].map(([x, y, r], i) => (
          <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.72} fill={t.near[i % 2]} />
        ))}
      </g>
      <path d="M0 300 Q200 270 400 292 T800 284 V500 H0 Z" fill="url(#fs-grass)" />
      <g opacity=".95">{FLOWERS.map(([x, y, c, r], i) => <Flower key={i} x={x} y={y} c={c} r={r} />)}</g>
      {theme === 'garden' && (
        <g transform="translate(100 215)">
          <rect x="-2.5" y="14" width="5" height="70" fill="#3d8f35" />
          {Array.from({ length: 12 }, (_, i) => (
            <ellipse key={i} cx="0" cy="-17" rx="6" ry="14" fill="#ffc21a" transform={`rotate(${i * 30})`} />
          ))}
          <circle r="14" fill="#8a4b1a" />
        </g>
      )}
      {t.dim > 0 && <rect width="800" height="500" fill="#000a2a" opacity={t.dim} />}
    </svg>
  )
}

export default memo(Scenery)
