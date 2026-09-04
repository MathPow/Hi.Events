<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Order\Payment\Square;

use HiEvents\DomainObjects\AccountSquareCredentialDomainObject;
use HiEvents\DomainObjects\Generated\AccountSquareCredentialDomainObjectAbstract;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrderItemDomainObject;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Exceptions\ResourceConflictException;
use HiEvents\Exceptions\Square\CreateSquarePaymentFailedException;
use HiEvents\Exceptions\Square\SquareNotConnectedException;
use HiEvents\Exceptions\UnauthorizedException;
use HiEvents\Repository\Interfaces\AccountRepositoryInterface;
use HiEvents\Repository\Interfaces\AccountSquareCredentialRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Application\Handlers\Order\Payment\Square\DTO\CreateSquarePaymentDTO;
use HiEvents\Services\Domain\Payment\Square\SquareOrderCompletionService;
use HiEvents\Services\Domain\Payment\Square\SquarePaymentService;
use HiEvents\Services\Infrastructure\Session\CheckoutSessionManagementService;
use HiEvents\Services\Infrastructure\Square\SquareConfigurationService;
use Illuminate\Database\DatabaseManager;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;
use Throwable;

class CreateSquarePaymentHandler
{
    public function __construct(
        private readonly OrderRepositoryInterface                   $orderRepository,
        private readonly AccountRepositoryInterface                 $accountRepository,
        private readonly AccountSquareCredentialRepositoryInterface $credentialRepository,
        private readonly SquareConfigurationService                 $configurationService,
        private readonly SquarePaymentService                       $paymentService,
        private readonly SquareOrderCompletionService               $completionService,
        private readonly CheckoutSessionManagementService           $sessionIdentifierService,
        private readonly DatabaseManager                            $databaseManager,
    )
    {
    }

    /**
     * @throws CreateSquarePaymentFailedException
     * @throws SquareNotConnectedException
     * @throws ResourceConflictException
     * @throws UnauthorizedException
     * @throws Throwable
     */
    public function handle(CreateSquarePaymentDTO $data): OrderDomainObject
    {
        $order = $this->orderRepository
            ->loadRelation(OrderItemDomainObject::class)
            ->findByShortId($data->orderShortId);

        if (!$order || !$this->sessionIdentifierService->verifySession($order->getSessionId())) {
            throw new UnauthorizedException(
                __('Sorry, we could not verify your session. Please create a new order.')
            );
        }

        // Une commande deja completee ou expiree ne doit pas etre debitee: sans
        // ce garde, un double envoi du formulaire encaisserait deux fois.
        if ($order->getStatus() !== OrderStatus::RESERVED->name || $order->isReservedOrderExpired()) {
            throw new ResourceConflictException(
                __('This order is expired or is no longer awaiting payment.')
            );
        }

        $account = $this->accountRepository->findByEventId($order->getEventId());

        if ($account === null) {
            throw new ResourceNotFoundException(__('Account not found for this event'));
        }

        return $this->databaseManager->transaction(function () use ($data, $order, $account) {
            $this->paymentService->charge(
                order: $order,
                credential: $this->findCredential($account->getId()),
                sourceId: $data->sourceId,
                verificationToken: $data->verificationToken,
            );

            return $this->completionService->complete($order->getId());
        });
    }

    private function findCredential(int $accountId): ?AccountSquareCredentialDomainObject
    {
        $credential = $this->credentialRepository->findFirstWhere([
            AccountSquareCredentialDomainObjectAbstract::ACCOUNT_ID => $accountId,
            AccountSquareCredentialDomainObjectAbstract::ENVIRONMENT => $this->configurationService
                ->getEnvironment()->value,
        ]);

        return $credential?->isSetupComplete() === true ? $credential : null;
    }
}
