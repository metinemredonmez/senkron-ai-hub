'use client';

import { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const tenant = formData.get('tenant')?.toString() ?? 'demo-tenant';
    if (typeof window !== 'undefined') {
      localStorage.setItem('tenant', tenant);
    }
    router.push('/dashboard');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-semibold text-slate-800">Sign in</h1>
        <div>
          <label className="text-sm font-medium text-slate-600">Email</label>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-600">Password</label>
          <input
            name="password"
            type="password"
            required
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-600">Tenant</label>
          <input name="tenant" defaultValue="demo-tenant" className="mt-1 w-full rounded border px-3 py-2 text-sm" />
        </div>
        <button className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white">Continue</button>
      </form>
    </div>
  );
}
