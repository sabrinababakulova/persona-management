export type StatusStat = {
  status: string;
  value: number;
  max: number;
};

export type StatusStatisticsProps = {
  statusStats?: StatusStat[];
};
