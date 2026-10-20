import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors.ts';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function apiSecurityMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!WRITE_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  // 1. Origin host check when Origin header is present
  const originHeader = req.headers.origin;
  if (originHeader) {
    let originHost = '';
    try {
      originHost = new URL(originHeader).host.toLowerCase();
    } catch {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN_ORIGIN',
          message: 'Invalid Origin header.',
        },
      });
      return;
    }

    const rawHost = (req.headers.host || '').toLowerCase();
    const rawForwardedHost = (
      Array.isArray(req.headers['x-forwarded-host'])
        ? req.headers['x-forwarded-host'][0]
        : req.headers['x-forwarded-host'] || ''
    )
      .split(',')[0]
      .trim()
      .toLowerCase();

    const matchesHost = Boolean(rawHost && originHost === rawHost);
    const matchesForwarded = Boolean(rawForwardedHost && originHost === rawForwardedHost);

    if (!matchesHost && !matchesForwarded) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN_ORIGIN',
          message: 'Origin host does not match request Host.',
        },
      });
      return;
    }
  }

  // 2. Content-Type: application/json check on all write requests
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    res.status(400).json({
      error: {
        code: 'INVALID_CONTENT_TYPE',
        message: 'Write requests must send Content-Type: application/json.',
      },
    });
    return;
  }

  next();
}

export function apiErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.fields ? { fields: err.fields } : {}),
      },
    });
    return;
  }

  if (
    err &&
    typeof err === 'object' &&
    'type' in err &&
    (err as { type?: string }).type === 'entity.parse.failed'
  ) {
    res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Request body contains malformed JSON.',
      },
    });
    return;
  }

  // Generic 500 with no stack trace or SQL details
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected server error occurred.',
    },
  });
}
