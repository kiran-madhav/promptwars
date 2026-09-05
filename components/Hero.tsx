export type MediaTab = "image" | "audio" | "video";

interface HeroProps {
  activeTab: MediaTab;
  onTabChange: (tab: MediaTab) => void;
}

const TABS: { id: MediaTab; label: string; icon: string; ready: boolean }[] = [
  { id: "image", label: "Image", icon: "🖼", ready: true },
  { id: "audio", label: "Audio", icon: "🎙", ready: false },
  { id: "video", label: "Video", icon: "🎞", ready: false },
];

export function Hero({ activeTab, onTabChange }: HeroProps) {
  return (
    <div className="pt-14 pb-8 text-center">
      {/* Pill badge */}
      <div className="inline-flex items-center gap-2 bg-blue-950/50 border border-blue-800/50 rounded-full px-4 py-1.5 text-xs text-blue-400 font-medium mb-6">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        AI-Assisted Media Verification
      </div>

      {/* Headline */}
      <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight tracking-tight">
        Before you trust it.
        <br />
        <span className="text-blue-400">Before you share it.</span>
      </h1>

      {/* Sub-copy */}
      <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto leading-relaxed mb-2">
        Upload media to receive an evidence-based assessment of potential AI generation or digital
        manipulation — for images, audio, and video.
      </p>

      {/* Feature badges */}
      <div className="flex flex-wrap justify-center gap-5 mt-6 mb-10 text-sm text-gray-500">
        {[
          { icon: "🔍", text: "Signals & Evidence" },
          { icon: "📊", text: "Structured Assessment" },
          { icon: "📋", text: "Verification Report" },
        ].map(({ icon, text }) => (
          <div key={text} className="flex items-center gap-2">
            <span>{icon}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>

      {/* ── Media-type selector ── */}
      <div
        role="tablist"
        aria-label="Select media type to analyze"
        className="inline-flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-xl p-1"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`
                relative flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold
                transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                ${isActive
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-900/50"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                }
              `}
            >
              <span aria-hidden="true">{tab.icon}</span>
              {tab.label}
              {!tab.ready && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 ml-0.5">
                  Soon
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
