// Project: Via Nostra
// File: frontend/components/CarForm.tsx
// Purpose: The form for a car's details, used both to add a new car and to edit one.
//          After approval the car's identity (make, plate and so on) is locked and
//          only the description, prices and rental days can change.

'use client';

import { useActionState } from 'react';
import Field from '@/components/Field';
import type { CarFormState, CarFormValues } from '@/lib/types';

type Props = {
  action: (previous: CarFormState, formData: FormData) => Promise<CarFormState>;
  initial?: Partial<CarFormValues>;
  identityLocked?: boolean;
  carId?: string;
  submitLabel: string;
};

const EMPTY: CarFormValues = {
  make: '',
  model: '',
  year: '',
  plateNumber: '',
  vin: '',
  color: '',
  seats: '5',
  transmission: 'automatic',
  fuelType: 'petrol',
  description: '',
  currency: 'USD',
  dailyPrice: '',
  deposit: '0',
  minRentalDays: '1',
  maxRentalDays: '30',
};

export default function CarForm({
  action,
  initial,
  identityLocked = false,
  carId,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const values: CarFormValues = { ...EMPTY, ...initial, ...state?.values };
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="form-panel">
      {carId ? <input type="hidden" name="carId" value={carId} /> : null}
      {state?.message ? <div className="alert">{state.message}</div> : null}
      {identityLocked ? (
        <p className="hint">
          The make, model, year, plate, VIN, seats, gearbox, fuel and currency cannot change
          after approval.
        </p>
      ) : null}

      <div className="form-grid">
        <Field label="Make" name="make" defaultValue={values.make} disabled={identityLocked} required maxLength={60} error={errors.make} />
        <Field label="Model" name="model" defaultValue={values.model} disabled={identityLocked} required maxLength={60} error={errors.model} />
        <Field label="Year" name="year" type="number" defaultValue={values.year} disabled={identityLocked} required min={1990} max={new Date().getFullYear() + 1} error={errors.year} />
        <Field label="Plate number" name="plateNumber" defaultValue={values.plateNumber} disabled={identityLocked} required maxLength={15} error={errors.plateNumber} />
        <Field label="VIN (17 characters, optional)" name="vin" defaultValue={values.vin} disabled={identityLocked} maxLength={17} minLength={17} error={errors.vin} />
        <Field label="Colour" name="color" defaultValue={values.color} maxLength={30} error={errors.color} />
        <Field label="Seats" name="seats" type="number" defaultValue={values.seats} disabled={identityLocked} required min={1} max={20} error={errors.seats} />
        <Field
          label="Gearbox"
          name="transmission"
          defaultValue={values.transmission}
          disabled={identityLocked}
          options={[
            { value: 'automatic', label: 'Automatic' },
            { value: 'manual', label: 'Manual' },
          ]}
          error={errors.transmission}
        />
        <Field
          label="Fuel"
          name="fuelType"
          defaultValue={values.fuelType}
          disabled={identityLocked}
          options={[
            { value: 'petrol', label: 'Petrol' },
            { value: 'diesel', label: 'Diesel' },
            { value: 'hybrid', label: 'Hybrid' },
            { value: 'electric', label: 'Electric' },
          ]}
          error={errors.fuelType}
        />
        <Field label="Currency (3 letters)" name="currency" defaultValue={values.currency} disabled={identityLocked} required minLength={3} maxLength={3} error={errors.currency} />
        <Field label="Price per day" name="dailyPrice" type="number" step="0.01" min="1" defaultValue={values.dailyPrice} required error={errors.dailyPrice} />
        <Field label="Refundable deposit" name="deposit" type="number" step="0.01" min="0" defaultValue={values.deposit} error={errors.deposit} />
        <Field label="Shortest rental (days)" name="minRentalDays" type="number" min={1} max={365} defaultValue={values.minRentalDays} error={errors.minRentalDays} />
        <Field label="Longest rental (days)" name="maxRentalDays" type="number" min={1} max={365} defaultValue={values.maxRentalDays} error={errors.maxRentalDays} />
        <div className="wide">
          <Field label="Description" name="description" rows={4} maxLength={2000} defaultValue={values.description} error={errors.description} />
        </div>
      </div>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}

// File: frontend/components/CarForm.tsx
// END OF FILE