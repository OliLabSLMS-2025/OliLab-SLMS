

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// FIX: Import State from types.ts where it has been centralized.
import { Item, User, LogEntry, Notification, Suggestion, LogAction, SuggestionStatus, State, Comment, LogStatus, UserStatus, SuggestionType } from '../types';
import { IconLoader } from '../components/icons';
import { loadState, saveState, generateId } from '../services/localStore';
import { sendNewUserAdminNotification, sendAccountApprovedNotification, sendAccountDeniedNotification } from '../services/emailService';

// State interface moved to types.ts to be shared across modules.

interface InventoryContextType {
  state: State;
  isLoading: boolean;
  addItem: (itemData: Omit<Item, 'id' | 'availableQuantity'>) => Promise<void>;
  editItem: (itemData: Item) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  requestBorrowItem: (payload: { userId: string; itemId: string; quantity: number }) => Promise<void>;
  approveBorrowRequest: (logId: string) => Promise<void>;
  denyBorrowRequest: (payload: { logId: string; reason: string }) => Promise<void>;
  returnItem: (payload: { borrowLog: LogEntry; adminNotes: string }) => Promise<void>;
  requestItemReturn: (payload: { log: LogEntry; item: Item; user: User }) => Promise<void>;
  createUser: (userData: Omit<User, 'id' | 'status'>) => Promise<string>;
  editUser: (userData: User) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  approveUser: (userId: string) => Promise<void>;
  denyUser: (userId: string) => Promise<void>;
  markNotificationsAsRead: (notificationIds: string[]) => Promise<void>;
  addSuggestion: (suggestionData: Omit<Suggestion, 'id' | 'status' | 'timestamp' | 'category'>) => Promise<void>;
  approveItemSuggestion: (payload: { suggestionId: string; category: string; totalQuantity: number }) => Promise<void>;
  approveFeatureSuggestion: (suggestionId: string) => Promise<void>;
  denySuggestion: (payload: { suggestionId: string; reason: string; adminId: string }) => Promise<void>;
  importItems: (items: Omit<Item, 'id' | 'availableQuantity'>[]) => Promise<void>;
  addComment: (payload: { suggestionId: string; userId: string; text: string }) => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<State>(loadState());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Persist state to local storage whenever it changes.
    saveState(state);
  }, [state]);

  useEffect(() => {
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
    setState(prevState => {
      // Create a notification for admins
      const newNotification: Notification = {
          id: generateId('notif'),
          message: `New user registration pending approval: ${newUser.fullName}`,
          type: 'new_user',
          read: false,
          timestamp: new Date().toISOString(),
      };
      // Send email to admins
      const admins = prevState.users.filter(u => u.isAdmin);
      sendNewUserAdminNotification(newUser, admins);

      return { ...prevState, users: [...prevState.users, newUser], notifications: [newNotification, ...prevState.notifications] };
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
        let approvedUser: User | undefined;
        const newUsers = prevState.users.map(user => {
            if (user.id === userId) {
                approvedUser = { ...user, status: UserStatus.APPROVED };
                return approvedUser;
            }
            return user;
        });

        if (approvedUser) {
            sendAccountApprovedNotification(approvedUser);
            // Optional: create an in-app notification for the user
            const newNotification: Notification = {
                id: generateId('notif'),
                message: 'Welcome! Your account has been approved by an administrator.',
                type: 'account_approved',
                read: false,
                timestamp: new Date().toISOString(),
            };
            // This is tricky as we don't have a user-specific notification system yet.
            // For now, email is the primary notification channel.
        }
        
        return { ...prevState, users: newUsers };
    });
  };

  const denyUser: InventoryContextType['denyUser'] = async (userId) => {
    setState(prevState => {
        let deniedUser: User | undefined;
        const newUsers = prevState.users.map(user => {
            if (user.id === userId) {
                deniedUser = { ...user, status: UserStatus.DENIED };
                return deniedUser;
            }
            return user;
        });

        if (deniedUser) {
            sendAccountDeniedNotification(deniedUser);
        }
        
        return { ...prevState, users: newUsers };
    });
  };

  const requestBorrowItem: InventoryContextType['requestBorrowItem'] = async ({ userId, itemId, quantity }) => {
    setState(prevState => {
        const item = prevState.items.find(i => i.id === itemId);
        const user = prevState.users.find(u => u.id === userId);
        if (!item || !user || item.availableQuantity < quantity) {
            throw new Error('Not enough items in stock or invalid user/item.');
        }

        const newLog: LogEntry = {
            id: generateId('log'),
            userId,
            itemId,
            quantity,
            timestamp: new Date().toISOString(),
            action: LogAction.BORROW,
            status: LogStatus.PENDING,
        };

        const newNotification: Notification = {
            id: generateId('notif'),
            message: `New borrow request from ${user.fullName} for ${quantity}x ${item.name}.`,
            type: 'new_borrow_request',
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
        if (!log || log.status !== LogStatus.PENDING) {
            throw new Error('Log entry not found or not in pending state.');
        }
        const item = prevState.items.find(i => i.id === log.itemId);
        if (!item || item.availableQuantity < log.quantity) {
            throw new Error('Not enough items in stock to approve this request.');
        }

        const newItems = prevState.items.map(i => 
            i.id === log.itemId ? { ...i, availableQuantity: i.availableQuantity - log.quantity } : i
        );
        const newLogs = prevState.logs.map(l =>
            l.id === logId ? { ...l, status: LogStatus.APPROVED } : l
        );
        
        // TODO: Could add a notification for the user here in future
        
        return { ...prevState, items: newItems, logs: newLogs };
    });
  };

  const denyBorrowRequest: InventoryContextType['denyBorrowRequest'] = async ({ logId, reason }) => {
    setState(prevState => {
        const log = prevState.logs.find(l => l.id === logId);
        if (!log || log.status !== LogStatus.PENDING) {
            throw new Error('Log entry not found or not in pending state.');
        }
        const newLogs = prevState.logs.map(l =>
            l.id === logId ? { ...l, status: LogStatus.DENIED, adminNotes: reason } : l
        );

        // TODO: Could add a notification for the user here in future

        return { ...prevState, logs: newLogs };
    });
  };

  const returnItem: InventoryContextType['returnItem'] = async ({ borrowLog, adminNotes }) => {
    setState(prevState => {
        // Update original borrow log status to RETURNED
        let updatedLogs = prevState.logs.map(l => l.id === borrowLog.id ? { ...l, status: LogStatus.RETURNED } : l);

        // Create a new RETURN log entry
        const returnLog: LogEntry = {
            id: generateId('log'),
            userId: borrowLog.userId,
            itemId: borrowLog.itemId,
            quantity: borrowLog.quantity,
            timestamp: new Date().toISOString(),
            action: LogAction.RETURN,
            relatedLogId: borrowLog.id,
            adminNotes,
        };
        updatedLogs.unshift(returnLog);

        const newItems = prevState.items.map(i => {
            if (i.id === borrowLog.itemId) {
                const newAvailable = Math.min(i.totalQuantity, i.availableQuantity + borrowLog.quantity);
                return { ...i, availableQuantity: newAvailable };
            }
            return i;
        });

        return { ...prevState, items: newItems, logs: updatedLogs };
    });
  };

  const requestItemReturn: InventoryContextType['requestItemReturn'] = async ({ log, item, user }) => {
      setState(prevState => {
          const newLogs = prevState.logs.map(l => l.id === log.id ? { ...l, returnRequested: true } : l);
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

  const approveItemSuggestion: InventoryContextType['approveItemSuggestion'] = async ({ suggestionId, category, totalQuantity }) => {
    setState(prevState => {
        const suggestion = prevState.suggestions.find(s => s.id === suggestionId);
        if (!suggestion || suggestion.type !== SuggestionType.ITEM) {
            throw new Error("Suggestion not found or is not an item suggestion.");
        }

        const newSuggestions = prevState.suggestions.map(s => 
            s.id === suggestionId 
                ? { ...s, status: SuggestionStatus.APPROVED, category } 
                : s
        );

        const newItem: Item = {
            id: generateId('item'),
            name: suggestion.title,
            category: category,
            totalQuantity: totalQuantity,
            availableQuantity: totalQuantity,
        };
        
        return { ...prevState, suggestions: newSuggestions, items: [...prevState.items, newItem] };
    });
  };

  const approveFeatureSuggestion: InventoryContextType['approveFeatureSuggestion'] = async (suggestionId) => {
    setState(prevState => ({
        ...prevState,
        suggestions: prevState.suggestions.map(s => 
            s.id === suggestionId ? { ...s, status: SuggestionStatus.APPROVED } : s
        ),
    }));
  };

  const denySuggestion: InventoryContextType['denySuggestion'] = async ({ suggestionId, reason, adminId }) => {
    setState(prevState => {
        const newSuggestions = prevState.suggestions.map(s => s.id === suggestionId ? { ...s, status: SuggestionStatus.DENIED } : s);
        const newComment: Comment = {
            id: generateId('comment'),
            suggestionId,
            userId: adminId,
            text: reason,
            timestamp: new Date().toISOString(),
        };
        return { ...prevState, suggestions: newSuggestions, comments: [newComment, ...prevState.comments] };
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

  const contextValue: InventoryContextType = {
      state,
      isLoading,
      addItem,
      editItem,
      deleteItem,
      requestBorrowItem,
      approveBorrowRequest,
      denyBorrowRequest,
      returnItem,
      requestItemReturn,
      createUser,
      editUser,
      deleteUser,
      approveUser,
      denyUser,
      markNotificationsAsRead,
      addSuggestion,
      approveItemSuggestion,
      approveFeatureSuggestion,
      denySuggestion,
      importItems,
      addComment,
  };

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-screen bg-slate-900">
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
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};