<?php

namespace HiEvents\Resources\Document;

use HiEvents\DomainObjects\DocumentSignatureDomainObject;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An attendee's copy of a document, for the organizer.
 *
 * @mixin DocumentSignatureDomainObject
 */
class DocumentSignatureResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->getId(),
            'organizer_document_id' => $this->getOrganizerDocumentId(),
            'attendee_id' => $this->getAttendeeId(),
            'title' => $this->getTitle(),
            'signing_mode' => $this->getSigningMode(),
            'signer_name' => $this->getSignerName(),
            'guardian_name' => $this->getGuardianName(),
            'signed_at' => $this->getSignedAt(),
            'created_at' => $this->getCreatedAt(),
        ];
    }
}
