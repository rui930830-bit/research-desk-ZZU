'use client';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { hoursInput } from '@/lib/work-summary';
export function DurationField({ value, onChange }: { value: number | undefined; onChange: (value: number | undefined) => void }) {
  const [hours, setHours] = useState(() => hoursInput(value));
  useEffect(() => {
    setHours(current => (current.trim() === '' ? undefined : Math.round(Number(current) * 60)) === value ? current : hoursInput(value));
  }, [value]);
  return <label className="field"><span>实际耗时（小时，选填）</span>
    <Input type="number" min={0} max={10000000 / 60} step="any" value={hours} placeholder="例如 1.5"
      onChange={e => { const next = e.target.value; setHours(next); onChange(next === '' ? undefined : Math.round(Number(next) * 60)); }} />
  </label>;
}
