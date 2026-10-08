<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\BatchStatus;
use App\Enums\MovementAction;
use App\Exceptions\OpenFoodFactsUnavailableException;
use App\Http\Controllers\Controller;
use App\Http\Requests\ConsumeBatchRequest;
use App\Http\Requests\StoreBatchRequest;
use App\Http\Requests\UpdateBatchRequest;
use App\Models\Batch;
use App\Models\Household;
use App\Models\HouseholdMovement;
use App\Models\Product;
use App\Services\OpenFoodFactsClient;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

final class BatchController extends Controller
{
    use AuthorizesRequests;

    private const UNAVAILABLE_MESSAGE = 'Barcode lookup service is temporarily unavailable. Please try again.';

    public function index(Request $request): JsonResponse
    {
        $query = Batch::query()
            ->with(['product', 'creator', 'updater'])
            ->whereHas('household', fn ($builder) => $builder->whereHas('users', fn ($users) => $users->whereKey($request->user()->id)));

        if ($request->filled('household_id')) {
            $householdId = $request->integer('household_id');
            $query->where('household_id', $householdId);
        }

        $batches = $query->orderBy('expires_at')->get();

        return response()->json([
            'data' => $batches->map(fn (Batch $batch): array => $this->serialize($batch)),
        ]);
    }

    public function store(StoreBatchRequest $request): JsonResponse
    {
        $household = Household::findOrFail($request->integer('household_id'));
        $this->authorize('view', $household);

        try {
            $product = $this->resolveProduct($request);
        } catch (OpenFoodFactsUnavailableException) {
            return response()->json(['message' => self::UNAVAILABLE_MESSAGE], 503);
        }

        if ($product === null) {
            return response()->json(['message' => 'Product not found for this barcode.'], 422);
        }

        $batch = DB::transaction(function () use ($request, $household, $product): Batch {
            $batch = Batch::create([
                'household_id' => $household->id,
                'product_id' => $product->id,
                'quantity' => $request->integer('quantity', 1),
                'expires_at' => $request->date('expires_at'),
                'status' => BatchStatus::Active,
                'created_by' => $request->user()->id,
                'updated_by' => $request->user()->id,
            ]);

            HouseholdMovement::forBatch($batch, MovementAction::Created, $request->user(), $batch->quantity, [
                'quantity' => [null, $batch->quantity],
                'expires_at' => [null, $batch->expires_at->toDateString()],
            ]);

            return $batch;
        });

        return response()->json(['data' => $this->serialize($batch->load(['product', 'creator', 'updater']))], 201);
    }

    public function show(Batch $batch): JsonResponse
    {
        $this->authorize('view', $batch);

        return response()->json(['data' => $this->serialize($batch->load(['product', 'creator', 'updater']))]);
    }

    public function update(UpdateBatchRequest $request, Batch $batch): JsonResponse
    {
        $this->authorize('update', $batch);

        DB::transaction(function () use ($request, $batch): void {
            $before = $this->snapshot($batch);

            $batch->update([
                ...$request->only(['quantity', 'expires_at', 'status']),
                'updated_by' => $request->user()->id,
            ]);

            $after = $this->snapshot($batch->fresh());
            $changes = array_map(null, $before, $after);
            if ($before === $after) {
                return;
            }

            // Marking a batch consumed/discarded here (edit form, "consume all")
            // is the same movement as the consume endpoint with all its units.
            $action = match (true) {
                $before['status'] === BatchStatus::Active->value && $after['status'] === BatchStatus::Consumed->value => MovementAction::Consumed,
                $before['status'] === BatchStatus::Active->value && $after['status'] === BatchStatus::Discarded->value => MovementAction::Discarded,
                default => MovementAction::Updated,
            };

            HouseholdMovement::forBatch(
                $batch,
                $action,
                $request->user(),
                $action === MovementAction::Updated ? null : $after['quantity'],
                array_combine(array_keys($before), $changes),
            );
        });

        return response()->json(['data' => $this->serialize($batch->fresh(['product', 'creator', 'updater']))]);
    }

    /**
     * Consumes or discards some units of an active batch. All of them marks the
     * batch consumed/discarded; part of them lowers its quantity. Either way the
     * movement records how many units and what happened to them.
     */
    public function consume(ConsumeBatchRequest $request, Batch $batch): JsonResponse
    {
        $this->authorize('update', $batch);

        if ($batch->status !== BatchStatus::Active) {
            return response()->json([
                'message' => 'Only active batches can be consumed or discarded.',
                'errors' => ['action' => ['Only active batches can be consumed or discarded.']],
            ], 422);
        }

        $units = $request->integer('quantity');
        if ($units > $batch->quantity) {
            return response()->json([
                'message' => 'The quantity is larger than what is left in this batch.',
                'errors' => ['quantity' => ['The quantity is larger than what is left in this batch.']],
            ], 422);
        }

        $status = BatchStatus::from($request->string('action')->toString());

        DB::transaction(function () use ($request, $batch, $units, $status): void {
            $all = $units === $batch->quantity;
            $changes = $all
                ? ['status' => [BatchStatus::Active->value, $status->value]]
                : ['quantity' => [$batch->quantity, $batch->quantity - $units]];

            $batch->update([
                ...($all ? ['status' => $status] : ['quantity' => $batch->quantity - $units]),
                'updated_by' => $request->user()->id,
            ]);

            HouseholdMovement::forBatch(
                $batch,
                $status === BatchStatus::Consumed ? MovementAction::Consumed : MovementAction::Discarded,
                $request->user(),
                $units,
                $changes,
            );
        });

        return response()->json(['data' => $this->serialize($batch->fresh(['product', 'creator', 'updater']))]);
    }

    /** @return array{quantity: int, expires_at: string, status: string} */
    private function snapshot(Batch $batch): array
    {
        return [
            'quantity' => $batch->quantity,
            'expires_at' => $batch->expires_at->toDateString(),
            'status' => $batch->status->value,
        ];
    }

    public function destroy(Request $request, Batch $batch): JsonResponse
    {
        $this->authorize('delete', $batch);

        DB::transaction(function () use ($request, $batch): void {
            HouseholdMovement::forBatch($batch, MovementAction::Deleted, $request->user(), $batch->quantity, [
                'quantity' => [$batch->quantity, null],
                'expires_at' => [$batch->expires_at->toDateString(), null],
                'status' => [$batch->status->value, null],
            ]);

            $batch->delete();
        });

        return response()->json(null, 204);
    }

    public function lookupBarcode(Request $request, string $barcode): JsonResponse
    {
        try {
            $data = OpenFoodFactsClient::fromConfig()->findByBarcode($barcode);
        } catch (OpenFoodFactsUnavailableException) {
            return response()->json(['message' => self::UNAVAILABLE_MESSAGE], 503);
        }

        if ($data === null) {
            return response()->json([
                'name' => null,
                'photo_url' => null,
                'barcode' => $barcode,
            ]);
        }

        return response()->json([
            'name' => $data['product_name'] ?? $barcode,
            'photo_url' => $data['image_url'] ?? null,
            'barcode' => $barcode,
        ]);
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
            'product' => [
                'id' => $batch->product->id,
                'name' => $batch->product->name,
                'barcode' => $batch->product->barcode,
                'photo_url' => $batch->product->photo_path === null
                    ? null
                    : Storage::disk('public')->url($batch->product->photo_path),
            ],
            'quantity' => $batch->quantity,
            'expires_at' => $batch->expires_at->toDateString(),
            'status' => $batch->status->value,
            'created_at' => $batch->created_at?->toIso8601String(),
            'updated_at' => $batch->updated_at?->toIso8601String(),
            'created_by' => $batch->creator === null ? null : [
                'id' => $batch->creator->id,
                'name' => $batch->creator->name,
            ],
            'updated_by' => $batch->updater === null ? null : [
                'id' => $batch->updater->id,
                'name' => $batch->updater->name,
            ],
        ];
    }
}
