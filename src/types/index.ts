export type UserRole = 'community_member' | 'facility_manager' | 'worker' | 'admin';
export type IssueStatus = 'pending' | 'in_progress' | 'resolved';
export type IssueCategory = 'maintenance' | 'infrastructure' | 'sustainability' | 'cleanliness' | 'other';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  location: string;
  status: IssueStatus;
  image_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator?: Profile;
  assignment?: Assignment;
  status_history?: StatusHistory[];
}

export interface Assignment {
  id: string;
  issue_id: string;
  worker_id: string;
  assigned_by: string;
  assigned_at: string;
  worker?: Profile;
}

export interface Comment {
  id: string;
  issue_id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  author?: Profile;
}

export interface StatusHistory {
  id: string;
  issue_id: string;
  old_status: IssueStatus | null;
  new_status: IssueStatus;
  changed_by: string;
  note: string | null;
  changed_at: string;
  changer?: Profile;
}
