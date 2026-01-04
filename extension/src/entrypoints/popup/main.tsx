import React, { Suspense } from 'react';
console.log('Popup: Script loaded');
import ReactDOM from 'react-dom/client';
import Popup from './Popup';
import '../style.css';
import '@/app/styles/global.css'; // New Global CSS
import { PrismThemeProvider } from '@/app/providers/ThemeProvider';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

const DebugOverlay = __UI_DEBUG_MODE__
    ? React.lazy(() => import('@/shared/ui/debug/DebugOverlay').then(module => ({ default: module.DebugOverlay })))
    : () => null;

ReactDOM.createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
        <PrismThemeProvider>
            <Popup />
            {__UI_DEBUG_MODE__ && (
                <Suspense fallback={null}>
                    <DebugOverlay root={document.body} />
                </Suspense>
            )}
        </PrismThemeProvider>
    </ErrorBoundary>,
);
