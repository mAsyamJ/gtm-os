import { spawnSync } from 'node:child_process';
import { safePath } from '../../core/src/workspace.js';
import { GtmError } from '../../observability/src/index.js';
import { context, artifact } from './common.js';

export function researchReplay(root: string, selected: unknown) {
  const c = context(root, selected, 'SYNTHETIC');
  const samples = [
    { mode: 'rss', interpreter: '/home/ubuntu/.local/share/uv/tools/agent-reach/bin/python', input: { tenant: c.tenant,
      feed: '<rss><channel><item><guid>fixture-one</guid><title>Source-backed explanation</title><pubDate>Mon, 19 Oct 2026 00:00:00 GMT</pubDate></item></channel></rss>' } },
    { mode: 'dates', interpreter: '/usr/bin/python3', input: { tenant: c.tenant, days: 30, asOf: '2026-10-19' } },
    { mode: 'html', interpreter: '/home/ubuntu/agent-control-plane/adapters/scrapling/.venv/bin/python', input: { tenant: c.tenant,
      html: '<html><title>Local review fixture</title><body><p>Source scope remains explicit.</p><script>untrusted()</script></body></html>' } },
  ];
  const jobs = samples.map(sample => {
    const p = spawnSync(sample.interpreter, ['-I', safePath(root, 'adapters/research/offline.py'), sample.mode],
      { input: JSON.stringify(sample.input), encoding: 'utf8', timeout: 20000, maxBuffer: 1048576, env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' } });
    if (p.error || p.status !== 0) throw new GtmError('RESEARCH_COMPONENT_BLOCKED', `Offline ${sample.mode} component unavailable; no alternative was installed`, 4);
    return JSON.parse(p.stdout) as unknown;
  });
  return { ...c, label: 'SYNTHETIC', jobs, receipt: artifact(root, c.tenant, 'research-replay', jobs), liveRetrievalProven: false };
}
