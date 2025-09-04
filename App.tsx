import * as React from 'react';
// FIX: Updated react-router-dom imports for v5 compatibility. Replaced v6 components.
import { HashRouter, Switch, Route, Redirect } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { BorrowLog } from './pages/BorrowLog';
import { Users } from './pages/Users';
import { DataReports } from './pages/DataReports';
import { InventoryProvider } from './context/InventoryContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/Login';
import { Search } from './pages/Search';
import { MyBorrows } from './pages/MyBorrows';
import { Profile } from './pages/Profile';
import { SignUpPage } from './pages/SignUp';
import { Suggestions } from './pages/Suggestions';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { ThemeProvider } from './context/ThemeContext';

const DynamicTitle = () => {
    const { settings } = useSettings();
    React.useEffect(() => {
        if (settings.title) {
            document.title = `${settings.title} - Science Laboratory Management`;
        }
    }, [settings.title]);
    return null; // This component does not render anything
};

// FIX: Modified MainLayout to accept and render children for v5 routing.
const MainLayout: React.FC = ({ children }) => {
  const [isSidebarCollapsed, setSidebarCollapsed] = React.useState(window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    };

    window.addEventListener('resize', handleResize);
    // Call handler right away in case the initial state is wrong
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return (
    <div className="flex">
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={() => setSidebarCollapsed(prev => !prev)} />
      <main className={`flex-1 min-h-screen main-content-print bg-slate-100 dark:bg-slate-900 transition-all duration-300 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
          {children}
      </main>
    </div>
  );
};

// FIX: A component to handle routing logic, compatible with v5.
const AppRoutes: React.FC = () => {
  const { isAuthenticated, currentUser } = useAuth();

  // Unauthenticated users only see login/signup pages.
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/signup" component={SignUpPage} />
        <Redirect to="/login" />
      </Switch>
    );
  }

  // Authenticated users see the main layout and protected routes.
  return (
    <MainLayout>
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/search" component={Search} />
        <Route path="/profile" component={Profile} />
        <Route path="/my-borrows" component={MyBorrows} />
        <Route path="/suggestions" component={Suggestions} />
        
        {/* Admin Routes */}
        <Route path="/log" render={() => currentUser?.isAdmin ? <BorrowLog /> : <Redirect to="/dashboard" />} />
        <Route path="/users" render={() => currentUser?.isAdmin ? <Users /> : <Redirect to="/dashboard" />} />
        <Route path="/reports" render={() => currentUser?.isAdmin ? <DataReports /> : <Redirect to="/dashboard" />} />
        
        <Redirect from="/" to="/dashboard" exact />
        <Route path="*" render={() => <Redirect to="/dashboard" />} />
      </Switch>
    </MainLayout>
  );
};

const App: React.FC = () => {
  return (
    <SettingsProvider>
      <ThemeProvider>
        <InventoryProvider>
          <AuthProvider>
            <HashRouter>
              <DynamicTitle />
              <AppRoutes />
            </HashRouter>
          </AuthProvider>
        </InventoryProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
};

export default App;
