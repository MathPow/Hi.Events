<?php

namespace HiEvents\Services\Application\Handlers\Question;

use HiEvents\DomainObjects\Enums\ProductType;
use HiEvents\DomainObjects\Enums\QuestionBelongsTo;
use HiEvents\DomainObjects\Enums\QuestionPresetKey;
use HiEvents\DomainObjects\Enums\QuestionTypeEnum;
use HiEvents\DomainObjects\Generated\ProductDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\QuestionDomainObjectAbstract;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\QuestionDomainObject;
use HiEvents\Exceptions\NoTicketProductsException;
use HiEvents\Repository\Interfaces\ProductRepositoryInterface;
use HiEvents\Repository\Interfaces\QuestionRepositoryInterface;
use HiEvents\Services\Domain\Question\CreateQuestionService;
use HiEvents\Services\Domain\Question\SensitiveAnswerPurgeService;
use Illuminate\Support\Collection;
use Throwable;

/**
 * The participant form of sports and outdoor events, added in one click: date
 * of birth, emergency contact and health, asked of every ticket's attendee.
 * The answers are sensitive: only the organizers see them, and they are
 * erased after the event (SensitiveAnswerPurgeService). A question already
 * added is left as the organizer made it.
 */
class AddParticipantFormHandler
{
    public function __construct(
        private readonly QuestionRepositoryInterface $questionRepository,
        private readonly ProductRepositoryInterface  $productRepository,
        private readonly CreateQuestionService       $createQuestionService,
    )
    {
    }

    /**
     * @return Collection<int, QuestionDomainObject> The questions it added.
     * @throws NoTicketProductsException
     * @throws Throwable
     */
    public function handle(int $eventId): Collection
    {
        $productIds = $this->productRepository
            ->findWhere([
                ProductDomainObjectAbstract::EVENT_ID => $eventId,
                ProductDomainObjectAbstract::PRODUCT_TYPE => ProductType::TICKET->name,
            ])
            ->map(fn(ProductDomainObject $product) => $product->getId())
            ->all();

        if ($productIds === []) {
            throw new NoTicketProductsException(__('Add a ticket before adding the participant form.'));
        }

        $existingKeys = $this->questionRepository
            ->findWhereIn(
                QuestionDomainObjectAbstract::PRESET_KEY,
                QuestionPresetKey::valuesArray(),
                [QuestionDomainObjectAbstract::EVENT_ID => $eventId],
            )
            ->map(fn(QuestionDomainObject $question) => $question->getPresetKey());

        return collect($this->presets())
            ->reject(fn(QuestionDomainObject $question) => $existingKeys->contains($question->getPresetKey()))
            ->map(fn(QuestionDomainObject $question) => $this->createQuestionService->createQuestion(
                $question->setEventId($eventId),
                $productIds,
            ))
            ->values();
    }

    /**
     * @return QuestionDomainObject[]
     */
    private function presets(): array
    {
        $privacy = __('Only the organizers see this answer. It is erased :days days after the event.', [
            'days' => SensitiveAnswerPurgeService::RETENTION_DAYS,
        ]);

        return [
            $this->preset(QuestionPresetKey::DATE_OF_BIRTH, __('Date of birth'), QuestionTypeEnum::DATE, true, $privacy),
            $this->preset(QuestionPresetKey::EMERGENCY_CONTACT_NAME, __('Emergency contact name'), QuestionTypeEnum::SINGLE_LINE_TEXT, true),
            $this->preset(QuestionPresetKey::EMERGENCY_CONTACT_PHONE, __('Emergency contact phone'), QuestionTypeEnum::SINGLE_LINE_TEXT, true),
            $this->preset(QuestionPresetKey::HEALTH_NOTES, __('Allergies or health conditions we should know about'), QuestionTypeEnum::MULTI_LINE_TEXT, false, $privacy),
        ];
    }

    private function preset(
        QuestionPresetKey $key,
        string            $title,
        QuestionTypeEnum  $type,
        bool              $required,
        ?string           $description = null,
    ): QuestionDomainObject
    {
        return (new QuestionDomainObject())
            ->setPresetKey($key->value)
            ->setTitle($title)
            ->setType($type->name)
            ->setRequired($required)
            ->setBelongsTo(QuestionBelongsTo::PRODUCT->name)
            ->setIsHidden(false)
            ->setIsSensitive(true)
            ->setDescription($description);
    }
}
