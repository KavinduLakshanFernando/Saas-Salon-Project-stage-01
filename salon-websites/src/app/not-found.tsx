import React from 'react';
import Link from 'next/link';
import { Store, AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60">
          <Store className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Salon Website Not Available</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            The salon website you are trying to visit does not exist, has expired, or is currently inactive.
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-600 text-left flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span>
            If you are the salon owner, please ensure your subscription includes the Website feature and your website is published in your admin portal.
          </span>
        </div>

        <Link
          href="/"
          className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 transition-colors"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}

