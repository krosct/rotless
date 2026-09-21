<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\HouseholdRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Requests\UpdateProfileRequest;
use App\Models\Household;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\Pivot;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

final class AuthController extends Controller
{
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = DB::transaction(function () use ($request): User {
            $user = User::create([
                'name' => $request->string('name'),
                'email' => $request->string('email'),
                'password' => $request->string('password'),
            ]);

            $household = Household::create([
                'name' => "{$user->name}'s pantry",
            ]);

            $household->users()->attach($user->id, ['role' => HouseholdRole::Owner->value]);

            return $user;
        });

        $token = $user->createToken('auth')->plainTextToken;

        return response()->json([
            'user' => $this->serializeUser($user),
            'token' => $token,
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->string('email'))->first();

        if ($user === null || ! Hash::check($request->string('password')->toString(), $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        $token = $user->createToken('auth')->plainTextToken;

        return response()->json([
            'user' => $this->serializeUser($user),
            'token' => $token,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load('households');

        return response()->json([
            'user' => $this->serializeUser($user),
        ]);
    }

    public function updateProfile(UpdateProfileRequest $request, Request $httpRequest): JsonResponse
    {
        $user = $httpRequest->user();
        $user->update($request->only(['name', 'telegram_chat_id']));

        return response()->json([
            'user' => $this->serializeUser($user->fresh()->load('households')),
            'message' => 'Profile updated successfully.',
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    /** @return array<string, mixed> */
    private function serializeUser(User $user): array
    {
        $households = $user->households->map(function ($household) {
            /** @var Pivot $pivot */
            $pivot = $household->getAttribute('pivot');

            return [
                'id' => $household->id,
                'name' => $household->name,
                'is_owner' => $pivot->getAttribute('role') === HouseholdRole::Owner->value,
                'role' => $pivot->getAttribute('role'),
            ];
        })->values()->all();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'telegram_chat_id' => $user->telegram_chat_id,
            'households' => $households,
        ];
    }
}
