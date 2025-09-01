import { db } from '../firebaseConfig';
// FIX: Changed to named imports for firebase/firestore to use v9 modular SDK correctly.
import {
    Timestamp,
    addDoc,
    collection,
    doc,
    runTransaction,
    deleteDoc,
    setDoc,
    updateDoc,
    writeBatch
} from 'firebase/firestore';
import { Item, User, LogEntry, LogAction, Notification, Suggestion, SuggestionStatus } from '../types';
import { sendNewUserAdminNotification } from './emailService';

// --- Helper Functions ---
const createFirebaseTimestamp = () => Timestamp.now();

// --- Item Management ---
export const addItem = async (itemData: Omit<Item, 'id' | 'availableQuantity'>) => {
    const newItem = {
        ...itemData,
        availableQuantity: itemData.totalQuantity,
    };
    await addDoc(collection(db, 'items'), newItem);
};

export const editItem = async (itemData: Item) => {
    const itemRef = doc(db, 'items', itemData.id);
    await runTransaction(db, async (transaction) => {
        const itemDoc = await transaction.get(itemRef);
        if (!itemDoc.exists()) {
            throw new Error("Item to edit does not exist.");
        }
        const currentItem = itemDoc.data();
        const borrowedCount = currentItem.totalQuantity - currentItem.availableQuantity;

        if (itemData.totalQuantity < borrowedCount) {
            throw new Error("Total quantity cannot be less than the number of items currently borrowed.");
        }
        
        const newAvailableQuantity = itemData.totalQuantity - borrowedCount;

        transaction.update(itemRef, {
            name: itemData.name,
            category: itemData.category,
            totalQuantity: itemData.totalQuantity,
            availableQuantity: newAvailableQuantity,
        });
    });
};

export const deleteItem = (itemId: string) => {
    // Add logic here to check for outstanding loans before deleting if needed.
    // This is often best handled by security rules in Firestore.
    return deleteDoc(doc(db, 'items', itemId));
};

// --- User Management ---
export const createUserProfile = (uid: string, userData: Omit<User, 'id'>) => {
    return setDoc(doc(db, 'users', uid), { ...userData, id: uid });
};

export const editUser = (userData: User) => {
    const userRef = doc(db, 'users', userData.id);
    return updateDoc(userRef, { ...userData });
};

export const deleteUser = (userId: string) => {
    // IMPORTANT: This only deletes the user's profile from Firestore.
    // Deleting a user from Firebase Authentication is a privileged action
    // and typically requires a backend server with the Firebase Admin SDK.
    return deleteDoc(doc(db, 'users', userId));
};

// --- Borrow/Return Logging ---
export const borrowItem = async (payload: { userId: string; itemId: string; quantity: number }) => {
    const { userId, itemId, quantity } = payload;
    const itemRef = doc(db, 'items', itemId);
    
    await runTransaction(db, async (transaction) => {
        const itemDoc = await transaction.get(itemRef);
        if (!itemDoc.exists()) {
            throw new Error("Item does not exist.");
        }

        const currentItem = itemDoc.data();
        if (currentItem.availableQuantity < quantity) {
            throw new Error(`Not enough items in stock. Only ${currentItem.availableQuantity} available.`);
        }
        
        const newQuantity = currentItem.availableQuantity - quantity;
        transaction.update(itemRef, { availableQuantity: newQuantity });

        const newLogEntry = {
            userId,
            itemId,
            quantity,
            timestamp: createFirebaseTimestamp(),
            action: LogAction.BORROW,
        };
        const logRef = doc(collection(db, 'logs'));
        transaction.set(logRef, newLogEntry);
    });
};

export const returnItem = async (borrowLog: LogEntry) => {
    const itemRef = doc(db, 'items', borrowLog.itemId);

    await runTransaction(db, async (transaction) => {
        const itemDoc = await transaction.get(itemRef);
        // Even if item was deleted, we should still log the return
        if (itemDoc.exists()) {
             const currentItem = itemDoc.data();
             const currentQuantity = currentItem.availableQuantity;
             const totalQuantity = currentItem.totalQuantity;
             // Ensure available quantity doesn't exceed total quantity
             const newQuantity = Math.min(totalQuantity, currentQuantity + borrowLog.quantity);
             transaction.update(itemRef, { availableQuantity: newQuantity });
        }
        
        const logRef = doc(collection(db, 'logs'));
        const returnLogEntry = {
            userId: borrowLog.userId,
            itemId: borrowLog.itemId,
            quantity: borrowLog.quantity,
            timestamp: createFirebaseTimestamp(),
            action: LogAction.RETURN,
            relatedLogId: borrowLog.id,
        };
        transaction.set(logRef, returnLogEntry);
    });
};

export const requestItemReturn = async (payload: { log: LogEntry; item: Item; user: User }) => {
    const { log, item, user } = payload;
    const batch = writeBatch(db);

    const logRef = doc(db, 'logs', log.id);
    batch.update(logRef, { returnRequested: true });

    const notificationRef = doc(collection(db, 'notifications'));
    const notification: Omit<Notification, 'id'> = {
        message: `${user.fullName} requested to return ${log.quantity}x ${item.name}.`,
        type: 'return_request',
        read: false,
        timestamp: createFirebaseTimestamp() as any, // Cast because serverTimestamp is different
        relatedLogId: log.id,
    };
    batch.set(notificationRef, notification);

    await batch.commit();
};


// --- Notifications ---
export const createNewUserNotification = async (newUser: User, admins: User[]) => {
    const notification = {
        message: `New user signed up: ${newUser.fullName}`,
        type: 'new_user',
        read: false,
        timestamp: createFirebaseTimestamp(),
    };
    await addDoc(collection(db, 'notifications'), notification);
    sendNewUserAdminNotification(newUser, admins);
};

export const markNotificationsAsRead = async (notificationIds: string[]) => {
    const batch = writeBatch(db);
    notificationIds.forEach(id => {
        const notifRef = doc(db, 'notifications', id);
        batch.update(notifRef, { read: true });
    });
    await batch.commit();
};


// --- Suggestions ---
export const addSuggestion = async (suggestionData: Omit<Suggestion, 'id' | 'status' | 'timestamp'>) => {
    const newSuggestion = {
        ...suggestionData,
        status: SuggestionStatus.PENDING,
        timestamp: createFirebaseTimestamp(),
    };
    await addDoc(collection(db, 'suggestions'), newSuggestion);
};

export const approveSuggestion = async (payload: { suggestion: Suggestion; totalQuantity: number }) => {
    const { suggestion, totalQuantity } = payload;
    const batch = writeBatch(db);

    const suggestionRef = doc(db, 'suggestions', suggestion.id);
    batch.update(suggestionRef, { status: SuggestionStatus.APPROVED });

    const newItemRef = doc(collection(db, 'items'));
    batch.set(newItemRef, {
        name: suggestion.itemName,
        category: suggestion.category,
        totalQuantity,
        availableQuantity: totalQuantity,
    });
    
    await batch.commit();
};

export const denySuggestion = (suggestionId: string) => {
    const suggestionRef = doc(db, 'suggestions', suggestionId);
    return updateDoc(suggestionRef, { status: SuggestionStatus.DENIED });
};

// --- Data Import ---
export const importItems = async (items: Omit<Item, 'id' | 'availableQuantity'>[]) => {
    const batch = writeBatch(db);
    const itemsCollection = collection(db, 'items');
    items.forEach(item => {
        const docRef = doc(itemsCollection);
        const newItem = {
            ...item,
            availableQuantity: item.totalQuantity,
        };
        batch.set(docRef, newItem);
    });
    await batch.commit();
};

// Settings
export const updateSettingsInDb = (settings: any) => {
    return setDoc(doc(db, 'settings', 'main'), settings, { merge: true });
};