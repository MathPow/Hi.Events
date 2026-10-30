<?php

namespace HiEvents\Services\Infrastructure\Geocoding\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class GeocodedLocationDTO extends BaseDataObject
{
    public function __construct(
        public float $latitude,
        public float $longitude,
    )
    {
    }
}
