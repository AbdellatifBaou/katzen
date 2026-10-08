'use client';

import React from 'react';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      <div className="text-center space-y-2">
        <div className="text-4xl">🐱</div>
        <h2 className="text-lg font-bold">Etwas ist schiefgelaufen</h2>
        <button
          onClick={() => reset()}
          className="inline-block mt-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}
