<?php

namespace HiEvents\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends ServiceProvider
{
    /**
     * The path to your application's "home" route.
     *
     * Typically, users are redirected here after authentication.
     *
     * @var string
     */
    public const HOME = '/home';

    /**
     * Define your route model bindings, pattern filters, and other route configuration.
     */
    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(config('app.api_rate_limit_per_minute'))
                ->by($request->user()?->id ?: $request->ip());
        });

        // Inscription et connexion: assez pour une personne qui se trompe, trop
        // peu pour un robot. Les courriels de compte (mot de passe oublie,
        // confirmation) sont limites par adresse, pour ne pas servir a bombarder
        // une boite de reception.
        RateLimiter::for('register', function (Request $request) {
            return Limit::perHour(10)->by($request->ip());
        });

        RateLimiter::for('login', function (Request $request) {
            return [
                Limit::perMinute(10)->by('email:' . strtolower((string)$request->input('email')) . '|' . $request->ip()),
                Limit::perMinute(30)->by('ip:' . $request->ip()),
            ];
        });

        RateLimiter::for('account-email', function (Request $request) {
            return [
                Limit::perHour(5)->by('account-email:' . ($request->user()?->id ?? strtolower((string)$request->input('email')))),
                Limit::perHour(20)->by('ip:' . $request->ip()),
            ];
        });

        RateLimiter::for('account-code', function (Request $request) {
            return Limit::perMinute(10)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('self-service-email', function (Request $request) {
            return Limit::perHour(20)->by($request->route('order_short_id') ?? $request->ip());
        });

        RateLimiter::for('self-service-edit', function (Request $request) {
            return Limit::perHour(20)->by($request->route('order_short_id') ?? $request->ip());
        });

        // The check-in endpoints are unauthenticated, so cap how fast anyone holding (or guessing)
        // a check-in link can hammer them. A busy door scans a few times a second at most.
        RateLimiter::for('check-in', function (Request $request) {
            return Limit::perMinute(120)
                ->by($request->route('check_in_list_short_id') . '|' . $request->ip());
        });

        $this->routes(function () {
            Route::middleware('api')
                ->group(base_path('routes/api.php'));

            Route::middleware('web')
                ->group(base_path('routes/web.php'));
        });
    }
}
