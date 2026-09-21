import { groupSummary, formatMinutes, validMinutes, type WorkSummaryData } from './work-summary';

const ink = '#2c4540', muted = '#66746c', paper = '#f7f5ed';
const colors = ['#547265', '#83a0ac', '#8f9e86', '#b4a78e', '#9f8794', '#82959a', '#aca181', '#667d92', '#b48f78', '#8c86aa', '#a1ad75', '#638e89', '#b47f8c', '#789369', '#9a8c71', '#798386'];
type Assets = { image: HTMLImageElement };
type CardItem = { number: number; lines: string[]; meta: string; category?: string; continued: boolean };
export type SharePage = { chart: boolean; grouped?: boolean; cards: CardItem[] };
let assetsPromise: Promise<Assets> | undefined;
export function shareAssets(): Promise<Assets> {
  if (!assetsPromise) assetsPromise = Promise.all([
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('插图加载失败，请刷新重试'));
      image.src = '/art/summary-water-lilies.jpg';
    }),
    new FontFace('ResearchSerif', 'url(/fonts/research-serif.ttf)').load().then(font => { document.fonts.add(font); }),
  ]).then(([image]) => ({ image })).catch(error => { assetsPromise = undefined; throw error; });
  return assetsPromise;
}
function font(ctx: CanvasRenderingContext2D, size: number, family = 'sans') {
  ctx.font = `${family === 'number' ? 300 : 400} ${size}px ${family === 'serif' ? 'ResearchSerif, "Songti SC", serif' : '"Helvetica Neue", "PingFang SC", sans-serif'}`;
}
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []; let line = '';
  for (const ch of text) {
    if (ch === '\n') { lines.push(line); line = ''; continue; }
    if (line && ctx.measureText(line + ch).width > width) { lines.push(line); line = ch; } else line += ch;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}
export function sharePages(summary: WorkSummaryData): SharePage[] {
  if (summary.showChart) return [{ chart: true, cards: [] }];
  if (summary.period !== 'day') {
    const cards = summary.groups.map((g, index) => ({ number: index + 1, lines: [g.name], meta: groupSummary(g), continued: false }));
    const pages: SharePage[] = [];
    for (let n = 0; n < cards.length; n += 6) pages.push({ chart: false, grouped: true, cards: cards.slice(n, n + 6) });
    return pages.length ? pages : [{ chart: false, grouped: true, cards: [] }];
  }
  const ctx = document.createElement('canvas').getContext('2d')!; font(ctx, 25);
  const cards = summary.items.flatMap((item, index) => {
    const lines = wrap(ctx, item.title.replace(/\r/g, ''), 274);
    const meta = [summary.period !== 'day' ? item.completedOn : '', validMinutes(item.actualMinutes) ? formatMinutes(item.actualMinutes) : summary.timedCount ? '未填写耗时' : ''].filter(Boolean).join(' · ');
    const pieces: CardItem[] = [];
    for (let n = 0; n < lines.length; n += 6) pieces.push({ number: index + 1, lines: lines.slice(n, n + 6), meta, category: item.workLabel, continued: n > 0 });
    return pieces;
  });
  const pages: SharePage[] = [];
  for (let n = 0; n < cards.length; n += 6) pages.push({ chart: false, cards: cards.slice(n, n + 6) });
  return pages.length ? pages : [{ chart: false, cards: [] }];
}
export function drawSharePage(s: WorkSummaryData, page: SharePage, assets: Assets, index: number, totalPages: number): HTMLCanvasElement {
  const rowHeights: number[] = [];
  for (let n = 0; n < page.cards.length; n += 2) {
    rowHeights.push(Math.max(...page.cards.slice(n, n + 2).map(c => 38 + c.lines.length * 35 + (c.meta ? 34 : 0) + (c.category ? 30 : 0))) + 26);
  }
  const contentEnd = page.chart ? 745 + Math.max(4, s.groups.length) * 71 : 672 + rowHeights.reduce((a, b) => a + b, 0);
  const height = Math.max(1080, contentEnd + 90);
  const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = height * 2;
  const ctx = canvas.getContext('2d')!; ctx.scale(2, 2);
  const text = (value: string, x: number, y: number, size = 26, color = ink, family = 'sans', align: CanvasTextAlign = 'left') => {
    font(ctx, size, family); ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value, x, y); ctx.textAlign = 'left';
  };
  const tracked = (value: string, x: number, y: number, size: number, color: string, spacing: number) => {
    for (const ch of value) { text(ch, x, y, size, color, 'serif'); x += ctx.measureText(ch).width + spacing; }
  };
  ctx.fillStyle = paper; ctx.fillRect(0, 0, 720, height);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 720, 410); ctx.clip();
  ctx.drawImage(assets.image, 0, -105, 720, assets.image.height * 720 / assets.image.width); ctx.restore();
  const shade = ctx.createLinearGradient(0, 0, 0, 410);
  shade.addColorStop(0, 'rgba(14,36,32,.36)'); shade.addColorStop(.65, 'rgba(14,36,32,.12)'); shade.addColorStop(1, 'rgba(14,36,32,.2)');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, 720, 410);
  tracked('研间', 56, 67, 28, '#fff', 8);
  text('RESEARCH JOURNAL', 664, 66, 22, '#fff', 'sans', 'right');
  tracked({ day: s.anchor === s.currentDay ? '今日所成' : '一日所成', week: s.currentDay >= s.start && s.currentDay <= s.end ? '本周回望' : '一周回望', month: '月度小结' }[s.period], 54, 193, 68, '#fff', 5);
  text({ day: 'D A I L Y   N O T E S', week: 'W E E K L Y   N O T E S', month: 'M O N T H L Y   N O T E S' }[s.period], 59, 236, 22, '#fff');
  const date = s.period === 'day' ? s.anchor.replaceAll('-', '.') : `${s.start.replaceAll('-', '.')} — ${s.end.slice(5).replace('-', '.')}${s.effectiveEnd < s.end ? ` / 截至 ${s.effectiveEnd.slice(5).replace('-', '.')}` : ''}`;
  text(date, 58, 370, 25, '#fff');
  text(String(s.items.length).padStart(2, '0'), 52, 558, s.items.length > 999 ? 76 : 112, ink, 'number');
  text('项完成', 57, 602, 26, muted);
  if (s.timedCount) {
    const h = Math.floor(s.minutes / 60), m = s.minutes % 60;
    let x = 365;
    const big = h > 999 ? 45 : h > 99 ? 64 : 88;
    if (h) { text(String(h), x, 548, big, ink, 'number'); x += ctx.measureText(String(h)).width + 10; text('h', x, 548, 28, muted); x += 30; }
    if (m || !h) { text(String(m), x, 548, h > 999 ? 40 : 64, ink, 'number'); x += ctx.measureText(String(m)).width + 8; text('m', x, 548, 26, muted); }
    text(s.complete ? '记录耗时' : `已计时 ${s.timedCount}/${s.items.length} 项`, 365, 602, 26, muted);
  } else if (s.period === 'day') { text('未计时', 365, 546, 38); text('只记录完成事项', 365, 602, 26, muted); }
  ctx.fillStyle = '#d7dcd1'; ctx.fillRect(56, 640, 608, 1);
  if (page.chart) {
    const cy = s.groups.length > 4 ? 710 + s.groups.length * 35 : 822;
    let a = -Math.PI / 2;
    s.groups.forEach((g, i) => {
      if (!g.minutes) return;
      const end = a + g.minutes / s.minutes * Math.PI * 2, gap = Math.min(.012, (end - a) / 5);
      ctx.beginPath(); ctx.arc(197, cy, 111, a + gap, end - gap); ctx.lineWidth = 34; ctx.strokeStyle = colors[i % colors.length]; ctx.stroke(); a = end;
    });
    text('时间', 197, cy - 9, 29, ink, 'serif', 'center'); text('分配', 197, cy + 33, 29, ink, 'serif', 'center');
    s.groups.forEach((g, i) => {
      const y = 713 + i * 71; ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(365, y - 15, 8, 8);
      tracked(g.name, 390, y, 22, ink, 0.3);
      text(groupSummary(g), 390, y + 33, 23, muted, 'serif');
    });
  } else {
    let rowY = 697;
    for (let n = 0; n < page.cards.length; n += 2) {
      page.cards.slice(n, n + 2).forEach((item, column) => {
        const x = column ? 370 : 57;
        if (page.grouped) { ctx.fillStyle = colors[(item.number - 1) % colors.length]; ctx.fillRect(x, rowY - 12, 9, 9); }
        else text(String(item.number).padStart(2, '0') + (item.continued ? ' · 续' : ''), x, rowY, 22, muted);
        item.lines.forEach((line, i) => page.grouped ? tracked(line, x, rowY + 39, 22, ink, 0.3) : text(line, x, rowY + 39 + i * 35, 25));
        if (item.category) text(item.category, x, rowY + 39 + item.lines.length * 35, 20, muted);
        if (item.meta) text(item.meta, x, rowY + 39 + item.lines.length * 35 + (item.category ? 30 : 0), 22, muted);
      });
      rowY += rowHeights[n / 2];
    }
    if (!s.items.length) text('这段时间，尚无完成记录。', 57, 752, 30, muted);
  }
  ctx.fillStyle = '#d7dcd1'; ctx.fillRect(56, height - 86, 608, 1);
  text('研间', 56, height - 46, 26, muted, 'serif');
  text(totalPages > 1 ? `${index + 1} / ${totalPages}` : s.period !== 'day' ? `${s.days} 天留下完成记录` : '工作记录', 664, height - 46, 24, muted, 'sans', 'right');
  return canvas;
}
export function pngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片生成失败')), 'image/png'));
}
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
