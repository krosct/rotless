<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BatchController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\HouseholdController;
use App\Http\Controllers\Api\V1\InvitationController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\TelegramController;
use Illuminate\Support\Facades\Route;

// Rate limiters (throttle:<name>) are defined in AppServiceProvider.

Route::get('/v1/health', HealthController::class)->middleware('throttle:public');

Route::post('/v1/register', [AuthController::class, 'register'])->middleware('throttle:register');
Route::post('/v1/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::get('/v1/invitations/info/{token}', [InvitationController::class, 'info'])->middleware('throttle:public');
Route::post('/v1/telegram/webhook', [TelegramController::class, 'webhook'])->middleware('throttle:webhook');

Route::middleware(['auth:sanctum', 'throttle:api'])->group(function (): void {
    Route::post('/v1/logout', [AuthController::class, 'logout']);
    Route::get('/v1/me', [AuthController::class, 'me']);
    Route::patch('/v1/user/profile', [AuthController::class, 'updateProfile']);
    Route::patch('/v1/user/password', [AuthController::class, 'updatePassword'])->middleware('throttle:password');
    Route::get('/v1/batches', [BatchController::class, 'index']);
    Route::post('/v1/batches', [BatchController::class, 'store']);
    Route::get('/v1/batches/{batch}', [BatchController::class, 'show']);
    Route::patch('/v1/batches/{batch}', [BatchController::class, 'update']);
    Route::delete('/v1/batches/{batch}', [BatchController::class, 'destroy']);
    Route::get('/v1/openfoodfacts/{barcode}', [BatchController::class, 'lookupBarcode']);
    Route::patch('/v1/products/{product}', [ProductController::class, 'update']);
    Route::post('/v1/households/{household}/invitations', [InvitationController::class, 'store']);
    Route::patch('/v1/households/{household}', [HouseholdController::class, 'update']);
    Route::get('/v1/households/{household}/members', [HouseholdController::class, 'members']);
    Route::get('/v1/households/{household}/activities', [HouseholdController::class, 'activities']);
    Route::get('/v1/households/{household}/actors', [HouseholdController::class, 'actors']);
    Route::delete('/v1/households/{household}/members/{user}', [HouseholdController::class, 'removeMember']);
    Route::patch('/v1/households/{household}/members/{user}/role', [HouseholdController::class, 'updateMemberRole']);
    Route::post('/v1/invitations/accept', [InvitationController::class, 'accept']);
    Route::post('/v1/telegram/link', [TelegramController::class, 'link']);
    Route::delete('/v1/telegram/link', [TelegramController::class, 'unlink']);
});
