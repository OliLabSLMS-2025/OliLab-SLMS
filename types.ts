



export interface Item {
  id: string;
  name: string;
  totalQuantity: number;
  availableQuantity: number;
  category: string;
}

export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  DENIED = 'DENIED',
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
  status: UserStatus;
}

export enum LogAction {
  BORROW = 'BORROW',
  RETURN = 'RETURN',
}

export enum BorrowStatus {
  PENDING = 'PENDING',
  ON_LOAN = 'ON_LOAN',
  DENIED = 'DENIED',
  RETURN_REQUESTED = 'RETURN_REQUESTED',
  RETURNED = 'RETURNED',
}


export interface LogEntry {
  id: string;
  userId: string;
  itemId: string;
  quantity: number;
  timestamp: string;
  action: LogAction;
  status?: BorrowStatus; // For BORROW logs
  relatedLogId?: string; // To link a RETURN action to a BORROW action
  dueDate?: string; // The calculated due date for a borrowed item
}

export interface Notification {
  id: string;
  message: string;
  type: 'new_user_request' | 'return_request' | 'borrow_request';
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

export interface LogComment {
  id: string;
  logId: string; // The ID of the LogEntry it's attached to
  userId: string; // The user (admin) who wrote it
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
  logComments: LogComment[];
}