<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class BatchController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $batches = Batch::query()
            ->with('product')
            ->whereHas('household', fn ($query) => $query->whereHas('users', fn ($users) => $users->whereKey($request->user()->id)))
            ->orderBy('expires_at')
            ->get();

        return response()->json([
            'data' => $batches->map(fn (Batch $batch): array => [
                'id' => $batch->id,
                'product' => ['id' => $batch->product->id, 'name' => $batch->product->name],
                'quantity' => $batch->quantity,
                'expires_at' => $batch->expires_at->toDateString(),
                'status' => $batch->status->value,
            ]),
        ]);
    }
}
