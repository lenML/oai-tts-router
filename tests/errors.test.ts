import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { OpenAiError, openai_error_from_zod, error_handler } from '../src/errors.ts';
import type { Request, Response, NextFunction } from 'express';

describe('OpenAiError', () => {
  it('should create error with correct properties', () => {
    const err = new OpenAiError(
      'Test message',
      'invalid_request_error',
      'model',
      'model_not_found',
      400,
    );
    expect(err.message).toBe('Test message');
    expect(err.type).toBe('invalid_request_error');
    expect(err.param).toBe('model');
    expect(err.code).toBe('model_not_found');
    expect(err.status_code).toBe(400);
    expect(err.name).toBe('OpenAiError');
  });

  it('should convert to OpenAI-compatible response', () => {
    const err = new OpenAiError('Bad request.', 'invalid_request_error', 'voice', null, 400);
    const response = err.to_response();
    expect(response).toEqual({
      error: {
        message: 'Bad request.',
        type: 'invalid_request_error',
        param: 'voice',
        code: null,
      },
    });
  });

  it('should create error with default null param and code', () => {
    const err = new OpenAiError('Server error.', 'server_error');
    expect(err.param).toBeNull();
    expect(err.code).toBeNull();
    expect(err.status_code).toBe(400);
  });
});

describe('openai_error_from_zod', () => {
  it('should convert a ZodError to OpenAiError', () => {
    const schema = z.object({
      name: z.string().min(1, { message: 'Name is required' }),
    });
    const result = schema.safeParse({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const err = openai_error_from_zod(result.error);
      expect(err.type).toBe('invalid_request_error');
      expect(err.message).toBe('Name is required');
      expect(err.param).toBe('name');
      expect(err.status_code).toBe(400);
    }
  });

  it('should handle nested path', () => {
    const schema = z.object({
      voice: z.string().min(1),
      extra: z.object({
        pitch: z.number(),
      }),
    });
    const result = schema.safeParse({ voice: 'alloy', extra: { pitch: 'high' } });
    expect(result.success).toBe(false);
    if (!result.success) {
      const err = openai_error_from_zod(result.error);
      expect(err.param).toBe('extra.pitch');
    }
  });

  it('should handle root-level errors with no path', () => {
    const schema = z.number();
    const result = schema.safeParse('not-a-number');
    expect(result.success).toBe(false);
    if (!result.success) {
      const err = openai_error_from_zod(result.error);
      expect(err.param).toBeNull();
    }
  });
});

describe('error_handler', () => {
  it('should respond with OpenAiError status and body', () => {
    const err = new OpenAiError('Not found.', 'invalid_request_error', 'model', null, 400);
    const req = {} as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    error_handler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Not found.', type: 'invalid_request_error', param: 'model', code: null },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should fallback to 500 for unknown errors', () => {
    const err = new Error('Unexpected.');
    const req = {} as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    error_handler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'An unexpected error occurred.', type: 'server_error', param: null, code: null },
    });
  });
});
