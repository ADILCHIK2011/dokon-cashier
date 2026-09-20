import { useState } from 'react';
import { changePassword } from '../api/auth.api';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { useAuth } from '../auth/AuthContext';

export function SettingsPage() {
  const { user } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    const form = new FormData(e.target);
    const currentPassword = form.get('currentPassword');
    const newPassword = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');

    if (newPassword !== confirmPassword) {
      setError("Yangi parollar mos emas");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
      e.target.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Sozlamalar" subtitle="Hisob maʼlumotlari" />

      <div className="max-w-sm rounded-box border border-base-300 bg-base-100 p-6">
        <h2 className="mb-1 font-heading text-base font-semibold">Parolni almashtirish</h2>
        <p className="mb-4 text-sm text-base-content/50">{user?.name} sifatida tizimga kirgansiz</p>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm text-base-content/60">Joriy parol</span>
            <input className="input input-bordered w-full" name="currentPassword" type="password" required />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-base-content/60">Yangi parol</span>
            <input className="input input-bordered w-full" name="newPassword" type="password" required minLength={4} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-base-content/60">Yangi parolni tasdiqlang</span>
            <input className="input input-bordered w-full" name="confirmPassword" type="password" required minLength={4} />
          </label>

          {error && <p className="text-sm text-error">{error}</p>}
          {success && <p className="text-sm text-success">Parol muvaffaqiyatli yangilandi</p>}

          <Button type="submit" disabled={submitting} className="mt-1">
            {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
          </Button>
        </form>
      </div>
    </div>
  );
}
