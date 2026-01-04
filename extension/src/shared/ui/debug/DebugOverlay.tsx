import React, { useEffect, useState } from 'react';


interface DebugOverlayProps {
    root: HTMLElement | ShadowRoot;
}

export const DebugOverlay: React.FC<DebugOverlayProps> = ({ root }) => {
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [componentName, setComponentName] = useState<string | null>(null);
    const [sourceInfo, setSourceInfo] = useState<string | null>(null);
    const [isLocked, setIsLocked] = useState(false);
    const [isEnabled, setIsEnabled] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                setIsLocked(prev => !prev);
            }
            // Toggle Debug Mode with Ctrl+Shift+U
            if (e.ctrlKey && e.shiftKey && (e.key === 'u' || e.key === 'U')) {
                setIsEnabled(prev => {
                    const next = !prev;
                    console.log(`UI Debug Mode: ${next ? 'ENABLED' : 'DISABLED'}`);
                    window.dispatchEvent(new CustomEvent('UI_DEBUG_STATE_CHANGE', { detail: { enabled: next } }));
                    if (!next) {
                        setTargetRect(null);
                        setComponentName(null);
                        setSourceInfo(null);
                    }
                    return next;
                });
            }
        };

        const handleToggleEvent = () => {
            setIsEnabled(prev => {
                const next = !prev;
                console.log(`UI Debug Mode: ${next ? 'ENABLED' : 'DISABLED'}`);
                window.dispatchEvent(new CustomEvent('UI_DEBUG_STATE_CHANGE', { detail: { enabled: next } }));
                if (!next) {
                    setTargetRect(null);
                    setComponentName(null);
                    setSourceInfo(null);
                }
                return next;
            });
        };

        const handleGetStateEvent = () => {
            window.dispatchEvent(new CustomEvent('UI_DEBUG_STATE_CHANGE', { detail: { enabled: isEnabled } }));
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('TOGGLE_UI_DEBUG', handleToggleEvent);
        window.addEventListener('GET_UI_DEBUG_STATE', handleGetStateEvent);

        // Broadcast initial state
        window.dispatchEvent(new CustomEvent('UI_DEBUG_STATE_CHANGE', { detail: { enabled: isEnabled } }));

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('TOGGLE_UI_DEBUG', handleToggleEvent);
            window.removeEventListener('GET_UI_DEBUG_STATE', handleGetStateEvent);
        };
    }, [isEnabled]);

    useEffect(() => {
        if (isEnabled) {
            const handleMouseMove = (e: Event) => {
                if (isLocked) return;

                const target = e.target as HTMLElement;
                // Find closest component - prioritize debug-id
                const component = target.closest('[data-debug-id]') ||
                    target.closest('[data-component]') ||
                    target.closest('[data-inspector-line]');

                if (component) {
                    setTargetRect(component.getBoundingClientRect());

                    // Prioritize data-debug-id
                    const debugId = component.getAttribute('data-debug-id');
                    const dataComponent = component.getAttribute('data-component');
                    const tagName = component.tagName.toLowerCase();

                    setComponentName(debugId || dataComponent || tagName);

                    // Extract source info if available
                    const relativePath = component.getAttribute('data-inspector-relative-path');
                    const line = component.getAttribute('data-inspector-line');

                    if (relativePath && line) {
                        setSourceInfo(`${relativePath}:${line}`);
                    } else {
                        setSourceInfo(null);
                    }
                } else {
                    setTargetRect(null);
                    setComponentName(null);
                    setSourceInfo(null);
                }
            };

            root.addEventListener('mousemove', handleMouseMove);
            return () => root.removeEventListener('mousemove', handleMouseMove);
        }
    }, [root, isEnabled, isLocked]);

    if (!isEnabled) return null;

    return (
        <>
            <div className="fixed bottom-4 right-4 z-50 px-2 py-1 bg-pink-500 text-white text-xs font-bold rounded pointer-events-none opacity-50">
                DEBUG MODE ACTIVE
            </div>

            {targetRect && componentName && (
                <>
                    <div
                        style={{
                            position: 'fixed',
                            top: targetRect.top,
                            left: targetRect.left,
                            width: targetRect.width,
                            height: targetRect.height,
                            border: '2px solid magenta',
                            pointerEvents: 'none',
                            zIndex: 9999,
                        }}
                    />
                    <div
                        style={{
                            position: 'fixed',
                            top: targetRect.top - 28,
                            left: targetRect.left,
                            backgroundColor: 'magenta',
                            color: 'white',
                            padding: '2px 6px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            zIndex: 9999,
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        <div className="flex flex-col">
                            <span>{componentName} {isLocked ? '(LOCKED)' : ''}</span>
                            {sourceInfo && <span className="font-mono opacity-90 font-normal">{sourceInfo}</span>}
                        </div>
                    </div>
                </>
            )}
        </>
    );
};
