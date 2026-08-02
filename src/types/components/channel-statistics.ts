export type ChannelStat = {
  name: string;
  count: number;
  percentage: number;
};

export type ChannelStatisticsProps = {
  channelStats?: ChannelStat[];
};
