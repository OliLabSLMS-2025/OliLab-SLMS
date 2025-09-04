import * as React from 'react';
// FIX: Import State from types.ts where it has been centralized.
import { Item, User, LogEntry, Notification, Suggestion, LogAction, SuggestionStatus, State, Comment, BorrowStatus, LogComment, UserStatus } from '../types';
import { IconLoader } from '../components/icons';
import { loadState, saveState, generateId } from '../services/localStore';
import { sendAccountStatusNotification, sendNewUserAdminNotification } from '../services/emailService';
import { useSettings } from './SettingsContext';
import { showSystemNotification } from '../services/notificationService';

// State interface moved to types.ts to be shared across modules.

interface InventoryContextType {
  state: State;
  isLoading: boolean;
  addItem: (itemData: Omit<Item, 'id' | 'availableQuantity'>) => Promise<void>;
  editItem: (itemData: Item) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  requestBorrowItem: (payload: { userId: string; itemId: string; quantity: number }) => Promise<void>;
  approveBorrowRequest: (logId: string) => Promise<void>;
  denyBorrowRequest: (logId: string) => Promise<void>;
  approveReturnRequest: (log: LogEntry) => Promise<void>;
  requestItemReturn: (payload: { log: LogEntry; item: Item; user: User }) => Promise<void>;
  createUser: (userData: Omit<User, 'id' | 'status'>) => Promise<string>;
  editUser: (userData: User) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  approveUser: (userId: string) => Promise<void>;
  denyUser: (userId: string) => Promise<void>;
  markNotificationsAsRead: (notificationIds: string[]) => Promise<void>;
  addSuggestion: (suggestionData: Omit<Suggestion, 'id' | 'status' | 'timestamp'>) => Promise<void>;
  approveSuggestion: (payload: { suggestion: Suggestion; totalQuantity: number }) => Promise<void>;
  denySuggestion: (payload: { suggestionId: string; reason: string; adminId: string }) => Promise<void>;
  importItems: (items: Omit<Item, 'id' | 'availableQuantity'>[]) => Promise<void>;
  addComment: (payload: { suggestionId: string; userId: string; text: string }) => Promise<void>;
  addLogComment: (payload: { logId: string; userId: string; text: string }) => Promise<void>;
}

const InventoryContext = React.createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = React.useState<State>(loadState());
  const [isLoading, setIsLoading] = React.useState(true);
  const { settings } = useSettings();

  React.useEffect(() => {
    // Persist state to local storage whenever it changes.
    saveState(state);
  }, [state]);

  React.useEffect(() => {
    // Simulate initial loading
    setTimeout(() => setIsLoading(false), 500);
  }, []);
  
  // --- CRUD Operations ---

  const addItem: InventoryContextType['addItem'] = async (itemData) => {
    const newItem: Item = {
      ...itemData,
      id: generateId('item'),
      availableQuantity: itemData.totalQuantity,
    };
    setState(prevState => ({ ...prevState, items: [...prevState.items, newItem] }));
  };

  const editItem: InventoryContextType['editItem'] = async (itemData) => {
    setState(prevState => {
        const itemToUpdate = prevState.items.find(i => i.id === itemData.id);
        if (!itemToUpdate) throw new Error("Item to edit does not exist.");

        const borrowedCount = itemToUpdate.totalQuantity - itemToUpdate.availableQuantity;
        if (itemData.totalQuantity < borrowedCount) {
             throw new Error("Total quantity cannot be less than the number of items currently borrowed.");
        }
        const newAvailableQuantity = itemData.totalQuantity - borrowedCount;

        return {
            ...prevState,
            items: prevState.items.map(item => item.id === itemData.id ? {...itemData, availableQuantity: newAvailableQuantity } : item),
        };
    });
  };

  const deleteItem: InventoryContextType['deleteItem'] = async (itemId) => {
      setState(prevState => ({ ...prevState, items: prevState.items.filter(item => item.id !== itemId)}));
  };
  
  const createUser: InventoryContextType['createUser'] = async (userData) => {
    const newUserId = generateId('user');
    const newUser: User = {
        ...userData,
        id: newUserId,
        status: UserStatus.PENDING,
    };
    setState(prevState => ({ ...prevState, users: [...prevState.users, newUser]}));
    // Create a notification for admins
    const newNotification: Notification = {
        id: generateId('notif'),
        message: `New user requires approval: ${newUser.fullName}`,
        type: 'new_user_request',
        read: false,
        timestamp: new Date().toISOString(),
    };
     setState(prevState => {
        const admins = prevState.users.filter(u => u.isAdmin && u.status === UserStatus.ACTIVE);
        sendNewUserAdminNotification(newUser, admins);
        showSystemNotification(settings.notifications.enabled, 'New User Request', { body: `User ${newUser.fullName} is awaiting approval.` });
        return { ...prevState, notifications: [newNotification, ...prevState.notifications] };
     });
     return newUserId;
  };

  const editUser: InventoryContextType['editUser'] = async (userData) => {
    setState(prevState => ({ ...prevState, users: prevState.users.map(user => user.id === userData.id ? userData : user)}));
  };

  const deleteUser: InventoryContextType['deleteUser'] = async (userId) => {
      setState(prevState => ({ ...prevState, users: prevState.users.filter(user => user.id !== userId)}));
  };

  const approveUser: InventoryContextType['approveUser'] = async (userId) => {
      setState(prevState => {
          const userToUpdate = prevState.users.find(u => u.id === userId);
          if (userToUpdate) {
              const updatedUser = { ...userToUpdate, status: UserStatus.ACTIVE };
              sendAccountStatusNotification(updatedUser);
              return {
                  ...prevState,
                  users: prevState.users.map(user => user.id === userId ? updatedUser : user),
              };
          }
          return prevState;
      });
  };
  
  const denyUser: InventoryContextType['denyUser'] = async (userId) => {
      setState(prevState => {
          const userToUpdate = prevState.users.find(u => u.id === userId);
          if (userToUpdate) {
              const updatedUser = { ...userToUpdate, status: UserStatus.DENIED };
              sendAccountStatusNotification(updatedUser);
              return {
                  ...prevState,
                  users: prevState.users.map(user => user.id === userId ? updatedUser : user),
              };
          }
          return prevState;
      });
  };

  const requestBorrowItem: InventoryContextType['requestBorrowItem'] = async ({ userId, itemId, quantity }) => {
    setState(prevState => {
        const item = prevState.items.find(i => i.id === itemId);
        if (!item || item.availableQuantity < quantity) {
            throw new Error('Not enough items in stock.');
        }
        const newLog: LogEntry = {
            id: generateId('log'),
            userId,
            itemId,
            quantity,
            timestamp: new Date().toISOString(),
            action: LogAction.BORROW,
            status: BorrowStatus.PENDING,
        };
        const user = prevState.users.find(u => u.id === userId);
        const newNotification: Notification = {
            id: generateId('notif'),
            message: `${user?.fullName} requested to borrow ${quantity}x ${item.name}.`,
            type: 'borrow_request',
            read: false,
            timestamp: new Date().toISOString(),
            relatedLogId: newLog.id,
        };
        return { ...prevState, logs: [newLog, ...prevState.logs], notifications: [newNotification, ...prevState.notifications] };
    });
  };

  const approveBorrowRequest: InventoryContextType['approveBorrowRequest'] = async (logId) => {
    setState(prevState => {
        const log = prevState.logs.find(l => l.id === logId);
        if (!log || log.status !== BorrowStatus.PENDING) throw new Error("Log not found or not in pending state.");

        const item = prevState.items.find(i => i.id === log.itemId);
        if (!item || item.availableQuantity < log.quantity) throw new Error("Not enough items in stock to approve.");

        const approvalDate = new Date();
        const dueDate = new Date(approvalDate);
        dueDate.setDate(approvalDate.getDate() + (settings.loanPeriodDays || 7));

        const newLogs = prevState.logs.map(l => 
            l.id === logId 
            ? { ...l, status: BorrowStatus.ON_LOAN, timestamp: approvalDate.toISOString(), dueDate: dueDate.toISOString() } 
            : l
        );
        const newItems = prevState.items.map(i => i.id === log.itemId ? { ...i, availableQuantity: i.availableQuantity - log.quantity } : i);

        return { ...prevState, logs: newLogs, items: newItems };
    });
  };

  const denyBorrowRequest: InventoryContextType['denyBorrowRequest'] = async (logId) => {
    setState(prevState => {
        const newLogs = prevState.logs.map(l => l.id === logId ? { ...l, status: BorrowStatus.DENIED } : l);
        return { ...prevState, logs: newLogs };
    });
  };

  const approveReturnRequest: InventoryContextType['approveReturnRequest'] = async (borrowLog) => {
    setState(prevState => {
        const newLogs = prevState.logs.map(l => l.id === borrowLog.id ? { ...l, status: BorrowStatus.RETURNED } : l);

        const returnLog: LogEntry = {
            id: generateId('log'),
            userId: borrowLog.userId,
            itemId: borrowLog.itemId,
            quantity: borrowLog.quantity,
            timestamp: new Date().toISOString(),
            action: LogAction.RETURN,
            relatedLogId: borrowLog.id,
        };
        newLogs.unshift(returnLog);

        const newItems = prevState.items.map(i => {
            if (i.id === borrowLog.itemId) {
                const newAvailable = Math.min(i.totalQuantity, i.availableQuantity + borrowLog.quantity);
                return { ...i, availableQuantity: newAvailable };
            }
            return i;
        });

        return { ...prevState, items: newItems, logs: newLogs };
    });
  };

  const requestItemReturn: InventoryContextType['requestItemReturn'] = async ({ log, item, user }) => {
      setState(prevState => {
          const newLogs = prevState.logs.map(l => l.id === log.id ? { ...l, status: BorrowStatus.RETURN_REQUESTED } : l);
          const newNotification: Notification = {
              id: generateId('notif'),
              message: `${user.fullName} requested to return ${log.quantity}x ${item.name}.`,
              type: 'return_request',
              read: false,
              timestamp: new Date().toISOString(),
              relatedLogId: log.id,
          };
          return { ...prevState, logs: newLogs, notifications: [newNotification, ...prevState.notifications] };
      });
  };
  
  const markNotificationsAsRead: InventoryContextType['markNotificationsAsRead'] = async (notificationIds) => {
    setState(prevState => ({
        ...prevState,
        notifications: prevState.notifications.map(n => notificationIds.includes(n.id) ? { ...n, read: true } : n),
    }));
  };

  const addSuggestion: InventoryContextType['addSuggestion'] = async (suggestionData) => {
    const newSuggestion: Suggestion = {
      ...suggestionData,
      id: generateId('sug'),
      status: SuggestionStatus.PENDING,
      timestamp: new Date().toISOString(),
    };
    setState(prevState => ({ ...prevState, suggestions: [newSuggestion, ...prevState.suggestions] }));
  };

  const approveSuggestion: InventoryContextType['approveSuggestion'] = async ({ suggestion, totalQuantity }) => {
    setState(prevState => {
        const newSuggestions = prevState.suggestions.map(s => s.id === suggestion.id ? { ...s, status: SuggestionStatus.APPROVED } : s);
        const newItem: Item = {
            id: generateId('item'),
            name: suggestion.itemName,
            category: suggestion.category,
            totalQuantity,
            availableQuantity: totalQuantity,
        };
        return { ...prevState, suggestions: newSuggestions, items: [...prevState.items, newItem] };
    });
  };

  const denySuggestion: InventoryContextType['denySuggestion'] = async ({ suggestionId, reason, adminId }) => {
    setState(prevState => {
        const newSuggestions = prevState.suggestions.map(s => s.id === suggestionId ? { ...s, status: SuggestionStatus.DENIED } : s);
        
        const denialComment: Comment = {
            id: generateId('comment'),
            suggestionId,
            userId: adminId,
            text: `Denial Reason: ${reason}`,
            timestamp: new Date().toISOString(),
        };

        return { 
            ...prevState, 
            suggestions: newSuggestions, 
            comments: [denialComment, ...prevState.comments] 
        };
    });
  };
  
   const importItems: InventoryContextType['importItems'] = async (itemsToImport) => {
      const newItems: Item[] = itemsToImport.map(item => ({
          ...item,
          id: generateId('item'),
          availableQuantity: item.totalQuantity,
      }));
      setState(prevState => ({...prevState, items: [...prevState.items, ...newItems] }));
   };

  const addComment: InventoryContextType['addComment'] = async ({ suggestionId, userId, text }) => {
    const newComment: Comment = {
      id: generateId('comment'),
      suggestionId,
      userId,
      text,
      timestamp: new Date().toISOString(),
    };
    setState(prevState => ({ ...prevState, comments: [newComment, ...prevState.comments] }));
  };

  const addLogComment: InventoryContextType['addLogComment'] = async ({ logId, userId, text }) => {
    const newLogComment: LogComment = {
      id: generateId('logcomment'),
      logId,
      userId,
      text,
      timestamp: new Date().toISOString(),
    };
    setState(prevState => ({ ...prevState, logComments: [newLogComment, ...prevState.logComments] }));
  };


  const contextValue: InventoryContextType = {
      state,
      isLoading,
      addItem,
      editItem,
      deleteItem,
      requestBorrowItem,
      approveBorrowRequest,
      denyBorrowRequest,
      approveReturnRequest,
      requestItemReturn,
      createUser,
      editUser,
      deleteUser,
      approveUser,
      denyUser,
      markNotificationsAsRead,
      addSuggestion,
      approveSuggestion,
      denySuggestion,
      importItems,
      addComment,
      addLogComment,
  };

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900">
            <IconLoader className="h-10 w-10 text-emerald-500" />
        </div>
    );
  }

  return (
    <InventoryContext.Provider value={contextValue}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = React.useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};