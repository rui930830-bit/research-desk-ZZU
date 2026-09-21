'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { completedWork } from '@/lib/completed-work';
import { today, type Item, type State } from '@/lib/desk';
import { formatMinutes, parseHours, hoursInput, summarizeWork, summaryText, updateWorkDetails, validMinutes, groupSummary, type SummaryPeriod } from '@/lib/work-summary';
import { drawSharePage, pngBlob, saveBlob, shareAssets, sharePages } from '@/lib/share-card';
import { classificationLabel, validClassification, type WorkClassification } from '@/lib/work-classification';
import { WorkClassificationFields } from '@/components/work-classification-fields';
import { zipFiles } from '@/lib/share-zip';

function WorkRow({ work, save }: { work: Item; save: (minutes: number | undefined, classification?: WorkClassification) => Promise<void> }) {
  const [editing, setEditing] = useState(false), [hours, setHours] = useState(''), [classification, setClassification] = useState<WorkClassification>({taskCategory: work.taskCategory, workType: work.workType});
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <article className="summary-work-row">
    <div className="summary-row-heading"><div><strong>{work.title}</strong><small>{work.completedOn} · {classificationLabel(work, work.source)}</small></div>
      <Button size="sm" variant="ghost" onClick={() => { setHours(hoursInput(work.actualMinutes)); setClassification({taskCategory:work.taskCategory,workType:work.workType}); setError(''); setEditing(true); }}>
        {validMinutes(work.actualMinutes) ? formatMinutes(work.actualMinutes) : '填写耗时'}
      </Button>
    </div>
    {editing && <form className="summary-time-form" onSubmit={async e => {
      e.preventDefault(); if (busy) return; setBusy(true); setError('');
      try {
        const changed = classification.taskCategory !== work.taskCategory || classification.workType !== work.workType;
        if (changed && !validClassification(classification.taskCategory, classification.workType)) throw new Error('请选择任务类别及对应的工作类型');
        await save(parseHours(hours), changed ? classification : undefined); setEditing(false); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
    }}>
      <label>实际耗时（小时）<Input type="number" min={0} max={10000000 / 60} step="any" value={hours} onChange={e => setHours(e.target.value)} placeholder="例如 1.5" disabled={busy} /></label>
      {work.source !== 'meetings' && <WorkClassificationFields value={classification} onChange={setClassification}
        fixedCategory={work.source === 'students' ? '学生指导' : undefined} disabled={busy} required={false} pendingLabel="待细分（历史记录）" />}
      <div className="button-row"><Button size="sm" type="submit" disabled={busy}>{busy ? '保存中…' : '保存'}</Button><Button size="sm" type="button" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>取消</Button></div>
      {error && <p className="error-text" role="alert">{error}</p>}
    </form>}
  </article>;
}
export function WorkSummary({ data, initialPeriod = 'day', mutate }: { data: State; initialPeriod?: SummaryPeriod; mutate: (fn: (state: State) => State) => Promise<void> }) {
  const [period, setPeriod] = useState<SummaryPeriod>(initialPeriod), [anchor, setAnchor] = useState(today), [now, setNow] = useState(today);
  const [pageIndex, setPageIndex] = useState(0), [pageCount, setPageCount] = useState(1), [previewReady, setPreviewReady] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [progress, setProgress] = useState('');
  const [retry, setRetry] = useState(0), canvas = useRef<HTMLCanvasElement>(null);
  const work = useMemo(() => completedWork(data), [data]);
  const summary = useMemo(() => summarizeWork(work, period, anchor, now), [work, period, anchor, now]);
  useEffect(() => { const timer = window.setInterval(() => setNow(today()), 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { setPageIndex(0); setNotice(''); }, [summary]);
  useEffect(() => {
    let cancelled = false; setPreviewReady(false); setError('');
    shareAssets().then(assets => {
      if (cancelled || !canvas.current) return;
      const pages = sharePages(summary), index = Math.min(pageIndex, pages.length - 1);
      const rendered = drawSharePage(summary, pages[index], assets, index, pages.length);
      canvas.current.width = rendered.width; canvas.current.height = rendered.height;
      canvas.current.getContext('2d')!.drawImage(rendered, 0, 0); setPageCount(pages.length); setPreviewReady(true);
    }).catch(e => { if (!cancelled) setError(e.message || '分享图加载失败'); });
    return () => { cancelled = true; };
  }, [summary, pageIndex, retry]);
  const baseName = `研间-${{ day: '日总结', week: '周总结', month: '月总结' }[period]}-${anchor}`;
  async function download(all = false) {
    if (busy || !previewReady) return; setBusy(true); setError('');
    try {
      if (!all) { if (canvas.current) saveBlob(await pngBlob(canvas.current), `${baseName}-${pageIndex + 1}.png`); }
      else {
        const assets = await shareAssets(), pages = sharePages(summary), files = [];
        for (let i = 0; i < pages.length; i++) {
          setProgress(`${i + 1}/${pages.length}`);
          const blob = await pngBlob(drawSharePage(summary, pages[i], assets, i, pages.length));
          files.push({ name: `${baseName}-${i + 1}.png`, bytes: new Uint8Array(await blob.arrayBuffer()) });
        }
        const zip = zipFiles(files); saveBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), `${baseName}.zip`);
      }
      setNotice('已生成下载文件');
    } catch (e: any) { setError(e.message || '导出失败，请重试'); } finally { setBusy(false); setProgress(''); }
  }
  return <section className="work-summary">
    <div className="page-title"><div><p className="eyebrow">WORK JOURNAL</p><h1>工作总结</h1></div>
      <div className="button-row"><Button variant="outline" disabled={!summary.items.length || busy} onClick={async () => {
        try { await navigator.clipboard.writeText(summaryText(summary)); setNotice('总结已复制'); }
        catch { saveBlob(new Blob([summaryText(summary)], { type: 'text/plain;charset=utf-8' }), `${baseName}.txt`); setNotice('总结已保存为文字文件'); }
      }}>复制总结</Button>
      <Button disabled={!previewReady || !summary.items.length || busy} onClick={() => void download()}>{busy ? `生成中 ${progress}` : pageCount > 1 ? '下载本张' : '下载分享图'}</Button>
      {pageCount > 1 && <Button variant="outline" disabled={!previewReady || busy} onClick={() => void download(true)}>下载全部图片</Button>}</div>
    </div>
    <div className="summary-controls"><div className="summary-periods" role="group" aria-label="总结周期">{(['day', 'week', 'month'] as SummaryPeriod[]).map(p => <Button key={p} variant={period === p ? 'default' : 'outline'} disabled={busy} aria-pressed={period === p} onClick={() => { setPeriod(p); setPageIndex(0); }}>{ { day: '日总结', week: '周总结', month: '月总结' }[p]}</Button>)}</div>
      <label>统计日期<Input type="date" value={anchor} max={now} disabled={busy} onChange={e => { if (e.target.value && e.target.validity.valid) { setAnchor(e.target.value); setPageIndex(0); } }} /></label>
    </div>
    {error && <div className="error-text" role="alert">{error} <Button size="sm" variant="outline" onClick={() => setRetry(n => n + 1)}>重试</Button></div>}
    {notice && <p role="status">{notice}</p>}
    <div className="summary-layout">
      <div className="summary-preview" aria-busy={!previewReady}>
        {!previewReady && !error && <p role="status">正在生成分享图…</p>}
        <canvas ref={canvas} aria-label={`${summary.items.length}项完成，${summary.timedCount ? `已记录耗时${formatMinutes(summary.minutes)}` : '未填写耗时'}`} role="img" style={{ display: previewReady ? 'block' : 'none' }} />
        {pageCount > 1 && <div className="summary-pagination"><Button size="sm" variant="outline" disabled={pageIndex === 0 || busy} onClick={() => setPageIndex(n => n - 1)}>上一张</Button><span>{pageIndex + 1} / {pageCount}</span><Button size="sm" variant="outline" disabled={pageIndex >= pageCount - 1 || busy} onClick={() => setPageIndex(n => n + 1)}>下一张</Button></div>}
      </div>
      <section className="panel summary-details"><div className="section-head"><h2>完成事项 <small>{summary.items.length} 项</small></h2></div>
        <div className="summary-category-totals" aria-label="任务类别小计">{summary.categoryTotals.map(g => <div key={g.name}><strong>{g.name}</strong><span>{groupSummary(g)}</span></div>)}</div>
        {summary.items.some(w => !w.workType) && <p className="summary-note">部分历史记录待分类或待细分，可点击右侧耗时补选。</p>}
        {summary.missingCount > 0 && <p className="summary-note">{summary.missingCount} 项尚未填写耗时</p>}
        {!summary.items.length && <p className="summary-note">这段时间还没有完成记录。</p>}
        {summary.items.map(w => <WorkRow key={w.workKey} work={w} save={(minutes, classification) => mutate(s => updateWorkDetails(s, w, minutes, classification?.workType, classification?.taskCategory))} />)}
        {summary.undatedCount > 0 && <p className="summary-note">另有 {summary.undatedCount} 项历史记录未填写完成日期</p>}
      </section>
    </div>
  </section>;
}
