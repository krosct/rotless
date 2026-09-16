<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Listeners in app/Listeners are auto-discovered by the framework
        // (handle() type-hinted with the event class), so no manual
        // Event::listen() registration here — it would run twice.
    }
}
