'use client';
import { taskCategories, workTypesFor, type WorkClassification } from '@/lib/work-classification';

export function WorkClassificationFields({ value, onChange, fixedCategory, disabled = false, required = true, pendingLabel = '请选择工作类型' }: {
  value: WorkClassification;
  onChange: (value: WorkClassification) => void;
  fixedCategory?: string;
  disabled?: boolean;
  required?: boolean;
  pendingLabel?: string;
}) {
  const category = fixedCategory || value.taskCategory;
  return <>
    <label className="field"><span>任务类别</span>
      <select className="work-classification-select" aria-label="任务类别" required={required} disabled={disabled || !!fixedCategory} value={category}
        onChange={e => onChange({ taskCategory: e.target.value, workType: '' })}>
        <option value="">请选择任务类别</option>
        {taskCategories.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </label>
    <label className="field"><span>工作类型</span>
      <select className="work-classification-select" aria-label="工作类型" required={required} disabled={disabled || !category} value={value.workType}
        onChange={e => onChange({ taskCategory: category, workType: e.target.value })}>
        <option value="">{category ? pendingLabel : '请先选择任务类别'}</option>
        {workTypesFor(category).map(t => <option key={t} value={t}>{t}</option>)}
      </select>
    </label>
  </>;
}
