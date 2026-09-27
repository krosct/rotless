<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class TelegramWebhookRequest extends FormRequest
{
    public function authorize(): bool
    {
        $secret = (string) config('services.telegram.webhook_secret', '');
        $provided = (string) $this->header('X-Telegram-Bot-Api-Secret-Token', '');

        return $secret !== '' && $provided !== '' && hash_equals($secret, $provided);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'message' => ['nullable', 'array'],
            'message.text' => ['nullable', 'string'],
            'message.chat' => ['nullable', 'array'],
            'message.chat.id' => ['nullable'],
            'message.chat.first_name' => ['nullable', 'string'],
            'message.chat.last_name' => ['nullable', 'string'],
            'message.chat.username' => ['nullable', 'string'],
            'message.chat.title' => ['nullable', 'string'],
        ];
    }
}
