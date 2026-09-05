import { AnalysisResult, OverallAssessment, Confidence, Severity, Signal } from "@/lib/types";

interface Props {
  result: AnalysisResult;
  onReset: () => void;
}

// ─── Assessment badge config ────────────────────────────────────────────────

const ASSESSMENT_CONFIG: Record<
  OverallAssessment,
  { label: string; color: string; bg: string; border: string; icon: string }
> = {
  likely_authentic: {
    label: "Likely Authentic",
    color: "text-emerald-400",
    bg: "bg-emerald-950/40",
    border: "border-emerald-800/60",
    icon: "✓",
  },
  potentially_manipulated: {
    label: "Potentially Manipulated",
    color: "text-amber-400",
    bg: "bg-amber-950/40",
    border: "border-amber-800/60",
    icon: "⚠",
  },
  likely_synthetic: {
    label: "Likely Synthetic / AI-Generated",
    color: "text-red-400",
    bg: "bg-red-950/40",
    border: "border-red-800/60",
    icon: "⚠",
  },
  inconclusive: {
    label: "Inconclusive",
    color: "text-gray-400",
    bg: "bg-gray-900/40",
    border: "border-gray-700",
    icon: "?",
  },
};

const CONFIDENCE_COLOR: Record<Confidence, string> = {
  low: "text-gray-400",
  medium: "text-amber-400",
  high: "text-emerald-400",
};

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; label: string }> = {
  low: { color: "text-blue-400", bg: "bg-blue-950/30 border-blue-900/40", label: "Low" },
  medium: { color: "text-amber-400", bg: "bg-amber-950/30 border-amber-900/40", label: "Medium" },
  high: { color: "text-red-400", bg: "bg-red-950/30 border-red-900/40", label: "High" },
};

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
        <span className="w-4 h-px bg-gray-700" />
        {title}
        <span className="flex-1 h-px bg-gray-800" />
      </h2>
      {children}
    </section>
  );
}

// ─── Signal card ─────────────────────────────────────────────────────────────

function SignalCard({ signal }: { signal: Signal }) {
  const sev = SEVERITY_CONFIG[signal.severity];
  return (
    <div className={`rounded-xl border p-5 ${sev.bg}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-white text-sm leading-snug">{signal.title}</h3>
        <span className={`text-xs font-bold uppercase tracking-wide shrink-0 ${sev.color}`}>
          {sev.label}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div>
          <span className="text-gray-500 text-xs uppercase tracking-wide">Observation</span>
          <p className="text-gray-300 mt-0.5">{signal.observation}</p>
        </div>
        <div>
          <span className="text-gray-500 text-xs uppercase tracking-wide">Why it matters</span>
          <p className="text-gray-400 mt-0.5">{signal.explanation}</p>
        </div>
        {signal.evidence && (
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">Evidence</span>
            <p className="text-gray-400 mt-0.5 italic">{signal.evidence}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VerificationReport({ result, onReset }: Props) {
  if (!result.success) {
    return (
      <div className="rounded-2xl border border-red-900/50 bg-red-950/20 p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-lg font-bold text-red-400 mb-2">Analysis Failed</h2>
        <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">{result.error}</p>
        <button
          onClick={onReset}
          className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  const { report, filename, fileSize, mimeType, analyzedAt } = result;
  const assessment = ASSESSMENT_CONFIG[report.overallAssessment];
  const confColor = CONFIDENCE_COLOR[report.confidence];

  return (
    <div className="space-y-2">
      {/* ── Verification result header ── */}
      <div className={`rounded-2xl border p-6 sm:p-8 ${assessment.bg} ${assessment.border}`}>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
          Verification Result
        </p>

        <div className="flex flex-wrap items-start gap-4 mb-4">
          <div className={`text-3xl font-black ${assessment.color}`}>
            {assessment.icon}
          </div>
          <div>
            <h1 className={`text-2xl sm:text-3xl font-bold ${assessment.color}`}>
              {assessment.label}
            </h1>
            <p className={`text-sm mt-1 font-medium ${confColor}`}>
              Confidence: <span className="capitalize">{report.confidence}</span>
            </p>
          </div>
        </div>

        <p className="text-gray-300 leading-relaxed">{report.summary}</p>
      </div>

      {/* ── Why we think so — Signals ── */}
      {report.signals && report.signals.length > 0 && (
        <Section title="Why we think so — Observable Signals">
          <div className="space-y-3">
            {report.signals.map((signal, i) => (
              <SignalCard key={i} signal={signal} />
            ))}
          </div>
        </Section>
      )}

      {report.signals && report.signals.length === 0 && (
        <Section title="Observable Signals">
          <p className="text-gray-500 text-sm bg-gray-900/40 border border-gray-800 rounded-xl p-5">
            No specific manipulation signals were identified. This does not rule out manipulation —
            absence of signals does not confirm authenticity.
          </p>
        </Section>
      )}

      {/* ── Source context ── */}
      {report.sourceSignals && report.sourceSignals.length > 0 && (
        <Section title="Source Context">
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 divide-y divide-gray-800 overflow-hidden">
            {report.sourceSignals.map((s, i) => (
              <div key={i} className="px-5 py-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {s.type.replace(/_/g, " ")}
                </span>
                <p className="text-gray-300 text-sm mt-1">{s.observation}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Media details / metadata ── */}
      <Section title="Media Details">
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
          <div className="divide-y divide-gray-800">
            {[
              { label: "Filename", value: filename },
              {
                label: "File size",
                value: fileSize > 1024 * 1024
                  ? `${(fileSize / 1024 / 1024).toFixed(2)} MB`
                  : `${(fileSize / 1024).toFixed(1)} KB`,
              },
              { label: "Format", value: mimeType },
              { label: "Analyzed at", value: new Date(analyzedAt).toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start gap-4 px-5 py-3">
                <span className="text-gray-500 text-sm w-28 shrink-0">{label}</span>
                <span className="text-gray-300 text-sm font-mono break-all">{value}</span>
              </div>
            ))}
          </div>

          {report.metadataObservations && report.metadataObservations.length > 0 && (
            <div className="border-t border-gray-800 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                AI Metadata Observations
              </p>
              <div className="space-y-3">
                {report.metadataObservations.map((m, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 font-medium">{m.field}</span>
                      <span className="text-gray-600">·</span>
                      <span className="text-gray-300 font-mono">{m.value}</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5 ml-0">{m.significance}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ── Limitations ── */}
      {report.limitations && report.limitations.length > 0 && (
        <Section title="Limitations of this Analysis">
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
            <ul className="space-y-2">
              {report.limitations.map((l, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                  <span className="text-gray-600 mt-0.5 shrink-0">•</span>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {/* ── Recommended actions ── */}
      {report.recommendedActions && report.recommendedActions.length > 0 && (
        <Section title="What to Do Next">
          <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-5">
            <ul className="space-y-3">
              {report.recommendedActions.map((a, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                  <span className="w-5 h-5 rounded-full bg-blue-800/60 text-blue-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {/* ── Trust notice ── */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/20 p-5 mt-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          <strong className="text-gray-400">Important:</strong> This analysis is probabilistic and
          AI-assisted. It should not be treated as definitive forensic proof. Use this report as one
          input among several in a broader verification process. Consult additional sources, reverse
          image search, and domain experts where the stakes are high.
        </p>
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onReset}
          className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
        >
          Analyze another image
        </button>
        <button
          onClick={() => window.print()}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-5 py-3 rounded-xl transition-colors text-sm"
        >
          Print / Save
        </button>
      </div>
    </div>
  );
}
