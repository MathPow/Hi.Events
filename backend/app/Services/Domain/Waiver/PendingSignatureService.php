<?php

namespace HiEvents\Services\Domain\Waiver;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\DocumentSignatureDomainObject;
use HiEvents\DomainObjects\Enums\DocumentSigningMode;
use HiEvents\DomainObjects\Enums\QuestionBelongsTo;
use HiEvents\DomainObjects\Enums\QuestionPresetKey;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\Generated\AttendeeDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\DocumentSignatureDomainObjectAbstract;
use HiEvents\DomainObjects\OrganizerDocumentDomainObject;
use HiEvents\Repository\Interfaces\AttendeeRepositoryInterface;
use HiEvents\Repository\Interfaces\DocumentSignatureRepositoryInterface;
use HiEvents\Repository\Interfaces\QuestionAnswerRepositoryInterface;
use HiEvents\Repository\Interfaces\QuestionRepositoryInterface;
use HiEvents\Services\Domain\Document\DocumentSigningService;
use HiEvents\Services\Domain\Waiver\DTO\PendingSignaturesDTO;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * What a participant still has to sign after checkout (the event's waiver, the
 * online documents' copies left unsigned), and their signature of it, from
 * their ticket's link or on the volunteer's device at the door.
 */
class PendingSignatureService
{
    private const NAME_MAX_LENGTH = 100;

    public function __construct(
        private readonly WaiverService                        $waiverService,
        private readonly DocumentSigningService               $documentSigningService,
        private readonly AttendeeRepositoryInterface          $attendeeRepository,
        private readonly DocumentSignatureRepositoryInterface $documentSignatureRepository,
        private readonly QuestionRepositoryInterface          $questionRepository,
        private readonly QuestionAnswerRepositoryInterface    $questionAnswerRepository,
    )
    {
    }

    public function pending(AttendeeDomainObject $attendee, EventDomainObject $event, ?EventSettingDomainObject $settings): PendingSignaturesDTO
    {
        $waiverText = $this->waiverText($settings);
        $documents = $this->pendingDocuments($attendee);

        return new PendingSignaturesDTO(
            waiver_text: $waiverText !== null && $attendee->getWaiverSignedAt() === null ? $waiverText : null,
            waiver_is_minor: $this->waiverService->isMinorOnEventDay($this->dateOfBirth($attendee), $event),
            documents: $documents->map(fn(DocumentSignatureDomainObject $copy) => [
                'id' => $copy->getId(),
                'title' => $copy->getTitle(),
                'blocks' => $copy->getBlocks(),
                'audience' => $copy->getAudience(),
                'auto_values' => $copy->getAutoValues() ?? [],
                'is_minor' => (bool)($copy->getAutoValues()['is_minor'] ?? false),
            ])->values()->all(),
        );
    }

    public function hasPending(AttendeeDomainObject $attendee, ?EventSettingDomainObject $settings): bool
    {
        return ($this->waiverText($settings) !== null && $attendee->getWaiverSignedAt() === null)
            || $this->pendingDocuments($attendee)->isNotEmpty();
    }

    /**
     * Records the participant's signature of everything still pending. Input:
     * waiver: {accepted, signed_name, guardian_name}, documents: {<copy id>: {accepted, answers}}.
     *
     * @throws ValidationException
     */
    public function sign(AttendeeDomainObject $attendee, EventDomainObject $event, ?EventSettingDomainObject $settings, array $input, ?string $ipAddress): void
    {
        $pending = $this->pending($attendee, $event, $settings);
        $waiver = is_array($input['waiver'] ?? null) ? $input['waiver'] : [];
        $documentEntries = is_array($input['documents'] ?? null) ? $input['documents'] : [];
        $copies = $this->pendingDocuments($attendee)->keyBy(fn(DocumentSignatureDomainObject $copy) => $copy->getId());
        $errors = [];

        if ($pending->waiver_text !== null) {
            $errors = [...$errors, ...$this->waiverErrors($waiver, $pending->waiver_is_minor)];
        }

        foreach ($copies as $copyId => $copy) {
            $isMinor = (bool)($copy->getAutoValues()['is_minor'] ?? false);
            foreach ($this->documentSigningService->errors($this->asDocument($copy), $documentEntries[$copyId] ?? [], $isMinor) as $key => $error) {
                $errors["documents.$copyId.$key"] = $error;
            }
        }

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        $now = now()->toDateTimeString();

        if ($pending->waiver_text !== null) {
            $guardianName = trim((string)($waiver['guardian_name'] ?? ''));
            $this->attendeeRepository->updateFromArray($attendee->getId(), [
                AttendeeDomainObjectAbstract::WAIVER_ID => $this->waiverService->currentVersion($event->getId(), $pending->waiver_text)->getId(),
                AttendeeDomainObjectAbstract::WAIVER_SIGNED_NAME => trim((string)($waiver['signed_name'] ?? '')),
                AttendeeDomainObjectAbstract::WAIVER_GUARDIAN_NAME => $pending->waiver_is_minor && $guardianName !== '' ? $guardianName : null,
                AttendeeDomainObjectAbstract::WAIVER_SIGNED_AT => $now,
                AttendeeDomainObjectAbstract::WAIVER_IP_ADDRESS => $ipAddress,
            ]);
        }

        foreach ($copies as $copyId => $copy) {
            $isMinor = (bool)($copy->getAutoValues()['is_minor'] ?? false);
            $signed = $this->documentSigningService->signedFields($this->asDocument($copy), $documentEntries[$copyId] ?? [], $isMinor);
            $this->documentSignatureRepository->updateFromArray($copyId, [
                ...$signed,
                DocumentSignatureDomainObjectAbstract::SIGNED_AT => $now,
                DocumentSignatureDomainObjectAbstract::IP_ADDRESS => $ipAddress,
            ]);
        }
    }

    private function waiverText(?EventSettingDomainObject $settings): ?string
    {
        $text = $settings?->getWaiverText();

        return trim(strip_tags((string)$text)) !== '' ? $text : null;
    }

    /**
     * @return Collection<int, DocumentSignatureDomainObject>
     */
    private function pendingDocuments(AttendeeDomainObject $attendee): Collection
    {
        // An example attendee (the email previews) has no copies.
        if ($attendee->getId() === 0) {
            return collect();
        }

        return $this->documentSignatureRepository->findWhere([
            DocumentSignatureDomainObjectAbstract::ATTENDEE_ID => $attendee->getId(),
            DocumentSignatureDomainObjectAbstract::SIGNING_MODE => DocumentSigningMode::ONLINE->value,
            [DocumentSignatureDomainObjectAbstract::SIGNED_AT, 'null', null],
        ]);
    }

    /**
     * A copy read as its document, for the signing checks.
     */
    private function asDocument(DocumentSignatureDomainObject $copy): OrganizerDocumentDomainObject
    {
        return (new OrganizerDocumentDomainObject())
            ->setId($copy->getOrganizerDocumentId())
            ->setTitle($copy->getTitle())
            ->setBlocks($copy->getBlocks())
            ->setAudience($copy->getAudience())
            ->setSigningMode($copy->getSigningMode());
    }

    /**
     * @return array<string, string>
     */
    private function waiverErrors(array $waiver, bool $isMinor): array
    {
        $errors = [];

        if (!filter_var($waiver['accepted'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $errors['waiver.accepted'] = __('Please accept the waiver.');
        }

        $nameError = $this->nameError($waiver['signed_name'] ?? null, __('Type your full name to sign the waiver.'));
        if ($nameError) {
            $errors['waiver.signed_name'] = $nameError;
        }

        if ($isMinor) {
            $guardianError = $this->nameError($waiver['guardian_name'] ?? null, __('A parent or guardian must sign for a participant under :age.', [
                'age' => WaiverService::ADULT_AGE,
            ]));
            if ($guardianError) {
                $errors['waiver.guardian_name'] = $guardianError;
            }
        }

        return $errors;
    }

    private function nameError(mixed $name, string $missingMessage): ?string
    {
        $name = is_scalar($name) ? trim((string)$name) : '';

        if ($name === '') {
            return $missingMessage;
        }

        if (mb_strlen($name) > self::NAME_MAX_LENGTH) {
            return __('The name must be :max characters or less.', ['max' => self::NAME_MAX_LENGTH]);
        }

        return null;
    }

    /**
     * The participant's date of birth, from the participant form's question.
     */
    private function dateOfBirth(AttendeeDomainObject $attendee): ?string
    {
        $question = $this->questionRepository->findFirstWhere([
            'event_id' => $attendee->getEventId(),
            'preset_key' => QuestionPresetKey::DATE_OF_BIRTH->value,
            'belongs_to' => QuestionBelongsTo::PRODUCT->name,
        ]);

        if (!$question) {
            return null;
        }

        $answer = $this->questionAnswerRepository->findFirstWhere([
            'question_id' => $question->getId(),
            'attendee_id' => $attendee->getId(),
        ])?->getAnswer();

        $answer = is_array($answer) ? ($answer['answer'] ?? ($answer[0] ?? null)) : $answer;

        return is_string($answer) ? $answer : null;
    }
}
