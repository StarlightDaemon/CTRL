import React, { Suspense } from 'react';

import ReactDOM from 'react-dom/client';
import Popup from './Popup';
import '../style.css';
import '@/app/styles/global.css'; // New Global CSS
import { Theme } from '@carbon/react';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

const DebugOverlay = __UI_DEBUG_MODE__
    ? React.lazy(() => import('@/shared/ui/debug/DebugOverlay').then(module => ({ default: module.DebugOverlay })))
    : () => null;

ReactDOM.createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
        <Theme theme="g100">
            <Popup />
            {__UI_DEBUG_MODE__ && (
                <Suspense fallback={null}>
                    <DebugOverlay root={document.body} />
                </Suspense>
            )}
        </Theme>
    </ErrorBoundary>,
);
