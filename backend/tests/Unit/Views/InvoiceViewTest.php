<?php

namespace Tests\Unit\Views;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\InvoiceDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\Status\InvoiceStatus;
use Illuminate\Support\Facades\View;
use Mockery as m;
use Tests\TestCase;

class InvoiceViewTest extends TestCase
{
    /**
     * La contribution n'est pas une ligne de commande: elle n'entre dans aucun sous-total
     * et n'apparait que dans le total. Sans sa propre ligne, l'acheteur lit un ecart
     * inexplique entre le sous-total et le montant debite.
     */
    public function testTheContributionGetsItsOwnLineBetweenTheSubtotalAndTheTotal(): void
    {
        $html = $this->render(platformContribution: 2.00, totalGross: 27.00);

        $this->assertStringContainsString('Support the platform', $html);
        $this->assertMatchesRegularExpression(
            '/Support the platform.*?2\.00.*?Total/s',
            preg_replace('/<[^>]+>/', ' ', $html)
        );
    }

    public function testNoLineIsShownWithoutAContribution(): void
    {
        $html = $this->render(platformContribution: 0.0, totalGross: 25.00);

        $this->assertStringNotContainsString('Support the platform', $html);
    }

    private function render(float $platformContribution, float $totalGross): string
    {
        $order = m::mock(OrderDomainObject::class);
        $order->shouldReceive('getPlatformContribution')->andReturn($platformContribution);
        $order->shouldReceive('getTotalGross')->andReturn($totalGross);
        $order->shouldReceive('getTotalBeforeAdditions')->andReturn(25.00);
        $order->shouldReceive('getTotalTax')->andReturn(0.0);
        $order->shouldReceive('getTotalFee')->andReturn(0.0);
        $order->shouldReceive('getHasTaxes')->andReturn(false);
        $order->shouldReceive('getHasFees')->andReturn(false);
        $order->shouldReceive('getTaxesAndFeesRollup')->andReturn(['taxes' => [], 'fees' => []]);
        $order->shouldReceive('getCurrency')->andReturn('CAD');
        $order->shouldReceive('getFullName')->andReturn('Jean Tremblay');
        $order->shouldReceive('getEmail')->andReturn('jean@example.com');
        $order->shouldReceive('getAddress')->andReturn(null);
        $order->shouldReceive('getBillingAddressString')->andReturn(null);

        $invoice = m::mock(InvoiceDomainObject::class);
        $invoice->shouldReceive('getStatus')->andReturn(InvoiceStatus::PAID->name);
        $invoice->shouldReceive('getInvoiceNumber')->andReturn('BB26-1');
        $invoice->shouldReceive('getIssueDate')->andReturn('2026-09-05');
        $invoice->shouldReceive('getDueDate')->andReturn(null);
        $invoice->shouldReceive('getItems')->andReturn([[
            'item_name' => 'Inscription',
            'quantity' => 1,
            'price' => 25.00,
            'price_before_discount' => null,
            'total_before_additions' => 25.00,
        ]]);

        $eventSettings = m::mock(EventSettingDomainObject::class);
        $eventSettings->shouldReceive('getInvoiceLabel')->andReturn(null);
        $eventSettings->shouldReceive('getInvoiceNotes')->andReturn(null);
        $eventSettings->shouldReceive('getInvoiceTaxDetails')->andReturn(null);
        $eventSettings->shouldReceive('getOrganizationName')->andReturn('Boreal');
        $eventSettings->shouldReceive('getOrganizationAddress')->andReturn(null);
        $eventSettings->shouldReceive('getSupportEmail')->andReturn('info@example.com');

        $event = m::mock(EventDomainObject::class);
        $event->shouldReceive('getTitle')->andReturn('Backyard Boreal 2026');

        return View::make('invoice', [
            'order' => $order,
            'event' => $event,
            'organizer' => m::mock(OrganizerDomainObject::class),
            'eventSettings' => $eventSettings,
            'invoice' => $invoice,
        ])->render();
    }
}
