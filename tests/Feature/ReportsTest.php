<?php

declare(strict_types=1);

use App\Enums\HouseholdRole;
use App\Models\Household;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

afterEach(fn () => Carbon::setTestNow());

/** @return array{0: User, 1: User, 2: User, 3: Household} */
function reportsHousehold(): array
{
    $owner = User::factory()->create(['name' => 'Ana']);
    $manager = User::factory()->create(['name' => 'Bia']);
    $member = User::factory()->create(['name' => 'Caio']);
    $household = Household::create(['name' => 'Casa']);
    $household->users()->attach($owner->id, ['role' => HouseholdRole::Owner->value]);
    $household->users()->attach($manager->id, ['role' => HouseholdRole::Manager->value]);
    $household->users()->attach($member->id, ['role' => HouseholdRole::Member->value]);

    return [$owner, $manager, $member, $household];
}

function addAt(string $utc, User $user, Household $household, string $name, int $quantity): int
{
    Carbon::setTestNow($utc);

    return test()->actingAs($user, 'sanctum')->postJson('/api/v1/batches', [
        'household_id' => $household->id,
        'name' => $name,
        'quantity' => $quantity,
        'expires_at' => CarbonImmutable::parse($utc)->addDays(5)->toDateString(),
    ])->assertCreated()->json('data.id');
}

function consumeAt(string $utc, User $user, int $batchId, int $quantity, string $action): void
{
    Carbon::setTestNow($utc);

    test()->actingAs($user, 'sanctum')
        ->postJson("/api/v1/batches/{$batchId}/consume", ['quantity' => $quantity, 'action' => $action])
        ->assertOk();
}

it('is only for owners and managers', function () {
    [$owner, $manager, $member, $household] = reportsHousehold();

    $this->actingAs($member, 'sanctum')->getJson("/api/v1/households/{$household->id}/reports")->assertForbidden();
    $this->actingAs($manager, 'sanctum')->getJson("/api/v1/households/{$household->id}/reports")->assertOk();
    $this->actingAs($owner, 'sanctum')->getJson("/api/v1/households/{$household->id}/reports")->assertOk();
});

it('validates the period and the timezone', function () {
    [$owner, , , $household] = reportsHousehold();

    $this->actingAs($owner, 'sanctum')->getJson("/api/v1/households/{$household->id}/reports?days=12")
        ->assertStatus(422)->assertJsonValidationErrors(['days']);
    $this->actingAs($owner, 'sanctum')->getJson("/api/v1/households/{$household->id}/reports?timezone=Mars/Base")
        ->assertStatus(422)->assertJsonValidationErrors(['timezone']);
});

it('sums consumed and discarded units, the use rate and the rankings', function () {
    [$owner, $manager, $member, $household] = reportsHousehold();

    $milk = addAt('2026-09-20 12:00:00 UTC', $owner, $household, 'Leite', 6);
    $bread = addAt('2026-09-21 12:00:00 UTC', $member, $household, 'Pão', 4);
    consumeAt('2026-09-22 12:00:00 UTC', $manager, $milk, 2, 'consumed');
    consumeAt('2026-09-23 12:00:00 UTC', $member, $milk, 4, 'consumed');
    consumeAt('2026-09-24 12:00:00 UTC', $member, $bread, 1, 'discarded');

    Carbon::setTestNow('2026-09-29 12:00:00 UTC');
    $report = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/households/{$household->id}/reports?days=30&timezone=UTC")
        ->assertOk()->json('data');

    expect($report['totals'])->toMatchArray([
        'added_units' => 10,
        'consumed_units' => 6,
        'discarded_units' => 1,
        'use_rate' => round(6 / 7, 4),
        'operations' => 5,
    ])
        ->and($report['totals']['avg_days_to_consume'])->toBe(2.5)
        ->and($report['totals']['median_days_to_consume'])->toBe(2.5)
        ->and($report['period']['bucket'])->toBe('day')
        ->and($report['timeline'])->toHaveCount(30)
        ->and(collect($report['timeline'])->sum('consumed'))->toBe(6)
        ->and(collect($report['timeline'])->sum('added'))->toBe(10)
        ->and($report['top_consumed'])->toBe([
            ['product_name' => 'Leite', 'units' => 6, 'events' => 2, 'last_at' => '2026-09-23'],
        ])
        ->and($report['top_discarded'])->toBe([
            ['product_name' => 'Pão', 'units' => 1, 'events' => 1, 'last_at' => '2026-09-24'],
        ]);

    $consumedDay = collect($report['timeline'])->firstWhere('date', '2026-09-22');
    expect($consumedDay['consumed'])->toBe(2)
        ->and($consumedDay['use_rate'])->toBe(1)
        ->and($consumedDay['consumed_items'])->toBe([['product_name' => 'Leite', 'units' => 2]]);

    $discardedDay = collect($report['timeline'])->firstWhere('date', '2026-09-24');
    expect($discardedDay['discarded'])->toBe(1)
        ->and($discardedDay['use_rate'])->toBe(0)
        ->and($discardedDay['discarded_items'])->toBe([['product_name' => 'Pão', 'units' => 1]]);

    $caio = collect($report['members'])->firstWhere('user.name', 'Caio');
    expect($caio)->toMatchArray(['added' => 1, 'consumed' => 1, 'discarded' => 1, 'other' => 0, 'total' => 3, 'is_member' => true]);
});

it('compares with the previous period', function () {
    [$owner, , , $household] = reportsHousehold();

    $old = addAt('2026-09-01 12:00:00 UTC', $owner, $household, 'Leite', 2);
    consumeAt('2026-09-02 12:00:00 UTC', $owner, $old, 2, 'discarded');
    $new = addAt('2026-09-26 12:00:00 UTC', $owner, $household, 'Leite', 2);
    consumeAt('2026-09-27 12:00:00 UTC', $owner, $new, 2, 'consumed');

    Carbon::setTestNow('2026-09-29 12:00:00 UTC');
    $report = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/households/{$household->id}/reports?days=7&timezone=UTC")
        ->assertOk()->json('data');

    expect($report['totals']['use_rate'])->toBe(1)
        ->and($report['previous']['use_rate'])->toBeNull()
        ->and($report['timeline'])->toHaveCount(7);

    $month = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/households/{$household->id}/reports?days=30&timezone=UTC")
        ->assertOk()->json('data');
    expect($month['totals']['use_rate'])->toBe(0.5);
});

it('buckets days in the viewer timezone and weeks for 90 days', function () {
    [$owner, , , $household] = reportsHousehold();

    // 22:30 in São Paulo on the 28th is already the 29th in UTC.
    $batch = addAt('2026-09-28 12:00:00 UTC', $owner, $household, 'Leite', 1);
    consumeAt('2026-09-29 01:30:00 UTC', $owner, $batch, 1, 'consumed');

    Carbon::setTestNow('2026-09-29 12:00:00 UTC');
    $local = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/households/{$household->id}/reports?days=7&timezone=America/Sao_Paulo")
        ->assertOk()->json('data');

    expect(collect($local['timeline'])->firstWhere('consumed', 1)['date'])->toBe('2026-09-28');

    $quarter = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/households/{$household->id}/reports?days=90&timezone=America/Sao_Paulo")
        ->assertOk()->json('data');

    expect($quarter['period']['bucket'])->toBe('week')
        ->and(collect($quarter['timeline'])->sum('consumed'))->toBe(1)
        ->and(count($quarter['timeline']))->toBeGreaterThanOrEqual(13);
});

it('does not drop the first hours of the previous period', function () {
    [$owner, , , $household] = reportsHousehold();

    // "days=7" at 2026-09-29 12:00 UTC opens the previous window at
    // 2026-09-16 00:00 UTC. This movement is one hour into it; stored on the
    // app clock (São Paulo) it reads 2026-09-15 22:00.
    addAt('2026-09-16 01:00:00 UTC', $owner, $household, 'Leite', 1);

    Carbon::setTestNow('2026-09-29 12:00:00 UTC');
    $report = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/households/{$household->id}/reports?days=7&timezone=UTC")
        ->assertOk()->json('data');

    expect($report['previous']['added_units'])->toBe(1)
        ->and($report['totals']['added_units'])->toBe(0);
});
