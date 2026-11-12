// The preview image a shared link shows (three-pillars plan S2): the wordmark, a kicker and the page's
// own headline, on the app's paper colours. Rendered by next/og at 1200×630.
export const OG_SIZE = { width: 1200, height: 630 };

export function OgCard({ kicker, title, foot }: { kicker: string[]; title: string; foot?: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f7f5f0", padding: "64px 72px", fontFamily: "serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 56, fontWeight: 700, color: "#16150f", letterSpacing: -1 }}>FINN</div>
        {/* parts separated by space, not dots */}
        <div style={{ display: "flex", gap: 28, fontSize: 26, color: "#2448a5", fontFamily: "sans-serif", letterSpacing: 3, textTransform: "uppercase" }}>
          {kicker.map((k) => (
            <span key={k}>{k}</span>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", fontSize: title.length > 70 ? 54 : 66, lineHeight: 1.15, color: "#16150f", maxWidth: 1020 }}>{title}</div>
      <div style={{ display: "flex", fontSize: 26, color: "#6b675c", fontFamily: "sans-serif" }}>
        {foot ?? "Filings ranked, promises kept against later words, and who can help."}
      </div>
    </div>
  );
}
