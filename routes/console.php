<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// 08:00 in the app timezone (Brasília): alerts arrive in the morning, not at
// midnight.
Schedule::command('app:check-expiring-batches')->dailyAt('08:00');
