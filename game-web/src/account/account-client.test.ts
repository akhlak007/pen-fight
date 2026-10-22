import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../app/app-state';
import { AccountClient } from './account-client';

const response = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

describe('account client', () => {
  it('restores and synchronizes an authenticated account', async () => {
    const account = { id: 'p1', username: 'Rafi', profile: createInitialState().profile };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ account }))
      .mockResolvedValueOnce(response({ account: { ...account, profile: { ...account.profile, xp: 100 } } }));
    const client = new AccountClient(fetcher as typeof fetch);

    expect(await client.restore()).toEqual(account);
    expect((await client.syncProfile({ ...account.profile, xp: 100 }))?.profile.xp).toBe(100);
    expect(fetcher).toHaveBeenLastCalledWith('/api/profile', expect.objectContaining({ method: 'PATCH', credentials: 'include' }));
  });

  it('keeps the game available when session restoration is offline', async () => {
    const client = new AccountClient(vi.fn().mockRejectedValue(new Error('offline')) as typeof fetch);
    expect(await client.restore()).toBeNull();
    expect(client.state).toEqual({ status: 'offline', error: 'offline' });
  });
});
