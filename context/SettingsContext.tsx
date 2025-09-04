import * as React from 'react';
import { loadSettings, saveSettings } from '../services/localStore';

interface Settings {
  title: string;
  logoUrl: string;
  notifications: {
    enabled: boolean;
    permission: 'default' | 'granted' | 'denied';
  };
  loanPeriodDays: number;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
}

const defaultSettings: Settings = {
  title: 'OliLab',
  logoUrl: '',
  notifications: {
    enabled: false,
    permission: 'default',
  },
  loanPeriodDays: 7,
};

const SettingsContext = React.createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = React.useState<Settings>(() => {
      const saved = loadSettings();
      // Merge saved settings with defaults to ensure new properties are added
      return { ...defaultSettings, ...saved };
  });

  React.useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings(prevSettings => ({ ...prevSettings, ...newSettings }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = React.useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};