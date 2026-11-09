<?php

namespace HiEvents\Services\Domain\Document;

use Carbon\CarbonImmutable;
use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\Enums\DocumentAudience;
use HiEvents\DomainObjects\Enums\DocumentSigningMode;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\Generated\DocumentSignatureDomainObjectAbstract;
use HiEvents\DomainObjects\OrganizerDocumentDomainObject;
use HiEvents\Repository\Interfaces\DocumentSignatureRepositoryInterface;
use HiEvents\Services\Domain\Waiver\WaiverService;

/**
 * The organizer's documents at checkout: which ones a participant fills, what
 * their answers must hold, and the copy kept for each of them.
 */
class DocumentSigningService
{
    public function __construct(
        private readonly WaiverService                        $waiverService,
        private readonly DocumentSignatureRepositoryInterface $documentSignatureRepository,
    )
    {
    }

    /**
     * Everyone fills a document for all; one « selon l'âge » only the participants under its age limit.
     */
    public function applies(OrganizerDocumentDomainObject $document, ?string $dateOfBirth, EventDomainObject $event): bool
    {
        $ageLimit = $document->ageLimit();

        return $ageLimit === null || $this->waiverService->isUnderAgeOnEventDay($dateOfBirth, $event, $ageLimit);
    }

    /**
     * A parent or guardian signs the documents for minors, and any document of a minor.
     */
    public function guardianSigns(string $audience, bool $isMinor): bool
    {
        return $audience === DocumentAudience::MINORS->value || $isMinor;
    }

    public function isMinor(?string $dateOfBirth, EventDomainObject $event): bool
    {
        return $this->waiverService->isMinorOnEventDay($dateOfBirth, $event);
    }

    /**
     * What is missing or wrong in a participant's signature of an online
     * document, by key relative to its entry (accepted, answers.<block id>).
     *
     * @return array<string, string>
     */
    public function errors(OrganizerDocumentDomainObject $document, mixed $entry, bool $isMinor): array
    {
        $entry = is_array($entry) ? $entry : [];
        $answers = is_array($entry['answers'] ?? null) ? $entry['answers'] : [];
        $blocks = $document->getBlocks();
        $errors = [];

        if (!filter_var($entry['accepted'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $errors['accepted'] = __('Please read and accept the document.');
        }

        foreach ($blocks as $block) {
            $answer = $answers[$block['id']] ?? null;

            if ($block['type'] === DocumentBlocks::FIELD) {
                $text = is_scalar($answer) ? trim((string)$answer) : '';
                if ($block['required'] && $text === '') {
                    $errors['answers.' . $block['id']] = __('This field is required.');
                } elseif (mb_strlen($text) > DocumentBlocks::ANSWER_MAX_LENGTH) {
                    $errors['answers.' . $block['id']] = __('The answer must be :max characters or less.', ['max' => DocumentBlocks::ANSWER_MAX_LENGTH]);
                }
            } elseif ($block['type'] === DocumentBlocks::CHECKBOX) {
                if ($block['required'] && !filter_var($answer ?? false, FILTER_VALIDATE_BOOLEAN)) {
                    $errors['answers.' . $block['id']] = __('Please check this box.');
                }
            } elseif ($block['type'] === DocumentBlocks::SIGNATURE) {
                if ($block['signer'] === DocumentBlocks::SIGNER_GUARDIAN && !$this->guardianSigns($document->getAudience(), $isMinor)) {
                    continue;
                }
                $error = $this->nameError($answer, $block['signer'] === DocumentBlocks::SIGNER_GUARDIAN);
                if ($error) {
                    $errors['answers.' . $block['id']] = $error;
                }
            }
        }

        if (DocumentBlocks::needsImplicitSignature($blocks, $this->guardianSigns($document->getAudience(), $isMinor))) {
            $error = $this->nameError($answers[DocumentBlocks::IMPLICIT_SIGNATURE] ?? null, false);
            if ($error) {
                $errors['answers.' . DocumentBlocks::IMPLICIT_SIGNATURE] = $error;
            }
        }

        return $errors;
    }

    /**
     * The automatic fields of a participant's copy.
     *
     * @return array<string, string>
     */
    public function autoValues(
        string            $participantName,
        ?string           $dateOfBirth,
        EventDomainObject $event,
        string            $organizerName,
        string            $locale,
    ): array
    {
        $born = $dateOfBirth && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateOfBirth)
            ? CarbonImmutable::createFromFormat('!Y-m-d', $dateOfBirth)
            : null;

        return [
            'participant_name' => trim($participantName),
            'date_of_birth' => $born ? $born->locale($locale)->isoFormat('LL') : '',
            'event_name' => (string)$event->getTitle(),
            'event_date' => CarbonImmutable::parse($event->getStartDate(), 'UTC')
                ->setTimezone($event->getTimezone() ?: 'UTC')
                ->locale($locale)
                ->isoFormat('LL'),
            'organizer_name' => $organizerName,
        ];
    }

    /**
     * Keeps the attendee's copy of each document that applies to them, as the
     * documents read now: online ones with their signature, the others to
     * print.
     *
     * @param iterable<OrganizerDocumentDomainObject> $documents
     * @param array<int, array> $entries The attendee's online signatures, by document id.
     */
    public function createCopies(
        iterable             $documents,
        AttendeeDomainObject $attendee,
        EventDomainObject    $event,
        string               $organizerName,
        ?string              $dateOfBirth,
        array                $entries,
        ?string              $ipAddress,
        string               $locale,
        // False: the online copies wait for the participant's own signature.
        bool                 $signNow = true,
    ): void
    {
        $isMinor = $this->isMinor($dateOfBirth, $event);
        $autoValues = $this->autoValues(
            trim($attendee->getFirstName() . ' ' . $attendee->getLastName()),
            $dateOfBirth,
            $event,
            $organizerName,
            $locale,
        );
        $now = now()->toDateTimeString();

        foreach ($documents as $document) {
            if (!$this->applies($document, $dateOfBirth, $event)) {
                continue;
            }

            $blocks = $document->getBlocks();
            $online = $document->getSigningMode() === DocumentSigningMode::ONLINE->value;
            $signed = $online && $signNow;
            $answers = $signed ? $this->answers($blocks, $entries[$document->getId()] ?? [], $this->guardianSigns($document->getAudience(), $isMinor)) : null;

            $this->documentSignatureRepository->create([
                DocumentSignatureDomainObjectAbstract::ORGANIZER_DOCUMENT_ID => $document->getId(),
                DocumentSignatureDomainObjectAbstract::EVENT_ID => $event->getId(),
                DocumentSignatureDomainObjectAbstract::ORDER_ID => $attendee->getOrderId(),
                DocumentSignatureDomainObjectAbstract::ATTENDEE_ID => $attendee->getId(),
                DocumentSignatureDomainObjectAbstract::TITLE => $document->getTitle(),
                DocumentSignatureDomainObjectAbstract::BLOCKS => $blocks,
                DocumentSignatureDomainObjectAbstract::SIGNING_MODE => $document->getSigningMode(),
                DocumentSignatureDomainObjectAbstract::AUDIENCE => $document->getAudience(),
                DocumentSignatureDomainObjectAbstract::ANSWERS => $answers,
                // Whether the participant was a minor stays with the copy: a parent signs it on paper too.
                DocumentSignatureDomainObjectAbstract::AUTO_VALUES => [...$autoValues, 'is_minor' => $isMinor],
                DocumentSignatureDomainObjectAbstract::SIGNER_NAME => $signed ? $this->signerName($blocks, $answers, DocumentBlocks::SIGNER_PARTICIPANT) : null,
                DocumentSignatureDomainObjectAbstract::GUARDIAN_NAME => $signed ? $this->signerName($blocks, $answers, DocumentBlocks::SIGNER_GUARDIAN) : null,
                DocumentSignatureDomainObjectAbstract::SIGNED_AT => $signed ? $now : null,
                DocumentSignatureDomainObjectAbstract::IP_ADDRESS => $signed ? $ipAddress : null,
            ]);
        }
    }

    /**
     * The columns of an online copy once its participant signs it: the answers
     * worth keeping and who signed.
     *
     * @return array<string, mixed>
     */
    public function signedFields(OrganizerDocumentDomainObject $document, mixed $entry, bool $isMinor): array
    {
        $blocks = $document->getBlocks();
        $answers = $this->answers($blocks, $entry, $this->guardianSigns($document->getAudience(), $isMinor));

        return [
            DocumentSignatureDomainObjectAbstract::ANSWERS => $answers,
            DocumentSignatureDomainObjectAbstract::SIGNER_NAME => $this->signerName($blocks, $answers, DocumentBlocks::SIGNER_PARTICIPANT),
            DocumentSignatureDomainObjectAbstract::GUARDIAN_NAME => $this->signerName($blocks, $answers, DocumentBlocks::SIGNER_GUARDIAN),
        ];
    }

    /**
     * The answers worth keeping: one per block that takes one.
     */
    private function answers(array $blocks, mixed $entry, bool $guardianSigns): array
    {
        $given = is_array($entry) && is_array($entry['answers'] ?? null) ? $entry['answers'] : [];
        $answers = [];

        foreach ($blocks as $block) {
            $answer = $given[$block['id']] ?? null;

            if ($block['type'] === DocumentBlocks::FIELD) {
                $answers[$block['id']] = mb_substr(is_scalar($answer) ? trim((string)$answer) : '', 0, DocumentBlocks::ANSWER_MAX_LENGTH);
            } elseif ($block['type'] === DocumentBlocks::CHECKBOX) {
                $answers[$block['id']] = filter_var($answer ?? false, FILTER_VALIDATE_BOOLEAN);
            } elseif ($block['type'] === DocumentBlocks::SIGNATURE
                && ($block['signer'] === DocumentBlocks::SIGNER_PARTICIPANT || $guardianSigns)) {
                $answers[$block['id']] = mb_substr(is_scalar($answer) ? trim((string)$answer) : '', 0, DocumentBlocks::NAME_MAX_LENGTH);
            }
        }

        if (DocumentBlocks::needsImplicitSignature($blocks, $guardianSigns)) {
            $answer = $given[DocumentBlocks::IMPLICIT_SIGNATURE] ?? null;
            $answers[DocumentBlocks::IMPLICIT_SIGNATURE] = mb_substr(is_scalar($answer) ? trim((string)$answer) : '', 0, DocumentBlocks::NAME_MAX_LENGTH);
        }

        return $answers;
    }

    private function signerName(array $blocks, array $answers, string $signer): ?string
    {
        foreach (DocumentBlocks::signatures($blocks, $signer) as $block) {
            if (($answers[$block['id']] ?? '') !== '') {
                return $answers[$block['id']];
            }
        }

        if ($signer === DocumentBlocks::SIGNER_PARTICIPANT && ($answers[DocumentBlocks::IMPLICIT_SIGNATURE] ?? '') !== '') {
            return $answers[DocumentBlocks::IMPLICIT_SIGNATURE];
        }

        return null;
    }

    private function nameError(mixed $name, bool $guardian): ?string
    {
        $name = is_scalar($name) ? trim((string)$name) : '';

        if ($name === '') {
            return $guardian
                ? __('A parent or guardian must sign with their full name.')
                : __('Type your full name to sign.');
        }

        if (mb_strlen($name) > DocumentBlocks::NAME_MAX_LENGTH) {
            return __('The name must be :max characters or less.', ['max' => DocumentBlocks::NAME_MAX_LENGTH]);
        }

        return null;
    }
}
