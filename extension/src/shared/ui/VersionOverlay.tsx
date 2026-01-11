import React from 'react';
import { BUILD_INFO } from '@/shared/lib/buildInfo';

export const VersionOverlay = () => {
    const copyBuildInfo = () => {
        const buildInfo = `Build: v${BUILD_INFO.version} // ${BUILD_INFO.displayDate}`;
        navigator.clipboard.writeText(buildInfo);
    };

    return (
        <div
            onClick={copyBuildInfo}
            className="fixed bottom-4 right-4 z-50 px-3 py-1 bg-black/80 backdrop-blur text-white text-xs rounded-full border border-white/10 shadow-lg select-none font-mono opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
            title="Click to copy build version"
        >
            <span className="text-gray-400">Build: v</span>{BUILD_INFO.version} <span className="text-gray-500">//</span> {BUILD_INFO.displayDate}
        </div>
    );
};
