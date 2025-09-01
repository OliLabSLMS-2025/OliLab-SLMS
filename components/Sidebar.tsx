import React, { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { IconLayoutDashboard, IconFlaskConical, IconBookText, IconUsers, IconOliveBranch, IconFileSpreadsheet, IconLogOut, IconSearch, IconUserCircle, IconLightbulb, IconChevronLeft, IconChevronRight } from './icons';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import { SuggestionStatus } from '../types';
import { useSettings } from '../context/SettingsContext';

interface SidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
}

const memberNavItems = [
  { to: '/dashboard', text: 'Dashboard', icon: <IconLayoutDashboard /> },
  { to: '/inventory', text: 'Inventory', icon: <IconFlaskConical /> },
  { to: '/search', text: 'Scan & Find', icon: <IconSearch /> },
  { to: '/my-borrows', text: 'My Borrows', icon: <IconBookText /> },
  { to: '/suggestions', text: 'Suggestions', icon: <IconLightbulb /> },
];

const NavItem: React.FC<{ to: string; text: string; icon: React.ReactNode; badge?: number; isCollapsed: boolean }> = ({ to, text, icon, badge, isCollapsed }) => (
    <NavLink
        to={to}
        title={isCollapsed ? text : undefined}
        className={({ isActive }) => `relative flex items-center py-3 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out ${isCollapsed ? 'px-3 justify-center' : 'px-4'} ${
            isActive
            ? 'bg-emerald-600 text-white shadow-lg'
            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
        }`}
    >
        {icon}
        {!isCollapsed && <span className="ml-3 flex-grow">{text}</span>}
        {!isCollapsed && badge && badge > 0 && (
            <span className="bg-red-500 text-white text-xs font-semibold h-5 w-5 flex items-center justify-center rounded-full">
                {badge > 9 ? '9+' : badge}
            </span>
        )}
        {isCollapsed && badge && badge > 0 && (
            <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-semibold h-4 w-4 flex items-center justify-center rounded-full text-[9px] border-2 border-slate-800">
                {badge > 9 ? '!' : badge}
            </span>
        )}
    </NavLink>
);

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
    const { currentUser, logout } = useAuth();
    const { state } = useInventory();
    const { settings } = useSettings();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    const newUserNotifications = useMemo(() => {
        return state.notifications.filter(n => n.type === 'new_user' && !n.read).length;
    }, [state.notifications]);
    
    const pendingSuggestionsCount = useMemo(() => {
        return state.suggestions.filter(s => s.status === SuggestionStatus.PENDING).length;
    }, [state.suggestions]);

    const pendingReturnRequestsCount = useMemo(() => {
        return state.notifications.filter(n => n.type === 'return_request' && !n.read).length;
    }, [state.notifications]);


    const adminNavItems = useMemo(() => [
      { to: '/dashboard', text: 'Dashboard', icon: <IconLayoutDashboard /> },
      { to: '/inventory', text: 'Inventory', icon: <IconFlaskConical /> },
      { to: '/search', text: 'Scan & Find', icon: <IconSearch /> },
      { to: '/log', text: 'Borrow Log', icon: <IconBookText />, badge: pendingReturnRequestsCount },
      { to: '/users', text: 'Users', icon: <IconUsers />, badge: newUserNotifications },
      { to: '/reports', text: 'Data & Reports', icon: <IconFileSpreadsheet /> },
      { to: '/suggestions', text: 'Suggestions', icon: <IconLightbulb />, badge: pendingSuggestionsCount },
    ], [newUserNotifications, pendingSuggestionsCount, pendingReturnRequestsCount]);

    const navItems = currentUser?.isAdmin ? adminNavItems : memberNavItems;

  return (
    <div className={`h-screen bg-slate-800 flex flex-col border-r border-slate-700 fixed top-0 left-0 sidebar-print-hide transition-all duration-300 ${isCollapsed ? 'w-20 p-2' : 'w-64 p-4'}`}>
      <div className={`flex items-center mb-8 ${isCollapsed ? 'justify-center' : ''}`}>
        <div className="p-2 bg-emerald-600 rounded-lg flex-shrink-0">
          {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-6 w-6 object-contain" />
          ) : (
              <IconOliveBranch />
          )}
        </div>
        {!isCollapsed && <h1 className="text-2xl font-bold text-white ml-3">{settings.title}</h1>}
      </div>
      <nav className="flex-grow flex flex-col space-y-2">
        {navItems.map(item => (
          <NavItem key={item.to} {...item} isCollapsed={isCollapsed} />
        ))}
      </nav>
      <div className="border-t border-slate-700 pt-4">
        {currentUser && !isCollapsed && (
            <div className="px-2 py-3 mb-2">
                <p className="text-sm font-semibold text-white truncate">{currentUser.fullName}</p>
                <p className="text-xs text-slate-400">{currentUser.role}</p>
            </div>
        )}
        <NavItem to="/profile" text="My Profile" icon={<IconUserCircle />} isCollapsed={isCollapsed}/>
        <button
            onClick={handleLogout}
            title="Logout"
            className={`flex w-full items-center py-3 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out text-slate-300 hover:bg-slate-700 hover:text-white ${isCollapsed ? 'justify-center px-3' : 'px-4'}`}
        >
            <IconLogOut />
            {!isCollapsed && <span className="ml-3">Logout</span>}
        </button>
        <button
            onClick={onToggle}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`flex w-full items-center py-3 mt-2 text-sm font-medium rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-all duration-200 ease-in-out ${isCollapsed ? 'justify-center px-3' : 'px-4'}`}
        >
            {isCollapsed ? (
                <IconChevronRight />
            ) : (
                <>
                    <IconChevronLeft />
                    <span className="ml-3">Collapse</span>
                </>
            )}
        </button>
      </div>
    </div>
  );
};