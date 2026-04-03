/**
 * __tests__/next-server-mock.mjs
 *
 * Minimal stub for `next/server` used during unit testing.
 *
 * Exports the minimum surface needed by lib/security/proxy.ts so
 * tests can run without a full Next.js installation:
 *   - NextResponse  — used by the proxy() function
 *   - NextRequest   — imported as a type; stub class keeps module loading clean
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

export class NextRequest extends Request {
  constructor(input, init) {
    super(input, init);
  }
}

export class NextResponse extends Response {
  constructor(body, init) {
    super(body, init);
  }

  static next(init) {
    return new NextResponse(null, { status: 200, ...init });
  }

  static redirect(url, init) {
    const status = typeof init === "number" ? init : (init?.status ?? 302);
    return new NextResponse(null, {
      status,
      headers: { location: typeof url === "string" ? url : url.toString() },
    });
  }

  static json(data, init) {
    return new NextResponse(JSON.stringify(data), {
      status: 200,
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  }
}
