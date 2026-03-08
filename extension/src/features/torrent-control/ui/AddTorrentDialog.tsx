import React, { useState, useEffect } from 'react';
import { ServerConfig } from '@/shared/lib/types';
import {
    Modal,
    TextInput,
    Select,
    SelectItem,
    Checkbox,
    InlineNotification,
    Form,
    Stack
} from '@carbon/react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (url: string, options: { path?: string; label?: string; paused?: boolean }) => Promise<void>;
    initialUrl?: string;
    server: ServerConfig;
    labels: string[];
}

export const AddTorrentDialog: React.FC<Props> = ({ isOpen, onClose, onAdd, initialUrl = '', server, labels }) => {
    const [url, setUrl] = useState(initialUrl);
    const [path, setPath] = useState(server.defaultDirectory || ((server.directories || []).length > 0 ? (server.directories || [])[0] : ''));
    const [label, setLabel] = useState(server.defaultLabel || '');
    const [paused, setPaused] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setUrl(initialUrl);
            setPath(server.defaultDirectory || ((server.directories || []).length > 0 ? (server.directories || [])[0] : ''));
            setLabel(server.defaultLabel || '');
            setPaused(false);
            setError(null);
        }
    }, [isOpen, initialUrl, server]);

    const handleSubmit = async () => {
        if (!url) return;

        setIsSubmitting(true);
        setError(null);
        try {
            await onAdd(url, { path, label, paused });
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to add torrent');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            open={isOpen}
            modalHeading={browser.i18n.getMessage('dialogAddTorrent')}
            primaryButtonText={isSubmitting ? browser.i18n.getMessage('dialogAdding') : browser.i18n.getMessage('dialogAddTorrent')}
            secondaryButtonText={browser.i18n.getMessage('dialogCancel')}
            onRequestClose={onClose}
            onRequestSubmit={handleSubmit}
            primaryButtonDisabled={!url || isSubmitting}
        >
            <Form>
                <Stack gap={7}>
                    <TextInput
                        id="torrent-url"
                        labelText={browser.i18n.getMessage('dialogUrlLabel')}
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="magnet:?xt=urn:btih..."
                        autoFocus
                    />

                    {(server.directories || []).length > 0 && (
                        <Select
                            id="download-path"
                            labelText={browser.i18n.getMessage('dialogPathLabel')}
                            value={path}
                            onChange={(e) => setPath(e.target.value)}
                        >
                            {(server.directories || []).map((dir, i) => (
                                <SelectItem key={i} value={dir} text={dir} />
                            ))}
                        </Select>
                    )}

                    {labels.length > 0 && (
                        <Select
                            id="torrent-label"
                            labelText={browser.i18n.getMessage('dialogLabelLabel')}
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                        >
                            <SelectItem value="" text={browser.i18n.getMessage('commonNone')} />
                            {labels.map((l, i) => (
                                <SelectItem key={i} value={l} text={l} />
                            ))}
                        </Select>
                    )}

                    <Checkbox
                        id="start-paused"
                        labelText={browser.i18n.getMessage('dialogStartPaused')}
                        checked={paused}
                        onChange={(_e, { checked }) => setPaused(checked)}
                    />

                    {error && (
                        <InlineNotification
                            kind="error"
                            title="Error"
                            subtitle={error}
                            hideCloseButton
                        />
                    )}
                </Stack>
            </Form>
        </Modal>
    );
};
