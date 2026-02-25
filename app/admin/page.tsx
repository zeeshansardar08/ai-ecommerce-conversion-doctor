"use client";

import { useEffect, useState } from "react";

type FeatureRequest = {
  id: string;
  created_at: string;
  type: string;
  email: string;
  store_url: string | null;
  report_id: string | null;
};

type OptimizationRequest = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  store_url: string | null;
  monthly_traffic: string;
  revenue_range: string | null;
  report_id: string | null;
};

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [featureRequests, setFeatureRequests] = useState<FeatureRequest[]>([]);
  const [optimizationRequests, setOptimizationRequests] = useState<
    OptimizationRequest[]
  >([]);

  const loadData = async () => {
    const response = await fetch("/api/admin/data");
    if (!response.ok) {
      throw new Error("Unauthorized");
    }
    const payload = await response.json();
    setFeatureRequests(payload.featureRequests || []);
    setOptimizationRequests(payload.optimizationRequests || []);
  };

  useEffect(() => {
    loadData()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Invalid password");
      }
      await loadData();
      setAuthed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-16">
          <h1 className="text-2xl font-semibold">Admin Access</h1>
          <p className="text-sm text-foreground/60">
            Enter the admin password to view leads.
          </p>
          <form onSubmit={submitPassword} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-base outline-none transition focus:border-accent"
              required
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Checking..." : "Unlock"}
            </button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Admin Leads</h1>
          <p className="text-sm text-foreground/60">
            Newest requests appear first.
          </p>
        </header>

        <section className="rounded-3xl border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Optimization Requests</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-foreground/60">
                <tr>
                  <th className="py-2">Name</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Store URL</th>
                  <th className="py-2">Traffic</th>
                  <th className="py-2">Revenue</th>
                  <th className="py-2">Created</th>
                  <th className="py-2">Report</th>
                </tr>
              </thead>
              <tbody>
                {optimizationRequests.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="py-3 font-semibold">{row.name}</td>
                    <td className="py-3">{row.email}</td>
                    <td className="py-3">{row.store_url || "-"}</td>
                    <td className="py-3">{row.monthly_traffic}</td>
                    <td className="py-3">{row.revenue_range || "-"}</td>
                    <td className="py-3">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="py-3">
                      {row.report_id ? (
                        <a
                          href={`/audit/${row.report_id}`}
                          className="text-accent"
                        >
                          View
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Feature Requests</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-foreground/60">
                <tr>
                  <th className="py-2">Type</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Store URL</th>
                  <th className="py-2">Created</th>
                  <th className="py-2">Report</th>
                </tr>
              </thead>
              <tbody>
                {featureRequests.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="py-3 font-semibold">{row.type}</td>
                    <td className="py-3">{row.email}</td>
                    <td className="py-3">{row.store_url || "-"}</td>
                    <td className="py-3">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="py-3">
                      {row.report_id ? (
                        <a
                          href={`/audit/${row.report_id}`}
                          className="text-accent"
                        >
                          View
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
