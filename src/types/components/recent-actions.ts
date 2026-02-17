export type RecentActivity = {
  id: string;
  name: string;
  action: string;
  candidateName: string;
  candidateInitials: string;
  newStatus: string;
  time: string;
  isRecent?: boolean;
};

export type RecentActionsProps = {
  recentActivities?: RecentActivity[];
};
