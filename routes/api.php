<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BatchController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\HouseholdController;
use App\Http\Controllers\Api\V1\InvitationController;
use App\Http\Controllers\Api\V1\ProductController;
use Illuminate\Support\Facades\Route;

Route::get('/v1/health', HealthController::class);

Route::post('/v1/register', [AuthController::class, 'register']);
Route::post('/v1/login', [AuthController::class, 'login']);
Route::get('/v1/invitations/info/{token}', [InvitationController::class, 'info']);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('/v1/logout', [AuthController::class, 'logout']);
    Route::get('/v1/me', [AuthController::class, 'me']);
    Route::patch('/v1/user/profile', [AuthController::class, 'updateProfile']);
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
});
