import * as React from 'react';
import { User, UserStatus } from '../types';
import { useInventory } from './InventoryContext';

export type SecureUser = User;

interface AuthContextType {
  currentUser: SecureUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'oliLabLoggedInUserId';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = React.useState<SecureUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const { state: inventoryState } = useInventory();

  React.useEffect(() => {
    try {
        const loggedInUserId = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (loggedInUserId) {
            const user = inventoryState.users.find(u => u.id === loggedInUserId);
            if (user && user.status === UserStatus.ACTIVE) {
                setCurrentUser(user);
            } else {
                // User ID not found or user is not active, clear session
                sessionStorage.removeItem(SESSION_STORAGE_KEY);
            }
        }
    } catch (error) {
        console.error("Failed to check session storage:", error);
    } finally {
        setIsLoading(false);
    }
  }, [inventoryState.users]);

  const login = async (identifier: string, password: string): Promise<{ success: boolean; message: string }> => {
    const identifierLower = identifier.toLowerCase().trim();
    const user = inventoryState.users.find(u => 
        u.email.toLowerCase() === identifierLower ||
        u.username.toLowerCase() === identifierLower ||
        (u.lrn && u.lrn === identifier.trim())
    );

    if (!user || user.password !== password) {
      return { success: false, message: 'Invalid credentials. Please check your details and password.' };
    }

    if (user.status === UserStatus.PENDING) {
        return { success: false, message: 'Your account is still pending approval by an administrator.' };
    }
    
    if (user.status === UserStatus.DENIED) {
        return { success: false, message: 'Your account application has been denied. Please contact an administrator.' };
    }
    
    if (user.status === UserStatus.ACTIVE) {
      setCurrentUser(user);
      sessionStorage.setItem(SESSION_STORAGE_KEY, user.id);
      return { success: true, message: 'Login successful' };
    }

    return { success: false, message: 'An unexpected error occurred. Invalid account status.' };
  };

  const logout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  };
  
  const value = {
      currentUser,
      isAuthenticated: !!currentUser,
      isLoading,
      login,
      logout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};