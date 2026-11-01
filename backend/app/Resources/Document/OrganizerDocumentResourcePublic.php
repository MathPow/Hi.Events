<?php

namespace HiEvents\Resources\Document;

use HiEvents\DomainObjects\OrganizerDocumentDomainObject;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * What the buyer reads and fills at checkout.
 *
 * @mixin OrganizerDocumentDomainObject
 */
class OrganizerDocumentResourcePublic extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->getId(),
            'title' => $this->getTitle(),
            'blocks' => $this->getBlocks(),
            'signing_mode' => $this->getSigningMode(),
            'audience' => $this->getAudience(),
        ];
    }
}
