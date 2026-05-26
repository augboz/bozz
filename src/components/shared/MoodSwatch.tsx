/** A single representative colour dot for a mood. */
export default function MoodSwatch({ color }: { color: string }) {
  return (
    <span style={{
      width: '16px', height: '16px', borderRadius: '50%',
      background: color, display: 'inline-block', flexShrink: 0,
    }} />
  );
}
