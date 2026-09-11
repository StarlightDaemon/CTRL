import React from 'react';
import { MainLayout } from '@/shared/ui/layout/MainLayout';
import { Dashboard } from '../../features/torrent-control/ui/Dashboard';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

const Popup = () => {
    return (
        <ErrorBoundary>
            <MainLayout>
                <div className="flex-1 overflow-hidden">
                    <Dashboard />
                </div>
            </MainLayout>
        </ErrorBoundary>
    );
};

export default Popup;
