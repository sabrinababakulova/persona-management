export type ChannelStat = {
  name: string;
  percentage: number;
};

export type ChannelStatisticsProps = {
  channelStats?: ChannelStat[];
};
