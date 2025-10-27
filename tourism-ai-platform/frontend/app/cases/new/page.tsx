'use client';

import { FormEvent, useState } from 'react';
import { Sidebar } from '../../../components/sidebar';

interface IntakeFormData {
  patientName: string;
  procedure: string;
  budget: string;
  travelFrom: string;
  notes: string;
}

const steps = ['Patient', 'Treatment', 'Logistics'];

export default function IntakeWizardPage() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<IntakeFormData>({
    patientName: '',
    procedure: '',
    budget: '',
    travelFrom: '',
    notes: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const updateField = (field: keyof IntakeFormData) => (value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const onNext = () => setStep((current) => Math.min(current + 1, steps.length - 1));
  const onPrev = () => setStep((current) => Math.max(current - 1, 0));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <h1 className="text-2xl font-semibold text-slate-800">Intake Wizard</h1>
        <p className="mt-2 text-sm text-slate-600">
          Collect patient, clinical, and travel preferences before triggering the AI orchestrator.
        </p>
        <div className="mt-6 flex gap-4">
          {steps.map((label, index) => (
            <div key={label} className={`flex-1 rounded-full border px-3 py-1 text-center text-xs ${
              index === step ? 'border-emerald-500 bg-emerald-100 text-emerald-700' : 'border-slate-200 text-slate-500'
            }`}>
              {label}
            </div>
          ))}
        </div>

        {submitted ? (
          <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-emerald-700">Intake submitted</h2>
            <p className="mt-2 text-sm text-slate-600">
              Case will be created for {data.patientName} targeting {data.procedure}. The orchestrator will route through
              eligibility and pricing with a non-diagnostic disclaimer.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-6">
            {step === 0 && (
              <section className="rounded-lg border bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-800">Patient</h2>
                <label className="mt-4 block text-sm font-medium text-slate-600">
                  Name
                  <input
                    required
                    value={data.patientName}
                    onChange={(event) => updateField('patientName')(event.target.value)}
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  />
                </label>
                <label className="mt-4 block text-sm font-medium text-slate-600">
                  Notes
                  <textarea
                    value={data.notes}
                    onChange={(event) => updateField('notes')(event.target.value)}
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  />
                </label>
              </section>
            )}

            {step === 1 && (
              <section className="rounded-lg border bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-800">Treatment</h2>
                <label className="mt-4 block text-sm font-medium text-slate-600">
                  Target procedure
                  <input
                    required
                    value={data.procedure}
                    onChange={(event) => updateField('procedure')(event.target.value)}
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  />
                </label>
                <label className="mt-4 block text-sm font-medium text-slate-600">
                  Budget (EUR)
                  <input
                    value={data.budget}
                    onChange={(event) => updateField('budget')(event.target.value)}
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  />
                </label>
              </section>
            )}

            {step === 2 && (
              <section className="rounded-lg border bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-800">Logistics</h2>
                <label className="mt-4 block text-sm font-medium text-slate-600">
                  Departure city
                  <input
                    value={data.travelFrom}
                    onChange={(event) => updateField('travelFrom')(event.target.value)}
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  />
                </label>
                <p className="mt-4 text-xs text-slate-500">
                  Documents will be uploaded via secure presigned URLs; orchestrator will trigger visa checklist automatically.
                </p>
              </section>
            )}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={onPrev}
                disabled={step === 0}
                className="rounded-md border px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                Back
              </button>
              {step < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={onNext}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Next
                </button>
              ) : (
                <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
                  Submit
                </button>
              )}
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
