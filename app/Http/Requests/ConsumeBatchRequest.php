<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\BatchStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ConsumeBatchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'quantity' => ['required', 'integer', 'min:1'],
            'action' => ['required', Rule::in([BatchStatus::Consumed->value, BatchStatus::Discarded->value])],
        ];
    }
}
