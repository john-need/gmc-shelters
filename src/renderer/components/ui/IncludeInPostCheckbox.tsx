interface Props {
  photoId: number;
  checked: boolean;
  onToggle: (id: number, value: boolean) => void;
}

export default function IncludeInPostCheckbox({ photoId, checked, onToggle }: Props) {
  return (
    <input
      type="checkbox"
      checked={checked}
      aria-label="Include in post"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onToggle(photoId, e.target.checked)}
      style={{ cursor: 'pointer', margin: 0 }}
    />
  );
}
