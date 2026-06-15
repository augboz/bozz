/**
 * ColorBankPicker — shows the user's personal colour bank as swatches.
 *
 * This is the ONLY way colours are selected throughout the app. The bank
 * is defined in Settings → Appearance → Colour bank.
 *
 * If the bank is empty the picker shows a short prompt instead of falling
 * back to a hardcoded palette — so the user knows to visit Settings.
 *
 * Props:
 *   bank        – the user's color bank (from AppearancePrefs.colorBank)
 *   selected    – currently selected hex string, or undefined = none
 *   onChange    – called with the new hex string, or undefined to clear
 *   allowNone   – show a "none / clear" swatch at the start (default true)
 *   swatchSize  – px size of each swatch (default 18)
 */

interface ColorBankPickerProps {
  bank: string[];
  selected?: string;
  onChange: (color: string | undefined) => void;
  allowNone?: boolean;
  swatchSize?: number;
}

export default function ColorBankPicker({
  bank,
  selected,
  onChange,
  allowNone = true,
  swatchSize = 18,
}: ColorBankPickerProps) {

  if (bank.length === 0) {
    return (
      <div style={{
        fontSize: '0.68rem', color: '#888', fontStyle: 'italic', padding: '0.2rem 0',
      }}>
        No colours in bank — add some in Settings → Appearance.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
      {allowNone && (
        <button
          title="None / clear"
          onClick={() => onChange(undefined)}
          style={{
            width: swatchSize, height: swatchSize,
            borderRadius: '4px',
            border: selected == null ? '2px solid currentColor' : '2px solid transparent',
            background: 'transparent',
            backgroundImage: 'repeating-linear-gradient(45deg, #888 0, #888 1px, transparent 0, transparent 50%)',
            backgroundSize: '4px 4px',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
            outline: selected == null ? '2px solid #888' : 'none',
            outlineOffset: '1px',
          }}
          aria-label="No color"
        />
      )}

      {bank.map(c => {
        const on = selected === c;
        return (
          <button
            key={c}
            onClick={() => onChange(on ? undefined : c)}
            title={c}
            aria-pressed={on}
            style={{
              width: swatchSize,
              height: swatchSize,
              borderRadius: '4px',
              border: on ? '2px solid #fff' : '2px solid transparent',
              background: c,
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
              outline: on ? `2px solid ${c}` : 'none',
              outlineOffset: '1px',
              transition: 'transform 0.1s',
              transform: on ? 'scale(1.15)' : 'scale(1)',
            }}
          />
        );
      })}
    </div>
  );
}
