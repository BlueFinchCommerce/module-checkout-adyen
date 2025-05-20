<?php
declare(strict_types=1);

namespace BlueFinch\CheckoutAdyen\Plugin\CustomerData;

use Adyen\Payment\Api\AdyenPaymentMethodManagementInterface;
use Magento\Checkout\CustomerData\Cart as Subject;
use Magento\Checkout\Model\Session;

class Cart
{
    public const PAYMENT_METHODS_KEY = 'bluefinch_adyen_payment_methods';

    /**
     * @var AdyenPaymentMethodManagementInterface
     */
    private $adyenPaymentMethodManagement;

    /**
     * @var Session
     */
    private $checkoutSession;

    /**
     * Cart constructor
     *
     * @param AdyenPaymentMethodManagementInterface $adyenPaymentMethodManagement
     * @param Session $checkoutSession
     */
    public function __construct(
        AdyenPaymentMethodManagementInterface $adyenPaymentMethodManagement,
        Session $checkoutSession
    ) {
        $this->adyenPaymentMethodManagement = $adyenPaymentMethodManagement;
        $this->checkoutSession = $checkoutSession;
    }

    /**
     * Intercept getSectionData and add is_minicart identifier
     *
     * @param Subject $subject
     * @param array $result
     * @return array
     */
    public function afterGetSectionData(
        Subject $subject,
        array $result
    ): array {
        $quoteId = $this->checkoutSession->getQuoteId();
        $paymentMethods = $quoteId ?
            json_decode(
                $this->adyenPaymentMethodManagement->getPaymentMethods($quoteId),
                true
            ) : [];
        $result[self::PAYMENT_METHODS_KEY] = $paymentMethods;
        return $result;
    }
}
