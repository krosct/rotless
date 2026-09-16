<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;

final class OpenFoodFactsClient
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly int $timeoutSeconds = 10,
    ) {}

    /**
     * @return array<string, mixed>|null product data or null when not found.
     */
    public function findByBarcode(string $barcode): ?array
    {
        $response = Http::timeout($this->timeoutSeconds)
            ->acceptJson()
            ->get("{$this->baseUrl}/api/v2/product/{$barcode}.json");

        if (! $response->successful()) {
            return null;
        }

        $payload = $response->json();

        if (! is_array($payload) || ($payload['status'] ?? 0) !== 1 || ! isset($payload['product']) || ! is_array($payload['product'])) {
            return null;
        }

        return $payload['product'];
    }

    public static function fromConfig(): self
    {
        return new self(
            baseUrl: config('services.openfoodfacts.base_url'),
            timeoutSeconds: (int) config('services.openfoodfacts.timeout', 10),
        );
    }
}
