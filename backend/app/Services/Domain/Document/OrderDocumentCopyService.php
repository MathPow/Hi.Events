<?php

namespace HiEvents\Services\Domain\Document;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\DocumentSignatureDomainObject;
use HiEvents\DomainObjects\Enums\QuestionBelongsTo;
use HiEvents\DomainObjects\Enums\QuestionPresetKey;
use HiEvents\DomainObjects\Generated\AttendeeDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\DocumentSignatureDomainObjectAbstract;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrganizerDocumentDomainObject;
use HiEvents\Repository\Interfaces\AttendeeRepositoryInterface;
use HiEvents\Repository\Interfaces\DocumentSignatureRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerDocumentRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use HiEvents\Repository\Interfaces\QuestionRepositoryInterface;
use HiEvents\Services\Application\Handlers\Order\DTO\CompleteOrderProductDataDTO;
use HiEvents\Services\Application\Handlers\Order\DTO\CreatedProductDataDTO;
use HiEvents\Services\Application\Handlers\Order\DTO\OrderQuestionsDTO;
use Closure;
use Illuminate\Support\Collection;

/**
 * The attendees' copies of the organizer's documents, kept when an order's
 * details are completed (and replaced when the buyer goes back to edit them).
 */
class OrderDocumentCopyService
{
    public function __construct(
        private readonly OrganizerDocumentRepositoryInterface $documentRepository,
        private readonly DocumentSignatureRepositoryInterface $documentSignatureRepository,
        private readonly AttendeeRepositoryInterface          $attendeeRepository,
        private readonly EventRepositoryInterface             $eventRepository,
        private readonly OrganizerRepositoryInterface         $organizerRepository,
        private readonly QuestionRepositoryInterface          $questionRepository,
        private readonly DocumentSigningService               $signingService,
    )
    {
    }

    /**
     * @param Collection<int, CreatedProductDataDTO> $createdProducts The order's lines, with the short id of each ticket's attendee.
     * @param Closure|null $signsAtCheckout Given an attendee's email, whether they sign now (or later, from their ticket's link).
     */
    public function createForOrder(OrderDomainObject $order, Collection $createdProducts, ?string $ipAddress, ?Closure $signsAtCheckout = null): void
    {
        $documents = $this->documentRepository->findForEvent($order->getEventId());
        $tickets = $createdProducts->filter(fn(CreatedProductDataDTO $created) => $created->shortId !== null);

        if ($documents->isEmpty() || $tickets->isEmpty()) {
            return;
        }

        $event = $this->eventRepository->findById($order->getEventId());
        $organizerName = (string)$this->organizerRepository->findById($event->getOrganizerId())->getName();
        $dateOfBirthQuestionId = $this->questionRepository->findFirstWhere([
            'event_id' => $order->getEventId(),
            'preset_key' => QuestionPresetKey::DATE_OF_BIRTH->value,
            'belongs_to' => QuestionBelongsTo::PRODUCT->name,
        ])?->getId();

        $attendees = $this->attendeeRepository
            ->findWhereIn(AttendeeDomainObjectAbstract::SHORT_ID, $tickets->pluck('shortId')->all())
            ->keyBy(fn(AttendeeDomainObject $attendee) => $attendee->getShortId());

        foreach ($tickets as $created) {
            $attendee = $attendees->get($created->shortId);
            if (!$attendee) {
                continue;
            }

            /** @var CompleteOrderProductDataDTO $data */
            $data = $created->productRequestData;

            $this->signingService->createCopies(
                documents: $documents,
                attendee: $attendee,
                event: $event,
                organizerName: $organizerName,
                dateOfBirth: $this->dateOfBirth($data, $dateOfBirthQuestionId),
                entries: collect($data->documents ?? [])
                    ->filter(fn(mixed $entry) => is_array($entry) && isset($entry['document_id']))
                    ->keyBy(fn(array $entry) => (int)$entry['document_id'])
                    ->all(),
                ipAddress: $ipAddress,
                locale: $order->getLocale() ?: app()->getLocale(),
                signNow: $signsAtCheckout === null || $signsAtCheckout($attendee->getEmail()),
            );
        }
    }

    public function deleteForOrder(int $orderId): void
    {
        $this->documentSignatureRepository->deleteWhere(['order_id' => $orderId]);
    }

    public function deleteForAttendee(int $attendeeId): void
    {
        $this->documentSignatureRepository->deleteWhere([DocumentSignatureDomainObjectAbstract::ATTENDEE_ID => $attendeeId]);
    }

    /**
     * The copies of whoever holds the ticket now: the ones they have not signed are made again from
     * the event's documents, for their name and age, and wait for their own signature.
     */
    public function replaceUnsignedForAttendee(AttendeeDomainObject $attendee, ?string $dateOfBirth, string $locale): void
    {
        $this->documentSignatureRepository->deleteWhere([
            DocumentSignatureDomainObjectAbstract::ATTENDEE_ID => $attendee->getId(),
            [DocumentSignatureDomainObjectAbstract::SIGNED_AT, 'null', null],
        ]);

        $signedDocumentIds = $this->documentSignatureRepository
            ->findWhere([DocumentSignatureDomainObjectAbstract::ATTENDEE_ID => $attendee->getId()])
            ->map(fn(DocumentSignatureDomainObject $copy) => $copy->getOrganizerDocumentId())
            ->all();

        $documents = $this->documentRepository
            ->findForEvent($attendee->getEventId())
            ->reject(fn(OrganizerDocumentDomainObject $document) => in_array($document->getId(), $signedDocumentIds, true))
            ->values();

        if ($documents->isEmpty()) {
            return;
        }

        $event = $this->eventRepository->findById($attendee->getEventId());

        $this->signingService->createCopies(
            documents: $documents,
            attendee: $attendee,
            event: $event,
            organizerName: (string)$this->organizerRepository->findById($event->getOrganizerId())->getName(),
            dateOfBirth: $dateOfBirth,
            entries: [],
            ipAddress: null,
            locale: $locale,
            signNow: false,
        );
    }

    private function dateOfBirth(CompleteOrderProductDataDTO $data, ?int $dateOfBirthQuestionId): ?string
    {
        if ($dateOfBirthQuestionId === null) {
            return $data->document_birth_date;
        }

        /** @var OrderQuestionsDTO|null $question */
        $question = $data->questions?->first(
            fn(OrderQuestionsDTO $question) => (int)$question->question_id === $dateOfBirthQuestionId
        );
        $answer = $question ? ($question->response['answer'] ?? null) : null;

        return is_string($answer) ? $answer : null;
    }
}
