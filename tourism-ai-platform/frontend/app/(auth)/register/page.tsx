export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 text-center shadow">
        <h1 className="text-xl font-semibold text-slate-800">Contact Sales</h1>
        <p className="text-sm text-slate-600">
          Multi-tenant onboarding is handled by the platform operations team to ensure KVKK/GDPR compliance.
        </p>
        <a href="mailto:ops@health-tourism.example" className="text-sm font-medium text-emerald-600">
          ops@health-tourism.example
        </a>
      </div>
    </div>
  );
}
