import React, { useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { LogAction, LogEntry, User } from '../types';
import { IconPrinter } from '../components/icons';
import { useAuth } from '../context/AuthContext';

const OverdueReminder: React.FC<{ overdueItems: { itemName: string }[] }> = ({ overdueItems }) => {
    if (overdueItems.length === 0) return null;

    return (
        <div className="mb-6 p-4 bg-yellow-900/50 border border-yellow-700 text-yellow-300 text-sm rounded-lg">
            <h3 className="font-bold text-base mb-2">Weekly Return Reminder</h3>
            <p className="mb-2">The following items were borrowed before last Friday and have not been returned. Please return them to the lab as soon as possible:</p>
            <ul className="list-disc list-inside space-y-1">
                {overdueItems.map((item, index) => (
                    <li key={index}><strong>{item.itemName}</strong></li>
                ))}
            </ul>
        </div>
    );
};

export const MyBorrows: React.FC = () => {
  const { state, requestItemReturn } = useInventory();
  const { currentUser } = useAuth();

  const myLogs = useMemo(() => {
    if (!currentUser) return [];
    
    const returnedLogIds = new Set(
        state.logs.filter(log => log.action === LogAction.RETURN).map(log => log.relatedLogId)
    );

    return state.logs
        .filter(log => log.userId === currentUser.id && log.action === LogAction.BORROW)
        .map(log => {
            const item = state.items.find(i => i.id === log.itemId);
            return {
                ...log,
                itemName: item?.name || 'Unknown Item',
                isReturned: returnedLogIds.has(log.id),
            };
        })
        .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [state.logs, state.items, currentUser]);
  
  const overdueItems = useMemo(() => {
    const today = new Date();
    const lastFriday = new Date(today);
    // Logic to find the date of the last Friday
    lastFriday.setDate(today.getDate() - (today.getDay() + 2) % 7);
    lastFriday.setHours(0, 0, 0, 0); // Set to the beginning of that day

    return myLogs.filter(log => 
        !log.isReturned && new Date(log.timestamp) < lastFriday
    );
  }, [myLogs]);

  const handleRequestReturn = async (log: LogEntry) => {
    if (!currentUser) return;
    const item = state.items.find(i => i.id === log.itemId);
    if (!item) {
        console.error("Item not found for return request");
        return;
    }
    await requestItemReturn({ log, item, user: currentUser as User });
  };


  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-white print-text-black">My Borrowing History</h1>
        <button
            onClick={() => window.print()}
            className="flex items-center justify-center px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-700 transition-colors button-print-hide"
        >
            <IconPrinter />
            <span>Print</span>
        </button>
      </div>
      
      <OverdueReminder overdueItems={overdueItems} />

      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden print-bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-700/50 print-text-black">
              <tr>
                <th scope="col" className="px-6 py-3">Item Name</th>
                <th scope="col" className="px-6 py-3">Quantity</th>
                <th scope="col" className="px-6 py-3">Date Borrowed</th>
                <th scope="col" className="px-6 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {myLogs.map(log => (
                <tr key={log.id} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors print-text-black">
                  <td className="px-6 py-4 font-medium text-white print-text-black whitespace-nowrap">{log.itemName}</td>
                  <td className="px-6 py-4">{log.quantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-6 py-4 text-center">
                    {log.isReturned ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-900 text-green-300 print-text-black">Returned</span>
                    ) : log.returnRequested ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-900 text-blue-300 print-text-black">Return Requested</span>
                    ) : (
                      <button 
                        onClick={() => handleRequestReturn(log)}
                        className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-xs"
                      >
                        Request Return
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {myLogs.length === 0 && (
                <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-400 print-text-black">You have not borrowed any items yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};