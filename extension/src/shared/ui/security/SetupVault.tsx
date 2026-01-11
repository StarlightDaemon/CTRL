import React, { useState, useEffect } from 'react';
import { Shield, Lock, AlertTriangle, Check } from 'lucide-react';
import { VaultService } from '@/shared/api/security/VaultService';

interface SetupVaultProps {
    onComplete: () => void;
}

export const SetupVault: React.FC<SetupVaultProps> = ({ onComplete }) => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [hasLegacy, setHasLegacy] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        VaultService.hasLegacyData().then(setHasLegacy);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 8) {
            setError('Password must be at least 8 characters long');
            return;
        }

        if (password !== confirm) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            if (hasLegacy) {
                await VaultService.migrateLegacyData(password);
            } else {
                await VaultService.initialize(password);
            }
            onComplete();
        } catch (err) {
            setError('Failed to setup vault. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-950 p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-8">
                <div className="flex flex-col items-center mb-6">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 text-blue-500 ring-1 ring-blue-500/20">
                        <Shield size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Secure Your Data</h1>
                    <p className="text-center text-slate-400 mt-2">
                        CTRL now uses industry-standard encryption to protect your torrent client credentials.
                    </p>
                </div>

                {hasLegacy && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6 flex items-start space-x-3">
                        <AlertTriangle className="text-amber-500 flex-shrink-0" size={20} />
                        <p className="text-sm text-amber-200">
                            We found existing server configurations. Setting a password will migrate and encrypt this data securely.
                        </p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Master Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                placeholder="Min. 8 characters"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Confirm Password</label>
                        <div className="relative">
                            <Check className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="password"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                placeholder="Repeat password"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <p className="text-sm text-red-400 text-center">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/20"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <span>{hasLegacy ? 'Encrypt & Migrate' : 'Create Vault'}</span>
                        )}
                    </button>

                    <p className="text-xs text-center text-slate-500 mt-4">
                        This password is used to generate your encryption key. It is never stored and cannot be recovered if lost.
                    </p>
                </form>
            </div>
        </div>
    );
};
