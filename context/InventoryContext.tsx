
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// FIX: Import State from types.ts where it has been centralized.
import { Item, User, LogEntry, Notification, Suggestion, LogAction, SuggestionStatus, State, Comment } from '../types';
import { IconLoader } from '../components/icons';
import { loadState, saveState, generateId } from '../services/localStore';

// State interface moved to types.ts to be shared across modules.

interface InventoryContextType {
  state: State;
  isLoading: boolean;
  addItem: (itemData: Omit<Item, 'id' | 'availableQuantity'>) => Promise<void>;
  editItem: (itemData: Item) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  borrowItem: (payload: { userId: string; itemId: string; quantity: number }) => Promise<void>;
  returnItem: (log: LogEntry) => Promise<void>;
  requestItemReturn: (payload: { log: LogEntry; item: Item; user: User }) => Promise<void>;
  createUser: (userData: Omit<User, 'id'>) => Promise<string>;
  editUser: (userData: User) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  markNotificationsAsRead: (notificationIds: string[]) => Promise<void>;
  addSuggestion: (suggestionData: Omit<Suggestion, 'id' | 'status' | 'timestamp'>) => Promise<void>;
  approveSuggestion: (payload: { suggestion: Suggestion; totalQuantity: number }) => Promise<void>;
  denySuggestion: (suggestionId: string) => Promise<void>;
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
    };
    setState(prevState => ({ ...prevState, users: [...prevState.users, newUser]}));
    // Create a notification for admins
    const newNotification: Notification = {
        id: generateId('notif'),
        message: `New user signed up: ${newUser.fullName}`,
        type: 'new_user',
        read: false,
        timestamp: new Date().toISOString(),
    };
     setState(prevState => ({ ...prevState, notifications: [newNotification, ...prevState.notifications] }));
     return newUserId;
  };

  const editUser: InventoryContextType['editUser'] = async (userData) => {
    setState(prevState => ({ ...prevState, users: prevState.users.map(user => user.id === userData.id ? userData : user)}));
  };

  const deleteUser: InventoryContextType['deleteUser'] = async (userId) => {
      setState(prevState => ({ ...prevState, users: prevState.users.filter(user => user.id !== userId)}));
  };

  const borrowItem: InventoryContextType['borrowItem'] = async ({ userId, itemId, quantity }) => {
    setState(prevState => {
        const item = prevState.items.find(i => i.id === itemId);
        if (!item || item.availableQuantity < quantity) {
            throw new Error('Not enough items in stock.');
        }
        const newItems = prevState.items.map(i => i.id === itemId ? { ...i, availableQuantity: i.availableQuantity - quantity } : i);
        const newLog: LogEntry = {
            id: generateId('log'),
            userId,
            itemId,
            quantity,
            timestamp: new Date().toISOString(),
            action: LogAction.BORROW,
        };
        return { ...prevState, items: newItems, logs: [newLog, ...prevState.logs] };
    });
  };

  const returnItem: InventoryContextType['returnItem'] = async (borrowLog) => {
    setState(prevState => {
        const newLogs = [...prevState.logs];
        const item = prevState.items.find(i => i.id === borrowLog.itemId);

        // Find and update the original borrow log entry to mark it as returned implicitly
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

  const denySuggestion: InventoryContextType['denySuggestion'] = async (suggestionId) => {
    setState(prevState => ({
        ...prevState,
        suggestions: prevState.suggestions.map(s => s.id === suggestionId ? { ...s, status: SuggestionStatus.DENIED } : s),
    }));
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
      borrowItem,
      returnItem,
      requestItemReturn,
      createUser,
      editUser,
      deleteUser,
      markNotificationsAsRead,
      addSuggestion,
      approveSuggestion,
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
