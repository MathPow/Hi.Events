<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\Models\EventSetting;
use HiEvents\Repository\Interfaces\EventSettingsRepositoryInterface;
use Illuminate\Support\Collection;

/**
 * @extends BaseRepository<EventSettingDomainObject>
 */
class EventSettingsRepository extends BaseRepository implements EventSettingsRepositoryInterface
{
    protected function getModel(): string
    {
        return EventSetting::class;
    }

    public function getDomainObject(): string
    {
        return EventSettingDomainObject::class;
    }

    public function findNotLocatedWith(string $fingerprintVersion, int $limit): Collection
    {
        $settings = $this->model
            ->whereExists(fn($query) => $query
                ->selectRaw('1')
                ->from('events')
                ->whereColumn('events.id', 'event_settings.event_id')
                ->whereNull('events.deleted_at'))
            ->where('is_online_event', false)
            ->where(fn($query) => $query
                ->whereNull('location_geocoded_for')
                ->orWhere('location_geocoded_for', 'not like', $fingerprintVersion . '%'))
            ->where(fn($query) => $query
                ->whereRaw("COALESCE(TRIM(location_details->>'address_line_1'), '') <> ''")
                ->orWhereRaw("COALESCE(TRIM(location_details->>'venue_name'), '') <> ''")
                ->orWhereRaw("COALESCE(TRIM(location_details->>'city'), '') <> ''")
                ->orWhereRaw("COALESCE(TRIM(location_details->>'zip_or_postal_code'), '') <> ''"))
            ->orderByDesc('id')
            ->limit($limit)
            ->get();

        $this->resetModel();

        return $this->handleResults($settings);
    }
}
