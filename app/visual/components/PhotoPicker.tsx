'use client'

interface PhotoPickerProps {
  folderId: string
  onChange: (next: string) => void
}

export function PhotoPicker({ folderId, onChange }: PhotoPickerProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">
        Drive photo folder <span className="text-neutral-400">(optional)</span>
      </span>
      <input
        type="text"
        value={folderId}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Google Drive folder id (leave empty for solid background)"
        className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
      />
      <span className="text-xs text-neutral-500">
        The folder must be shared with the service account. Photos cycle across
        slides in listing order.
      </span>
    </label>
  )
}
