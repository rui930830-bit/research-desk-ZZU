'use client';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableRow, TableCell } from '@/components/ui/table';
function inline(s: string) {
  return s
    .split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*)/g)
    .map((v, i) => {
      const m = v.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      return m ? (
        <a key={i} href={m[2]} target="_blank" rel="noreferrer">
          {m[1]}
        </a>
      ) : v.startsWith('**') ? (
        <strong key={i}>{v.slice(2, -2)}</strong>
      ) : (
        v
      );
    });
}
export function Markdown({ value }: { value: string }) {
  const lines = value.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!/^\|[\s:|-]+$/.test(lines[i]))
          rows.push(lines[i].replace(/^\||\|$/g, '').split('|'));
        i++;
      }
      i--;
      out.push(
        <Table key={i}>
          <TableBody>
            {rows.map((r, n) => (
              <TableRow key={n}>
                {r.map((c, j) => (
                  <TableCell key={j}>{inline(c.trim())}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>,
      );
    } else if (l.startsWith('### '))
      out.push(<h4 key={i}>{inline(l.slice(4))}</h4>);
    else if (l.startsWith('## '))
      out.push(<h3 key={i}>{inline(l.slice(3))}</h3>);
    else if (l.startsWith('# '))
      out.push(<h2 key={i}>{inline(l.slice(2))}</h2>);
    else if (/^- \[[ x]\]/i.test(l))
      out.push(
        <p key={i}>
          {l[3].toLowerCase() === 'x' ? '☑' : '☐'} {inline(l.slice(6))}
        </p>,
      );
    else if (l.startsWith('- '))
      out.push(<p key={i}>• {inline(l.slice(2))}</p>);
    else out.push(<p key={i}>{inline(l) || <br />}</p>);
  }
  return <div className="prose-notes">{out}</div>;
}
export function Editor({
  value,
  onChange,
  onBlur,
  label = '内容',
}: {
  value: string;
  onChange: (s: string) => void;
  onBlur?: () => void;
  label?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  function insert(text: string) {
    const e = ref.current;
    if (!e) return;
    const start = e.selectionStart,
      end = e.selectionEnd;
    onChange(value.slice(0, start) + text + value.slice(end));
    setTimeout(() => {
      e.focus();
      e.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  }
  return (
    <Tabs defaultValue="write">
      <div className="editor-top">
        <TabsList>
          <TabsTrigger value="write">编辑</TabsTrigger>
          <TabsTrigger value="preview">阅读</TabsTrigger>
        </TabsList>
        <small>支持 Markdown</small>
      </div>
      <TabsContent value="write">
        <div className="editor-toolbar">
          {[
            ['标题', '\n## 标题\n'],
            ['列表', '\n- '],
            ['清单', '\n- [ ] '],
            ['链接', '[链接文字](https://example.com)'],
            ['表格', '\n| 项目 | 内容 |\n| --- | --- |\n|  |  |\n'],
          ].map(([name, text]) => (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              key={name}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(text)}
            >
              {name}
            </Button>
          ))}
        </div>
        <textarea
          ref={ref}
          aria-label={label}
          className="note-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="在这里记录思路、讨论与下一步安排……"
        />
      </TabsContent>
      <TabsContent value="preview">
        <Markdown value={value || '暂无记录。'} />
      </TabsContent>
    </Tabs>
  );
}
