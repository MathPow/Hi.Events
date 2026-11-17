<?php

declare(strict_types=1);

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\Models\Account;
use HiEvents\Repository\Interfaces\AccountRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * @extends BaseRepository<AccountDomainObject>
 */
class AccountRepository extends BaseRepository implements AccountRepositoryInterface
{
    protected function getModel(): string
    {
        return Account::class;
    }

    public function getDomainObject(): string
    {
        return AccountDomainObject::class;
    }

    public function findByEventId(int $eventId): AccountDomainObject
    {
        $account = $this
            ->model
            ->select('accounts.*')
            ->join('events', 'accounts.id', '=', 'events.account_id')
            ->where('events.id', $eventId)
            ->first();

        $this->resetModel();

        return $this->handleSingleResult($account, AccountDomainObject::class);
    }

    public function getAllAccountsWithCounts(?string $search, int $perPage): LengthAwarePaginator
    {
        $query = $this->model
            ->select('accounts.*')
            ->withCount(['events', 'users'])
            ->with([
                'users' => function ($query) {
                    $query->select('users.id', 'users.first_name', 'users.last_name', 'users.email')
                        ->withPivot('role');
                },
                'messagingTier',
            ]);

        // Chaque mot cherche doit se trouver quelque part : le compte, ses personnes (nom, prenom,
        // courriel), ses organisateurs ou ses evenements. « #12 » ou « 12 » trouve aussi le compte 12.
        $terms = preg_split('/\s+/', trim((string)$search), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        foreach ($terms as $term) {
            $like = '%' . addcslashes($term, '%_\\') . '%';
            $id = ctype_digit(ltrim($term, '#')) ? (int)ltrim($term, '#') : null;

            $query->where(function ($q) use ($like, $id) {
                $q->where('accounts.name', 'ilike', $like)
                    ->orWhere('accounts.email', 'ilike', $like)
                    ->orWhereHas('users', function ($users) use ($like) {
                        $users->where(function ($user) use ($like) {
                            $user->where('users.email', 'ilike', $like)
                                ->orWhere('users.first_name', 'ilike', $like)
                                ->orWhere('users.last_name', 'ilike', $like);
                        });
                    })
                    ->orWhereExists(function ($organizers) use ($like) {
                        $organizers->selectRaw('1')->from('organizers')
                            ->whereColumn('organizers.account_id', 'accounts.id')
                            ->whereNull('organizers.deleted_at')
                            ->where(function ($organizer) use ($like) {
                                $organizer->where('organizers.name', 'ilike', $like)
                                    ->orWhere('organizers.email', 'ilike', $like);
                            });
                    })
                    ->orWhereExists(function ($events) use ($like) {
                        $events->selectRaw('1')->from('events')
                            ->whereColumn('events.account_id', 'accounts.id')
                            ->whereNull('events.deleted_at')
                            ->where('events.title', 'ilike', $like);
                    });

                if ($id !== null) {
                    $q->orWhere('accounts.id', $id);
                }
            });
        }

        return $query->orderBy('created_at', 'desc')->paginate($perPage);
    }

    public function getAccountWithDetails(int $accountId): Account
    {
        return $this->model
            ->withCount(['events', 'users'])
            ->with([
                'configuration',
                'account_vat_setting',
                'messagingTier',
                'users' => function ($query) {
                    $query->select('users.id', 'users.first_name', 'users.last_name', 'users.email')
                        ->withPivot('role');
                }
            ])
            ->findOrFail($accountId);
    }
}
