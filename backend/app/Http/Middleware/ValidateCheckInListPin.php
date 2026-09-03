<?php

namespace HiEvents\Http\Middleware;

use Closure;
use HiEvents\DomainObjects\Generated\CheckInListDomainObjectAbstract;
use HiEvents\Repository\Interfaces\CheckInListRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards the unauthenticated check-in endpoints with the list's optional door code.
 *
 * Without it, the short_id in the check-in URL is the only thing standing between a leaked link and
 * the full attendee list - or an undo of every check-in already recorded.
 */
class ValidateCheckInListPin
{
    public const PIN_HEADER = 'X-Check-In-Pin';

    public const PIN_REQUIRED_CODE = 'CHECK_IN_PIN_REQUIRED';

    public const PIN_INVALID_CODE = 'CHECK_IN_PIN_INVALID';

    public function __construct(
        private readonly CheckInListRepositoryInterface $checkInListRepository,
    )
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $shortId = $request->route('check_in_list_short_id');

        $checkInList = $this->checkInListRepository->findFirstWhere([
            CheckInListDomainObjectAbstract::SHORT_ID => $shortId,
        ]);

        if ($checkInList === null) {
            return new JsonResponse(
                ['message' => __('Check-in list not found')],
                Response::HTTP_NOT_FOUND,
            );
        }

        $pin = $checkInList->getPin();

        if ($pin === null || $pin === '') {
            return $next($request);
        }

        $providedPin = $request->header(self::PIN_HEADER);

        if (!is_string($providedPin) || $providedPin === '') {
            return new JsonResponse(
                [
                    'message' => __('This check-in list is protected by a PIN.'),
                    'code' => self::PIN_REQUIRED_CODE,
                ],
                Response::HTTP_UNAUTHORIZED,
            );
        }

        if (!hash_equals($pin, $providedPin)) {
            return new JsonResponse(
                [
                    'message' => __('That PIN is not correct.'),
                    'code' => self::PIN_INVALID_CODE,
                ],
                Response::HTTP_UNAUTHORIZED,
            );
        }

        return $next($request);
    }
}
