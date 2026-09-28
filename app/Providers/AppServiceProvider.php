<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Listeners in app/Listeners are auto-discovered by the framework
        // (handle() type-hinted with the event class), so no manual
        // Event::listen() registration here — it would run twice.

        $this->configureRateLimiting();
    }

    /**
     * Brute-force and abuse protection, applied per route with `throttle:<name>`.
     *
     * The client IP comes from the trusted reverse proxy (see bootstrap/app.php).
     * Login combines three keys: account + IP stops a single attacker, IP alone
     * caps credential stuffing across many accounts, and the account alone caps a
     * distributed attack on one account from many IPs.
     */
    private function configureRateLimiting(): void
    {
        RateLimiter::for('login', function (Request $request): array {
            $email = Str::transliterate(Str::lower($request->string('email')->trim()->toString()));
            $ip = (string) $request->ip();

            return [
                Limit::perMinute(5)->by("login:{$email}|{$ip}")->response($this->tooManyAttempts(...)),
                Limit::perMinute(20)->by("login-ip:{$ip}")->response($this->tooManyAttempts(...)),
                Limit::perMinutes(15, 10)->by("login-account:{$email}")->response($this->tooManyAttempts(...)),
            ];
        });

        RateLimiter::for('register', fn (Request $request): Limit => Limit::perHour(10)
            ->by('register:'.$request->ip())
            ->response($this->tooManyAttempts(...)));

        // Guards the current-password check against guessing with a stolen token.
        RateLimiter::for('password', fn (Request $request): Limit => Limit::perMinutes(15, 5)
            ->by('password:'.($request->user()?->getAuthIdentifier() ?? $request->ip()))
            ->response($this->tooManyAttempts(...)));

        RateLimiter::for('public', fn (Request $request): Limit => Limit::perMinute(30)
            ->by('public:'.$request->ip())
            ->response($this->tooManyAttempts(...)));

        RateLimiter::for('webhook', fn (Request $request): Limit => Limit::perMinute(120)
            ->by('webhook:'.$request->ip())
            ->response($this->tooManyAttempts(...)));

        RateLimiter::for('api', fn (Request $request): Limit => Limit::perMinute(120)
            ->by('api:'.($request->user()?->getAuthIdentifier() ?? $request->ip()))
            ->response($this->tooManyAttempts(...)));
    }

    /** @param array<string, string|int> $headers */
    private function tooManyAttempts(Request $request, array $headers): JsonResponse
    {
        $retryAfter = (int) ($headers['Retry-After'] ?? 60);

        return response()->json([
            'message' => "Too many attempts. Try again in {$retryAfter} seconds.",
        ], 429, $headers);
    }
}
