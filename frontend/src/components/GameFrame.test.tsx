import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { GameFrame } from './GameFrame';

/**
 * The Studio's console-error watcher is honest only if a runtime error the
 * game frame actually posts is surfaced to the parent. These tests fire a real
 * `weld:console-error` message event and assert the GameFrame routes it — and
 * that it never invents an error the game didn't produce.
 */
describe('GameFrame console-error routing', () => {
  it('forwards a real weld:console-error postMessage to onError', () => {
    const onError = vi.fn();
    render(<GameFrame src="/games/x" title="x" onError={onError} />);
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'weld:console-error', message: 'TypeError: boom' },
        }),
      );
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('TypeError: boom');
  });

  it('honest: no message -> onError never fires (never fabricates an error)', () => {
    const onError = vi.fn();
    render(<GameFrame src="/games/x" title="x" onError={onError} />);
    expect(onError).not.toHaveBeenCalled();
  });

  it('still routes game-state messages to onState, untouched by the error channel', () => {
    const onState = vi.fn();
    const onError = vi.fn();
    render(<GameFrame src="/games/x" title="x" onState={onState} onError={onError} />);
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'weld:game-state', payload: { status: 'playing' } },
        }),
      );
    });
    expect(onState).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });
});
