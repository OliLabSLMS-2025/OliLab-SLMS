import React, { useMemo, useState, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { LogAction, LogEntry } from '../types';
import { IconPrinter } from '../components/icons';

const tabs = [
    { id: 'transactions', label: 'Transaction Log' },
    { id: 'loans', label: 'Current Loans (Lab Management)' },
    { id: 'categories', label: 'Category Activity' },
];

export const BorrowLog: React.FC = () => {
  const { state, returnItem, markNotificationsAsRead } = useInventory();
  const [activeTab, setActiveTab] = useState('transactions');
  
  useEffect(() => {
    const unreadNotifications = state.notifications
        .filter(n => n.type === 'return_request' && !n.read)
        .map(n => n.id);
    if (unreadNotifications.length > 0) {
        markNotificationsAsRead(unreadNotifications);
    }
  }, [state.notifications, markNotificationsAsRead]);

  const handleReturn = (log: LogEntry) => {
    returnItem(log);
  };
  
  const processedLogs = useMemo(() => {
    const returnedLogIds = new Set(
        state.logs.filter(log => log.action === LogAction.RETURN).map(log => log.relatedLogId)
    );

    return state.logs.map(log => {
      const item = state.items.find(i => i.id === log.itemId);
      const user = state.users.find(u => u.id === log.userId);
      return {
        ...log,
        itemName: item?.name || 'Unknown Item',
        userName: user?.fullName || 'Unknown User',
        isReturned: log.action === LogAction.RETURN || returnedLogIds.has(log.id),
        returnRequested: log.returnRequested,
      };
    }).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [state.logs, state.items, state.users]);

  const currentLoans = useMemo(() => {
    const returnedLogIds = new Set(
        state.logs.filter(log => log.action === LogAction.RETURN).map(log => log.relatedLogId)
    );
    return state.logs
        .filter(log => log.action === LogAction.BORROW && !returnedLogIds.has(log.id))
        .map(log => {
            const item = state.items.find(i => i.id === log.itemId);
            const user = state.users.find(u => u.id === log.userId);
            return {
                ...log,
                itemName: item?.name || 'Unknown',
                userName: user?.fullName || 'Unknown',
                returnRequested: log.returnRequested,
            };
        })
        .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [state.logs, state.items, state.users]);

  const categoryActivity = useMemo(() => {
      const activity: { [category: string]: { borrows: number; currentlyOut: number } } = {};
      const returnedLogIds = new Set(
          state.logs.filter(log => log.action === LogAction.RETURN).map(log => log.relatedLogId)
      );

      state.logs.forEach(log => {
          const item = state.items.find(i => i.id === log.itemId);
          if (!item) return;

          const category = item.category;
          if (!activity[category]) {
              activity[category] = { borrows: 0, currentlyOut: 0 };
          }

          if (log.action === LogAction.BORROW) {
              activity[category].borrows += log.quantity;
              if (!returnedLogIds.has(log.id)) {
                  activity[category].currentlyOut += log.quantity;
              }
          }
      });
      return Object.entries(activity).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.borrows - a.borrows);
  }, [state.logs, state.items]);


  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-white print-text-black">Borrow Log & Management</h1>
        <button
            onClick={() => window.print()}
            className="flex items-center justify-center px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-700 transition-colors button-print-hide"
        >
            <IconPrinter />
            <span>Print</span>
        </button>
      </div>
      
      <div className="border-b border-slate-700 mb-6 button-print-hide">
        <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                        ${activeTab === tab.id
                            ? 'border-emerald-500 text-emerald-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'
                        }`
                    }
                >
                    {tab.label}
                </button>
            ))}
        </nav>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden print-bg-white">
        <div className="overflow-x-auto">
            {activeTab === 'transactions' && (
                <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs text-slate-400 uppercase bg-slate-700/50 print-text-black">
                <tr>
                    <th scope="col" className="px-6 py-3">Item Name</th>
                    <th scope="col" className="px-6 py-3">User</th>
                    <th scope="col" className="px-6 py-3">Action</th>
                    <th scope="col" className="px-6 py-3">Quantity</th>
                    <th scope="col" className="px-6 py-3">Date</th>
                    <th scope="col" className="px-6 py-3 text-center button-print-hide">Status</th>
                </tr>
                </thead>
                <tbody>
                {processedLogs.map(log => (
                    <tr key={log.id} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors print-text-black">
                    <td className="px-6 py-4 font-medium text-white print-text-black whitespace-nowrap">{log.itemName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{log.userName}</td>
                    <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                            log.action === LogAction.BORROW ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'
                        } print-text-black`}>
                        {log.action}
                        </span>
                    </td>
                    <td className="px-6 py-4">{log.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-6 py-4 text-center button-print-hide">
                        {log.action === LogAction.BORROW && !log.isReturned ? (
                        <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleReturn(log)} className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors whitespace-nowrap">
                                Mark as Returned
                            </button>
                            {log.returnRequested && 
                                <span title="User has requested to return this item" className="px-2 py-1 text-xs rounded-full bg-yellow-900 text-yellow-300">
                                    Request
                                </span>
                            }
                        </div>
                        ) : (
                        <span className="text-slate-400">
                            {log.action === LogAction.BORROW ? 'Returned' : 'Processed'}
                        </span>
                        )}
                    </td>
                    </tr>
                ))}
                    {processedLogs.length === 0 && (
                    <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400 print-text-black">No transaction logs yet.</td>
                    </tr>
                    )}
                </tbody>
            </table>
            )}
            {activeTab === 'loans' && (
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-700/50 print-text-black">
                        <tr>
                            <th scope="col" className="px-6 py-3">Item Name</th>
                            <th scope="col" className="px-6 py-3">Borrowed By</th>
                            <th scope="col" className="px-6 py-3">Quantity</th>
                            <th scope="col" className="px-6 py-3">Date Borrowed</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentLoans.map(log => (
                            <tr key={log.id} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors print-text-black">
                            <td className="px-6 py-4 font-medium text-white print-text-black whitespace-nowrap flex items-center">
                                {log.itemName}
                                {log.returnRequested && 
                                    <span title="User has requested to return this item" className="ml-2 px-2 py-1 text-xs rounded-full bg-yellow-900 text-yellow-300">
                                        Return Requested
                                    </span>
                                }
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">{log.userName}</td>
                            <td className="px-6 py-4">{log.quantity}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                            </tr>
                        ))}
                        {currentLoans.length === 0 && (
                            <tr>
                                <td colSpan={4} className="text-center py-8 text-slate-400 print-text-black">No items are currently on loan.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
            {activeTab === 'categories' && (
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-700/50 print-text-black">
                        <tr>
                            <th scope="col" className="px-6 py-3">Category</th>
                            <th scope="col" className="px-6 py-3">Total Borrows (Units)</th>
                            <th scope="col" className="px-6 py-3">Units Currently Out</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categoryActivity.map(cat => (
                            <tr key={cat.name} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors print-text-black">
                                <td className="px-6 py-4 font-medium text-white print-text-black whitespace-nowrap">{cat.name}</td>
                                <td className="px-6 py-4">{cat.borrows}</td>
                                <td className="px-6 py-4">{cat.currentlyOut}</td>
                            </tr>
                        ))}
                        {categoryActivity.length === 0 && (
                            <tr>
                                <td colSpan={3} className="text-center py-8 text-slate-400 print-text-black">No borrowing activity recorded yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
      </div>
    </div>
  );
};