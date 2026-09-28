# App image: FrankenPHP (PHP 8.3) serves the API; the queue and scheduler
# services reuse it with their own `php artisan` commands.
FROM dunglas/frankenphp:1.12.7-php8.3-bookworm

# The base image already ships mbstring, opcache and pdo_sqlite (test suite).
# pcntl lets queue:work enforce job timeouts.
RUN install-php-extensions pdo_pgsql pgsql zip intl bcmath gd pcntl \
    && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

COPY docker/frankenphp/php.ini "$PHP_INI_DIR/conf.d/zz-rotless.ini"
COPY docker/frankenphp/Caddyfile /etc/frankenphp/Caddyfile

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Dependencies first: this layer is reused while composer.json/composer.lock
# are unchanged, so a code-only deploy skips `composer install` (slow and
# memory-hungry on the 1 GB VPS). Scripts need the app code, so they run below.
COPY composer.json composer.lock ./
RUN composer install --no-interaction --prefer-dist --no-scripts --no-autoloader

COPY . .

RUN composer dump-autoload --optimize

EXPOSE 8000

CMD ["frankenphp", "run", "--config", "/etc/frankenphp/Caddyfile"]
