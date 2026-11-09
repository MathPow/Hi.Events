<?php

namespace HiEvents\Validators\Rules;

use Closure;
use HiEvents\DomainObjects\Enums\DocumentSigningMode;
use HiEvents\DomainObjects\Enums\ProductType;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrganizerDocumentDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\Services\Domain\Document\DocumentBlocks;
use HiEvents\Services\Domain\Document\DocumentSigningService;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\ValidatorAwareRule;
use Illuminate\Support\Collection;
use Illuminate\Validation\Validator;

/**
 * Every ticket's attendee signs the event's online documents that apply to
 * them (those for minors only when they are one), each in its own entry of
 * products.N.documents: {document_id, accepted, answers: {<block id>: …}}.
 * Without a date of birth question on the participant form, documents that
 * need the date take it from products.N.document_birth_date. The errors land
 * on each attendee's own fields.
 */
class ProductDocumentsRule implements ValidationRule, ValidatorAwareRule
{
    private Validator $validator;

    /**
     * @param Collection<int, OrganizerDocumentDomainObject> $documents The documents linked to the event.
     * @param Collection<int, ProductDomainObject> $products
     */
    public function __construct(
        private readonly Collection             $documents,
        private readonly Collection             $products,
        private readonly EventDomainObject      $event,
        private readonly ?int                   $dateOfBirthQuestionId,
        private readonly DocumentSigningService $signingService,
        // Whether this attendee signs at checkout (or later, from their ticket's link).
        private readonly ?Closure               $signsAtCheckout = null,
    )
    {
    }

    public function setValidator(Validator $validator): static
    {
        $this->validator = $validator;

        return $this;
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $messages = [];

        foreach ((array)$value as $index => $attendee) {
            if (!is_array($attendee) || !$this->isTicket($attendee['product_id'] ?? null)) {
                continue;
            }

            $dateOfBirth = self::dateOfBirth($attendee, $this->dateOfBirthQuestionId);

            if ($this->dateOfBirthQuestionId === null && $this->needsBirthDate()) {
                $error = $this->birthDateError($dateOfBirth);
                if ($error) {
                    $messages["products.$index.document_birth_date"][] = $error;
                    continue;
                }
            }

            // Signed later by the participant: only the date of birth (which documents apply) is needed now.
            if ($this->signsAtCheckout && !($this->signsAtCheckout)($attendee)) {
                continue;
            }

            $isMinor = $this->signingService->isMinor($dateOfBirth, $this->event);
            $entries = is_array($attendee['documents'] ?? null) ? array_values($attendee['documents']) : [];

            foreach ($this->onlineDocuments() as $document) {
                if (!$this->signingService->applies($document, $dateOfBirth, $this->event)) {
                    continue;
                }

                $position = $this->entryPosition($entries, $document->getId());
                if ($position === null) {
                    $messages["products.$index.documents"][] = __('Please sign « :title ».', ['title' => $document->getTitle()]);
                    continue;
                }

                foreach ($this->signingService->errors($document, $entries[$position], $isMinor) as $key => $error) {
                    $messages["products.$index.documents.$position.$key"][] = $error;
                }
            }
        }

        if ($messages) {
            $this->validator->messages()->merge($messages);
        }
    }

    /**
     * The attendee's date of birth: the participant form's answer, or the one
     * asked with the documents.
     */
    public static function dateOfBirth(array $attendee, ?int $dateOfBirthQuestionId): ?string
    {
        if ($dateOfBirthQuestionId !== null) {
            foreach ($attendee['questions'] ?? [] as $question) {
                if ((int)($question['question_id'] ?? 0) === $dateOfBirthQuestionId) {
                    $response = $question['response'] ?? null;
                    $answer = is_array($response) ? ($response['answer'] ?? null) : $response;

                    return is_string($answer) ? $answer : null;
                }
            }

            return null;
        }

        $date = $attendee['document_birth_date'] ?? null;

        return is_string($date) ? $date : null;
    }

    private function needsBirthDate(): bool
    {
        return $this->documents->contains(
            fn(OrganizerDocumentDomainObject $document) => DocumentBlocks::needsBirthDate($document->getBlocks(), $document->getAudience())
        );
    }

    private function birthDateError(?string $date): ?string
    {
        if ($date === null || trim($date) === '') {
            return __('Please enter the date of birth of the participant.');
        }

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !checkdate((int)substr($date, 5, 2), (int)substr($date, 8, 2), (int)substr($date, 0, 4))
            || $date > now()->toDateString() || $date < '1900-01-01') {
            return __('Please enter a valid date of birth.');
        }

        return null;
    }

    /**
     * @return Collection<int, OrganizerDocumentDomainObject>
     */
    private function onlineDocuments(): Collection
    {
        return $this->documents->filter(
            fn(OrganizerDocumentDomainObject $document) => $document->getSigningMode() === DocumentSigningMode::ONLINE->value
        );
    }

    private function entryPosition(array $entries, int $documentId): ?int
    {
        foreach ($entries as $position => $entry) {
            if (is_array($entry) && (int)($entry['document_id'] ?? 0) === $documentId) {
                return $position;
            }
        }

        return null;
    }

    private function isTicket(mixed $productId): bool
    {
        return $this->products->contains(
            fn(ProductDomainObject $product) => $product->getId() === (int)$productId
                && $product->getProductType() === ProductType::TICKET->name
        );
    }
}
