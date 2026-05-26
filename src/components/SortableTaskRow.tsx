import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { Theme } from '../lib/types';

interface SortableTaskRowProps {
  /** Stable unique id for this row (item.id / application.id). */
  id: number;
  t: Theme;
  /** The computed container style for the row (rowStyle(...) or the meta-based object). */
  containerStyle: React.CSSProperties;
  /** Everything that appears AFTER the drag handle (status toggle, text, buttons…). */
  children: React.ReactNode;
  /** When true (e.g. list is sorted, not in manual order) drag is off and the grip is hidden. */
  disabled?: boolean;
}

/**
 * A single sortable row. The drag handle is the grip icon ONLY — the rest of the
 * row stays fully clickable. Keyboard (Tab to handle, Space to pick up, arrows to
 * move) works via @dnd-kit's KeyboardSensor.
 */
export default function SortableTaskRow({ id, t, containerStyle, children, disabled = false }: SortableTaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    ...containerStyle,
    transform: CSS.Transform.toString(transform),
    // Keep colour transitions (status changes) AND dnd-kit's transform transition.
    // For the actively-dragged item dnd-kit gives transition=null, so it tracks
    // the pointer 1:1 with no lag.
    transition: [transition, 'background-color 150ms ease', 'border-color 150ms ease']
      .filter(Boolean)
      .join(', '),
    opacity: isDragging ? 0.45 : 1,
    position: 'relative',
    zIndex: isDragging ? 2 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {!disabled && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          style={{
            background: 'transparent', border: 'none', padding: 0, margin: 0,
            cursor: isDragging ? 'grabbing' : 'grab', flexShrink: 0,
            display: 'flex', alignItems: 'center', color: t.textDim,
            // Required so touch-drag works instead of scrolling the page.
            touchAction: 'none',
          }}
        >
          <GripVertical size={14} strokeWidth={1.5} />
        </button>
      )}
      {children}
    </div>
  );
}
