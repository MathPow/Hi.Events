<?php

namespace HiEvents\Services\Domain\Document;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\Enums\QuestionBelongsTo;
use HiEvents\DomainObjects\Enums\QuestionPresetKey;
use HiEvents\DomainObjects\Generated\AttendeeDomainObjectAbstract;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\Repository\Interfaces\AttendeeRepositoryInterface;
use HiEvents\Repository\Interfaces\DocumentSignatureRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerDocumentRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use HiEvents\Repository\Interfaces\QuestionRepositoryInterface;
use HiEvents\Services\Application\Handlers\Order\DTO\CompleteOrderProductDataDTO;
use HiEvents\Services\Application\Handlers\Order\DTO\CreatedProductDataDTO;
use HiEvents\Services\Application\Handlers\Order\DTO\OrderQuestionsDTO;
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
     */
    public function createForOrder(OrderDomainObject $order, Collection $createdProducts, ?string $ipAddress): void
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
            );
        }
    }

    public function deleteForOrder(int $orderId): void
    {
        $this->documentSignatureRepository->deleteWhere(['order_id' => $orderId]);
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
