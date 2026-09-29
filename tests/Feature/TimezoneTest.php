<?php

declare(strict_types=1);

use App\Enums\HouseholdRole;
use App\Models\Household;
use App\Models\User;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

afterEach(fn () => Carbon::setTestNow());

it('runs on Brasília time', function () {
    expect(config('app.timezone'))->toBe('America/Sao_Paulo')
        ->and(date_default_timezone_get())->toBe('America/Sao_Paulo');
});

it('accepts an item that expires today late in the evening', function () {
    // 22:30 in São Paulo on the 29th is already the 30th in UTC; "today" must
    // still be the 29th, the household's calendar day.
    Carbon::setTestNow('2026-09-30 01:30:00 UTC');

    $user = User::factory()->create();
    $household = Household::create(['name' => 'Casa']);
    $household->users()->attach($user->id, ['role' => HouseholdRole::Owner->value]);

    $this->actingAs($user, 'sanctum')->postJson('/api/v1/batches', [
        'household_id' => $household->id,
        'name' => 'Leite',
        'expires_at' => '2026-09-29',
    ])->assertCreated()
        ->assertJsonPath('data.created_at', '2026-09-29T22:30:00-03:00');

    $this->actingAs($user, 'sanctum')->postJson('/api/v1/batches', [
        'household_id' => $household->id,
        'name' => 'Pão',
        'expires_at' => '2026-09-28',
    ])->assertStatus(422)->assertJsonValidationErrors(['expires_at']);
});

it('sends the daily expiry alerts at 08:00 Brasília time', function () {
    $event = collect(app(Schedule::class)->events())
        ->first(fn ($event): bool => str_contains((string) $event->command, 'app:check-expiring-batches'));

    expect($event)->not->toBeNull()
        ->and($event->expression)->toBe('0 8 * * *');

    Carbon::setTestNow('2026-09-29 11:00:00 UTC'); // 08:00 in São Paulo
    expect($event->isDue(app()))->toBeTrue();

    Carbon::setTestNow('2026-09-29 08:00:00 UTC'); // 05:00 in São Paulo
    expect($event->isDue(app()))->toBeFalse();
});
