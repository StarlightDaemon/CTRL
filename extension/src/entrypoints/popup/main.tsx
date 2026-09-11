import React from 'react';

import ReactDOM from 'react-dom/client';
import Popup from './Popup';
import '@/app/styles/index.css';
import { Theme } from '@carbon/react';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';


ReactDOM.createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
        <Theme theme="g100">
            <Popup />
        </Theme>
    </ErrorBoundary>,
);
