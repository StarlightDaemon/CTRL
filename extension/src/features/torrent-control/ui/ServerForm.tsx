import React, { useMemo, useRef, useState } from 'react';
import {
    Button,
    Form,
    FormGroup,
    InlineNotification,
    PasswordInput,
    Select,
    SelectItem,
    Stack,
    TextInput,
} from '@carbon/react';
import type { ServerConfig } from '@/shared/lib/types';
import { PUBLIC_CLIENT_LIST, getClientCapability, isPublicClient } from '@/shared/lib/constants';
import type { TestConnectionRequest, TestConnectionResponse } from '@/shared/api/messaging/protocol';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import {
    addressPlaceholder,
    analyzeAddress,
    emptyServerForm,
    formToServer,
    serverToForm,
    validateServerForm,
    type ServerFormField,
    type ServerFormValues,
} from '../model/serverForm';
import { useHostPermission } from '../model/useHostPermission';

interface Props {
    /** Existing configuration to edit, or null to create a new one. */
    server: ServerConfig | null;
    onSave: (server: ServerConfig) => Promise<void>;
    onCancel: () => void;
}

type TestState =
    | { kind: 'idle' }
    | { kind: 'testing' }
    | { kind: 'ok' }
    | { kind: 'failed'; message: string };

/** Stable element ids: used by tests and by label association. */
export const SERVER_FORM_IDS = {
    name: 'server-name',
    client: 'server-client',
    address: 'server-address',
    username: 'server-username',
    password: 'server-password',
    credentialDisclosure: 'server-credential-disclosure',
    httpWarning: 'server-http-warning',
} as const;

export const CREDENTIAL_DISCLOSURE =
    'CTRL encrypts this username and password before storing them in this browser. ' +
    'They are sent only to the server address above, to sign in to that torrent client. ' +
    'CTRL never sends them to the CTRL developer or to anyone else.';

export const HTTP_WARNING_TITLE = 'Unencrypted connection';
export const HTTP_WARNING_TEXT =
    'This address uses http://, so the username, password and every command CTRL sends can be read or altered ' +
    'by anyone on the network path between this browser and the server. Use https:// if the client or a reverse proxy offers it.';

/**
 * Add / edit form for one server.
 *
 * Every control is a Carbon input with a real label; the address is one
 * complete URL; results and warnings are live regions so keyboard and
 * screen-reader users get the same information as everyone else.
 */
export const ServerForm: React.FC<Props> = ({ server, onSave, onCancel }) => {
    const [values, setValues] = useState<ServerFormValues>(() => (server ? serverToForm(server) : emptyServerForm()));
    const [touched, setTouched] = useState<Partial<Record<ServerFormField, boolean>>>({});
    const [submitted, setSubmitted] = useState(false);
    const [test, setTest] = useState<TestState>({ kind: 'idle' });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const nameRef = useRef<HTMLInputElement>(null);
    const clientRef = useRef<HTMLSelectElement>(null);
    const addressRef = useRef<HTMLInputElement>(null);

    const errors = useMemo(() => validateServerForm(values), [values]);
    const address = useMemo(() => analyzeAddress(values.address), [values.address]);
    const permission = useHostPermission(address.ok ? address.origin : null);
    const isValid = Object.keys(errors).length === 0;

    const visibleError = (field: ServerFormField): string | undefined =>
        touched[field] || submitted ? errors[field] : undefined;

    const update = <K extends ServerFormField>(field: K, value: ServerFormValues[K]) => {
        setValues((prev) => ({ ...prev, [field]: value }));
        // Any change to what is sent invalidates the last test result.
        if (test.kind !== 'idle' && test.kind !== 'testing') setTest({ kind: 'idle' });
        if (saveError) setSaveError(null);
    };

    const touch = (field: ServerFormField) => setTouched((prev) => ({ ...prev, [field]: true }));

    const focusFirstInvalid = () => {
        if (errors.name) nameRef.current?.focus();
        else if (errors.clientId) clientRef.current?.focus();
        else if (errors.address) addressRef.current?.focus();
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSubmitted(true);
        if (!isValid) {
            focusFirstInvalid();
            return;
        }
        setSaving(true);
        setSaveError(null);
        try {
            await onSave(formToServer(values, server));
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'The server could not be saved.');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setSubmitted(true);
        if (!isValid) {
            focusFirstInvalid();
            return;
        }
        if (permission.status !== 'granted') {
            setTest({ kind: 'failed', message: `Grant CTRL access to ${address.origin} before testing the connection.` });
            return;
        }
        setTest({ kind: 'testing' });
        try {
            const request: TestConnectionRequest = { type: 'TEST_CONNECTION', config: formToServer(values, server) };
            const response = (await chrome.runtime.sendMessage(request)) as TestConnectionResponse | undefined;
            if (response && response.connected) {
                setTest({ kind: 'ok' });
            } else {
                setTest({ kind: 'failed', message: response?.error || 'The server did not respond as expected.' });
            }
        } catch (error) {
            setTest({ kind: 'failed', message: error instanceof Error ? error.message : 'The connection test failed.' });
        }
    };

    const clientName = getClientCapability(values.clientId)?.name ?? values.clientId;
    const hiddenClient = !isPublicClient(values.clientId) ? getClientCapability(values.clientId) : undefined;

    return (
        <SettingsCard title={server ? `Edit ${server.name || 'server'}` : 'New server'}>
            <Form onSubmit={handleSubmit} aria-label={server ? 'Edit server' : 'Add server'} noValidate>
                <Stack gap={6}>
                    <TextInput
                        id={SERVER_FORM_IDS.name}
                        ref={nameRef}
                        labelText="Server name"
                        helperText="How this server is listed in CTRL."
                        value={values.name}
                        onChange={(e) => update('name', e.target.value)}
                        onBlur={() => touch('name')}
                        invalid={!!visibleError('name')}
                        invalidText={visibleError('name')}
                        autoComplete="off"
                        maxLength={128}
                    />

                    <Select
                        id={SERVER_FORM_IDS.client}
                        ref={clientRef}
                        labelText="BitTorrent client"
                        helperText="The program CTRL sends links to and reads the queue from."
                        value={values.clientId}
                        onChange={(e) => update('clientId', e.target.value)}
                        invalid={!!visibleError('clientId')}
                        invalidText={visibleError('clientId')}
                    >
                        {PUBLIC_CLIENT_LIST.map((client) => (
                            <SelectItem key={client.id} value={client.id} text={client.name} />
                        ))}
                        {/* An existing configuration of a hidden client keeps its type;
                            hidden clients are not offered for new configurations. */}
                        {hiddenClient && (
                            <SelectItem value={hiddenClient.id} text={`${hiddenClient.name} (experimental, not verified)`} />
                        )}
                    </Select>

                    <TextInput
                        id={SERVER_FORM_IDS.address}
                        ref={addressRef}
                        labelText="Server address"
                        helperText={`The full address of the ${clientName} web interface, including https:// or http://, the port, and any path behind a reverse proxy. Example: ${addressPlaceholder(values.clientId)}`}
                        placeholder={addressPlaceholder(values.clientId)}
                        value={values.address}
                        onChange={(e) => update('address', e.target.value)}
                        onBlur={() => touch('address')}
                        invalid={!!visibleError('address')}
                        invalidText={visibleError('address')}
                        autoComplete="off"
                        spellCheck={false}
                        inputMode="url"
                    />

                    {address.ok && address.plainHttpRemote && (
                        <InlineNotification
                            id={SERVER_FORM_IDS.httpWarning}
                            kind="warning"
                            title={HTTP_WARNING_TITLE}
                            subtitle={HTTP_WARNING_TEXT}
                            lowContrast
                            hideCloseButton
                            role="status"
                            aria-live="polite"
                        />
                    )}

                    {address.ok && permission.status === 'missing' && (
                        <div>
                            <InlineNotification
                                kind="warning"
                                title="Access not granted"
                                subtitle={`CTRL needs your permission to contact ${address.origin}. Without it the server can be saved but not reached. The browser will ask you to confirm.`}
                                lowContrast
                                hideCloseButton
                                role="status"
                                aria-live="polite"
                            />
                            <div className="mt-2">
                                <Button kind="tertiary" size="sm" onClick={() => { void permission.request(); }}>
                                    Grant access to {address.origin}
                                </Button>
                            </div>
                        </div>
                    )}
                    {address.ok && permission.status === 'granted' && (
                        <p className="text-sm text-[var(--cds-text-secondary)]" role="status">
                            CTRL may contact {address.origin}.
                        </p>
                    )}

                    <FormGroup legendText="Login">
                        <Stack gap={5}>
                            <TextInput
                                id={SERVER_FORM_IDS.username}
                                labelText="Username"
                                value={values.username}
                                onChange={(e) => update('username', e.target.value)}
                                autoComplete="off"
                                aria-describedby={SERVER_FORM_IDS.credentialDisclosure}
                            />
                            <PasswordInput
                                id={SERVER_FORM_IDS.password}
                                labelText="Password"
                                value={values.password}
                                onChange={(e) => update('password', e.target.value)}
                                autoComplete="off"
                                showPasswordLabel="Show password"
                                hidePasswordLabel="Hide password"
                                aria-describedby={SERVER_FORM_IDS.credentialDisclosure}
                            />
                            <p id={SERVER_FORM_IDS.credentialDisclosure} className="text-sm text-[var(--cds-text-secondary)]">
                                {CREDENTIAL_DISCLOSURE}
                            </p>
                        </Stack>
                    </FormGroup>

                    {test.kind === 'ok' && (
                        <InlineNotification
                            kind="success"
                            title="Connection successful"
                            subtitle={`${clientName} answered at ${address.origin}.`}
                            lowContrast
                            hideCloseButton
                            role="status"
                        />
                    )}
                    {test.kind === 'failed' && (
                        <InlineNotification
                            kind="error"
                            title="Connection failed"
                            subtitle={test.message}
                            lowContrast
                            hideCloseButton
                            role="alert"
                        />
                    )}
                    {saveError && (
                        <InlineNotification
                            kind="error"
                            title="Not saved"
                            subtitle={saveError}
                            lowContrast
                            hideCloseButton
                            role="alert"
                        />
                    )}

                    <div className="flex flex-wrap gap-2">
                        <Button type="submit" disabled={saving}>
                            {saving ? 'Saving…' : 'Save server'}
                        </Button>
                        <Button kind="secondary" onClick={() => { void handleTest(); }} disabled={test.kind === 'testing' || saving}>
                            {test.kind === 'testing' ? 'Testing…' : 'Test connection'}
                        </Button>
                        <Button kind="ghost" onClick={onCancel} disabled={saving}>
                            Cancel
                        </Button>
                    </div>
                </Stack>
            </Form>
        </SettingsCard>
    );
};
