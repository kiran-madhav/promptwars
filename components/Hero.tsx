export function Hero() {
  return (
    <div className="pt-16 pb-10 text-center">
      <div className="inline-flex items-center gap-2 bg-blue-950/50 border border-blue-800/50 rounded-full px-4 py-1.5 text-xs text-blue-400 font-medium mb-6">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        AI-Assisted Media Verification
      </div>

      <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight tracking-tight">
        Before you trust it.
        <br />
        <span className="text-blue-400">Before you share it.</span>
      </h1>

      <p className="text-gray-400 text-lg max-w-xl mx-auto leading-relaxed mb-2">
        Upload an image to receive an evidence-based assessment of potential signs of AI generation or digital manipulation.
      </p>

      <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-gray-500">
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
    </div>
  );
}
