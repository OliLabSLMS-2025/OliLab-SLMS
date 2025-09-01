
import { State, LogAction } from '../types';

const LOCAL_STORAGE_KEY = 'oliLabLocalData';
const SETTINGS_STORAGE_KEY = 'oliLabSettings';

const getDefaultData = (): State => {
    const defaultAdminId = `admin_${Date.now()}`;
    return {
        items: [
            { id: 'item_1622548800000', name: 'Beaker 250ml', category: 'Chemistry', totalQuantity: 20, availableQuantity: 20 },
            { id: 'item_1622548800001', name: 'Test Tube Rack', category: 'Chemistry', totalQuantity: 15, availableQuantity: 15 },
            { id: 'item_1622548800002', name: 'Microscope', category: 'Biology', totalQuantity: 5, availableQuantity: 3 },
            { id: 'item_1622548800003', name: 'Sulfuric Acid (H2SO4)', category: 'Chemistry', totalQuantity: 10, availableQuantity: 10 },
        ],
        users: [
            {
                id: defaultAdminId,
                username: 'admin',
                fullName: 'Admin User',
                email: 'admin@olilab.app',
                password: 'password', // NOTE: Storing plain-text passwords is a security risk. This is for demonstration purposes only.
                lrn: '',
                gradeLevel: null,
                section: null,
                role: 'Admin',
                isAdmin: true,
            }
        ],
        logs: [
             // FIX: Used LogAction enum member instead of a string literal to satisfy TypeScript.
             { id: 'log_1622548800002', userId: defaultAdminId, itemId: 'item_1622548800002', quantity: 2, timestamp: new Date(Date.now() - 86400000).toISOString(), action: LogAction.BORROW, returnRequested: false },
        ],
        notifications: [],
        suggestions: [],
        comments: [],
    };
};

export const loadState = (): State => {
    try {
        const serializedState = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (serializedState === null) {
            const defaultData = getDefaultData();
            saveState(defaultData);
            return defaultData;
        }
        let parsed = JSON.parse(serializedState);
        if (parsed.users && parsed.items) {
             // For backward compatibility, add comments if they don't exist
             if (!parsed.comments) {
                 parsed.comments = [];
             }
             return parsed;
        }
        const defaultDataOnParseError = getDefaultData();
        saveState(defaultDataOnParseError);
        return defaultDataOnParseError;
    } catch (err) {
        console.error("Could not load state from local storage", err);
        const defaultDataOnError = getDefaultData();
        saveState(defaultDataOnError);
        return defaultDataOnError;
    }
};

export const saveState = (state: State) => {
    try {
        const serializedState = JSON.stringify(state);
        localStorage.setItem(LOCAL_STORAGE_KEY, serializedState);
    } catch (err) {
        console.error("Could not save state to local storage", err);
    }
};

export const loadSettings = () => {
    try {
        const serializedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
        return serializedSettings ? JSON.parse(serializedSettings) : { title: 'OliLab', logoUrl: '' };
    } catch (err) {
         console.error("Could not load settings from local storage", err);
         return { title: 'OliLab', logoUrl: '' };
    }
}

export const saveSettings = (settings: any) => {
     try {
        const serializedSettings = JSON.stringify(settings);
        localStorage.setItem(SETTINGS_STORAGE_KEY, serializedSettings);
    } catch (err) {
        console.error("Could not save settings to local storage", err);
    }
}

export const generateId = (prefix: string = 'id') => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
