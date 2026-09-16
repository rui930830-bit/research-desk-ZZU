'use client';
import { useEffect, useState } from 'react';
import { api, type State } from '@/lib/desk';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export type AiSource = {
  kind: 'tasks' | 'projects' | 'students' | 'meetings';
  id: string;
  noteId?: string;
  title: string;
  context: string;
};
export function AiSettings() {
  const [config, setConfig] = useState<any>({}),
    [key, setKey] = useState(''),
    [model, setModel] = useState(''),
    [models, setModels] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    api('ai/config')
      .then((c) => {
        setConfig(c);
        setModel(c.model);
      })
      .catch((e) => setMessage(e.message));
  }, []);
  async function act(action: string) {
    setBusy(true);
    setMessage('');
    try {
      if (action === 'clear') {
        await api('ai/config', { clear: true });
        setConfig({});
        setKey('');
        setModel('');
        setModels([]);
        setMessage('已清除本地密钥和模型配置');
        return;
      }
      const c = await api('ai/config', { key, model });
      setConfig(c);
      setKey('');
      if (action === 'models') {
        const r = await api('ai/models', {});
        setModels(r.models);
        setMessage('模型列表已载入，请选择后保存');
      } else if (action === 'test') {
        await api('ai/test', {});
        setMessage('连接成功，模型可以调用');
      } else setMessage('已保存到本机，密钥不会随工作台备份导出');
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel ai-settings">
      <h2>AI 服务 · 硅基流动</h2>
      <p className="settings-copy">
        地址：https://api.siliconflow.cn/v1。调用时仅发送你在预览框中确认的文字，不读取整个文件夹。密钥保存在本机独立配置文件，限制文件访问权限但不做额外加密；不进入普通备份。
      </p>
      <label>
        API Key（{config.configured ? '已配置；留空则保留' : '尚未配置'}）
        <Input
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="在本机粘贴硅基流动密钥"
        />
      </label>
      <label>
        模型
        <Input
          list="sf-models"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="可先保存密钥，再读取模型列表"
        />
        <datalist id="sf-models">
          {models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>
      <div className="button-row">
        <Button disabled={busy} onClick={() => void act('save')}>
          保存配置
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void act('models')}
        >
          读取可用模型
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void act('test')}
        >
          测试连接（少量调用）
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => void act('clear')}
        >
          清除密钥
        </Button>
      </div>
      <p role="status">{busy ? '正在处理…' : message}</p>
    </section>
  );
}
