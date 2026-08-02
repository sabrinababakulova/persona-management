export type RecentActivity = {
  id: string;
  name: string;
  action: string;
  candidateName: string;
  actorInitials: string;
  newStatus: string;
  time: string;
  isRecent?: boolean;
  isCurrentUser?: boolean;
};

export type RecentActionsProps = {
  recentActivities?: RecentActivity[];
};
