import React from 'react';

import ReactDOM from 'react-dom/client';
import App from './App';
import '@/app/styles/index.css';
import { Theme } from '@carbon/react';


ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Theme theme="g100">
            <App />
        </Theme>
    </React.StrictMode>,
);
