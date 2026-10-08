<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\OpenFoodFactsUnavailableException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Throwable;

final class OpenFoodFactsClient
{
    /**
     * Status codes worth retrying: OpenFoodFacts rate limits with 429 and
     * occasionally fails on its side with a 5xx.
     *
     * @var list<int>
     */
    private const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];

    public function __construct(
        private readonly string $baseUrl,
        private readonly int $timeoutSeconds = 10,
        private readonly int $maxAttempts = 3,
        private readonly int $retryDelayMilliseconds = 500,
        private readonly string $userAgent = 'Rotless/1.0 (+https://github.com/krosct/rotless)',
    ) {}

    /**
     * @return array<string, mixed>|null product data or null when the barcode is genuinely unknown.
     *
     * @throws OpenFoodFactsUnavailableException when the API is rate limited or unreachable after retries.
     */
    public function findByBarcode(string $barcode): ?array
    {
        $response = Http::timeout($this->timeoutSeconds)
            ->withHeaders(['User-Agent' => $this->userAgent])
            ->acceptJson()
            ->retry(
                $this->maxAttempts,
                $this->retryDelayMilliseconds,
                fn (Throwable $exception): bool => $this->isRetryable($exception),
                throw: false,
            )
            ->get("{$this->baseUrl}/api/v2/product/{$barcode}.json");

        if ($response->status() === 404) {
            return null;
        }

        if (! $response->successful()) {
            throw new OpenFoodFactsUnavailableException(
                "OpenFoodFacts returned HTTP {$response->status()} for barcode {$barcode}."
            );
        }

        $payload = $response->json();

        if (! is_array($payload) || ($payload['status'] ?? 0) !== 1 || ! isset($payload['product']) || ! is_array($payload['product'])) {
            return null;
        }

        return $payload['product'];
    }

    private function isRetryable(Throwable $exception): bool
    {
        if ($exception instanceof ConnectionException) {
            return true;
        }

        return $exception instanceof RequestException
            && in_array($exception->response->status(), self::RETRYABLE_STATUSES, true);
    }

    public static function fromConfig(): self
    {
        return new self(
            baseUrl: config('services.openfoodfacts.base_url'),
            timeoutSeconds: (int) config('services.openfoodfacts.timeout', 10),
            maxAttempts: (int) config('services.openfoodfacts.attempts', 3),
            retryDelayMilliseconds: (int) config('services.openfoodfacts.retry_delay', 500),
            userAgent: (string) config('services.openfoodfacts.user_agent'),
        );
    }
}
