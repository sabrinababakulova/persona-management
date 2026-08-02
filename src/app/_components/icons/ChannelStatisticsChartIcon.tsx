import type { IconProps } from "./types";

type ChannelStatisticsChartSegment = {
  name: string;
  segment: number;
  dashOffset: number;
  strokeClassName: string;
};

interface ChannelStatisticsChartIconProps extends IconProps {
  radius: number;
  circumference: number;
  segments: ChannelStatisticsChartSegment[];
}

export function ChannelStatisticsChartIcon({
  className,
  circumference,
  radius,
  segments,
  ...props
}: ChannelStatisticsChartIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 140 138"
      {...props}
    >
      <title>Channel Statistics Chart</title>
      <circle
        className="stroke-bg-input"
        cx="70"
        cy="69"
        fill="none"
        r={radius}
        strokeWidth="18"
      />
      {segments.map((item) => {
        const segmentGap = Math.min(3, item.segment * 0.35);
        const visibleSegment = Math.max(0, item.segment - segmentGap);

        return visibleSegment > 0 ? (
          <circle
            className={item.strokeClassName}
            cx="70"
            cy="69"
            fill="none"
            key={item.name}
            r={radius}
            strokeDasharray={`${visibleSegment} ${circumference - visibleSegment}`}
            strokeDashoffset={-item.dashOffset}
            strokeLinecap="butt"
            strokeWidth="18"
          />
        ) : null;
      })}
    </svg>
  );
}
