import { useMemo } from 'react';

export const useDebugId = (page: string, section: string, element: string) => {
    const debugId = `${page}:${section}:${element}`;

    // Return attributes to spread onto the component
    return useMemo(() => ({
        'data-debug-id': debugId,
        'data-component': element // Fallback/Legacy support
    }), [debugId, element]);
};
