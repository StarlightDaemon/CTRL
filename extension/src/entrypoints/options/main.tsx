import React, { Suspense } from 'react';

import ReactDOM from 'react-dom/client';
import App from './App';
import '../style.css';
import '@/app/styles/global.css'; // New Global CSS
import { Theme } from '@carbon/react';

const DebugOverlay = __UI_DEBUG_MODE__
    ? React.lazy(() => import('@/shared/ui/debug/DebugOverlay').then(module => ({ default: module.DebugOverlay })))
    : () => null;

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Theme theme="g100">
            <App />
            {__UI_DEBUG_MODE__ && (
                <Suspense fallback={null}>
                    <DebugOverlay root={document.body} />
                </Suspense>
            )}
        </Theme>
    </React.StrictMode>,
);
