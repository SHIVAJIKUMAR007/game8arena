export default function Stars({ value = 0, max = 3, size = '1.4em' }) {
  return (
    <span className="stars" style={{ fontSize: size }} role="img" aria-label={`${value} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < value ? 'on' : 'off'}>★</span>
      ))}
    </span>
  )
}
