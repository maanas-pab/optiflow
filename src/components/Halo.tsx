import React from 'react';

/** Ambient watercolor halo: overlapping translucent shapes that breathe slowly.
 *  Colour is set via CSS variables so the score colour can tint it without
 *  ever being the only carrier of meaning. Respects prefers-reduced-motion in CSS. */
export default function Halo({ color }: { color?: string | null }) {
  const style = color ? ({ '--sage': color, '--blue': color, '--lav': color } as React.CSSProperties) : undefined;
  return (
    <div className="halo" style={style} aria-hidden="true">
      <i /><i /><i />
    </div>
  );
}
