<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BatchController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\InvitationController;
use Illuminate\Support\Facades\Route;

Route::get('/v1/health', HealthController::class);

Route::post('/v1/register', [AuthController::class, 'register']);
Route::post('/v1/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('/v1/logout', [AuthController::class, 'logout']);
    Route::get('/v1/batches', [BatchController::class, 'index']);
    Route::post('/v1/batches', [BatchController::class, 'store']);
    Route::get('/v1/batches/{batch}', [BatchController::class, 'show']);
    Route::patch('/v1/batches/{batch}', [BatchController::class, 'update']);
    Route::delete('/v1/batches/{batch}', [BatchController::class, 'destroy']);
    Route::post('/v1/households/{household}/invitations', [InvitationController::class, 'store']);
    Route::post('/v1/invitations/accept', [InvitationController::class, 'accept']);
});
