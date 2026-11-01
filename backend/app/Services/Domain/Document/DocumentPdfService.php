<?php

namespace HiEvents\Services\Domain\Document;

use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;
use HiEvents\DomainObjects\DocumentSignatureDomainObject;
use HiEvents\DomainObjects\Enums\DocumentSigningMode;
use HiEvents\DomainObjects\OrganizerDocumentDomainObject;
use Illuminate\Support\Str;

/**
 * The PDF of an organizer's document: blank (the organizer's preview and
 * export), or an attendee's copy, filled and signed or ready to print.
 */
class DocumentPdfService
{
    public function __construct(
        private readonly DocumentRenderer $renderer,
    )
    {
    }

    public function blank(OrganizerDocumentDomainObject $document, string $organizerName): string
    {
        return $this->pdf(
            title: $document->getTitle(),
            organizerName: $organizerName,
            body: $this->renderer->render($document->getBlocks(), new DocumentRenderContext()),
            footer: [],
        );
    }

    public function copy(DocumentSignatureDomainObject $copy, ?string $timezone = null): string
    {
        $autoValues = $copy->getAutoValues() ?? [];
        $signed = $copy->getSigningMode() === DocumentSigningMode::ONLINE->value && $copy->getSignedAt() !== null;
        $signedAt = $signed
            ? CarbonImmutable::parse($copy->getSignedAt(), 'UTC')->setTimezone($timezone ?: 'UTC')->locale(app()->getLocale())
            : null;

        $context = new DocumentRenderContext(
            autoValues: $autoValues,
            answers: $signed ? ($copy->getAnswers() ?? []) : null,
            showGuardian: $signed
                ? $copy->getGuardianName() !== null
                // On paper, the parent signs when the document is for minors or the participant is one.
                : ($copy->getAudience() === 'MINORS' || $this->hasGuardianAnswerSlot($copy)),
            signedOn: $signedAt?->isoFormat('LL'),
        );

        $footer = $signed
            ? [
                __('Signed online by :name on :date at :time.', [
                    'name' => collect([$copy->getSignerName(), $copy->getGuardianName()])->filter()->implode(', '),
                    'date' => $signedAt->isoFormat('LL'),
                    'time' => $signedAt->format('H:i'),
                ]),
                __('IP address: :ip · Copy no. :id', ['ip' => $copy->getIpAddress() ?: '—', 'id' => $copy->getId()]),
            ]
            : [__('Print this document, sign it and bring it to the event.')];

        return $this->pdf(
            title: $copy->getTitle(),
            organizerName: (string)($autoValues['organizer_name'] ?? ''),
            body: $this->renderer->render($copy->getBlocks(), $context),
            footer: $footer,
        );
    }

    public function filename(string $title, ?string $participantName = null): string
    {
        $name = trim(Str::slug($title) . '-' . Str::slug((string)$participantName), '-');

        return ($name !== '' ? $name : 'document') . '.pdf';
    }

    /**
     * Whether the participant was a minor on the event's day, as noted on their copy.
     */
    private function hasGuardianAnswerSlot(DocumentSignatureDomainObject $copy): bool
    {
        return ($copy->getAutoValues()['is_minor'] ?? false) === true;
    }

    private function pdf(string $title, string $organizerName, string $body, array $footer): string
    {
        // Seulement les lettres utilisees des polices: ~30 Ko au lieu de ~1 Mo par document joint.
        return Pdf::setOption('enable_font_subsetting', true)
            ->loadView('documents.pdf', [
                'title' => $title,
                'organizerName' => $organizerName,
                'body' => $body,
                'footer' => $footer,
            ])
            ->output();
    }
}
