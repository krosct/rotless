<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->guardAgainstDestructiveDatabase();
    }

    /**
     * Tests use RefreshDatabase, which drops every table. Running them against
     * the development database would wipe real data, so refuse to start unless
     * the connection is the in-memory SQLite database.
     */
    private function guardAgainstDestructiveDatabase(): void
    {
        $connection = config('database.default');
        $database = config("database.connections.{$connection}.database");

        if ($connection !== 'sqlite' || $database !== ':memory:') {
            throw new RuntimeException(
                "Refusing to run tests against the '{$connection}' connection (database: {$database}). "
                .'Tests must use the in-memory SQLite database to avoid destroying development data.'
            );
        }
    }
}
