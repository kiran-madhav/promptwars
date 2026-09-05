export function LoadingState() {
  const steps = [
    "Extracting image features…",
    "Scanning for manipulation signals…",
    "Assessing AI generation patterns…",
    "Compiling verification report…",
  ];

  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-600/30 mb-6">
        <svg
          className="w-8 h-8 text-blue-400 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12" cy="12" r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>

      <h2 className="text-xl font-bold text-white mb-2">Analyzing image…</h2>
      <p className="text-gray-400 text-sm mb-8">
        Gemini AI is examining this image for authenticity signals.
      </p>

      <div className="max-w-xs mx-auto space-y-3">
        {steps.map((step, i) => (
          <div
            key={step}
            className="flex items-center gap-3 text-sm text-gray-500"
            style={{ animationDelay: `${i * 0.6}s` }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
