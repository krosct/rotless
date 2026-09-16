<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class StoreBatchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'household_id' => ['required', 'integer', 'exists:households,id'],
            'quantity' => ['sometimes', 'integer', 'min:1'],
            'expires_at' => ['required', 'date', 'after_or_equal:today'],
            'barcode' => ['required_without:name', 'nullable', 'string', 'max:64'],
            'name' => ['required_without:barcode', 'nullable', 'string', 'max:255'],
            'photo' => ['sometimes', 'image', 'max:5120'],
        ];
    }
}
