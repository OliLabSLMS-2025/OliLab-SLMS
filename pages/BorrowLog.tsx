import * as React from 'react';
import { useInventory } from '../context/InventoryContext';
import { LogAction, BorrowStatus, LogEntry } from '../types';
import { IconChevronDown, IconChevronUp, IconPrinter } from '../components/icons';
import { useAuth } from '../context/AuthContext';

const tabs = [
    { id: 'pendingBorrows', label: 'Pending Borrows' },
    { id: 'returnRequests', label: 'Return Requests' },
    { id: 'onLoan', label: 'On Loan' },
    { id: 'history', label: 'History' },
];

const isOverdue = (dueDate: string | undefined): boolean => {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Compare against the start of today
    return today > new Date(dueDate);
};

const DueDateCell: React.FC<{ dueDate?: string, status?: BorrowStatus }> = ({ dueDate, status }) => {
    if (!dueDate) {
        return <span className="text-slate-500">N/A</span>;
    }
    const overdue = isOverdue(dueDate);
    const isRelevantStatus = status === BorrowStatus.ON_LOAN || status === BorrowStatus.RETURN_REQUESTED;
    return (
        <span className={overdue && isRelevantStatus ? 'text-red-400 font-semibold' : ''}>
            {new Date(dueDate).toLocaleDateString()}
        </span>
    );
};

const StatusBadge: React.FC<{ status?: BorrowStatus }> = ({ status }) => {
    const baseClasses = "px-2 py-1 text-xs font-semibold rounded-full";
    switch (status) {
        case BorrowStatus.RETURNED:
            return <span className={`${baseClasses} bg-green-900 text-green-300`}>Returned</span>;
        case BorrowStatus.DENIED:
            return <span className={`${baseClasses} bg-red-900 text-red-300`}>Denied</span>;
        default:
            return <span className={`${baseClasses} bg-slate-700 text-slate-300`}>Unknown</span>;
    }
};

const LogComments: React.FC<{ logId: string }> = ({ logId }) => {
    const { state, addLogComment } = useInventory();
    const { currentUser } = useAuth();
    const [commentText, setCommentText] = React.useState('');

    const comments = React.useMemo(() => {
        return state.logComments
            .filter(c => c.logId === logId)
            .map(c => ({...c, user: state.users.find(u => u.id === c.userId)}))
            .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [state.logComments, state.users, logId]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim() || !currentUser) return;
        await addLogComment({ logId, userId: currentUser.id, text: commentText });
        setCommentText('');
    };

    return (
        <div className="bg-slate-900/70 p-4 rounded-b-lg">
            <h4 className="text-sm font-semibold text-slate-300 mb-3">Administrator Comments</h4>
            <div className="space-y-3 max-h-48 overflow-y-auto pr-2 mb-4">
                 {comments.length > 0 ? comments.map(comment => (
                    <div key={comment.id} className="text-xs p-3 bg-slate-800 rounded-md border border-slate-700">
                        <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-emerald-400">
                                {comment.user?.fullName || 'Unknown Admin'}
                            </span>
                            <span className="text-slate-500">{new Date(comment.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-300 whitespace-pre-wrap">{comment.text}</p>
                    </div>
                )) : <p className="text-xs text-slate-500 italic">No comments on this entry yet.</p>}
            </div>
             <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
                <textarea
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Add a comment (e.g., item condition upon return)..."
                    rows={2}
                    className="flex-grow bg-slate-700 border border-slate-600 rounded-lg p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm self-end">Post</button>
            </form>
        </div>
    );
};

export const BorrowLog: React.FC = () => {
  const { state, approveReturnRequest, markNotificationsAsRead, approveBorrowRequest, denyBorrowRequest } = useInventory();
  const [activeTab, setActiveTab] = React.useState('pendingBorrows');
  const [expandedLogId, setExpandedLogId] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    const unreadNotifications = state.notifications
        .filter(n => (n.type === 'return_request' || n.type === 'borrow_request') && !n.read)
        .map(n => n.id);
    if (unreadNotifications.length > 0) {
        markNotificationsAsRead(unreadNotifications);
    }
  }, [state.notifications, markNotificationsAsRead]);

  const borrowLogsWithDetails = React.useMemo(() => {
    return state.logs
      .filter(log => log.action === LogAction.BORROW)
      .map(log => {
        const item = state.items.find(i => i.id === log.itemId);
        const user = state.users.find(u => u.id === log.userId);
        const commentCount = state.logComments.filter(c => c.logId === log.id).length;
        return {
          ...log,
          itemName: item?.name || 'Unknown Item',
          userName: user?.fullName || 'Unknown User',
          commentCount,
        };
      }).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [state.logs, state.items, state.users, state.logComments]);

  const { pendingBorrows, returnRequests, onLoan, history } = React.useMemo(() => ({
      pendingBorrows: borrowLogsWithDetails.filter(log => log.status === BorrowStatus.PENDING),
      returnRequests: borrowLogsWithDetails.filter(log => log.status === BorrowStatus.RETURN_REQUESTED),
      onLoan: borrowLogsWithDetails.filter(log => log.status === BorrowStatus.ON_LOAN),
      history: borrowLogsWithDetails.filter(log => log.status === BorrowStatus.RETURNED || log.status === BorrowStatus.DENIED),
  }), [borrowLogsWithDetails]);
  
  const getTabCount = (tabId: string) => {
    switch (tabId) {
        case 'pendingBorrows': return pendingBorrows.length;
        case 'returnRequests': return returnRequests.length;
        default: return 0;
    }
  };

  const renderTable = (headers: string[], data: any[], renderRow: (item: any) => React.ReactNode, emptyMessage: string) => (
    <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden print-bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-300">
          <thead className="text-xs text-slate-400 uppercase bg-slate-700/50 print-text-black">
            <tr>
              {headers.map(header => <th key={header} scope="col" className="px-6 py-3">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? data.map(item => (
              <React.Fragment key={item.id}>
                <tr className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors print-text-black">
                    {renderRow(item)}
                </tr>
                {expandedLogId === item.id && (
                    <tr>
                        <td colSpan={headers.length} className="p-0">
                            <LogComments logId={item.id} />
                        </td>
                    </tr>
                )}
              </React.Fragment>
            )) : (
              <tr>
                <td colSpan={headers.length} className="text-center py-8 text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderContent = () => {
    const toggleComments = (logId: string) => setExpandedLogId(prev => (prev === logId ? null : logId));

    switch (activeTab) {
        case 'pendingBorrows': return renderTable(
            ['Item', 'Requested By', 'Quantity', 'Date', 'Actions'],
            pendingBorrows,
            (log) => (
                <>
                    <td className="px-6 py-4 font-medium text-white print-text-black whitespace-nowrap">{log.itemName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{log.userName}</td>
                    <td className="px-6 py-4">{log.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap button-print-hide">
                        <div className="flex items-center gap-4">
                            <button onClick={() => approveBorrowRequest(log.id)} className="font-medium text-emerald-400 hover:text-emerald-300">Approve</button>
                            <button onClick={() => denyBorrowRequest(log.id)} className="font-medium text-red-400 hover:text-red-300">Deny</button>
                            <button onClick={() => toggleComments(log.id)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"><span className="font-mono">{log.commentCount}</span> {expandedLogId === log.id ? <IconChevronUp /> : <IconChevronDown />}</button>
                        </div>
                    </td>
                </>
            ), "No pending borrow requests."
        );
        case 'returnRequests': return renderTable(
            ['Item', 'User', 'Quantity', 'Date Borrowed', 'Due Date', 'Actions'],
            returnRequests,
            (log) => (
                <>
                    <td className="px-6 py-4 font-medium text-white print-text-black whitespace-nowrap">{log.itemName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{log.userName}</td>
                    <td className="px-6 py-4">{log.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><DueDateCell dueDate={log.dueDate} status={log.status} /></td>
                    <td className="px-6 py-4 whitespace-nowrap button-print-hide">
                        <div className="flex items-center gap-4">
                            <button onClick={() => approveReturnRequest(log)} className="font-medium text-emerald-400 hover:text-emerald-300">Confirm Return</button>
                            <button onClick={() => toggleComments(log.id)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"><span className="font-mono">{log.commentCount}</span> {expandedLogId === log.id ? <IconChevronUp /> : <IconChevronDown />}</button>
                        </div>
                    </td>
                </>
            ), "No pending return requests."
        );
        case 'onLoan': return renderTable(
            ['Item', 'Borrowed By', 'Quantity', 'Date Approved', 'Due Date', 'Details'],
            onLoan,
            (log) => (
                <>
                    <td className="px-6 py-4 font-medium text-white print-text-black whitespace-nowrap">{log.itemName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{log.userName}</td>
                    <td className="px-6 py-4">{log.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><DueDateCell dueDate={log.dueDate} status={log.status} /></td>
                    <td className="px-6 py-4">
                        <button onClick={() => toggleComments(log.id)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"><span className="font-mono">{log.commentCount}</span> Comments {expandedLogId === log.id ? <IconChevronUp /> : <IconChevronDown />}</button>
                    </td>
                </>
            ), "No items are currently on loan."
        );
        case 'history': return renderTable(
            ['Item', 'User', 'Quantity', 'Date', 'Due Date', 'Status', 'Details'],
            history,
            (log) => (
                <>
                    <td className="px-6 py-4 font-medium text-white print-text-black whitespace-nowrap">{log.itemName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{log.userName}</td>
                    <td className="px-6 py-4">{log.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><DueDateCell dueDate={log.dueDate} status={log.status} /></td>
                    <td className="px-6 py-4"><StatusBadge status={log.status} /></td>
                    <td className="px-6 py-4">
                        <button onClick={() => toggleComments(log.id)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"><span className="font-mono">{log.commentCount}</span> Comments {expandedLogId === log.id ? <IconChevronUp /> : <IconChevronDown />}</button>
                    </td>
                </>
            ), "No historical records found."
        );
        default: return null;
    }
  };

  return (
    <div className="p-4 md:p-8">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
                <h1 className="text-3xl font-bold text-white print-text-black">Borrow Log</h1>
                <p className="text-slate-400 mt-1 print-text-black">Manage pending requests and view borrow history.</p>
            </div>
             <button
                onClick={() => window.print()}
                className="flex items-center justify-center px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-700 transition-colors button-print-hide"
            >
                <IconPrinter />
                <span>Print Log</span>
            </button>
      </div>

        <div className="border-b border-slate-700 button-print-hide">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                {tabs.map(tab => {
                    const count = getTabCount(tab.id);
                    return (
                         <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                                activeTab === tab.id
                                ? 'border-emerald-500 text-emerald-400'
                                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'
                            }`}
                        >
                            {tab.label}
                            {count > 0 && (
                                <span className={`h-5 w-5 rounded-full text-xs flex items-center justify-center ${activeTab === tab.id ? 'bg-emerald-500 text-slate-900' : 'bg-slate-600 text-slate-200'}`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>
        </div>
        <div className="mt-6">
            {renderContent()}
        </div>
    </div>
  );
};