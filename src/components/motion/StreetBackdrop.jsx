// Fixed street backdrop rendered once by Layout, behind all page
// content: asphalt gradient, slow-drifting neon alley glows (pink /
// cyan / lime), a dark vignette and a faint grunge grain. Pure CSS,
// pointer-events none, aria-hidden. All motion stops under
// prefers-reduced-motion (see index.css).
export default function StreetBackdrop() {
  return (
    <div className="street-backdrop" aria-hidden="true">
      <div className="alley-glow alley-glow-pink" />
      <div className="alley-glow alley-glow-cyan" />
      <div className="alley-glow alley-glow-lime" />
      <div className="alley-vignette" />
      <div className="alley-grain" />
    </div>
  );
}
