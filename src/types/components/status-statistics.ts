export type StatusStat = {
  label: string;
  value: number;
  max: number;
};

export type StatusStatisticsProps = {
  statusStats?: StatusStat[];
};
