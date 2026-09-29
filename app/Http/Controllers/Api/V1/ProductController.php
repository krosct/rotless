<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\MovementAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProductRequest;
use App\Models\HouseholdMovement;
use App\Models\Product;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

final class ProductController extends Controller
{
    use AuthorizesRequests;

    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
        $this->authorize('update', $product);

        $attributes = [];

        if ($request->filled('name')) {
            $attributes['name'] = $request->string('name')->toString();
        }

        if ($request->hasFile('photo')) {
            if ($product->photo_path !== null) {
                Storage::disk('public')->delete($product->photo_path);
            }

            $attributes['photo_path'] = $request->file('photo')->store('products', 'public');
        }

        if ($attributes !== []) {
            $before = $product->name;

            DB::transaction(function () use ($request, $product, $attributes, $before): void {
                $product->update($attributes);

                // One entry in each of the user's households that holds the product.
                $householdIds = $product->batches()
                    ->whereIn('household_id', $request->user()->households()->pluck('households.id'))
                    ->distinct()
                    ->pluck('household_id');

                foreach ($householdIds as $householdId) {
                    HouseholdMovement::create([
                        'household_id' => $householdId,
                        'user_id' => $request->user()->id,
                        'action' => MovementAction::ProductUpdated,
                        'product_id' => $product->id,
                        'product_name' => $product->name,
                        'changes' => array_filter([
                            'name' => $before !== $product->name ? ['from' => $before, 'to' => $product->name] : null,
                            'photo' => isset($attributes['photo_path']) ? ['from' => null, 'to' => 'updated'] : null,
                        ]),
                    ]);
                }
            });
        }

        return response()->json([
            'data' => [
                'id' => $product->id,
                'name' => $product->name,
                'barcode' => $product->barcode,
                'photo_url' => $product->photo_path === null
                    ? null
                    : Storage::disk('public')->url($product->photo_path),
            ],
        ]);
    }
}
