<?php

namespace HiEvents\Services\Application\Handlers\Order\DTO;

use HiEvents\DataTransferObjects\Attributes\CollectionOf;
use HiEvents\DataTransferObjects\BaseDTO;
use Illuminate\Support\Collection;

class CompleteOrderProductDataDTO extends BaseDTO
{
    public function __construct(
        public readonly int         $product_price_id,
        #[CollectionOf(OrderQuestionsDTO::class)]
        public readonly ?Collection $questions = null,

        // Only relevant for products with product type 'TICKET'
        public readonly ?string     $first_name = null,
        public readonly ?string     $last_name = null,
        public readonly ?string     $email = null,
        // The event's waiver as this attendee signed it: accepted, signed_name, guardian_name.
        public readonly ?array      $waiver = null,
        // The organizer's online documents as this attendee signed them: [{document_id, accepted, answers}].
        public readonly ?array      $documents = null,
        // The date of birth asked with the documents when the participant form has none.
        public readonly ?string     $document_birth_date = null,
    )
    {
    }

    public function isTicketProduct(): bool
    {
        return $this->first_name !== null
            && $this->last_name !== null
            && $this->email !== null;
    }
}
