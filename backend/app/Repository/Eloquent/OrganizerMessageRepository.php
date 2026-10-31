<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\OrganizerMessageDomainObject;
use HiEvents\Models\OrganizerMessage;
use HiEvents\Repository\Interfaces\OrganizerMessageRepositoryInterface;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * @extends BaseRepository<OrganizerMessageDomainObject>
 */
class OrganizerMessageRepository extends BaseRepository implements OrganizerMessageRepositoryInterface
{
    protected function getModel(): string
    {
        return OrganizerMessage::class;
    }

    public function getDomainObject(): string
    {
        return OrganizerMessageDomainObject::class;
    }

    public function paginateForOrganizer(int $organizerId, int $perPage, int $page, bool $unreadOnly = false): LengthAwarePaginator
    {
        $this->model = $this->model
            ->where('organizer_id', $organizerId)
            ->when($unreadOnly, fn($query) => $query->whereNull('read_at'))
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        $results = $this->model->paginate(perPage: $perPage, page: $page);
        $this->resetModel();

        return $this->handleResults($results);
    }
}
