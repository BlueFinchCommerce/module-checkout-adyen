<?php
declare(strict_types=1);

namespace BlueFinch\CheckoutAdyen\Plugin\CustomerData;

use Adyen\Payment\Api\AdyenPaymentMethodManagementInterface;
use Magento\Checkout\CustomerData\Cart as Subject;
use Magento\Checkout\Model\Session;
use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Store\Model\ScopeInterface;

class AddAdyenExpressMethods
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
     * @var ScopeConfigInterface
     */
    private $scopeConfig;

    /**
     * Cart constructor
     *
     * @param AdyenPaymentMethodManagementInterface $adyenPaymentMethodManagement
     * @param Session $checkoutSession
     * @param ScopeConfigInterface $scopeConfig
     */
    public function __construct(
        AdyenPaymentMethodManagementInterface $adyenPaymentMethodManagement,
        Session $checkoutSession,
        ScopeConfigInterface $scopeConfig
    ) {
        $this->adyenPaymentMethodManagement = $adyenPaymentMethodManagement;
        $this->checkoutSession = $checkoutSession;
        $this->scopeConfig = $scopeConfig;
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
        $googlePayExpressEnabled = $this->scopeConfig->getValue('payment/adyen_googlepay/express_show_on', ScopeInterface::SCOPE_STORE);
        $applePayExpressEnabled = $this->scopeConfig->getValue('payment/adyen_applepay/express_show_on', ScopeInterface::SCOPE_STORE);
        $payPalExpressEnabled = $this->scopeConfig->getValue('payment/adyen_paypal_express/express_show_on', ScopeInterface::SCOPE_STORE);

        // Only run if no Adyen Express methods are enabled otherwise we'd be duplicating the Adyen API request.
        if (!$googlePayExpressEnabled && !$applePayExpressEnabled && !$payPalExpressEnabled) {
            $quoteId = $this->checkoutSession->getQuoteId();
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
