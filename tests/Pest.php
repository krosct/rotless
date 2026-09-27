<?php

use Tests\TestCase;

/*
 * Tests must never touch the development database. RefreshDatabase drops every
 * table, so force the in-memory SQLite connection before the framework boots.
 * The phpunit.xml <env> entries are not enough when the shell or container
 * exports DB_CONNECTION/DB_DATABASE as real environment variables.
 */
foreach ([
    'APP_ENV' => 'testing',
    'DB_CONNECTION' => 'sqlite',
    'DB_DATABASE' => ':memory:',
    'DB_URL' => '',
    'DB_HOST' => '',
    'DB_PORT' => '',
    'DB_USERNAME' => '',
    'DB_PASSWORD' => '',
] as $key => $value) {
    putenv("{$key}={$value}");
    $_ENV[$key] = $value;
    $_SERVER[$key] = $value;
}

pest()->extend(TestCase::class)->in('Feature', 'Unit');
