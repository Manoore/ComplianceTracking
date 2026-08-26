interface Props {
  size?: number
  className?: string
}

export function CompliNowMark({ size = 40, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="CompliNow"
    >
      <rect width="100" height="100" rx="22" fill="#1B3260"/>
      <path d="M 70 70 A 28 28 0 1 1 70 30"
            stroke="#00C4A0" strokeWidth="6.5"
            strokeLinecap="round" fill="none"/>
      <path d="M 28 50 L 43 64 L 70 34"
            stroke="#00C4A0" strokeWidth="6.5"
            strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}
