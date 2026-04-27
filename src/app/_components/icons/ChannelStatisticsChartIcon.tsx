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
      {segments.map((item) => (
        <circle
          className={item.strokeClassName}
          cx="70"
          cy="69"
          fill="none"
          key={item.name}
          r={radius}
          strokeDasharray={`${item.segment} ${circumference - item.segment}`}
          strokeDashoffset={-item.dashOffset}
          strokeLinecap="butt"
          strokeWidth="24"
        />
      ))}
    </svg>
  );
}
