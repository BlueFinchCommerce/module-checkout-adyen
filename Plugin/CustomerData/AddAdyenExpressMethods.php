<?php
declare(strict_types=1);

namespace BlueFinch\CheckoutAdyen\Plugin\CustomerData;

use Adyen\Payment\Api\AdyenPaymentMethodManagementInterface;
use Magento\Checkout\CustomerData\Cart as Subject;
use Magento\Checkout\Model\Session;
use Magento\Framework\Module\Manager;

class AddAdyenExpressMethods
{
    public const PAYMENT_METHODS_KEY = 'bluefinch_adyen_payment_methods';

    /**
     * Cart constructor
     *
     * @param AdyenPaymentMethodManagementInterface $adyenPaymentMethodManagement
     * @param Session $checkoutSession
     * @param Manager $moduleManager
     */
    public function __construct(
        private readonly AdyenPaymentMethodManagementInterface $adyenPaymentMethodManagement,
        private readonly Session $checkoutSession,
        private readonly Manager $moduleManager
    ) {
    }

    /**
     * Intercept getSectionData and Adyen Payment methods.
     *
     * @param Subject $subject
     * @param array $result
     * @return array
     */
    public function afterGetSectionData(
        Subject $subject,
        array $result
    ): array {

        // Only run if no Adyen Express methods are enabled otherwise we'd be duplicating the Adyen API request.
        if (!$this->moduleManager->isEnabled('Adyen_ExpressCheckout')) {
            $quoteId = (string) $this->checkoutSession->getQuoteId();
            $paymentMethods = $quoteId ?
                json_decode(
                    $this->adyenPaymentMethodManagement->getPaymentMethods($quoteId),
                    true
                ) : [];
            $result[self::PAYMENT_METHODS_KEY] = $paymentMethods;
        }

        return $result;
    }
}
