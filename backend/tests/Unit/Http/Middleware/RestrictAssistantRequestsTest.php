<?php

namespace Tests\Unit\Http\Middleware;

use HiEvents\Http\Middleware\RestrictAssistantRequests;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class RestrictAssistantRequestsTest extends TestCase
{
    private function handle(string $method, string $uri, bool $fromAssistant = true): Response
    {
        $request = Request::create($uri, $method);
        if ($fromAssistant) {
            $request->headers->set('X-Dehors-Assistant', '1');
        }

        return (new RestrictAssistantRequests)->handle($request, fn () => new Response('ok'));
    }

    public function test_assistant_can_reach_organizer_routes(): void
    {
        $this->assertSame('ok', $this->handle('GET', '/events/12/orders')->getContent());
        $this->assertSame('ok', $this->handle('GET', '/users/me')->getContent());
    }

    public function test_requests_without_the_header_are_left_alone(): void
    {
        $this->assertSame('ok', $this->handle('GET', '/admin/accounts', false)->getContent());
    }

    public function test_assistant_is_refused_admin_and_users(): void
    {
        foreach ([['GET', '/admin/accounts'], ['POST', '/admin/impersonate/4'], ['PUT', '/users/7'], ['PUT', '/users/me']] as [$method, $uri]) {
            try {
                $this->handle($method, $uri);
                $this->fail("$method $uri should be refused");
            } catch (HttpException $exception) {
                $this->assertSame(403, $exception->getStatusCode());
            }
        }
    }

    public function test_an_encoded_path_is_decoded_before_the_check(): void
    {
        $this->expectException(HttpException::class);
        $this->handle('GET', '/%61dmin/accounts');
    }
}
