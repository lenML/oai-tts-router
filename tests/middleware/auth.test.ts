/**
 * Auth middleware tests.
 * Tests bearer_auth (API routes) and basic_auth (playground).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { init_auth, bearer_auth, basic_auth } from '../../src/middleware/auth.js';
import { OpenAiError } from '../../src/errors.js';

function mock_req(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function mock_res(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    send: vi.fn(),
    setHeader: vi.fn(),
  } as unknown as Response;
  return res;
}

describe('bearer_auth', () => {
  beforeEach(() => {
    init_auth(undefined);
  });

  it('should call next() when no API_KEY is configured', () => {
    const req = mock_req();
    const res = mock_res();
    const next = vi.fn() as NextFunction;

    bearer_auth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next() when API_KEY is empty string', () => {
    init_auth('');
    const req = mock_req();
    const res = mock_res();
    const next = vi.fn() as NextFunction;

    bearer_auth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('should return 401 when no Authorization header is present', () => {
    init_auth('sk-secret');
    const req = mock_req({});
    const res = mock_res();
    const next = vi.fn() as NextFunction;

    bearer_auth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    const err = next.mock.calls[0][0] as Error;
    expect(err.message).toBe('No API key provided. Set the Authorization header.');
    expect((err as OpenAiError).status_code).toBe(401);
  });

  it('should return 401 for invalid Authorization header format', () => {
    init_auth('sk-secret');
    const req = mock_req({ authorization: 'Basic xxx' });
    const res = mock_res();
    const next = vi.fn() as NextFunction;

    bearer_auth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    const err = next.mock.calls[0][0] as Error;
    expect(err.message).toContain('Invalid Authorization header format');
    expect((err as OpenAiError).status_code).toBe(401);
  });

  it('should return 401 for wrong API key', () => {
    init_auth('sk-secret');
    const req = mock_req({ authorization: 'Bearer wrong-key' });
    const res = mock_res();
    const next = vi.fn() as NextFunction;

    bearer_auth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    const err = next.mock.calls[0][0] as Error;
    expect(err.message).toBe('Invalid API key.');
    expect((err as OpenAiError).status_code).toBe(401);
  });

  it('should accept valid API key', () => {
    init_auth('sk-secret');
    const req = mock_req({ authorization: 'Bearer sk-secret' });
    const res = mock_res();
    const next = vi.fn() as NextFunction;

    bearer_auth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('should accept any key from a comma-separated list', () => {
    init_auth('sk-foo,sk-bar,sk-baz');
    const req = mock_req({ authorization: 'Bearer sk-bar' });
    const res = mock_res();
    const next = vi.fn() as NextFunction;

    bearer_auth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('should accept either key from a list with whitespace', () => {
    init_auth(' sk-foo , sk-bar ');
    const req = mock_req({ authorization: 'Bearer sk-foo' });
    const res = mock_res();
    const next = vi.fn() as NextFunction;

    bearer_auth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toBeUndefined();
  });
});

describe('basic_auth', () => {
  beforeEach(() => {
    init_auth(undefined);
  });

  it('should call next() when no API_KEY is configured', () => {
    const req = mock_req();
    const res = mock_res();
    const next = vi.fn() as NextFunction;

    basic_auth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('should return 401 with WWW-Authenticate when no header is present', () => {
    init_auth('sk-secret');
    const req = mock_req({});
    const res = mock_res();
    const next = vi.fn() as NextFunction;

    basic_auth(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'WWW-Authenticate',
      expect.stringContaining('Basic realm'),
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith('Authentication required');
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for wrong password', () => {
    init_auth('sk-secret');
    const encoded = Buffer.from('user:wrong-password').toString('base64');
    const req = mock_req({ authorization: `Basic ${encoded}` });
    const res = mock_res();
    const next = vi.fn() as NextFunction;

    basic_auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith('Invalid credentials');
  });

  it('should accept valid password (API key) with any username', () => {
    init_auth('sk-secret');
    const encoded = Buffer.from('some-random-user:sk-secret').toString('base64');
    const req = mock_req({ authorization: `Basic ${encoded}` });
    const res = mock_res();
    const next = vi.fn() as NextFunction;

    basic_auth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('should accept any key from a comma-separated list', () => {
    init_auth('sk-foo,sk-bar');
    const encoded = Buffer.from('admin:sk-bar').toString('base64');
    const req = mock_req({ authorization: `Basic ${encoded}` });
    const res = mock_res();
    const next = vi.fn() as NextFunction;

    basic_auth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('should reject missing colon in decoded credentials', () => {
    init_auth('sk-secret');
    const encoded = Buffer.from('justausername').toString('base64');
    const req = mock_req({ authorization: `Basic ${encoded}` });
    const res = mock_res();
    const next = vi.fn() as NextFunction;

    basic_auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith('Invalid credentials');
  });

  it('should reject malformed base64 gracefully', () => {
    init_auth('sk-secret');
    const req = mock_req({ authorization: 'Basic not-valid-base64!!!' });
    const res = mock_res();
    const next = vi.fn() as NextFunction;

    basic_auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith('Invalid credentials');
  });
});
