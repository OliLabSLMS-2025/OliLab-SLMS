import * as React from 'react';
import { useTheme } from '../context/ThemeContext';
import { IconSun, IconMoon } from './icons';

export const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            className="flex w-full items-center justify-center p-3 text-sm font-medium rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-white transition-all duration-200 ease-in-out"
        >
            {theme === 'light' ? <IconMoon /> : <IconSun />}
            <span className="sr-only">Toggle theme</span>
        </button>
    );
};
