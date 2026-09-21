<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProductRequest;
use App\Models\Product;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
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
            $product->update($attributes);
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
