<?php

declare(strict_types=1);

use App\Enums\BatchStatus;
use App\Enums\HouseholdRole;
use App\Enums\MovementAction;
use App\Models\Batch;
use App\Models\Household;
use App\Models\HouseholdInvitation;
use App\Models\HouseholdMovement;
use App\Models\Product;
use App\Models\User;
use App\Support\MovementBackfill;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/** @return array{0: User, 1: User, 2: Household} */
function movementsHousehold(): array
{
    $owner = User::factory()->create(['name' => 'Ana']);
    $member = User::factory()->create(['name' => 'Bia']);
    $household = Household::create(['name' => 'Casa']);
    $household->users()->attach($owner->id, ['role' => HouseholdRole::Owner->value]);
    $household->users()->attach($member->id, ['role' => HouseholdRole::Member->value]);

    return [$owner, $member, $household];
}

function createBatchVia(User $user, Household $household, int $quantity = 6, int $days = 5): int
{
    return test()->actingAs($user, 'sanctum')->postJson('/api/v1/batches', [
        'household_id' => $household->id,
        'name' => 'Leite',
        'quantity' => $quantity,
        'expires_at' => now()->addDays($days)->toDateString(),
    ])->assertCreated()->json('data.id');
}

function lastMovement(): HouseholdMovement
{
    return HouseholdMovement::query()->latest('id')->firstOrFail();
}

it('records who created a batch and with what', function () {
    [, $member, $household] = movementsHousehold();
    $id = createBatchVia($member, $household, 6);

    $movement = lastMovement();

    expect($movement->action)->toBe(MovementAction::Created)
        ->and($movement->user_id)->toBe($member->id)
        ->and($movement->batch_id)->toBe($id)
        ->and($movement->product_name)->toBe('Leite')
        ->and($movement->quantity)->toBe(6)
        ->and($movement->changes['quantity'])->toBe(['from' => null, 'to' => 6]);
});

it('records each changed field of an edit, from and to', function () {
    [$owner, , $household] = movementsHousehold();
    $id = createBatchVia($owner, $household, 6, 5);
    $newDate = now()->addDays(8)->toDateString();

    $this->actingAs($owner, 'sanctum')
        ->patchJson("/api/v1/batches/{$id}", ['expires_at' => $newDate, 'quantity' => 6])
        ->assertOk();

    $movement = lastMovement();

    expect($movement->action)->toBe(MovementAction::Updated)
        ->and($movement->changes)->toBe([
            'expires_at' => ['from' => now()->addDays(5)->toDateString(), 'to' => $newDate],
        ]);
});

it('records nothing for an edit that changes nothing', function () {
    [$owner, , $household] = movementsHousehold();
    $id = createBatchVia($owner, $household, 6);

    $this->actingAs($owner, 'sanctum')->patchJson("/api/v1/batches/{$id}", ['quantity' => 6])->assertOk();

    expect(HouseholdMovement::count())->toBe(1);
});

it('consumes part of a batch: quantity goes down, the movement says how much', function () {
    [$owner, $member, $household] = movementsHousehold();
    $id = createBatchVia($owner, $household, 6);

    $this->actingAs($member, 'sanctum')
        ->postJson("/api/v1/batches/{$id}/consume", ['quantity' => 2, 'action' => 'consumed'])
        ->assertOk()
        ->assertJsonPath('data.quantity', 4)
        ->assertJsonPath('data.status', 'active');

    $movement = lastMovement();

    expect($movement->action)->toBe(MovementAction::Consumed)
        ->and($movement->user_id)->toBe($member->id)
        ->and($movement->quantity)->toBe(2)
        ->and($movement->changes)->toBe(['quantity' => ['from' => 6, 'to' => 4]]);
});

it('discards all of a batch: status changes, the movement keeps the units', function () {
    [$owner, , $household] = movementsHousehold();
    $id = createBatchVia($owner, $household, 3);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/batches/{$id}/consume", ['quantity' => 3, 'action' => 'discarded'])
        ->assertOk()
        ->assertJsonPath('data.status', 'discarded')
        ->assertJsonPath('data.quantity', 3);

    expect(lastMovement()->action)->toBe(MovementAction::Discarded)
        ->and(lastMovement()->quantity)->toBe(3)
        ->and(lastMovement()->changes)->toBe(['status' => ['from' => 'active', 'to' => 'discarded']]);
});

it('treats marking a batch consumed in the edit form as consuming all of it', function () {
    [$owner, , $household] = movementsHousehold();
    $id = createBatchVia($owner, $household, 4);

    $this->actingAs($owner, 'sanctum')->patchJson("/api/v1/batches/{$id}", ['status' => 'consumed'])->assertOk();

    expect(lastMovement()->action)->toBe(MovementAction::Consumed)
        ->and(lastMovement()->quantity)->toBe(4);
});

it('rejects consuming more than is left or an inactive batch', function () {
    [$owner, , $household] = movementsHousehold();
    $id = createBatchVia($owner, $household, 2);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/batches/{$id}/consume", ['quantity' => 3, 'action' => 'consumed'])
        ->assertStatus(422)->assertJsonValidationErrors(['quantity']);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/batches/{$id}/consume", ['quantity' => 2, 'action' => 'consumed'])->assertOk();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/batches/{$id}/consume", ['quantity' => 1, 'action' => 'discarded'])
        ->assertStatus(422)->assertJsonValidationErrors(['action']);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/batches/{$id}/consume", ['quantity' => 1, 'action' => 'eaten'])
        ->assertStatus(422)->assertJsonValidationErrors(['action']);
});

it('forbids consuming a batch of another household', function () {
    [$owner, , $household] = movementsHousehold();
    $id = createBatchVia($owner, $household, 2);
    $stranger = User::factory()->create();

    $this->actingAs($stranger, 'sanctum')
        ->postJson("/api/v1/batches/{$id}/consume", ['quantity' => 1, 'action' => 'consumed'])
        ->assertForbidden();

    expect(HouseholdMovement::count())->toBe(1);
});

it('keeps the history of a deleted batch', function () {
    [$owner, , $household] = movementsHousehold();
    $id = createBatchVia($owner, $household, 3);

    $this->actingAs($owner, 'sanctum')->deleteJson("/api/v1/batches/{$id}")->assertNoContent();

    expect(Batch::find($id))->toBeNull()
        ->and(HouseholdMovement::where('batch_id', $id)->pluck('action')->all())
        ->toBe([MovementAction::Created, MovementAction::Deleted])
        ->and(lastMovement()->product_name)->toBe('Leite')
        ->and(lastMovement()->changes['quantity'])->toBe(['from' => 3, 'to' => null]);
});

it('records product renames in the household that holds the product', function () {
    [$owner, , $household] = movementsHousehold();
    createBatchVia($owner, $household);
    $product = Product::firstOrFail();

    $this->actingAs($owner, 'sanctum')
        ->patchJson("/api/v1/products/{$product->id}", ['name' => 'Leite desnatado'])
        ->assertOk();

    expect(lastMovement()->action)->toBe(MovementAction::ProductUpdated)
        ->and(lastMovement()->household_id)->toBe($household->id)
        ->and(lastMovement()->changes)->toBe(['name' => ['from' => 'Leite', 'to' => 'Leite desnatado']]);
});

it('records household and member events', function () {
    [$owner, $member, $household] = movementsHousehold();

    $this->actingAs($owner, 'sanctum')->patchJson("/api/v1/households/{$household->id}", ['name' => 'Casa Nova'])->assertOk();
    $this->actingAs($owner, 'sanctum')->patchJson("/api/v1/households/{$household->id}/members/{$member->id}/role", ['role' => 'manager'])->assertOk();
    $token = $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/households/{$household->id}/invitations", ['email' => 'caio@example.com'])
        ->assertCreated()->json('invitation.token');

    $caio = User::factory()->create(['email' => 'caio@example.com']);
    $this->actingAs($caio, 'sanctum')->postJson('/api/v1/invitations/accept', ['token' => $token])->assertOk();
    $this->actingAs($owner, 'sanctum')->deleteJson("/api/v1/households/{$household->id}/members/{$member->id}")->assertOk();

    $movements = HouseholdMovement::orderBy('id')->get();

    expect($movements->pluck('action')->all())->toBe([
        MovementAction::HouseholdRenamed,
        MovementAction::MemberRoleChanged,
        MovementAction::MemberInvited,
        MovementAction::MemberJoined,
        MovementAction::MemberRemoved,
    ])
        ->and($movements[0]->changes)->toBe(['name' => ['from' => 'Casa', 'to' => 'Casa Nova']])
        ->and($movements[1]->subject_user_id)->toBe($member->id)
        ->and($movements[1]->changes)->toBe(['role' => ['from' => 'member', 'to' => 'manager']])
        ->and($movements[3]->user_id)->toBe($caio->id)
        ->and($movements[4]->subject_user_id)->toBe($member->id);
    expect(HouseholdInvitation::count())->toBe(1);
});

it('pages the history newest first and filters member events', function () {
    [$owner, $member, $household] = movementsHousehold();
    foreach (range(1, 3) as $_) {
        createBatchVia($owner, $household);
    }
    $this->actingAs($owner, 'sanctum')->patchJson("/api/v1/households/{$household->id}/members/{$member->id}/role", ['role' => 'manager'])->assertOk();

    $first = $this->actingAs($owner, 'sanctum')->getJson("/api/v1/households/{$household->id}/activities?limit=3");
    $first->assertOk()->assertJsonCount(3, 'data')->assertJsonPath('data.0.action', 'member_role_changed');
    $next = $first->json('meta.next_before');
    expect($next)->not->toBeNull();

    $second = $this->actingAs($owner, 'sanctum')->getJson("/api/v1/households/{$household->id}/activities?limit=3&before={$next}");
    $second->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.next_before', null);

    $members = $this->actingAs($owner, 'sanctum')->getJson("/api/v1/households/{$household->id}/activities?action=members");
    $members->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.subject.name', 'Bia')
        ->assertJsonPath('data.0.changes.role.to', 'manager');
});

it('rebuilds the history of batches that existed before movements', function () {
    [$owner, $member, $household] = movementsHousehold();
    $product = Product::create(['name' => 'Arroz']);

    $active = Batch::create([
        'household_id' => $household->id, 'product_id' => $product->id, 'quantity' => 2,
        'expires_at' => now()->addDays(10)->toDateString(), 'status' => BatchStatus::Active,
        'created_by' => $owner->id, 'updated_by' => $owner->id,
    ]);
    $eaten = Batch::create([
        'household_id' => $household->id, 'product_id' => $product->id, 'quantity' => 1,
        'expires_at' => now()->addDays(3)->toDateString(), 'status' => BatchStatus::Consumed,
        'created_by' => $owner->id, 'updated_by' => $member->id,
    ]);

    MovementBackfill::run();

    expect(HouseholdMovement::where('batch_id', $active->id)->pluck('action')->all())->toBe([MovementAction::Created])
        ->and(HouseholdMovement::where('batch_id', $eaten->id)->pluck('action')->all())
        ->toBe([MovementAction::Created, MovementAction::Consumed])
        ->and(HouseholdMovement::where('batch_id', $eaten->id)->where('action', 'consumed')->value('user_id'))->toBe($member->id)
        ->and(HouseholdMovement::first()->changes['backfilled'])->toBeTrue()
        ->and(Batch::count())->toBe(2);
});
