import { useState } from 'react';

interface AdminPinModalProps {
  /** Whether a PIN has already been set for this user. */
  hasPinSet: boolean;
  onSetPin: (pin: string) => Promise<string | null>;
  onClose: () => void;
}

export function AdminPinModal({ hasPinSet, onSetPin, onClose }: AdminPinModalProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (pin.length < 4) {
      setError('PIN must be at least 4 characters.');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }

    setSaving(true);
    const err = await onSetPin(pin);
    setSaving(false);

    if (err) {
      setError(err);
    } else {
      setSuccess(true);
      setTimeout(onClose, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-slate-900 rounded-2xl border border-slate-700 shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg">
            {hasPinSet ? 'Change Admin PIN' : 'Set Admin PIN'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-5">
          {hasPinSet
            ? 'Enter a new PIN to replace the existing one.'
            : 'Set a personal PIN for your management account. The PIN is stored as a secure hash — the plaintext is never saved.'}
        </p>

        {success ? (
          <div className="bg-emerald-900/40 border border-emerald-700 rounded-lg p-3 text-emerald-300 text-sm text-center">
            ✅ PIN saved successfully!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1">
                New PIN
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN (min 4 characters)"
                autoComplete="new-password"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1">
                Confirm PIN
              </label>
              <input
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Re-enter PIN"
                autoComplete="new-password"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-500"
              />
            </div>

            {error && (
              <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-2 px-4 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
              >
                {saving ? 'Saving…' : 'Save PIN'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
