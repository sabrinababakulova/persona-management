export function DonutChart() {
  return (
    <div className="relative h-40 w-40">
      <svg
        aria-hidden="true"
        className="h-full w-full -rotate-90"
        viewBox="0 0 100 100"
      >
        <title>Channel Statistics Chart</title>
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          fill="none"
          r="40"
          stroke="#E5E7EB"
          strokeWidth="20"
        />
        {/* Pink segment - hh.uz */}
        <circle
          cx="50"
          cy="50"
          fill="none"
          r="40"
          stroke="#F472B6"
          strokeDasharray="62.8 188.4"
          strokeDashoffset="0"
          strokeWidth="20"
        />
        {/* Purple segment - telegram */}
        <circle
          cx="50"
          cy="50"
          fill="none"
          r="40"
          stroke="#A78BFA"
          strokeDasharray="62.8 188.4"
          strokeDashoffset="-62.8"
          strokeWidth="20"
        />
        {/* Orange segment - rabota.uz */}
        <circle
          cx="50"
          cy="50"
          fill="none"
          r="40"
          stroke="#FB923C"
          strokeDasharray="62.8 188.4"
          strokeDashoffset="-125.6"
          strokeWidth="20"
        />
      </svg>
    </div>
  );
}
