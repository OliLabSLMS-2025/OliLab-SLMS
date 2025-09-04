import * as React from 'react';
import { useInventory } from '../context/InventoryContext';
import { LogAction, LogEntry, User, BorrowStatus } from '../types';
import { IconPrinter } from '../components/icons';
import { useAuth } from '../context/AuthContext';

const isOverdue = (dueDate: string | undefined): boolean => {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Compare against the start of today
    return today > new Date(dueDate);
};

const OverdueReminder: React.FC<{ overdueItems: { itemName: string }[] }> = ({ overdueItems }) => {
    if (overdueItems.length === 0) return null;

    return (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-700 text-red-300 text-sm rounded-lg button-print-hide">
            <h3 className="font-bold text-base mb-2">Overdue Items Reminder</h3>
            <p className="mb-2">The following items are past their due date. Please return them to the lab as soon as possible:</p>
            <ul className="list-disc list-inside space-y-1">
                {overdueItems.map((item, index) => (
                    <li key={index}><strong>{item.itemName}</strong></li>
                ))}
            </ul>
        </div>
    );
};

const DueDateDisplay: React.FC<{ log: LogEntry }> = ({ log }) => {
    if (log.status !== BorrowStatus.ON_LOAN && log.status !== BorrowStatus.RETURN_REQUESTED && log.status !== BorrowStatus.RETURNED) {
         return <span className="text-slate-500">N/A</span>;
    }
    if (!log.dueDate) {
        return <span className="text-slate-500">N/A</span>;
    }

    const overdue = isOverdue(log.dueDate);
    return (
        <div className="flex flex-col">
            <span className={overdue && (log.status === BorrowStatus.ON_LOAN || log.status === BorrowStatus.RETURN_REQUESTED) ? 'text-red-400' : ''}>
                {new Date(log.dueDate).toLocaleDateString()}
            </span>
            {overdue && (log.status === BorrowStatus.ON_LOAN || log.status === BorrowStatus.RETURN_REQUESTED) && (
                 <span className="text-xs text-red-500 font-semibold">Overdue</span>
            )}
        </div>
    );
};

const StatusDisplay: React.FC<{ 
    log: LogEntry & { itemName: string };
    onReturn: (log: LogEntry) => void; 
}> = ({ log, onReturn }) => {
    switch (log.status) {
        case BorrowStatus.PENDING:
            return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-700 text-gray-300 print-text-black">Pending Approval</span>;
        case BorrowStatus.ON_LOAN:
            return (
                <button 
                    onClick={() => onReturn(log)}
                    className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-xs button-print-hide"
                  >
                    Request Return
                  </button>
            );
        case BorrowStatus.RETURN_REQUESTED:
            return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-900 text-blue-300 print-text-black">Return Requested</span>;
        case BorrowStatus.RETURNED:
            return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-900 text-green-300 print-text-black">Returned</span>;
        case BorrowStatus.DENIED:
             return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-900 text-red-300 print-text-black">Request Denied</span>;
        default:
            // This case should ideally not be reached due to the normalization in `myLogs`.
            // It acts as a fallback for any unexpected status.
            return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-700 text-slate-300 print-text-black">Unknown</span>;
    }
}


export const MyBorrows: React.FC = () => {
  const { state, requestItemReturn } = useInventory();
  const { currentUser } = useAuth();

  const myLogs = React.useMemo(() => {
    if (!currentUser) return [];
    
    // This logic handles both new (status-based) and old (log-pairing based) return tracking for backward compatibility.
    const returnedByActionLogIds = new Set(
        state.logs.filter(log => log.userId === currentUser.id && log.action === LogAction.RETURN).map(log => log.relatedLogId)
    );

    return state.logs
        .filter(log => log.userId === currentUser.id && log.action === LogAction.BORROW)
        .map(log => {
            const item = state.items.find(i => i.id === log.itemId);
            const isLegacyReturned = returnedByActionLogIds.has(log.id);
            return {
                ...log,
                itemName: item?.name || 'Unknown Item',
                // Explicitly mark as returned if it's a legacy entry that has been returned
                status: log.status ?? (isLegacyReturned ? BorrowStatus.RETURNED : BorrowStatus.ON_LOAN),
            };
        })
        .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [state.logs, state.items, currentUser]);
  
  const overdueItems = React.useMemo(() => {
    return myLogs.filter(log => 
        (log.status === BorrowStatus.ON_LOAN || log.status === BorrowStatus.RETURN_REQUESTED) && isOverdue(log.dueDate)
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
    alert("Your return request has been submitted for admin approval.");
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
                <th scope="col" className="px-6 py-3">Date</th>
                <th scope="col" className="px-6 py-3">Due Date</th>
                <th scope="col" className="px-6 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {myLogs.map(log => (
                <tr key={log.id} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors print-text-black">
                  <td className="px-6 py-4 font-medium text-white print-text-black whitespace-nowrap">{log.itemName}</td>
                  <td className="px-6 py-4">{log.quantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <DueDateDisplay log={log} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <StatusDisplay log={log} onReturn={handleRequestReturn} />
                  </td>
                </tr>
              ))}
              {myLogs.length === 0 && (
                <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400 print-text-black">You have not borrowed any items yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};