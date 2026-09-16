<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\BatchStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBatchRequest;
use App\Http\Requests\UpdateBatchRequest;
use App\Models\Batch;
use App\Models\Household;
use App\Models\Product;
use App\Services\OpenFoodFactsClient;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class BatchController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request): JsonResponse
    {
        $batches = Batch::query()
            ->with('product')
            ->whereHas('household', fn ($query) => $query->whereHas('users', fn ($users) => $users->whereKey($request->user()->id)))
            ->orderBy('expires_at')
            ->get();

        return response()->json([
            'data' => $batches->map(fn (Batch $batch): array => $this->serialize($batch)),
        ]);
    }

    public function store(StoreBatchRequest $request): JsonResponse
    {
        $household = Household::findOrFail($request->integer('household_id'));
        $this->authorize('view', $household);

        $product = $this->resolveProduct($request);

        if ($product === null) {
            return response()->json(['message' => 'Product not found for this barcode.'], 422);
        }

        $batch = Batch::create([
            'household_id' => $household->id,
            'product_id' => $product->id,
            'quantity' => $request->integer('quantity', 1),
            'expires_at' => $request->date('expires_at'),
            'status' => BatchStatus::Active,
        ]);

        return response()->json(['data' => $this->serialize($batch->load('product'))], 201);
    }

    public function show(Batch $batch): JsonResponse
    {
        $this->authorize('view', $batch);

        return response()->json(['data' => $this->serialize($batch->load('product'))]);
    }

    public function update(UpdateBatchRequest $request, Batch $batch): JsonResponse
    {
        $this->authorize('update', $batch);

        $batch->update($request->only(['quantity', 'expires_at', 'status']));

        return response()->json(['data' => $this->serialize($batch->fresh('product'))]);
    }

    public function destroy(Batch $batch): JsonResponse
    {
        $this->authorize('delete', $batch);

        $batch->delete();

        return response()->json(null, 204);
    }

    private function resolveProduct(StoreBatchRequest $request): ?Product
    {
        if ($request->filled('barcode')) {
            $barcode = $request->string('barcode')->toString();

            $cached = Product::where('barcode', $barcode)->first();
            if ($cached !== null) {
                return $cached;
            }

            $data = OpenFoodFactsClient::fromConfig()->findByBarcode($barcode);
            if ($data === null) {
                return null;
            }

            return Product::create([
                'name' => $data['product_name'] ?? $barcode,
                'barcode' => $barcode,
                'openfoodfacts_data' => $data,
            ]);
        }

        return Product::create([
            'name' => $request->string('name')->toString(),
            'photo_path' => $request->hasFile('photo')
                ? $request->file('photo')->store('products', 'public')
                : null,
        ]);
    }

    /** @return array<string, mixed> */
    private function serialize(Batch $batch): array
    {
        return [
            'id' => $batch->id,
            'product' => ['id' => $batch->product->id, 'name' => $batch->product->name],
            'quantity' => $batch->quantity,
            'expires_at' => $batch->expires_at->toDateString(),
            'status' => $batch->status->value,
        ];
    }
}
