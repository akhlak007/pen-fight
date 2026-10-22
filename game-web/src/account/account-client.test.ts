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

  it('does not let a stale restore overwrite a successful signup', async () => {
    let finishRestore!: (value: Response) => void;
    const restoreResponse = new Promise<Response>((resolve) => { finishRestore = resolve; });
    const account = { id: 'p2', username: 'Nila', profile: createInitialState().profile };
    const fetcher = vi.fn()
      .mockReturnValueOnce(restoreResponse)
      .mockResolvedValueOnce(response({ account }, 201));
    const client = new AccountClient(fetcher as typeof fetch);

    const restoring = client.restore();
    expect(await client.signup('Nila', 'password-1', account.profile)).toEqual(account);
    finishRestore(response({ account: null }));

    expect(await restoring).toBeNull();
    expect(client.state).toEqual({ status: 'authenticated', account });
  });

  it('keeps a valid restore when a concurrent login fails', async () => {
    let finishRestore!: (value: Response) => void;
    const restoreResponse = new Promise<Response>((resolve) => { finishRestore = resolve; });
    const account = { id: 'p3', username: 'Asha', profile: createInitialState().profile };
    const fetcher = vi.fn()
      .mockReturnValueOnce(restoreResponse)
      .mockResolvedValueOnce(response({ error: { message: 'Wrong username or password.' } }, 401));
    const client = new AccountClient(fetcher as typeof fetch);

    const restoring = client.restore();
    await expect(client.login('Asha', 'wrong-password')).rejects.toThrow('Wrong username or password.');
    finishRestore(response({ account }));

    expect(await restoring).toEqual(account);
    expect(client.state).toEqual({ status: 'authenticated', account });
  });
});
