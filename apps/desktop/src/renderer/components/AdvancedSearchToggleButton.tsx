export function AdvancedSearchToggleButton({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`search-mode-icon-btn${enabled ? " active" : ""}`}
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label={enabled ? "Disable advanced search syntax" : "Enable advanced search syntax"}
      title={enabled ? "Advanced syntax enabled" : "Advanced syntax disabled"}
    >
      <svg
        className="search-mode-glyph"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <title>Advanced search syntax</title>
        <path d="M8 8l-4 4l4 4M16 8l4 4l-4 4M13 6l-2 12" />
      </svg>
    </button>
  );
}
