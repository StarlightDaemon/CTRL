import { useCallback, useEffect, useRef, useState } from 'react';
import { checkHostPermission, requestHostPermission } from '@/shared/lib/permissions';

export type HostPermissionStatus =
    /** No usable address yet. */
    | 'idle'
    | 'checking'
    | 'granted'
    | 'missing';

/**
 * Tracks whether the optional host permission for an origin is granted.
 *
 * Re-checks whenever the origin changes and whenever the browser reports a
 * permission being added or removed (for example the user revoking site
 * access from the browser's extension settings while the form is open), so
 * the form never claims access it no longer has.
 */
export function useHostPermission(origin: string | null) {
    const [status, setStatus] = useState<HostPermissionStatus>('idle');
    const seq = useRef(0);

    const check = useCallback(async () => {
        const id = ++seq.current;
        if (!origin) {
            setStatus('idle');
            return;
        }
        setStatus('checking');
        const granted = await checkHostPermission(origin);
        if (id !== seq.current) return; // a newer check superseded this one
        setStatus(granted ? 'granted' : 'missing');
    }, [origin]);

    useEffect(() => {
        void check();
    }, [check]);

    useEffect(() => {
        const onChange = () => { void check(); };
        const added = chrome.permissions?.onAdded;
        const removed = chrome.permissions?.onRemoved;
        added?.addListener(onChange);
        removed?.addListener(onChange);
        return () => {
            added?.removeListener(onChange);
            removed?.removeListener(onChange);
        };
    }, [check]);

    /**
     * Asks the browser for the permission. Must be called synchronously from
     * a user gesture (a click handler); Firefox rejects the request otherwise.
     */
    const request = useCallback((): Promise<boolean> => {
        if (!origin) return Promise.resolve(false);
        return requestHostPermission(origin).then((granted) => {
            setStatus(granted ? 'granted' : 'missing');
            return granted;
        });
    }, [origin]);

    return { status, check, request };
}
