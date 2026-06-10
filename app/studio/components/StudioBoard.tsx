'use client'

import { useState } from 'react'
import type { StudioColumn as StudioColumnData } from '@/lib/studio/slots'
import { StudioColumn } from './StudioColumn'

// Horizontal, swipeable board of film columns. Each column updates
// independently — changing one video / idea leaves the others alone.
export function StudioBoard({
  initialColumns,
  clinicId,
}: {
  initialColumns: StudioColumnData[]
  clinicId: string
  isAdmin: boolean
}) {
  const [columns, setColumns] = useState(initialColumns)

  function updateColumn(next: StudioColumnData) {
    setColumns((prev) =>
      prev.map((c) => (c.slot_index === next.slot_index ? next : c))
    )
  }

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
      {columns.map((c) => (
        <StudioColumn
          key={c.slot_index}
          column={c}
          clinicId={clinicId}
          onUpdate={updateColumn}
        />
      ))}
    </div>
  )
}
