declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
    CREATE_LIMIT: RateLimit;
    WRITE_LIMIT: RateLimit;
    SEND_EMAIL: SendEmail;
    TURNSTILE_SITE_KEY: string;
    TURNSTILE_SECRET?: string;
  }
}
