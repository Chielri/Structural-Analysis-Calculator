import type { ReactNode } from 'react';

export function Field({
  label,
  unit,
  children,
}: {
  label: string;
  unit?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="field-label flex items-center justify-between">
        <span>{label}</span>
        {unit && <span className="text-slate-500 lowercase normal-case">{unit}</span>}
      </div>
      {children}
    </label>
  );
}

export function NumberInput({
  value,
  onChange,
  step = 'any',
  min,
  max,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number | 'any';
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      className="field-input"
      value={Number.isFinite(value) ? value : ''}
      step={step}
      min={min}
      max={max}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.valueAsNumber;
        if (Number.isFinite(v)) onChange(v);
      }}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      className="field-input"
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
