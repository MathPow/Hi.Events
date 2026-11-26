<?php

namespace Tests\Unit\Services\Application\Handlers\Mcp;

use HiEvents\Services\Application\Handlers\Mcp\McpMessageHandler;
use HiEvents\Services\Domain\Mcp\DTO\McpApiResponseDTO;
use HiEvents\Services\Domain\Mcp\McpApiProxy;
use HiEvents\Services\Domain\Mcp\McpInstructions;
use Mockery;
use Mockery\MockInterface;
use Tests\TestCase;

class McpMessageHandlerTest extends TestCase
{
    private McpApiProxy&MockInterface $proxy;

    private McpMessageHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->proxy = Mockery::mock(McpApiProxy::class);
        $this->handler = new McpMessageHandler($this->proxy, new McpInstructions());
    }

    private function send(string $method, array $params = [], int $id = 1): ?array
    {
        return $this->handler->handle(['jsonrpc' => '2.0', 'id' => $id, 'method' => $method, 'params' => $params], 'Bearer jwt', '1.2.3.4');
    }

    public function testInitializeEchoesASupportedVersionAndGivesInstructions(): void
    {
        $result = $this->send('initialize', ['protocolVersion' => '2025-06-18'])['result'];

        $this->assertSame('2025-06-18', $result['protocolVersion']);
        $this->assertSame('billetterie-dehors', $result['serverInfo']['name']);
        $this->assertArrayHasKey('tools', $result['capabilities']);
        $this->assertStringContainsString('## La billetterie', $result['instructions']);
    }

    public function testInitializeFallsBackToTheLatestVersion(): void
    {
        $result = $this->send('initialize', ['protocolVersion' => '1999-01-01'])['result'];

        $this->assertSame(McpMessageHandler::PROTOCOL_VERSIONS[0], $result['protocolVersion']);
    }

    public function testNotificationsGetNoAnswer(): void
    {
        $this->assertNull($this->handler->handle(['jsonrpc' => '2.0', 'method' => 'notifications/initialized'], 'Bearer jwt', null));
    }

    public function testUnknownMethodAndInvalidMessage(): void
    {
        $this->assertSame(-32601, $this->send('resources/list')['error']['code']);
        $this->assertSame(-32600, $this->handler->handle('nope', 'Bearer jwt', null)['error']['code']);
    }

    public function testToolsAreListed(): void
    {
        $names = array_column($this->send('tools/list')['result']['tools'], 'name');

        $this->assertSame(['lire_billetterie', 'modifier_billetterie', 'reference_api'], $names);
    }

    public function testReadGoesThroughTheApi(): void
    {
        $this->proxy->shouldReceive('call')
            ->once()
            ->with('GET', '/events?per_page=5', null, 'Bearer jwt', '1.2.3.4')
            ->andReturn(new McpApiResponseDTO(200, '{"data":[]}'));

        $result = $this->send('tools/call', ['name' => 'lire_billetterie', 'arguments' => ['chemin' => '/events?per_page=5']])['result'];

        $this->assertFalse($result['isError']);
        $this->assertSame('{"data":[]}', $result['content'][0]['text']);
    }

    public function testWriteSendsTheBodyAndReportsApiErrors(): void
    {
        $this->proxy->shouldReceive('call')
            ->once()
            ->with('PUT', '/events/12/status', ['status' => 'LIVE'], 'Bearer jwt', '1.2.3.4')
            ->andReturn(new McpApiResponseDTO(422, '{"message":"invalid"}'));

        $result = $this->send('tools/call', [
            'name' => 'modifier_billetterie',
            'arguments' => ['methode' => 'put', 'chemin' => '/events/12/status', 'corps' => ['status' => 'LIVE']],
        ])['result'];

        $this->assertTrue($result['isError']);
        $this->assertStringStartsWith('HTTP 422', $result['content'][0]['text']);
    }

    public function testBlockedPathsAndBadMethodsNeverReachTheApi(): void
    {
        $this->proxy->shouldNotReceive('call');

        foreach (['/api-tokens', '/admin/accounts', '/mcp', '/accounts/1/stripe/connect', 'events'] as $path) {
            $result = $this->send('tools/call', ['name' => 'lire_billetterie', 'arguments' => ['chemin' => $path]])['result'];
            $this->assertTrue($result['isError'], $path);
        }

        $result = $this->send('tools/call', ['name' => 'modifier_billetterie', 'arguments' => ['methode' => 'GET', 'chemin' => '/events']])['result'];
        $this->assertTrue($result['isError']);
    }

    public function testLongAnswersAreCut(): void
    {
        $this->proxy->shouldReceive('call')->andReturn(new McpApiResponseDTO(200, str_repeat('a', 70000)));

        $text = $this->send('tools/call', ['name' => 'lire_billetterie', 'arguments' => ['chemin' => '/events']])['result']['content'][0]['text'];

        $this->assertLessThan(61000, mb_strlen($text));
        $this->assertStringContainsString('Réponse coupée', $text);
    }

    public function testUnknownToolIsAnError(): void
    {
        $this->assertSame(-32602, $this->send('tools/call', ['name' => 'rien'])['error']['code']);
    }
}
