import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, UserStatus } from '../types';
import { useInventory } from './InventoryContext';

export type SecureUser = User;

interface AuthContextType {
  currentUser: SecureUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'oliLabLoggedInUserId';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<SecureUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { state: inventoryState } = useInventory();

  useEffect(() => {
    try {
        const loggedInUserId = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (loggedInUserId) {
            const user = inventoryState.users.find(u => u.id === loggedInUserId);
            if (user && user.status === UserStatus.APPROVED) {
                setCurrentUser(user);
            } else {
                // User ID in session not found or user is not approved, clear session
                sessionStorage.removeItem(SESSION_STORAGE_KEY);
            }
        }
    } catch (error) {
        console.error("Failed to check session storage:", error);
    } finally {
        setIsLoading(false);
    }
  }, [inventoryState.users]);

  const login = async (identifier: string, password: string): Promise<boolean> => {
    const identifierLower = identifier.toLowerCase().trim();
    const user = inventoryState.users.find(u => 
        u.email.toLowerCase() === identifierLower ||
        u.username.toLowerCase() === identifierLower ||
        (u.lrn && u.lrn === identifier.trim())
    );

    if (user && user.password === password) {
       if (user.status !== UserStatus.APPROVED) {
            if (user.status === UserStatus.PENDING) {
                throw new Error("Your account is pending approval by an administrator.");
            }
            if (user.status === UserStatus.DENIED) {
                throw new Error("Your account registration has been denied.");
            }
            throw new Error("Your account is currently inactive. Please contact an administrator.");
       }
      setCurrentUser(user);
      sessionStorage.setItem(SESSION_STORAGE_KEY, user.id);
      return true;
    }
    return false;
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
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};