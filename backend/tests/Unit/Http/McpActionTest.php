<?php

namespace Tests\Unit\Http;

use Tests\TestCase;

class McpActionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config(['jwt.secret' => str_repeat('s', 64)]);
    }

    public function testTheHandshakeAndToolListAnswerWithoutAToken(): void
    {
        $this->call('POST', '/mcp', [], [], [], ['CONTENT_TYPE' => 'application/json'], json_encode([
            'jsonrpc' => '2.0', 'id' => 1, 'method' => 'initialize',
            'params' => ['protocolVersion' => '2025-06-18', 'capabilities' => new \stdClass(), 'clientInfo' => ['name' => 't', 'version' => '1']],
        ]))->assertOk()->assertJsonPath('result.serverInfo.name', 'billetterie-dehors');

        $this->call('POST', '/mcp', [], [], [], ['CONTENT_TYPE' => 'application/json'], json_encode([
            'jsonrpc' => '2.0', 'id' => 2, 'method' => 'tools/list',
        ]))->assertOk()->assertJsonCount(3, 'result.tools');
    }

    public function testToolCallsNeedAToken(): void
    {
        $this->call('POST', '/mcp', [], [], [], ['CONTENT_TYPE' => 'application/json'], json_encode([
            'jsonrpc' => '2.0', 'id' => 3, 'method' => 'tools/call',
            'params' => ['name' => 'lire_billetterie', 'arguments' => ['chemin' => '/events']],
        ]))->assertUnauthorized()->assertHeader('WWW-Authenticate');
    }

    public function testGetIsNotAStream(): void
    {
        $this->get('/mcp')->assertStatus(405);
    }
}
