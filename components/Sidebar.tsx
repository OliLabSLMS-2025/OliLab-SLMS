import * as React from 'react';
// FIX: Updated react-router-dom imports for v5 compatibility.
import { NavLink, useHistory } from 'react-router-dom';
import { IconLayoutDashboard, IconFlaskConical, IconBookText, IconUsers, IconOliveBranch, IconFileSpreadsheet, IconLogOut, IconSearch, IconUserCircle, IconLightbulb, IconChevronLeft, IconChevronRight } from './icons';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import { SuggestionStatus, BorrowStatus, LogAction, UserStatus } from '../types';
import { useSettings } from '../context/SettingsContext';
import { ThemeToggle } from './ThemeToggle';

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
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
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
            <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-semibold h-4 w-4 flex items-center justify-center rounded-full text-[9px] border-2 border-slate-200 dark:border-slate-800">
                {badge > 9 ? '!' : badge}
            </span>
        )}
    </NavLink>
);

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
    const { currentUser, logout } = useAuth();
    const { state } = useInventory();
    const { settings } = useSettings();
    // FIX: Replaced useNavigate (v6) with useHistory (v5).
    const history = useHistory();

    const handleLogout = () => {
        logout();
        // FIX: Used history.replace for navigation, compatible with v5.
        history.replace('/login');
    };

    const pendingUserCount = React.useMemo(() => {
        return state.users.filter(u => u.status === UserStatus.PENDING).length;
    }, [state.users]);
    
    const pendingSuggestionsCount = React.useMemo(() => {
        return state.suggestions.filter(s => s.status === SuggestionStatus.PENDING).length;
    }, [state.suggestions]);

    const pendingActionCount = React.useMemo(() => {
        const borrowRequests = state.logs.filter(l => l.action === LogAction.BORROW && l.status === BorrowStatus.PENDING).length;
        const returnRequests = state.logs.filter(l => l.action === LogAction.BORROW && l.status === BorrowStatus.RETURN_REQUESTED).length;
        return borrowRequests + returnRequests;
    }, [state.logs]);


    const adminNavItems = React.useMemo(() => [
      { to: '/dashboard', text: 'Dashboard', icon: <IconLayoutDashboard /> },
      { to: '/inventory', text: 'Inventory', icon: <IconFlaskConical /> },
      { to: '/search', text: 'Scan & Find', icon: <IconSearch /> },
      { to: '/log', text: 'Borrow Log', icon: <IconBookText />, badge: pendingActionCount },
      { to: '/users', text: 'Users', icon: <IconUsers />, badge: pendingUserCount },
      { to: '/reports', text: 'Data & Reports', icon: <IconFileSpreadsheet /> },
      { to: '/suggestions', text: 'Suggestions', icon: <IconLightbulb />, badge: pendingSuggestionsCount },
    ], [pendingUserCount, pendingSuggestionsCount, pendingActionCount]);

    const navItems = currentUser?.isAdmin ? adminNavItems : memberNavItems;

  return (
    <div className={`h-screen bg-slate-100 dark:bg-slate-800 flex flex-col border-r border-slate-200 dark:border-slate-700 fixed top-0 left-0 sidebar-print-hide transition-all duration-300 ${isCollapsed ? 'w-20 p-2' : 'w-64 p-4'}`}>
      <div className={`flex items-center mb-8 ${isCollapsed ? 'justify-center' : ''}`}>
        <div className="p-2 bg-emerald-600 rounded-lg flex-shrink-0">
          {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-6 w-6 object-contain" />
          ) : (
              <IconOliveBranch />
          )}
        </div>
        {!isCollapsed && <h1 className="text-2xl font-bold text-slate-800 dark:text-white ml-3">{settings.title}</h1>}
      </div>
      <nav className="flex-grow flex flex-col space-y-2">
        {navItems.map(item => (
          <NavItem key={item.to} {...item} isCollapsed={isCollapsed} />
        ))}
      </nav>
      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
        {currentUser && !isCollapsed && (
            <div className="px-2 py-3 mb-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{currentUser.fullName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{currentUser.role}</p>
            </div>
        )}
        <NavItem to="/profile" text="My Profile" icon={<IconUserCircle />} isCollapsed={isCollapsed}/>
        <button
            onClick={handleLogout}
            title="Logout"
            className={`flex w-full items-center py-3 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white ${isCollapsed ? 'justify-center px-3' : 'px-4'}`}
        >
            <IconLogOut />
            {!isCollapsed && <span className="ml-3">Logout</span>}
        </button>
        <div className={`flex mt-2 items-center ${isCollapsed ? 'flex-col gap-2' : 'gap-2'}`}>
           <div className={`${isCollapsed ? 'w-full' : 'flex-shrink-0'}`}>
              <ThemeToggle />
           </div>
            <button
                onClick={onToggle}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className={`flex w-full items-center py-3 text-sm font-medium rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all duration-200 ease-in-out ${isCollapsed ? 'justify-center px-3' : 'px-4'}`}
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
    </div>
  );
};
