import React, { useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { VaultService } from '@/shared/api/security/VaultService';

interface UnlockVaultProps {
    onUnlock: () => void;
}

export const UnlockVault: React.FC<UnlockVaultProps> = ({ onUnlock }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const success = await VaultService.unlock(password);
            if (success) {
                onUnlock();
            } else {
                setError('Incorrect password');
            }
        } catch (err) {
            setError('An error occurred');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-950 p-4">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-8">
                <div className="flex flex-col items-center mb-6">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 text-blue-500 ring-1 ring-blue-500/20">
                        <Lock size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Unlock CTRL</h1>
                    <p className="text-center text-slate-400 mt-2">
                        Enter your master password to access your torrent clients.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 text-center bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            placeholder="Master Password"
                            required
                            autoFocus
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-red-400 text-center font-medium">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/20"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Unlock size={18} />
                                <span>Unlock</span>
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};
