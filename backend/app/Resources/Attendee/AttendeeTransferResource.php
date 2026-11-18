<?php

namespace HiEvents\Resources\Attendee;

use HiEvents\DomainObjects\AttendeeTransferDomainObject;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin AttendeeTransferDomainObject
 */
class AttendeeTransferResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->getId(),
            'from_first_name' => $this->getFromFirstName(),
            'from_last_name' => $this->getFromLastName(),
            'from_email' => $this->getFromEmail(),
            'to_first_name' => $this->getToFirstName(),
            'to_last_name' => $this->getToLastName(),
            'to_email' => $this->getToEmail(),
            'created_at' => $this->getCreatedAt(),
        ];
    }
}
