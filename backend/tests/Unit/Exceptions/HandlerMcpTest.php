<?php

namespace Tests\Unit\Exceptions;

use HiEvents\Exceptions\Handler;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Tests\TestCase;

class HandlerMcpTest extends TestCase
{
    public function testTheMcpServerAnswersJsonWhenUnauthenticatedWithoutAnAcceptHeader(): void
    {
        $response = $this->app->make(Handler::class)->render(Request::create('/mcp', 'POST'), new AuthenticationException());

        $this->assertSame(401, $response->getStatusCode());
        $this->assertJson($response->getContent());
    }

    public function testOtherPagesStillRedirectToTheLogin(): void
    {
        $response = $this->app->make(Handler::class)->render(Request::create('/events', 'GET'), new AuthenticationException(redirectTo: '/auth/login'));

        $this->assertSame(302, $response->getStatusCode());
    }
}
