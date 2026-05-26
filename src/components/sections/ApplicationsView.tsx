import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import type { Application, ApplicationStatus, Theme } from '../../lib/types';
import SortableTaskRow from '../SortableTaskRow';
import { SectionHeader, EmptyState, InputRow } from '../shared/ui';
import { iconBtn } from '../shared/styles';

interface ApplicationsViewProps {
  applications: Application[]; setApplications: React.Dispatch<React.SetStateAction<Application[]>>;
  t: Theme; accent: string;
}

interface StatusMeta { color: string; bg: string; border: string; leftBar: string; dashed?: boolean; filled?: boolean }

export default function ApplicationsView({ applications, setApplications, t, accent }: ApplicationsViewProps) {
  const [newApp, setNewApp] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const statuses: ApplicationStatus[] = ['need to apply', 'applied', 'interview', 'offer', 'rejected'];

  const statusMeta: Record<ApplicationStatus, StatusMeta> = {
    'need to apply': { color: t.pendingAccent, bg: t.pendingBg, border: t.pendingBorder, leftBar: t.pendingAccent, dashed: true },
    'applied':       { color: t.textMuted,     bg: t.todoBg,    border: t.todoBorder,    leftBar: 'transparent' },
    'interview':     { color: t.doingAccent,   bg: t.doingBg,   border: t.doingBorder,   leftBar: t.doingAccent },
    'offer':         { color: t.doneAccent,    bg: t.doneBg,    border: t.doneBorder,    leftBar: t.doneAccent,  filled: true },
    'rejected':      { color: t.textDim,       bg: t.todoBg,    border: t.border,        leftBar: t.textDim },
  };

  const addApp = () => {
    if (newApp.trim()) {
      setApplications(prev => [...prev, { id: Date.now(), name: newApp.trim(), status: 'need to apply' }]);
      setNewApp('');
    }
  };
  const cycleStatus = (id: number) => {
    setApplications(prev => prev.map(a => {
      if (a.id !== id) return a;
      const idx = statuses.indexOf(a.status);
      return { ...a, status: statuses[(idx + 1) % statuses.length] };
    }));
  };
  const removeApp = (id: number) => setApplications(prev => prev.filter(a => a.id !== id));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setApplications(prev => {
        const oldIndex = prev.findIndex(a => a.id === active.id);
        const newIndex = prev.findIndex(a => a.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  return (
    <div>
      <SectionHeader title="Applications" t={t} hint="drag the grip · click status to cycle" />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext items={applications.map(a => a.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
            {applications.map(a => {
              const meta = statusMeta[a.status] ?? statusMeta['applied'];
              const containerStyle: React.CSSProperties = {
                background: meta.bg,
                border: `${meta.dashed ? '1px dashed' : '1px solid'} ${meta.border}`,
                borderLeft: `3px solid ${meta.leftBar}`,
                borderRadius: '8px', padding: '0.85rem 1.1rem',
                display: 'flex', alignItems: 'center', gap: '0.85rem', transition: 'all 0.2s ease',
              };
              return (
                <SortableTaskRow key={a.id} id={a.id} t={t} containerStyle={containerStyle}>
                  <span style={{
                    flex: 1, fontSize: '0.95rem',
                    color: a.status === 'rejected' ? t.textDim : t.text,
                    textDecoration: a.status === 'rejected' ? 'line-through' : 'none',
                    fontWeight: a.status === 'interview' ? 400 : 300,
                  }}>
                    {a.name}
                  </span>
                  <button
                    onClick={() => cycleStatus(a.id)}
                    style={{
                      background: meta.filled ? meta.color : 'transparent',
                      border: `1px solid ${meta.color}`, color: meta.filled ? t.bg : meta.color,
                      padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.7rem',
                      letterSpacing: '0.08em', cursor: 'pointer', fontFamily: 'inherit',
                      fontWeight: 400, textTransform: 'uppercase', whiteSpace: 'nowrap',
                    }}
                  >
                    {a.status}
                  </button>
                  <button onClick={() => removeApp(a.id)} style={iconBtn(t)} aria-label="Delete">
                    <X size={14} strokeWidth={1.5} />
                  </button>
                </SortableTaskRow>
              );
            })}
            {applications.length === 0 && <EmptyState text="no applications yet" t={t} />}
          </div>
        </SortableContext>
      </DndContext>
      <InputRow value={newApp} setValue={setNewApp} onAdd={addApp} placeholder="add an application…" t={t} accent={accent} />
    </div>
  );
}
