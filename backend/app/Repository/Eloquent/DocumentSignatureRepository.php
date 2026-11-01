<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\DocumentSignatureDomainObject;
use HiEvents\Models\DocumentSignature;
use HiEvents\Repository\Interfaces\DocumentSignatureRepositoryInterface;

/**
 * @extends BaseRepository<DocumentSignatureDomainObject>
 */
class DocumentSignatureRepository extends BaseRepository implements DocumentSignatureRepositoryInterface
{
    protected function getModel(): string
    {
        return DocumentSignature::class;
    }

    public function getDomainObject(): string
    {
        return DocumentSignatureDomainObject::class;
    }
}
