type MediaType = "audio" | "video";

const CONFIG: Record<
  MediaType,
  { icon: string; label: string; description: string; formats: string }
> = {
  audio: {
    icon: "🎙",
    label: "Audio Analysis",
    description:
      "Detection of AI-synthesized speech, voice cloning, and audio deepfakes — including analysis of unnatural prosody, spectral artifacts, and discontinuities.",
    formats: "MP3, WAV, AAC, FLAC, OGG",
  },
  video: {
    icon: "🎞",
    label: "Video Analysis",
    description:
      "Frame-level inspection for face-swap artifacts, temporal inconsistencies, blending boundaries, and signs of generative video synthesis.",
    formats: "MP4, MOV, WebM, AVI",
  },
};

interface ComingSoonProps {
  mediaType: MediaType;
}

export function ComingSoon({ mediaType }: ComingSoonProps) {
  const cfg = CONFIG[mediaType];

  return (
    <div className="mt-8 rounded-2xl border border-gray-700/60 bg-gray-900/50 p-8 sm:p-10 text-center">
      {/* Icon */}
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 text-3xl mb-6">
        {cfg.icon}
      </div>

      {/* Badge */}
      <div className="inline-flex items-center gap-1.5 bg-blue-950/60 border border-blue-800/40 rounded-full px-3 py-1 text-xs text-blue-400 font-semibold uppercase tracking-wider mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
        Coming next
      </div>

      <h2 className="text-xl font-bold text-white mb-3">{cfg.label}</h2>

      <p className="text-gray-400 text-sm leading-relaxed max-w-md mx-auto mb-6">
        {cfg.description}
      </p>

      {/* Divider */}
      <div className="border-t border-gray-800 my-6 max-w-xs mx-auto" />

      <p className="text-xs text-gray-500 mb-1">
        <span className="text-gray-400 font-medium">Currently optimized for:</span> Image verification
      </p>
      <p className="text-xs text-gray-600">
        Planned support for: {cfg.formats}
      </p>

      <p className="mt-6 text-xs text-gray-600 max-w-xs mx-auto leading-relaxed">
        Switch to the <span className="text-gray-400 font-medium">Image</span> tab to analyze photos,
        screenshots, or illustrations with the full verification pipeline.
      </p>
    </div>
  );
}
