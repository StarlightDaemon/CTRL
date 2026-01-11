import React, { Suspense } from 'react';
console.log('Options: Script loaded');
import ReactDOM from 'react-dom/client';
import App from './App';
import '../style.css';
import '@/app/styles/global.css'; // New Global CSS
import { PrismThemeProvider } from '@/app/providers/ThemeProvider';

const DebugOverlay = __UI_DEBUG_MODE__
    ? React.lazy(() => import('@/shared/ui/debug/DebugOverlay').then(module => ({ default: module.DebugOverlay })))
    : () => null;

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <PrismThemeProvider>
            <App />
            {__UI_DEBUG_MODE__ && (
                <Suspense fallback={null}>
                    <DebugOverlay root={document.body} />
                </Suspense>
            )}
        </PrismThemeProvider>
    </React.StrictMode>,
);
