import React, { useState, useMemo, useCallback } from 'react';
import { useInventory } from '../context/InventoryContext';
import { generateInventoryReport } from '../services/geminiService';
import { IconLightbulb, IconLoader, IconPrinter } from '../components/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { LogAction, UserStatus } from '../types';
import { useAuth } from '../context/AuthContext';
 
const StatCard: React.FC<{ title: string; value: string | number; description: string }> = ({ title, value, description }) => (
    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-md print-bg-white print-text-black">
        <h3 className="text-sm font-medium text-slate-400 print-text-black">{title}</h3>
        <p className="text-3xl font-bold text-white mt-2 print-text-black">{value}</p>
        <p className="text-xs text-slate-500 mt-1 print-text-black">{description}</p>
    </div>
);

export const Dashboard: React.FC = () => {
  const { state } = useInventory();
  const { currentUser } = useAuth();
  const [report, setReport] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const stats = useMemo(() => {
    const totalItems = state.items.reduce((sum, item) => sum + item.totalQuantity, 0);
    const borrowedItems = state.items.reduce((sum, item) => sum + (item.totalQuantity - item.availableQuantity), 0);
    const lowStockItems = state.items.filter(item => item.totalQuantity > 0 && item.availableQuantity / item.totalQuantity < 0.2).length;
    const userCount = state.users.filter(u => u.status === UserStatus.APPROVED).length;
    return { totalItems, borrowedItems, lowStockItems, userCount };
  }, [state.items, state.users]);

  const chartData = useMemo(() => {
      return state.items.map(item => ({
          name: item.name,
          Available: item.availableQuantity,
          Borrowed: item.totalQuantity - item.availableQuantity
      })).slice(0, 7); // Show first 7 items for cleaner chart
  }, [state.items]);

  const handleGenerateReport = useCallback(async () => {
    setIsLoading(true);
    setReport('');
    const result = await generateInventoryReport(state.items, state.logs, state.users);
    setReport(result);
    setIsLoading(false);
  }, [state.items, state.logs, state.users]);
  
  const recentLogs = useMemo(() => {
      return state.logs.slice(0, 5).map(log => {
          const item = state.items.find(i => i.id === log.itemId);
          const user = state.users.find(u => u.id === log.userId);
          return { ...log, itemName: item?.name || 'N/A', userName: user?.fullName || 'N/A' };
      });
  }, [state.logs, state.items, state.users]);

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold text-white print-text-black">Dashboard</h1>
        <button
            onClick={() => window.print()}
            className="flex items-center justify-center px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-700 transition-colors button-print-hide"
        >
            <IconPrinter />
            <span>Print Page</span>
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Item Count" value={stats.totalItems} description="Across all categories" />
        <StatCard title="Items Currently Borrowed" value={stats.borrowedItems} description="Currently in use" />
        <StatCard title="Low Stock Alerts" value={stats.lowStockItems} description="Items below 20% stock" />
        <StatCard title="Registered Users" value={stats.userCount} description="Active & Approved" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 print-bg-white">
          <h2 className="text-xl font-semibold text-white mb-4 print-text-black">Inventory Status</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(71, 85, 105, 0.5)" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgb(30 41 59 / 0.9)',
                  borderColor: '#475569',
                  color: '#cbd5e1',
                  borderRadius: '0.5rem',
                }}
                cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
              />
              <Legend wrapperStyle={{fontSize: "14px"}}/>
              <Bar dataKey="Available" stackId="a" fill="#10b981" />
              <Bar dataKey="Borrowed" stackId="a" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 print-bg-white">
           <h2 className="text-xl font-semibold text-white mb-4 print-text-black">Recent Activity</h2>
           <div className="space-y-4">
              {recentLogs.length > 0 ? recentLogs.map(log => (
                  <div key={log.id} className="flex items-center justify-between text-sm">
                      <div>
                          <span className={`font-semibold ${log.action === LogAction.BORROW ? 'text-red-400' : 'text-green-400'} print-text-black`}>
                              {log.action === LogAction.BORROW ? 'Borrowed' : 'Returned'}
                          </span>
                          <span className="text-white ml-2 print-text-black">{log.quantity}x {log.itemName}</span>
                      </div>
                      <div className="text-slate-400 print-text-black">{log.userName}</div>
                  </div>
              )) : <p className="text-slate-400 print-text-black">No recent activity.</p>}
           </div>
        </div>
      </div>

      {currentUser?.isAdmin && (
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 print-bg-white">
          <div className="flex flex-col sm:flex-row justify-between items-start">
              <div className="mb-4 sm:mb-0">
                  <h2 className="text-xl font-semibold text-white print-text-black">AI-Powered Weekly Report</h2>
                  <p className="text-slate-400 mt-1 print-text-black">Generate an intelligent summary of your lab's status.</p>
              </div>
              <button
                onClick={handleGenerateReport}
                disabled={isLoading}
                className="flex items-center justify-center px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-emerald-700 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed button-print-hide flex-shrink-0"
              >
                {isLoading ? (
                  <>
                    <IconLoader className="h-5 w-5" />
                    <span className="ml-2">Generating...</span>
                  </>
                ) : (
                  <>
                    <IconLightbulb />
                    <span className="ml-2">Generate Report</span>
                  </>
                )}
              </button>
          </div>

          {(isLoading || report) && (
            <div className="mt-4 p-4 bg-slate-900 rounded-lg max-h-96 overflow-y-auto print-bg-white">
              {isLoading && (
                <div className="flex flex-col items-center justify-center text-slate-400 print-text-black">
                  <IconLoader className="h-8 w-8 mb-2" />
                  <p>Gemini is analyzing the data...</p>
                </div>
              )}
              {report && (
                <div className="prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: report }}></div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
};