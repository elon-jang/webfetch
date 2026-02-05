import { describe, it, expect } from 'vitest';
import {
  WebfetchError,
  AuthError,
  ContentError,
  NetworkError,
  TimeoutError,
  AdapterError,
  UploadError,
  isRetryable,
  wrapError,
} from '../src/utils/errors.js';

describe('Error classes', () => {
  it('WebfetchError has correct properties', () => {
    const err = new WebfetchError('test', 'TEST_CODE', { foo: 'bar' });
    expect(err.message).toBe('test');
    expect(err.code).toBe('TEST_CODE');
    expect(err.details.foo).toBe('bar');
    expect(err.timestamp).toBeTruthy();
  });

  it('AuthError supports hint in details', () => {
    const err = new AuthError('auth failed', {
      url: 'https://example.com',
      hint: 'auth/ 폴더를 삭제 후 재로그인',
    });
    expect(err.details.hint).toBe('auth/ 폴더를 삭제 후 재로그인');
    expect(err.retryable).toBe(false);
  });

  it('ContentError supports hint in details', () => {
    const err = new ContentError('no content', {
      hint: '사이트 구조 변경 가능. --keep-open으로 페이지 확인',
    });
    expect(err.details.hint).toBe('사이트 구조 변경 가능. --keep-open으로 페이지 확인');
  });

  it('toJSON includes all fields', () => {
    const err = new AuthError('test', { hint: 'hint text' });
    const json = err.toJSON();
    expect(json.name).toBe('AuthError');
    expect(json.code).toBe('AUTH_ERROR');
    expect(json.details.hint).toBe('hint text');
    expect(json.timestamp).toBeTruthy();
  });
});

describe('isRetryable', () => {
  it('AuthError is not retryable', () => {
    expect(isRetryable(new AuthError('test'))).toBe(false);
  });

  it('NetworkError is retryable', () => {
    expect(isRetryable(new NetworkError('test'))).toBe(true);
  });

  it('TimeoutError is retryable', () => {
    expect(isRetryable(new TimeoutError('test'))).toBe(true);
  });

  it('UploadError is retryable', () => {
    expect(isRetryable(new UploadError('test'))).toBe(true);
  });

  it('ContentError is not retryable', () => {
    expect(isRetryable(new ContentError('test'))).toBe(false);
  });

  it('detects retryable Playwright errors', () => {
    const err = new Error('net::ERR_ABORTED');
    expect(isRetryable(err)).toBe(true);
  });
});

describe('wrapError', () => {
  it('preserves WebfetchError and adds context', () => {
    const err = new AuthError('test', { url: 'http://x.com' });
    const wrapped = wrapError(err, { adapter: 'test' });
    expect(wrapped).toBeInstanceOf(AuthError);
    expect(wrapped.details.adapter).toBe('test');
    expect(wrapped.details.url).toBe('http://x.com');
  });

  it('wraps timeout errors', () => {
    const err = new Error('Navigation Timeout exceeded');
    const wrapped = wrapError(err);
    expect(wrapped).toBeInstanceOf(TimeoutError);
  });

  it('wraps network errors', () => {
    const err = new Error('net::ERR_CONNECTION_REFUSED');
    const wrapped = wrapError(err);
    expect(wrapped).toBeInstanceOf(NetworkError);
  });

  it('wraps unknown errors', () => {
    const err = new Error('something weird');
    const wrapped = wrapError(err);
    expect(wrapped).toBeInstanceOf(WebfetchError);
    expect(wrapped.code).toBe('UNKNOWN_ERROR');
  });
});
