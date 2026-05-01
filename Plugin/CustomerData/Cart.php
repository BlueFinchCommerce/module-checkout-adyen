<?php
declare(strict_types=1);

namespace BlueFinch\CheckoutAdyen\Plugin\CustomerData;

use BlueFinch\CheckoutAdyen\Plugin\CustomerData\AddAdyenExpressMethods;
use Adyen\ExpressCheckout\Plugin\CustomerData\Cart as Subject;

class Cart
{
    /**
     * If the Adyen Express has already added the payment methods then we can set use them without having
     * to call Adyen's API again.
     *
     * @param Subject $subject
     * @param array $result
     * @return array
     */
    public function afterAfterGetSectionData(
        Subject $subject,
        array $result
    ): array {
        if (isset($result[Subject::PAYMENT_METHODS_KEY])) {
            $result[AddAdyenExpressMethods::PAYMENT_METHODS_KEY] = $result[Subject::PAYMENT_METHODS_KEY];
        }

        return $result;
    }
}
