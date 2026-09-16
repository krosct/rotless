<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\BatchStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateBatchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'quantity' => ['sometimes', 'integer', 'min:1'],
            'expires_at' => ['sometimes', 'date', 'after_or_equal:today'],
            'status' => ['sometimes', Rule::enum(BatchStatus::class)],
        ];
    }
}
