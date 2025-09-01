
export interface Item {
  id: string;
  name: string;
  totalQuantity: number;
  availableQuantity: number;
  category: string;
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  password?: string; // For local authentication
  lrn: string; // Learners Reference Number - can be empty for admins
  gradeLevel: 'Grade 11' | 'Grade 12' | null;
  section: string | null;
  role: 'Member' | 'Admin';
  isAdmin: boolean;
}

export enum LogAction {
  BORROW = 'BORROW',
  RETURN = 'RETURN',
}

export interface LogEntry {
  id: string;
  userId: string;
  itemId: string;
  quantity: number;
  timestamp: string;
  action: LogAction;
  relatedLogId?: string; // To link a RETURN action to a BORROW action
  returnRequested?: boolean;
}

export interface Notification {
  id: string;
  message: string;
  type: 'new_user' | 'return_request';
  read: boolean;
  timestamp: string;
  relatedLogId?: string;
}

export enum SuggestionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
}

export interface Suggestion {
  id: string;
  userId: string;
  itemName: string;
  category: string;
  reason: string;
  status: SuggestionStatus;
  timestamp: string;
}

export interface Comment {
  id: string;
  userId: string;
  suggestionId: string;
  text: string;
  timestamp: string;
}

// FIX: Moved State interface here to be shared across modules and avoid circular dependencies.
export interface State {
  items: Item[];
  users: User[];
  logs: LogEntry[];
  notifications: Notification[];
  suggestions: Suggestion[];
  comments: Comment[];
}
