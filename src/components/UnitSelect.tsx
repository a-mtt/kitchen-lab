import type { Unit } from '../db';

interface Props {
  value: Unit;
  onChange: (unit: Unit) => void;
  /** Whether "pc" is offered (the ingredient has a piece weight). */
  allowPiece: boolean;
  label?: string;
}

export function UnitSelect({ value, onChange, allowPiece, label = 'Unit' }: Props) {
  return (
    <select className="line-unit" aria-label={label} value={value} onChange={(e) => onChange(e.target.value as Unit)}>
      <option value="g">g</option>
      <option value="ml">ml</option>
      <option value="tsp">tsp</option>
      <option value="tbsp">tbsp</option>
      {(allowPiece || value === 'pc') && <option value="pc">pc</option>}
    </select>
  );
}
