import Link from "next/link";

export default function LogoutConfirmationPage() {
  return (
    <section className="min-h-screen bg-gradient-to-b from-slate-50 to-emerald-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-xl p-8 text-center border border-slate-100">
        <h1 className="text-3xl font-semibold text-slate-900">Logged Out</h1>
        <p className="text-slate-600 mt-3">
          Your session has ended successfully. You can log back in anytime.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="px-6 py-3 rounded-xl bg-[#059669] text-white font-medium hover:bg-[#047857] transition"
          >
            Go to Login
          </Link>
          <Link
            href="/"
            className="px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </section>
  );
}
