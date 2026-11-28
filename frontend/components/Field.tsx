// Project: Via Nostra
// File: frontend/components/Field.tsx
// Purpose: One labelled form field (text, number, date, drop-down list or text area)
//          with an optional hint and error message. Used by all the forms.

import type { ReactNode } from 'react';

type Option = { value: string; label: string };

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  error?: string;
  options?: Option[];
  rows?: number;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  autoComplete?: string;
  children?: ReactNode;
};

export default function Field(props: FieldProps) {
  const { label, name, type = 'text', options, rows, hint, error, children, ...rest } = props;
  const id = `field-${name}`;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {options ? (
        <select
          id={id}
          name={name}
          defaultValue={rest.defaultValue}
          required={rest.required}
          disabled={rest.disabled}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : rows ? (
        <textarea
          id={id}
          name={name}
          rows={rows}
          defaultValue={rest.defaultValue}
          maxLength={rest.maxLength}
          required={rest.required}
          disabled={rest.disabled}
        />
      ) : (
        <input id={id} name={name} type={type} {...rest} />
      )}
      {children}
      {hint ? <p className="hint">{hint}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

// File: frontend/components/Field.tsx
// END OF FILE