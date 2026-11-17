/**
 * The app icon, drawn in code: a glowing teal diamond on deep navy
 * (docs/09-design-direction.md). Rendered to PNG by Next.js's ImageResponse
 * for the iPhone home screen icon, the manifest icons and the browser tab.
 *
 * `padding` shrinks the artwork for "maskable" icons, which Android crops
 * into circles (iPhone uses the full square and rounds the corners itself).
 */
export function AppIconArt({ size, padding = 0 }: { size: number; padding?: number }) {
  const art = size * (1 - padding * 2);
  const outer = art * 0.46; // side of the rotated square
  const inner = outer * 0.42;
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 70% 20%, #12304a 0%, #070b14 60%)",
      }}
    >
      <div
        style={{
          width: outer,
          height: outer,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: "rotate(45deg)",
          borderRadius: outer * 0.16,
          border: `${Math.max(2, outer * 0.09)}px solid #2ee6c9`,
          boxShadow: `0 0 ${outer * 0.35}px #2ee6c9`,
        }}
      >
        <div
          style={{
            width: inner,
            height: inner,
            borderRadius: inner * 0.18,
            background: "#2ee6c9",
            boxShadow: `0 0 ${inner * 0.6}px #2ee6c9`,
          }}
        />
      </div>
    </div>
  );
}
