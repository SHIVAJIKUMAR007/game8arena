// The friendly family character in the HUD, drawn as SVG so it needs no image file.
export default function Avatar() {
  return (
    <svg className="fs-avatar" viewBox="0 0 64 64" role="img" aria-label="Family Sort character">
      <circle cx="32" cy="32" r="30" fill="#ffe08a" stroke="#e0a010" strokeWidth="3" />
      <path d="M10 60c2-12 12-16 22-16s20 4 22 16c-6 3-14 4-22 4s-16-1-22-4Z" fill="#e8483c" />
      <path d="M24 46l8 8 8-8" fill="#fff" />
      <rect x="27" y="38" width="10" height="9" rx="4" fill="#efb58a" />
      <circle cx="32" cy="29" r="15" fill="#f6c7a0" />
      <path d="M16 30c-3-14 6-22 17-22 12 0 19 9 15 22-2-6-6-10-10-11-7 3-15 3-22 0-1 3-0 7 0 11Z" fill="#7a3b1d" />
      <circle cx="32" cy="8" r="6" fill="#7a3b1d" />
      <ellipse cx="26" cy="30" rx="2" ry="2.6" fill="#3a2418" />
      <ellipse cx="38" cy="30" rx="2" ry="2.6" fill="#3a2418" />
      <circle cx="25.4" cy="29.2" r=".7" fill="#fff" />
      <circle cx="37.4" cy="29.2" r=".7" fill="#fff" />
      <circle cx="22" cy="35" r="3" fill="#ff8f8f" opacity=".55" />
      <circle cx="42" cy="35" r="3" fill="#ff8f8f" opacity=".55" />
      <path d="M27 36c2.5 3 7.5 3 10 0" fill="none" stroke="#a5402c" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
