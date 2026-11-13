<?php

namespace HiEvents\DomainObjects;

use HiEvents\Helper\Url;

class EventRouteFileDomainObject extends Generated\EventRouteFileDomainObjectAbstract
{
    public function getDownloadUrl(): string
    {
        return sprintf(
            Url::getFrontEndUrlFromConfig(Url::EVENT_ROUTE_FILE_DOWNLOAD),
            $this->getEventId(),
            $this->getId(),
        );
    }
}
