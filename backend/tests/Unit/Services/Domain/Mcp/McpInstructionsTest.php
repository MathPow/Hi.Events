<?php

namespace Tests\Unit\Services\Domain\Mcp;

use HiEvents\Services\Domain\Mcp\McpInstructions;
use Tests\TestCase;

class McpInstructionsTest extends TestCase
{
    public function testReferenceFilterKeepsOnlyMatchingRoutesWithTheirFields(): void
    {
        $reference = (new McpInstructions())->reference('/promo-codes');
        $routes = array_filter(explode("\n", $reference), fn($line) => preg_match('/^(GET|POST|PUT|PATCH|DELETE) /', $line));

        $this->assertNotEmpty($routes);
        foreach ($routes as $route) {
            $this->assertStringContainsString('/promo-codes', $route);
        }
        $this->assertMatchesRegularExpression('/^  \w+:/m', $reference);
    }

    public function testWithoutFilterTheWholeReferenceComesBack(): void
    {
        $this->assertStringContainsString('GET /events', (new McpInstructions())->reference());
        $this->assertSame('', (new McpInstructions())->reference('/nothing-like-this'));
    }
}
