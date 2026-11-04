<?php

namespace Tests\Unit\Services\Domain\Assistant;

use HiEvents\Services\Domain\Assistant\AssistantRoutes;
use Tests\TestCase;

class AssistantRoutesTest extends TestCase
{
    public function testOrganizerRoutesAreAllowed(): void
    {
        $this->assertTrue(AssistantRoutes::isAllowed('/events'));
        $this->assertTrue(AssistantRoutes::isAllowed('/events/12/orders?per_page=50&filter_fields[status][eq]=COMPLETED'));
        $this->assertTrue(AssistantRoutes::isAllowed('/organizers/3/settings'));
        $this->assertTrue(AssistantRoutes::isAllowed('/users/me'));
    }

    public function testLoginTokensAdminAndPublicRoutesAreBlocked(): void
    {
        $this->assertFalse(AssistantRoutes::isAllowed('/auth/logout'));
        $this->assertFalse(AssistantRoutes::isAllowed('/api-tokens'));
        $this->assertFalse(AssistantRoutes::isAllowed('/admin/accounts'));
        $this->assertFalse(AssistantRoutes::isAllowed('/public/events/1'));
        $this->assertFalse(AssistantRoutes::isAllowed('/assistant'));
    }

    public function testOddPathsAreBlocked(): void
    {
        $this->assertFalse(AssistantRoutes::isAllowed('events'));
        $this->assertFalse(AssistantRoutes::isAllowed('//evil.example/events'));
        $this->assertFalse(AssistantRoutes::isAllowed('/events/../auth/logout'));
        $this->assertFalse(AssistantRoutes::isAllowed('/events\\..\\auth'));
        $this->assertTrue(AssistantRoutes::isAllowed('/authors'));
    }

    public function testEncodedPathsAreBlocked(): void
    {
        $this->assertFalse(AssistantRoutes::isAllowed('/%61dmin/accounts'));
        $this->assertFalse(AssistantRoutes::isAllowed('/events/12/%2e%2e/%2e%2e/admin'));
        $this->assertTrue(AssistantRoutes::isAllowed('/events/12/orders?query=caf%C3%A9'));
    }

    public function testOtherUsersAreBlockedButTheProfileCanBeRead(): void
    {
        $this->assertTrue(AssistantRoutes::isAllowed('/users/me', 'GET'));
        $this->assertTrue(AssistantRoutes::isAllowed('/users/me/', 'GET'));
        $this->assertFalse(AssistantRoutes::isAllowed('/users/me', 'PUT'));
        $this->assertFalse(AssistantRoutes::isAllowed('/users', 'GET'));
        $this->assertFalse(AssistantRoutes::isAllowed('/users', 'POST'));
        $this->assertFalse(AssistantRoutes::isAllowed('/users/7', 'PUT'));
        $this->assertFalse(AssistantRoutes::isAllowed('/users/7/invitation', 'DELETE'));
        $this->assertFalse(AssistantRoutes::isAllowed('/users/me/accounts', 'GET'));
    }

    public function testStripeConnectionsAreBlocked(): void
    {
        $this->assertFalse(AssistantRoutes::isAllowed('/accounts/3/stripe/connect', 'POST'));
        $this->assertFalse(AssistantRoutes::isAllowed('/organizers/5/stripe', 'DELETE'));
        $this->assertTrue(AssistantRoutes::isAllowed('/accounts/3/taxes-and-fees'));
    }
}
