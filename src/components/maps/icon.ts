const MARKER_BORDER = "#6b7280";

export type MarkerArtwork = {
  svg: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
};

export function buildSelectedPinArtwork(): MarkerArtwork {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="42" viewBox="0 0 28 42">
    <defs>
      <filter id="selected-pin-shadow" x="-30%" y="-20%" width="160%" height="180%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#7f1d1d" flood-opacity="0.22"/>
      </filter>
    </defs>
    <g filter="url(#selected-pin-shadow)">
      <path d="M14 40 C20.5 29, 25 23, 25 14 C25 7.925, 20.075 3, 14 3 C7.925 3, 3 7.925, 3 14 C3 23, 7.5 29, 14 40 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="1.5"/>
      <circle cx="14" cy="14" r="5.5" fill="#ffffff"/>
    </g>
  </svg>`;
  return { svg, width: 28, height: 42, anchorX: 14, anchorY: 42 };
}

export function buildMarkerArtwork(
  glyph?: string | null,
  highlighted = false,
): MarkerArtwork {
  const isHighlighted = highlighted && !!glyph;
  const width = 44;
  const height = 48;
  const shadowId = isHighlighted ? "marker-shadow-active" : "marker-shadow";
  const strokeColor = isHighlighted ? "#ef4444" : MARKER_BORDER;
  const fillColor = "#ffffff";
  const glyphMarkup = glyph
    ? `<text x="22" y="25.5" text-anchor="middle" font-size="18">${glyph}</text>`
    : "";
  const strokeWidth = isHighlighted ? 2.25 : 1.5;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 48 54">
    <defs>
      <filter id="marker-shadow" x="-20%" y="-20%" width="140%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0f172a" flood-opacity="0.18"/>
      </filter>
      <filter id="marker-shadow-active" x="-30%" y="-30%" width="160%" height="200%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#7f1d1d" flood-opacity="0.18"/>
      </filter>
    </defs>
    <g filter="url(#${shadowId})">
      <rect x="4" y="4" width="40" height="32" rx="11" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
      <path d="M19 36 L19 50 L29 36" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
    </g>
    ${glyphMarkup}
  </svg>`;
  return { svg, width, height, anchorX: 22, anchorY: 48 };
}

export function toDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
