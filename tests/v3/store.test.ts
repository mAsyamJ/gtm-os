import { expect, test } from 'vitest';
import { OperationsStore } from '../../packages/operations/src/store.js';
import { workspace } from '../phase-b/helpers.js';

test('observed records are physically separated and cannot be passed off as synthetic or another tenant', () => {
  const f = workspace();
  try {
    using observed = new OperationsStore(f.root, 'founder', { dataset: 'OBSERVED' });
    observed.put('metric', { id: 'founder-observation', tenant: 'founder', label: 'OWNER_ATTESTED', value: 12 });
    expect(observed.path.endsWith('/founder/observations.sqlite')).toBe(true);
    expect(() => observed.put('metric', { id: 'bad', tenant: 'founder', label: 'SYNTHETIC' })).toThrow();
    expect(() => observed.put('metric', { id: 'bad', tenant: 'retropick', label: 'OWNER_ATTESTED' })).toThrow();
    using synthetic = new OperationsStore(f.root, 'founder');
    expect(synthetic.list('metric')).toEqual([]);
    expect(observed.verify()).toMatchObject({ valid: true, records: 1 });
  } finally { f.cleanup(); }
});
